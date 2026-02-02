/**
 * State manager for collaborative canvas
 * Maintains ordered stroke history and handles undo operations
 */
class StateManager {
    constructor() {
        this.rooms = new Map(); // roomName -> RoomState
    }
    
    /**
     * Get or create room state
     */
    getRoomState(roomName) {
        if (!this.rooms.has(roomName)) {
            this.rooms.set(roomName, {
                strokes: [],        // Ordered array of strokes
                userStrokes: new Map(), // userId -> array of stroke indices
                lastModified: Date.now()
            });
        }
        return this.rooms.get(roomName);
    }
    
    /**
     * Add a new stroke to a room
     */
    addStroke(roomName, stroke) {
        const roomState = this.getRoomState(roomName);
        
        // Validate stroke structure
        if (!this.validateStroke(stroke)) {
            throw new Error('Invalid stroke data');
        }
        
        // Add stroke to history
        const strokeIndex = roomState.strokes.length;
        roomState.strokes.push(stroke);
        
        // Track user's strokes for undo
        if (!roomState.userStrokes.has(stroke.userId)) {
            roomState.userStrokes.set(stroke.userId, []);
        }
        roomState.userStrokes.get(stroke.userId).push(strokeIndex);
        
        // Update last modified time
        roomState.lastModified = Date.now();
        
        return stroke;
    }
    
    /**
     * Remove the last stroke from a specific user in a room
     */
    undo(roomName, userId) {
        const roomState = this.rooms.get(roomName);
        if (!roomState) {
            return null;
        }
        
        // Get user's strokes
        const userStrokeIndices = roomState.userStrokes.get(userId);
        if (!userStrokeIndices || userStrokeIndices.length === 0) {
            return null;
        }
        
        // Remove last stroke index
        const lastStrokeIndex = userStrokeIndices.pop();
        const removedStroke = roomState.strokes[lastStrokeIndex];
        
        // Mark stroke as removed (keep in array to maintain indices)
        roomState.strokes[lastStrokeIndex] = null;
        
        // Clean up empty user stroke list
        if (userStrokeIndices.length === 0) {
            roomState.userStrokes.delete(userId);
        }
        
        // Update last modified time
        roomState.lastModified = Date.now();
        
        console.log(`Undo: Removed stroke ${removedStroke?.id} from user ${userId} in room ${roomName}`);
        
        return removedStroke;
    }
    
    /**
     * Remove stroke by ID (global undo)
     */
    removeStrokeById(roomName, strokeId) {
        const roomState = this.rooms.get(roomName);
        if (!roomState) {
            return null;
        }
        
        // Find stroke by ID
        for (let i = 0; i < roomState.strokes.length; i++) {
            const stroke = roomState.strokes[i];
            if (stroke && stroke.id === strokeId) {
                // Remove stroke and add to redo history
                roomState.strokes[i] = null;
                
                // Update last modified time
                roomState.lastModified = Date.now();
                
                console.log(`Global undo: Removed stroke ${strokeId} from room ${roomName}`);
                return stroke;
            }
        }
        
        return null;
    }
    
    /**
     * Add stroke to redo history (global)
     */
    addStrokeToRedoHistory(roomName, stroke) {
        const roomState = this.rooms.get(roomName);
        if (!roomState) return;
        
        if (!roomState.redoHistory) {
            roomState.redoHistory = [];
        }
        
        roomState.redoHistory.push(stroke);
    }
    
    /**
     * Check if user has any strokes that can be undone
     */
    canUndo(roomName, userId) {
        const roomState = this.rooms.get(roomName);
        if (!roomState) {
            return false;
        }
        
        const userStrokeIndices = roomState.userStrokes.get(userId);
        return userStrokeIndices && userStrokeIndices.length > 0;
    }
    
    /**
     * Get user's stroke count
     */
    getUserStrokeCount(roomName, userId) {
        const roomState = this.rooms.get(roomName);
        if (!roomState) {
            return 0;
        }
        
        const userStrokeIndices = roomState.userStrokes.get(userId);
        return userStrokeIndices ? userStrokeIndices.length : 0;
    }
    
    /**
     * Get all active strokes for a room (null strokes removed)
     */
    getActiveStrokes(roomName) {
        const roomState = this.rooms.get(roomName);
        if (!roomState) {
            return [];
        }
        
        return roomState.strokes.filter(stroke => stroke !== null);
    }
    
    /**
     * Clear all strokes in a room
     */
    clearRoom(roomName) {
        const roomState = this.getRoomState(roomName);
        
        roomState.strokes = [];
        roomState.userStrokes.clear();
        roomState.lastModified = Date.now();
        
        return roomState;
    }
    
    /**
     * Get room state (for new users)
     */
    getRoomStateForUser(roomName) {
        const roomState = this.rooms.get(roomName);
        if (!roomState) {
            return {
                strokes: [],
                lastModified: Date.now()
            };
        }
        
        return {
            strokes: this.getActiveStrokes(roomName),
            lastModified: roomState.lastModified
        };
    }
    
    /**
     * Validate stroke data structure
     */
    validateStroke(stroke) {
        if (!stroke || typeof stroke !== 'object') {
            return false;
        }
        
        // Required fields
        const required = ['id', 'userId', 'color', 'width', 'points'];
        for (const field of required) {
            if (!(field in stroke)) {
                return false;
            }
        }
        
        // Validate types
        if (typeof stroke.id !== 'string' || !stroke.id) {
            return false;
        }
        
        if (typeof stroke.userId !== 'string' || !stroke.userId) {
            return false;
        }
        
        if (typeof stroke.color !== 'string' || !stroke.color) {
            return false;
        }
        
        if (typeof stroke.width !== 'number' || stroke.width <= 0) {
            return false;
        }
        
        if (!Array.isArray(stroke.points) || stroke.points.length < 2) {
            return false;
        }
        
        // Validate points
        for (const point of stroke.points) {
            if (!point || typeof point.x !== 'number' || typeof point.y !== 'number') {
                return false;
            }
        }
        
        return true;
    }
    
    /**
     * Get statistics for a room
     */
    getRoomStats(roomName) {
        const roomState = this.rooms.get(roomName);
        if (!roomState) {
            return null;
        }
        
        const activeStrokes = this.getActiveStrokes(roomName);
        const userCounts = {};
        
        // Count strokes per user
        for (const stroke of activeStrokes) {
            userCounts[stroke.userId] = (userCounts[stroke.userId] || 0) + 1;
        }
        
        return {
            totalStrokes: roomState.strokes.length,
            activeStrokes: activeStrokes.length,
            uniqueUsers: Object.keys(userCounts).length,
            strokesPerUser: userCounts,
            lastModified: roomState.lastModified,
            memoryUsage: this.estimateMemoryUsage(roomState)
        };
    }
    
    /**
     * Estimate memory usage of room state
     */
    estimateMemoryUsage(roomState) {
        const strokes = JSON.stringify(roomState.strokes);
        const userStrokes = JSON.stringify(Array.from(roomState.userStrokes.entries()));
        
        return {
            strokes: strokes.length,
            userStrokes: userStrokes.length,
            total: strokes.length + userStrokes.length
        };
    }
    
    /**
     * Clean up old inactive rooms (for maintenance)
     */
    cleanup(maxAge = 24 * 60 * 60 * 1000) { // 24 hours default
        const now = Date.now();
        const toDelete = [];
        
        for (const [roomName, roomState] of this.rooms) {
            if (now - roomState.lastModified > maxAge) {
                toDelete.push(roomName);
            }
        }
        
        for (const roomName of toDelete) {
            this.rooms.delete(roomName);
        }
        
        return toDelete.length;
    }
    
    /**
     * Get all rooms statistics
     */
    getAllStats() {
        const stats = {
            totalRooms: this.rooms.size,
            totalStrokes: 0,
            activeStrokes: 0,
            totalUsers: new Set(),
            roomDetails: {}
        };
        
        for (const [roomName, roomState] of this.rooms) {
            const roomStats = this.getRoomStats(roomName);
            if (roomStats) {
                stats.totalStrokes += roomStats.totalStrokes;
                stats.activeStrokes += roomStats.activeStrokes;
                Object.keys(roomStats.strokesPerUser).forEach(userId => {
                    stats.totalUsers.add(userId);
                });
                stats.roomDetails[roomName] = roomStats;
            }
        }
        
        stats.totalUsers = stats.totalUsers.size;
        
        return stats;
    }
}

module.exports = StateManager;