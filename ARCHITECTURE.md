# Architecture Documentation

## Overview

Collaborative Canvas is a real-time drawing application designed for multi-user collaboration. The architecture prioritizes performance, scalability, and data consistency.

## Core Principles

### 1. Server Authority
The server maintains the authoritative state of the drawing canvas. All stroke operations are validated and stored server-side, ensuring consistency across all clients.

**Why this matters:**
- Prevents conflicts between concurrent operations
- Enables proper undo semantics per user
- Provides single source of truth for new users
- Allows for robust error recovery

### 2. Stateless Client Canvas
The client canvas is treated as stateless and fully reconstructible from server data.

**Why this matters:**
- Simplifies client-side state management
- Enables easy reconnection and state recovery
- Reduces memory footprint on clients
- Ensures consistency across all connected clients

### 3. Stroke-Based Synchronization
Instead of streaming pixels, the application synchronizes drawing actions as stroke objects.

**Why this matters:**
- Dramatically reduces bandwidth usage
- Preserves drawing semantics and intent
- Enables selective undo operations
- Allows for efficient data compression and optimization

### 4. Room-Based Isolation
All drawing operations are scoped to specific rooms, providing natural multi-tenancy.

**Why this matters:**
- Prevents cross-room interference
- Enables scalable architecture
- Provides natural privacy boundaries
- Allows for concurrent independent sessions

## Data Flow Architecture

### Drawing Pipeline

```
Client A              Server                Client B
   |                    |                     |
   |-- strokeSegment -->|                     |
   |                    |-- strokeSegment -->|
   |                    |                     |
   |-- addStroke ------>|                     |
   |                    |-- addStroke ------>|
   |                    |                     |
   |<-- strokeAdded ----|-- strokeAdded ---->|
```

### Stroke Segments vs Complete Strokes

**Stroke Segments**:
- Sent during active drawing for real-time preview
- Not added to permanent history
- Provide immediate visual feedback
- Throttled to optimize bandwidth

**Complete Strokes**:
- Sent when drawing operation completes
- Validated and stored server-side
- Added to permanent history
- Broadcast to all clients

## Component Architecture

### Client-Side Components

#### Canvas (`canvas.js`)
- Handles all drawing operations
- Manages coordinate transformation
- Implements optimized rendering
- Provides stroke batching and segmentation

**Key Responsibilities:**
- Coordinate mapping (CSS to Canvas coordinates)
- Device pixel ratio handling
- Local stroke rendering
- Performance optimization (batch rendering)

#### WebSocket Manager (`websocket.js`)
- Manages real-time communication
- Implements adaptive throttling
- Handles connection management
- Manages ghost cursors

**Key Responsibilities:**
- Network latency measurement
- Adaptive buffering strategies
- Event routing and handling
- Error recovery and reconnection

### Server-Side Components

#### Server (`server.js`)
- HTTP and WebSocket serving
- Request validation and routing
- Connection management
- Event broadcasting

#### Room Manager (`rooms.js`)
- User presence tracking
- Room lifecycle management
- Access control
- Statistics collection

#### State Manager (`state-manager.js`)
- Authoritative stroke history
- Undo operation logic
- Data validation
- Memory management

## Undo Strategy

### Design Principles

1. **Per-User Undo**: Each user can only undo their own last stroke
2. **Server Authority**: Server validates and executes undo operations
3. **Immediate Feedback**: Clients provide immediate local undo with server confirmation
4. **Event Sourcing**: Undo is implemented as a new event (stroke removal)

### Implementation Details

```javascript
// Client-side immediate undo
const removed = canvas.removeLastStrokeFromUser(userId);
if (removed) {
    canvas.redrawCanvas();
    wsManager.sendUndo();
}

// Server-side authoritative undo
const removedStroke = stateManager.undo(room, userId);
if (removedStroke) {
    io.to(room).emit('strokeUndone', { userId, strokeId });
}
```

## Performance Considerations

### Client-Side Optimizations

1. **Stroke Batching**: Small strokes are accumulated and sent in batches
2. **Segment Throttling**: Real-time segments are throttled to prevent flooding
3. **Batch Rendering**: Strokes with similar properties are rendered together
4. **Memory Management**: Limited stroke history prevents memory leaks
5. **Adaptive Quality**: Network conditions affect update frequencies

### Server-Side Optimizations

1. **Efficient Data Structures**: Maps and sets for O(1) operations
2. **Lazy Cleanup**: Inactive rooms are cleaned up periodically
3. **Memory Monitoring**: Stroke history size is tracked and limited
4. **Connection Pooling**: Efficient WebSocket connection management

### Network Optimizations

1. **Compression**: Stroke data is inherently compressible
2. **Delta Updates**: Only changes are transmitted
3. **Adaptive Throttling**: Network latency affects update frequencies
4. **Selective Broadcasting**: Events are targeted to specific rooms

## Tradeoffs and Limitations

### Tradeoffs

1. **Latency vs Bandwidth**: Stroke segments add latency but improve perceived responsiveness
2. **Memory vs Performance**: Keeping stroke history uses memory but enables undo functionality
3. **Complexity vs Features**: The architecture is more complex but provides rich features

### Limitations

1. **Stroke History Size**: Unlimited stroke history is impractical, so history is truncated
2. **Network Dependency**: Real-time features require persistent connection
3. **Single Canvas**: Only one canvas per room (no layers or multiple canvases)
4. **Undo Granularity**: Only last-stroke undo, not arbitrary undo history

### Scalability Considerations

1. **Room Isolation**: Rooms provide natural horizontal scaling
2. **State Distribution**: Each room maintains its own state
3. **Connection Limits**: WebSocket connections are the primary bottleneck
4. **Memory Usage**: Large stroke histories impact server memory

## Security Considerations

### Input Validation
- All stroke data is validated server-side
- Room names are sanitized
- User IDs are generated server-side

### Access Control
- Room-based isolation provides natural boundaries
- No authentication required (anonymous collaboration)
- Users can only operate within their joined rooms

### Data Privacy
- No persistent storage of drawings
- Room data exists only in memory
- Users can clear canvas at any time

## Future Extensions

### Possible Enhancements

1. **Persistent Storage**: Database integration for permanent drawings
2. **User Authentication**: Named users with profiles and history
3. **Drawing Tools**: Shapes, text, layers, etc.
4. **Export Functionality**: Save drawings as images
5. **Real-time Voice**: Audio collaboration alongside drawing

### Architecture Adaptations

1. **Microservices**: Separate services for rooms, state, and authentication
2. **Message Queues**: For handling high-volume drawing operations
3. **CDN Integration**: For serving static assets and caching
4. **Load Balancing**: Multiple server instances behind a load balancer

## Monitoring and Debugging

### Metrics to Track

1. **Performance**: Stroke latency, render times, network latency
2. **Usage**: Active rooms, user counts, stroke frequencies
3. **Errors**: Connection failures, invalid data, timeout events
4. **Resources**: Memory usage, CPU usage, network bandwidth

### Debugging Tools

1. **Client Logging**: Browser console debugging with verbosity levels
2. **Server Logging**: Structured logging with correlation IDs
3. **Performance Monitoring**: Real-time metrics and alerts
4. **Health Endpoints**: Server status and statistics endpoints

This architecture provides a solid foundation for real-time collaborative drawing while maintaining performance, scalability, and data consistency.