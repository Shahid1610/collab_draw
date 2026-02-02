/**
 * WebSocket communication manager (minimal, stable)
 * Handles real-time collaboration with the server via Socket.IO
 */
class WebSocketManager {
    constructor(canvas) {
        this.canvas = canvas;
        this.socket = null;
        this.currentRoom = null;
        this.userId = this.generateUserId();

        this.ghostCursors = new Map();
        this.lastCursorSent = 0;
        this.cursorThrottleDelay = 50;
        this.lastCursorX = null;
        this.lastCursorY = null;
        this.cursorMinMovement = 3;
    }

    /**
     * Connect to Socket.IO server
     */
    connect() {
        if (typeof io === 'undefined') {
            console.error('Socket.IO client (io) not available');
            return;
        }

        this.socket = io({
            transports: ['websocket', 'polling']
        });

        this.setupEventListeners();
        console.log('WebSocket connecting...');
    }

    setupEventListeners() {
        if (!this.socket) return;

        this.socket.on('connect', () => {
            console.log('Connected to server');
        });

        this.socket.on('disconnect', () => {
            console.log('Disconnected from server');
            this.clearGhostCursors();
        });

        // Server ping/pong (optional)
        this.socket.on('pong', (data) => {
            if (data && typeof data.timestamp === 'number') {
                const latency = Date.now() - data.timestamp;
                // Adjust throttling slightly for high latency networks
                this.cursorThrottleDelay = latency > 150 ? 80 : 50;
            }
        });

        // Room events
        this.socket.on('roomJoined', (data) => {
            this.currentRoom = data.room;
            this.onRoomJoined(data);
        });

        this.socket.on('userJoined', (data) => {
            if (data && Array.isArray(data.users)) {
                this.updateUserList(data.users);
            }
        });

        // Drawing events
        this.socket.on('strokeAdded', (stroke) => {
            if (!stroke) return;
            // Ignore our own strokes that echo back
            if (stroke.userId === this.userId) return;

            if (stroke.isSegment) {
                this.canvas.drawStroke(stroke);
                return;
            }

            this.canvas.strokeHistory.push(stroke);
            this.canvas.drawStroke(stroke);
        });

        this.socket.on('globalUndo', (data) => {
            if (!data || !data.strokeId) return;

            const idx = this.canvas.strokeHistory.findIndex(s => s && s.id === data.strokeId);
            if (idx !== -1) {
                const removed = this.canvas.strokeHistory.splice(idx, 1)[0];
                this.canvas.redoHistory.push(removed);
                this.canvas.redrawCanvas();
            }
        });

        this.socket.on('clearCanvas', () => {
            this.canvas.clearCanvas();
        });

        this.socket.on('cursorMove', (data) => {
            if (!data || data.userId === this.userId) return;
            this.updateGhostCursor(data.userId, data.x, data.y);
        });

        this.socket.on('drawingState', (data) => {
            if (!data || data.userId === this.userId) return;
            this.setGhostCursorDrawing(data.userId, !!data.isDrawing);
        });

        this.socket.on('error', (err) => {
            console.error('Socket error:', err);
        });

        this.socket.on('connect_error', (err) => {
            console.error('Connection error:', err);
        });
    }

    joinRoom(roomName) {
        const room = (roomName || '').trim();
        if (!room || !this.socket) return;
        this.socket.emit('joinRoom', { room });
    }

    onRoomJoined(data) {
        console.log('Joined room:', data.room);

        const roomDisplay = document.getElementById('roomDisplay');
        if (roomDisplay) roomDisplay.textContent = `Room: ${data.room}`;

        const roomInput = document.getElementById('roomInput');
        if (roomInput) roomInput.value = data.room;

        if (Array.isArray(data.users)) {
            this.updateUserList(data.users);
        } else {
            this.updateUserList([this.userId]);
        }

        if (Array.isArray(data.strokes)) {
            this.canvas.strokeHistory = data.strokes;
            this.canvas.redrawCanvas();
        }

        // Ask server for a pong to estimate latency
        this.measureNetworkLatency();
    }

    sendStroke(stroke) {
        if (!this.currentRoom || !this.socket || !stroke) return;
        stroke.userId = this.userId;
        this.socket.emit('addStroke', { room: this.currentRoom, stroke });
    }

    sendStrokeSegment(points, color, width) {
        if (!this.currentRoom || !this.socket) return;
        if (!Array.isArray(points) || points.length < 2) return;

        const segment = {
            id: `stroke_${Date.now()}_${Math.random().toString(36).slice(2)}_seg`,
            userId: this.userId,
            color: color,
            width: width,
            points,
            isSegment: true
        };

        this.socket.emit('strokeSegment', { room: this.currentRoom, segment });
    }

    sendCursorMove(x, y) {
        if (!this.currentRoom || !this.socket) return;

        const now = Date.now();
        if (now - this.lastCursorSent < this.cursorThrottleDelay) return;

        if (this.lastCursorX !== null && this.lastCursorY !== null) {
            const dx = Math.abs(x - this.lastCursorX);
            const dy = Math.abs(y - this.lastCursorY);
            if (dx < this.cursorMinMovement && dy < this.cursorMinMovement) return;
        }

        this.lastCursorSent = now;
        this.lastCursorX = x;
        this.lastCursorY = y;

        this.socket.emit('cursorMove', {
            room: this.currentRoom,
            userId: this.userId,
            x,
            y
        });
    }

    sendDrawingState(userId, isDrawing) {
        if (!this.currentRoom || !this.socket) return;
        this.socket.emit('drawingState', {
            room: this.currentRoom,
            userId: userId || this.userId,
            isDrawing: !!isDrawing
        });
    }

    sendGlobalUndo(removedStroke) {
        if (!this.currentRoom || !this.socket || !removedStroke) return;
        this.socket.emit('globalUndo', {
            room: this.currentRoom,
            userId: this.userId,
            strokeId: removedStroke.id
        });
    }

    sendClear() {
        if (!this.currentRoom || !this.socket) return;
        this.socket.emit('clearCanvas', { room: this.currentRoom, userId: this.userId });
    }

    updateUserList(users) {
        const userList = document.getElementById('userList');
        if (!userList) return;

        const list = Array.isArray(users) ? users : [];
        userList.innerHTML = list
            .map(u => `<div class="user-item">${this.formatUserLabel(u)}</div>`)
            .join('');
    }

    updateGhostCursor(userId, x, y) {
        if (typeof x !== 'number' || typeof y !== 'number') return;

        let cursor = this.ghostCursors.get(userId);
        if (!cursor) {
            cursor = document.createElement('div');
            cursor.className = 'ghost-cursor';
            cursor.style.position = 'fixed';
            cursor.style.left = '0px';
            cursor.style.top = '0px';
            cursor.style.pointerEvents = 'none';
            cursor.style.zIndex = '9999';
            cursor.style.width = '14px';
            cursor.style.height = '14px';
            cursor.style.borderRadius = '50%';
            cursor.style.border = `2px solid ${this.getUserColor(userId)}`;
            cursor.style.background = `${this.getUserColor(userId)}33`;

            const label = document.createElement('div');
            label.className = 'cursor-tooltip';
            label.textContent = this.formatUserLabel(userId);
            label.style.position = 'absolute';
            label.style.top = '-18px';
            label.style.left = '50%';
            label.style.transform = 'translateX(-50%)';
            label.style.fontSize = '10px';
            label.style.padding = '2px 6px';
            label.style.borderRadius = '10px';
            label.style.background = 'rgba(0,0,0,0.75)';
            label.style.color = '#fff';
            label.style.whiteSpace = 'nowrap';

            cursor.appendChild(label);
            document.body.appendChild(cursor);
            this.ghostCursors.set(userId, cursor);
        }

        cursor.style.left = `${x}px`;
        cursor.style.top = `${y}px`;
        cursor.lastSeen = Date.now();
    }

    setGhostCursorDrawing(userId, isDrawing) {
        const cursor = this.ghostCursors.get(userId);
        if (!cursor) return;
        if (isDrawing) cursor.classList.add('drawing');
        else cursor.classList.remove('drawing');
    }

    clearGhostCursors() {
        for (const [, cursor] of this.ghostCursors) {
            try { cursor.remove(); } catch { }
        }
        this.ghostCursors.clear();
    }

    getUserColor(userId) {
        let hash = 0;
        for (let i = 0; i < userId.length; i++) {
            hash = userId.charCodeAt(i) + ((hash << 5) - hash);
        }
        const hue = Math.abs(hash) % 360;
        return `hsl(${hue}, 70%, 50%)`;
    }

    formatUserLabel(userId) {
        if (typeof userId !== 'string') return 'user';
        if (userId.startsWith('user_')) return userId.slice(5, 13);
        return userId.slice(0, 8);
    }

    generateUserId() {
        return `user_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
    }

    measureNetworkLatency() {
        if (!this.socket) return;
        this.socket.emit('ping', { timestamp: Date.now() });
    }

    getUserId() {
        return this.userId;
    }
}

