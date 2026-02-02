/**
 * Main application entry point
 * Coordinates canvas and WebSocket functionality
 */
document.addEventListener('DOMContentLoaded', () => {
    console.log('DOM Content Loaded');

    // Check if classes are loaded
    if (typeof WebSocketManager === 'undefined') {
        console.error('WebSocketManager class not loaded!');
        alert('Error: WebSocketManager class not loaded! Please check your network connection.');
        return;
    }

    if (typeof DrawingCanvas === 'undefined') {
        console.error('DrawingCanvas class not loaded!');
        alert('Error: DrawingCanvas class not loaded! Please refresh the page.');
        return;
    }

    // Initialize canvas
    const canvasElement = document.getElementById('drawingCanvas');
    const canvas = new DrawingCanvas(canvasElement);

    // Initialize WebSocket manager
    const wsManager = new WebSocketManager(canvas);

    // Connect to server
    wsManager.connect();

    // Set canvas userId after connection
    setTimeout(() => {
        if (wsManager.userId) {
            canvas.setUserId(wsManager.userId);
        }
    }, 100);

    // Set canvas segment callback for real-time drawing
    canvas.setSegmentCallback((points, color, width) => {
        wsManager.sendStrokeSegment(points, color, width);
    });

    // Send completed strokes to server
    canvas.setStrokeCallback((stroke) => {
        wsManager.sendStroke(stroke);
    });

    // Expose to global scope for debugging
    window.wsManager = wsManager;
    window.canvas = canvas;

    console.log('Collaborative Canvas initialized');
    console.log('User ID:', wsManager.getUserId());

    // UI Controls
    const colorPicker = document.getElementById('colorPicker');
    const brushSize = document.getElementById('brushSize');
    const sizeDisplay = document.getElementById('sizeDisplay');
    const undoBtn = document.getElementById('undoBtn');
    const redoBtn = document.getElementById('redoBtn');
    const clearBtn = document.getElementById('clearBtn');
    const roomInput = document.getElementById('roomInput');
    const joinBtn = document.getElementById('joinBtn');
    const roomDisplay = document.getElementById('roomDisplay');

    // Color picker
    colorPicker.addEventListener('change', (e) => {
        canvas.setColor(e.target.value);
    });

    // Brush size
    brushSize.addEventListener('input', (e) => {
        const size = parseInt(e.target.value);
        canvas.setWidth(size);
        sizeDisplay.textContent = size;
    });

    // Drawing tools
    const penTool = document.getElementById('penTool');
    const eraserTool = document.getElementById('eraserTool');

    penTool.addEventListener('click', () => {
        canvas.setEraser(false);
        penTool.classList.add('active');
        eraserTool.classList.remove('active');
        colorPicker.disabled = false;
    });

    eraserTool.addEventListener('click', () => {
        canvas.setEraser(true);
        eraserTool.classList.add('active');
        penTool.classList.remove('active');
        colorPicker.disabled = true;
    });

    // Undo button
    undoBtn.addEventListener('click', () => {
        // Try local undo first (global undo)
        const removed = canvas.removeLastStroke();

        if (removed) {
            canvas.redrawCanvas();
            // Send undo to server to sync with others
            wsManager.sendGlobalUndo(removed);

            // Visual feedback
            undoBtn.textContent = 'Undone!';
            undoBtn.style.background = '#28a745';
            setTimeout(() => {
                undoBtn.textContent = '↶ Undo';
                undoBtn.style.background = '#007bff';
            }, 500);
        } else {
            // Visual feedback for no strokes to undo
            undoBtn.textContent = 'Nothing';
            undoBtn.style.background = '#dc3545';
            setTimeout(() => {
                undoBtn.textContent = '↶ Undo';
                undoBtn.style.background = '#007bff';
            }, 500);
        }
    });

    // Redo button
    redoBtn.addEventListener('click', () => {
        const redone = canvas.redo();

        if (redone) {
            // Send redone stroke to server
            wsManager.sendStroke(redone);

            // Visual feedback
            redoBtn.textContent = 'Redone!';
            redoBtn.style.background = '#28a745';
            setTimeout(() => {
                redoBtn.textContent = '↷ Redo';
                redoBtn.style.background = '#007bff';
            }, 500);
        } else {
            // Visual feedback for nothing to redo
            redoBtn.textContent = 'Nothing';
            redoBtn.style.background = '#dc3545';
            setTimeout(() => {
                redoBtn.textContent = '↷ Redo';
                redoBtn.style.background = '#007bff';
            }, 500);
        }
    });

    // Clear button
    clearBtn.addEventListener('click', () => {
        if (confirm('Clear entire canvas for everyone?')) {
            canvas.clearCanvas();
            wsManager.sendClear();
        }
    });

    // Room joining
    joinBtn.addEventListener('click', () => {
        const roomName = roomInput.value.trim();
        if (roomName) {
            wsManager.joinRoom(roomName);
        } else {
            console.log('Room name is empty');
        }
    });

    // Allow Enter key to join room
    roomInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            const roomName = roomInput.value.trim();
            console.log('Enter key pressed, room name:', roomName);
            e.preventDefault();
            if (roomName) {
                wsManager.joinRoom(roomName);
            } else {
                console.log('Room name is empty');
            }
        }
    });

    // Track mouse movement for ghost cursors
    canvasElement.addEventListener('mousemove', (e) => {
        wsManager.sendCursorMove(e.clientX, e.clientY, canvas.isDrawing);
    });

    // Track when user starts drawing
    canvasElement.addEventListener('mousedown', (e) => {
        canvas.isDrawing = true;
        wsManager.sendDrawingState(wsManager.getUserId(), true);
    });

    // Track when user stops drawing
    canvasElement.addEventListener('mouseup', () => {
        canvas.isDrawing = false;
        wsManager.sendDrawingState(wsManager.getUserId(), false);
    });

    console.log('Collaborative Canvas initialized with all features');
    console.log('User ID:', wsManager.getUserId());
});