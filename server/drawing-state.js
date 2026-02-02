/**
 * Drawing state manager for collaborative canvas
 * Maintains ordered stroke history per room and supports undo operations.
 */
class DrawingState {
    constructor() {
        this.rooms = new Map(); // roomName -> RoomState
    }

    /**
     * Get or create room state
     */
    getRoomState(roomName) {
        if (!this.rooms.has(roomName)) {
            this.rooms.set(roomName, {
                strokes: [], // Ordered array of strokes
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
        if (!roomState) return null;

        const userStrokeIndices = roomState.userStrokes.get(userId);
        if (!userStrokeIndices || userStrokeIndices.length === 0) return null;

        const lastStrokeIndex = userStrokeIndices.pop();
        const removedStroke = roomState.strokes[lastStrokeIndex];

        // Mark stroke as removed (keep in array to maintain indices)
        roomState.strokes[lastStrokeIndex] = null;

        if (userStrokeIndices.length === 0) {
            roomState.userStrokes.delete(userId);
        }

        roomState.lastModified = Date.now();
        return removedStroke;
    }

    /**
     * Remove stroke by ID (global undo)
     */
    removeStrokeById(roomName, strokeId) {
        const roomState = this.rooms.get(roomName);
        if (!roomState) return null;

        for (let i = 0; i < roomState.strokes.length; i++) {
            const stroke = roomState.strokes[i];
            if (stroke && stroke.id === strokeId) {
                roomState.strokes[i] = null;
                roomState.lastModified = Date.now();
                return stroke;
            }
        }

        return null;
    }

    /**
     * Get all active strokes for a room (null strokes removed)
     */
    getActiveStrokes(roomName) {
        const roomState = this.rooms.get(roomName);
        if (!roomState) return [];
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
            return { strokes: [], lastModified: Date.now() };
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
        if (!stroke || typeof stroke !== 'object') return false;

        const required = ['id', 'userId', 'color', 'width', 'points'];
        for (const field of required) {
            if (!(field in stroke)) return false;
        }

        if (typeof stroke.id !== 'string' || !stroke.id) return false;
        if (typeof stroke.userId !== 'string' || !stroke.userId) return false;
        if (typeof stroke.color !== 'string' || !stroke.color) return false;
        if (typeof stroke.width !== 'number' || stroke.width <= 0) return false;
        if (!Array.isArray(stroke.points) || stroke.points.length < 2) return false;

        for (const point of stroke.points) {
            if (!point || typeof point.x !== 'number' || typeof point.y !== 'number') {
                return false;
            }
        }

        return true;
    }
}

module.exports = DrawingState;

