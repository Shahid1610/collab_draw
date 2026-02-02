/**
 * Canvas drawing implementation
 * Handles local drawing operations and coordinate mapping
 */
class DrawingCanvas {
    constructor(canvasElement) {
        this.canvas = canvasElement;
        this.ctx = canvasElement.getContext('2d');
        this.isDrawing = false;
        this.currentStroke = null;
        this.strokeHistory = [];
        this.redoHistory = [];

        // Device pixel ratio for sharp rendering
        this.dpr = window.devicePixelRatio || 1;

        // Drawing settings
        this.currentColor = '#000000';
        this.currentWidth = 3;
        this.isEraser = false;

        // Real-time drawing optimization
        this.segmentCallback = null;
        this.lastSegmentSent = 0;
        this.segmentThrottleDelay = 30; // 30ms throttle for segments
        this.strokeCallback = null;

        // Performance optimization
        this.resizeTimeout = null;
        this.maxStrokesHistory = 1000; // Limit history to prevent memory issues
        this.frameRequestId = null;

        this.setupCanvas();
        this.attachEventListeners();
    }

    /**
     * Track drawing state
     */
    trackDrawingState() {
        // Send drawing state to WebSocket manager
        if (this.wsManager) {
            this.wsManager.sendDrawingState(this.userId, this.isDrawing);
        }
    }

    /**
     * Setup canvas size and rendering context
     */
    setupCanvas() {
        // Set canvas CSS size
        this.canvas.style.width = window.innerWidth + 'px';
        this.canvas.style.height = window.innerHeight + 'px';

        // Set canvas internal size accounting for device pixel ratio
        this.canvas.width = window.innerWidth * this.dpr;
        this.canvas.height = window.innerHeight * this.dpr;

        // Scale drawing context to account for device pixel ratio
        this.ctx.scale(this.dpr, this.dpr);

        // Set default drawing properties
        this.ctx.lineCap = 'round';
        this.ctx.lineJoin = 'round';

        // Performance optimizations
        this.ctx.imageSmoothingEnabled = false; // Disable anti-aliasing for sharp lines
        this.ctx.globalCompositeOperation = 'source-over';
    }

    /**
     * Convert CSS coordinates to canvas coordinates
     */
    getCanvasCoordinates(clientX, clientY) {
        const rect = this.canvas.getBoundingClientRect();
        return {
            x: (clientX - rect.left) * (this.canvas.width / rect.width) / this.dpr,
            y: (clientY - rect.top) * (this.canvas.height / rect.height) / this.dpr
        };
    }

    /**
     * Start a new stroke
     */
    startStroke(x, y) {
        const coords = this.getCanvasCoordinates(x, y);

        this.isDrawing = true;
        this.currentStroke = {
            id: this.generateStrokeId(),
            userId: this.canvasUserId || 'unknown',
            color: this.isEraser ? '#FFFFFF' : this.currentColor,
            width: this.currentWidth,
            points: [coords]
        };

        // Draw first point
        this.ctx.beginPath();
        this.ctx.moveTo(coords.x, coords.y);
        this.ctx.strokeStyle = this.isEraser ? '#FFFFFF' : this.currentColor;
        this.ctx.lineWidth = this.currentWidth;

        // For eraser, set composite operation to "destination-out"
        if (this.isEraser) {
            this.ctx.globalCompositeOperation = 'destination-out';
        } else {
            this.ctx.globalCompositeOperation = 'source-over';
        }

        // Track drawing state
        this.trackDrawingState();
    }

    /**
     * Add point to current stroke
     */
    continueStroke(x, y) {
        if (!this.isDrawing || !this.currentStroke) return;

        const coords = this.getCanvasCoordinates(x, y);
        this.currentStroke.points.push(coords);

        // Draw line segment
        this.ctx.lineTo(coords.x, coords.y);
        this.ctx.stroke();

        // Send real-time segment for long strokes
        const now = Date.now();
        if (this.segmentCallback &&
            this.currentStroke.points.length > 5 &&
            now - this.lastSegmentSent > this.segmentThrottleDelay) {

            const recentPoints = this.currentStroke.points.slice(-5);
            this.segmentCallback(recentPoints, this.currentColor, this.currentWidth);
            this.lastSegmentSent = now;
        }
    }

    /**
     * Complete current stroke
     */
    endStroke() {
        if (!this.isDrawing || !this.currentStroke) return;

        this.isDrawing = false;

        // Ensure stroke has at least 2 points
        if (this.currentStroke.points.length < 2) {
            this.currentStroke = null;
            return;
        }

        // Add to history and draw
        this.strokeHistory.push(this.currentStroke);

        const completedStroke = this.currentStroke;
        this.currentStroke = null;

        // Track drawing state
        this.trackDrawingState();

        if (this.strokeCallback) {
            try {
                this.strokeCallback(completedStroke);
            } catch (err) {
                console.error('Stroke callback error:', err);
            }
        }

        return completedStroke;
    }

    /**
     * Draw a complete stroke from data
     */
    drawStroke(stroke) {
        if (!stroke.points || stroke.points.length < 2) return;

        // Check if this is an eraser stroke
        const isEraserStroke = stroke.color === '#FFFFFF' || stroke.color.toLowerCase() === '#ffffff';

        if (isEraserStroke) {
            // For eraser strokes, use destination-out to remove content
            this.ctx.globalCompositeOperation = 'destination-out';
            this.ctx.strokeStyle = 'rgba(0,0,0,1)'; // Any color works with destination-out
            this.ctx.lineWidth = stroke.width + 2; // Slightly larger for better coverage
        } else {
            // For normal strokes, use source-over to add content
            this.ctx.globalCompositeOperation = 'source-over';
            this.ctx.strokeStyle = stroke.color;
            this.ctx.lineWidth = stroke.width;
        }

        this.ctx.beginPath();

        // Move to first point
        this.ctx.moveTo(stroke.points[0].x, stroke.points[0].y);

        // Draw lines through remaining points
        for (let i = 1; i < stroke.points.length; i++) {
            this.ctx.lineTo(stroke.points[i].x, stroke.points[i].y);
        }

        this.ctx.stroke();

        // Always restore to source-over for next operation
        this.ctx.globalCompositeOperation = 'source-over';
    }

    /**
     * Redraw entire canvas from history (optimized)
     */
    redrawCanvas() {
        // Clear canvas
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

        // Batch stroke rendering for performance
        const validStrokes = this.strokeHistory.filter(stroke => stroke && !stroke.isSegment);

        if (validStrokes.length === 0) return;

        // Group strokes by similar properties for batch rendering
        const strokeGroups = this.groupStrokesByProperties(validStrokes);

        // Render each group
        for (const group of strokeGroups) {
            this.renderStrokeGroup(group);
        }
    }

    /**
     * Group strokes by similar rendering properties for batch optimization
     */
    groupStrokesByProperties(strokes) {
        const groups = new Map();

        for (const stroke of strokes) {
            const key = `${stroke.color}_${stroke.width}`;
            if (!groups.has(key)) {
                groups.set(key, []);
            }
            groups.get(key).push(stroke);
        }

        return Array.from(groups.values());
    }

    /**
     * Render a group of strokes with the same properties
     */
    renderStrokeGroup(strokes) {
        if (strokes.length === 0) return;

        const firstStroke = strokes[0];
        this.ctx.strokeStyle = firstStroke.color;
        this.ctx.lineWidth = firstStroke.width;
        this.ctx.beginPath();

        for (const stroke of strokes) {
            if (stroke.points.length < 2) continue;

            // Move to first point
            this.ctx.moveTo(stroke.points[0].x, stroke.points[0].y);

            // Draw lines through remaining points
            for (let i = 1; i < stroke.points.length; i++) {
                this.ctx.lineTo(stroke.points[i].x, stroke.points[i].y);
            }
        }

        this.ctx.stroke();
    }

    /**
     * Remove the last stroke from canvas (global undo)
     */
    removeLastStroke() {
        // Find last non-segment stroke from any user
        for (let i = this.strokeHistory.length - 1; i >= 0; i--) {
            const stroke = this.strokeHistory[i];
            if (stroke && !stroke.isSegment) {
                const removedStroke = this.strokeHistory.splice(i, 1)[0];
                // Add to global redo history
                this.redoHistory.push(removedStroke);
                return removedStroke;
            }
        }
        return null;
    }

    /**
     * Check if user has any strokes that can be undone
     */
    canUserUndo(userId) {
        return this.strokeHistory.some(stroke =>
            stroke && stroke.userId === userId && !stroke.isSegment
        );
    }

    /**
     * Clear all strokes
     */
    clearCanvas() {
        this.strokeHistory = [];
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    }

    /**
     * Generate unique stroke ID
     */
    generateStrokeId() {
        return 'stroke_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    }

    /**
     * Handle window resize (with debouncing)
     */
    handleResize() {
        // Debounce resize events
        if (this.resizeTimeout) {
            clearTimeout(this.resizeTimeout);
        }

        this.resizeTimeout = setTimeout(() => {
            this.setupCanvas();
            this.redrawCanvas();
        }, 250); // 250ms debounce
    }

    /**
     * Attach event listeners
     */
    attachEventListeners() {
        // Mouse events
        this.canvas.addEventListener('mousedown', (e) => this.startStroke(e.clientX, e.clientY));
        this.canvas.addEventListener('mousemove', (e) => this.continueStroke(e.clientX, e.clientY));
        this.canvas.addEventListener('mouseup', () => this.endStroke());
        this.canvas.addEventListener('mouseleave', () => this.endStroke());

        // Touch events
        this.canvas.addEventListener('touchstart', (e) => {
            e.preventDefault();
            const touch = e.touches[0];
            this.startStroke(touch.clientX, touch.clientY);
        });

        this.canvas.addEventListener('touchmove', (e) => {
            e.preventDefault();
            const touch = e.touches[0];
            this.continueStroke(touch.clientX, touch.clientY);
        });

        this.canvas.addEventListener('touchend', (e) => {
            e.preventDefault();
            this.endStroke();
        });

        // Window resize
        window.addEventListener('resize', () => this.handleResize());

        // Prevent context menu on canvas
        this.canvas.addEventListener('contextmenu', (e) => e.preventDefault());
    }

    /**
     * Add to history and draw (with memory management)
     */
    onStrokeAdded(stroke) {
        // Don't render our own strokes that come back
        if (stroke.userId === this.canvasUserId) return;

        // Don't add segments to history, only render
        if (stroke.isSegment) {
            this.drawStroke(stroke);
            return;
        }

        // Manage memory by limiting history
        if (this.strokeHistory.length >= this.maxStrokesHistory) {
            this.strokeHistory.shift(); // Remove oldest stroke
        }

        // Add to history and draw
        this.strokeHistory.push(stroke);

        // Use requestAnimationFrame for smooth rendering
        if (this.frameRequestId) {
            cancelAnimationFrame(this.frameRequestId);
        }

        this.frameRequestId = requestAnimationFrame(() => {
            this.drawStroke(stroke);
            this.frameRequestId = null;
        });
    }

    /**
     * Set drawing color
     */
    setColor(color) {
        this.currentColor = color;
    }

    /**
     * Set brush width
     */
    setWidth(width) {
        this.currentWidth = width;
    }

    /**
     * Set eraser mode
     */
    setEraser(isEraser) {
        this.isEraser = isEraser;
    }

    /**
     * Redo last undone stroke (global redo)
     */
    redo() {
        if (this.redoHistory.length === 0) return null;

        const strokeToRedo = this.redoHistory.pop();
        // Re-add as a new stroke ID to avoid duplicate IDs in shared history
        const redoneStroke = {
            ...strokeToRedo,
            id: this.generateStrokeId()
        };

        this.strokeHistory.push(redoneStroke);
        this.redrawCanvas();

        return redoneStroke;
    }

    /**
     * Check if redo is available (global)
     */
    canRedo() {
        return this.redoHistory.length > 0;
    }

    /**
     * Check if undo is available (global)
     */
    canUndo() {
        return this.strokeHistory.some(stroke => stroke && !stroke.isSegment);
    }

    /**
     * Set callback for real-time segment sending
     */
    setSegmentCallback(callback) {
        this.segmentCallback = callback;
    }

    /**
     * Set callback for completed strokes (used to send to server)
     */
    setStrokeCallback(callback) {
        this.strokeCallback = callback;
    }

    /**
     * Set userId for strokes
     */
    setUserId(userId) {
        this.canvasUserId = userId;
    }
}