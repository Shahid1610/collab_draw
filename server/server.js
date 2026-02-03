console.log('Starting server...');

const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const path = require('path');
const DrawingState = require('./drawing-state');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '../client')));

const PORT = process.env.PORT || 3000;
const drawingState = new DrawingState();

// Connection handler
io.on('connection', (socket) => {
    console.log(`User connected: ${socket.id}`);
    socket.userId = `user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    socket.currentRoom = null;

    // Room joining
    socket.on('joinRoom', (data) => {
        const { room } = data;

        if (!room || !room.trim()) {
            socket.emit('error', { message: 'Room name is required' });
            return;
        }

        socket.join(room);
        socket.currentRoom = room;

        console.log(`User ${socket.userId} joined room: ${room}`);

        // Send current room state
        const roomState = drawingState.getRoomStateForUser(room);
        socket.emit('roomJoined', {
            room: room,
            userId: socket.userId,
            users: [socket.userId],
            strokes: roomState.strokes
        });

        // Notify others
        socket.to(room).emit('userJoined', {
            userId: socket.userId,
            users: [socket.userId]
        });
    });

    // Stroke handling
    socket.on('addStroke', (data) => {
        const { room, stroke } = data;

        if (!socket.currentRoom || socket.currentRoom !== room) {
            socket.emit('error', { message: 'Not in room' });
            return;
        }

        if (!stroke) return;

        // Segments are preview-only
        if (stroke.isSegment) {
            socket.to(room).emit('strokeAdded', stroke);
            return;
        }

        try {
            drawingState.addStroke(room, stroke);
        } catch (err) {
            console.error('Invalid stroke:', err?.message || err);
            socket.emit('error', { message: 'Invalid stroke data' });
            return;
        }

        console.log(`Stroke added to room ${room} by ${stroke.userId}`);
        socket.to(room).emit('strokeAdded', stroke);
    });

    // Real-time stroke segment preview
    socket.on('strokeSegment', (data) => {
        const { room, segment } = data || {};
        if (!socket.currentRoom || socket.currentRoom !== room) return;
        if (!segment) return;
        socket.to(room).emit('strokeAdded', segment);
    });

    // Cursor movement
    socket.on('cursorMove', (data) => {
        const { room, x, y } = data;

        if (!socket.currentRoom || socket.currentRoom !== room) {
            return;
        }

        // Broadcast to others
        socket.to(room).emit('cursorMove', {
            userId: data.userId,
            x: x,
            y: y
        });
    });

    // Drawing state (used for cursor styling)
    socket.on('drawingState', (data) => {
        const { room, userId, isDrawing } = data || {};
        if (!socket.currentRoom || socket.currentRoom !== room) return;
        socket.to(room).emit('drawingState', { userId, isDrawing: !!isDrawing });
    });

    // Global undo
    socket.on('globalUndo', (data) => {
        const { room, strokeId } = data;

        if (!socket.currentRoom || socket.currentRoom !== room) {
            return;
        }

        drawingState.removeStrokeById(room, strokeId);
        console.log(`Global undo: stroke ${strokeId} in room ${room}`);

        // Broadcast to all users
        io.to(room).emit('globalUndo', {
            userId: data.userId,
            strokeId: strokeId
        });
    });

    // Clear canvas for everyone in room
    socket.on('clearCanvas', (data) => {
        const { room } = data || {};
        if (!socket.currentRoom || socket.currentRoom !== room) return;
        drawingState.clearRoom(room);
        io.to(room).emit('clearCanvas', { room });
    });

    // Ping/pong for latency measurement
    socket.on('ping', (data) => {
        socket.emit('pong', { timestamp: data?.timestamp });
    });

    // Handle disconnect
    socket.on('disconnect', () => {
        console.log(`User disconnected: ${socket.userId}`);
    });
});

// Start server (must be outside connection handler)
server.listen(PORT, () => {
    console.log(`Collaborative Canvas server running on port ${PORT}`);
    console.log(`Open http://localhost:${PORT} to start drawing`);
});

// Basic error handling
process.on('uncaughtException', (error) => {
    console.error('Uncaught Exception:', error);
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Rejection:', reason);
});