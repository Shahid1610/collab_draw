/**
 * Room management system
 * Tracks users in each room and provides room metadata
 */
class RoomManager {
    constructor() {
        this.rooms = new Map(); // roomName -> Set of users
        this.userSockets = new Map(); // roomName -> Map of userId -> socketId
    }
    
    /**
     * Add user to a room
     */
    addUser(roomName, userId, socketId) {
        if (!this.rooms.has(roomName)) {
            this.rooms.set(roomName, new Set());
            this.userSockets.set(roomName, new Map());
        }
        
        this.rooms.get(roomName).add(userId);
        this.userSockets.get(roomName).set(userId, socketId);
    }
    
    /**
     * Remove user from a room
     */
    removeUser(roomName, userId) {
        if (this.rooms.has(roomName)) {
            this.rooms.get(roomName).delete(userId);
            this.userSockets.get(roomName).delete(userId);
            
            // Clean up empty rooms
            if (this.rooms.get(roomName).size === 0) {
                this.rooms.delete(roomName);
                this.userSockets.delete(roomName);
            }
        }
    }
    
    /**
     * Get all users in a room
     */
    getUsers(roomName) {
        if (this.userSockets.has(roomName)) {
            return Array.from(this.userSockets.get(roomName).keys());
        }
        return [];
    }
    
    /**
     * Get socket ID for a user in a room
     */
    getSocketId(roomName, userId) {
        if (this.userSockets.has(roomName)) {
            return this.userSockets.get(roomName).get(userId);
        }
        return null;
    }
    
    /**
     * Check if user is in a room
     */
    isUserInRoom(roomName, userId) {
        return this.rooms.has(roomName) && this.rooms.get(roomName).has(userId);
    }
    
    /**
     * Get user count in a room
     */
    getUserCount(roomName) {
        if (this.rooms.has(roomName)) {
            return this.rooms.get(roomName).size;
        }
        return 0;
    }
    
    /**
     * Get all active rooms
     */
    getAllRooms() {
        const roomList = [];
        for (const [roomName, users] of this.rooms) {
            roomList.push({
                name: roomName,
                userCount: users.size,
                users: this.getUsers(roomName)
            });
        }
        return roomList;
    }
    
    /**
     * Get statistics
     */
    getStats() {
        const totalRooms = this.rooms.size;
        let totalUsers = 0;
        
        for (const users of this.rooms.values()) {
            totalUsers += users.size;
        }
        
        return {
            totalRooms,
            totalUsers,
            averageUsersPerRoom: totalRooms > 0 ? totalUsers / totalRooms : 0
        };
    }
}

module.exports = RoomManager;