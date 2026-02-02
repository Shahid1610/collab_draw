const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const path = require('path');

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

// Socket.io connection handler
io.on('connection', (socket) => {
    console.log(`User connected: ${socket.id}`);
    socket.userId = `user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    socket.currentRoom = null;
    
    // Handle room joining
    socket.on('joinRoom', (data) => {
        const { room } = data;
        
        if (!room || !room.trim()) {
            socket.emit('error', { message: 'Room name is required' });
            return;
        }
        
        // Join room
        socket.join(room);
        socket.currentRoom = room;
        
        console.log(`User ${socket.userId} joined room: ${room}`);
        
        // Send confirmation
        socket.emit('roomJoined', {
            room: room,
            userId: socket.userId,
            users: [socket.userId] // Simplified for now
        });
    });
    
    // Handle stroke addition
    socket.on('addStroke', (data) => {
        const { room, stroke } = data;
        
        if (!socket.currentRoom || socket.currentRoom !== room) {
            socket.emit('error', { message: 'Not in room' });
            return;
        }
        
        // Broadcast to others in room
        socket.to(room).emit('strokeAdded', stroke);
        console.log(`Stroke added to room ${room} by ${stroke.userId}`);
    });
    
    // Handle cursor movement
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
    
    // Handle global undo
    socket.on('globalUndo', (data) => {
        const { room, strokeId } = data;
        
        if (!socket.currentRoom || socket.currentRoom !== room) {
            return;
        }
        
        console.log(`Global undo: stroke ${strokeId} removed from room ${room}`);
        
        // Broadcast to all users
        io.to(room).emit('globalUndo', {
            userId: data.userId,
            strokeId: strokeId
        });
    });
    
    // Handle disconnect
    socket.on('disconnect', () => {
        console.log(`User disconnected: ${socket.userId}`);
    });
});

// Start server
server.listen(PORT, () => {
    console.log(`Collaborative Canvas server running on port ${PORT}`);
    console.log(`Open http://localhost:${PORT} to start drawing`);
});

process.on('SIGINT', () => {
    console.log('Shutting down server...');
    server.close(() => {
        console.log('Server closed');
        process.exit(0);
    });
});