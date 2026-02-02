# Architecture

This document describes how drawing data is represented, transmitted, and synchronized across users.

## Data Flow Diagram

### End-to-end drawing flow (User A → everyone in the room)

```
User A (browser)                 Server (Socket.IO)                  User B (browser)
-----------------                ------------------                  ----------------
canvas.js produces points
  |                                                                              |
  | strokeSegment (preview)                                                      |
  +-------------------------------> (broadcast to room) ------------------------>+  render segment immediately
  |                                                                              |
  | addStroke (final stroke)                                                     |
  +-------------------------------> validate + store in drawing-state --------->+  render + append to history
                                                                                 (same for all other users)
```

### Key idea
- **Segments** improve perceived responsiveness (other users see the stroke “live”).
- **Final strokes** are the only data stored as authoritative history on the server.

## WebSocket Protocol

All WebSocket communication uses Socket.IO. Messages are scoped by a `room` name.

### Stroke object format

```json
{
  "id": "stroke_1738480000000_ab12cd34",
  "userId": "user_1738480000000_xy12ab34",
  "color": "#000000",
  "width": 3,
  "points": [{ "x": 10.1, "y": 20.2 }, { "x": 11.0, "y": 21.4 }],
  "isSegment": false
}
```

### Events (client → server)

- **`joinRoom`**

```json
{ "room": "my-room" }
```

- **`addStroke`** (final stroke; persisted)

```json
{ "room": "my-room", "stroke": { "...stroke" : "object" } }
```

- **`strokeSegment`** (preview segment; not persisted)

```json
{ "room": "my-room", "segment": { "...stroke" : "object", "isSegment": true } }
```

- **`cursorMove`**

```json
{ "room": "my-room", "userId": "user_...", "x": 120, "y": 300 }
```

- **`drawingState`**

```json
{ "room": "my-room", "userId": "user_...", "isDrawing": true }
```

- **`globalUndo`**

```json
{ "room": "my-room", "userId": "user_...", "strokeId": "stroke_..." }
```

- **`clearCanvas`**

```json
{ "room": "my-room", "userId": "user_..." }
```

- **`ping`** (latency measurement)

```json
{ "timestamp": 1738480000000 }
```

### Events (server → client)

- **`roomJoined`** (initial sync for the joiner)

```json
{
  "room": "my-room",
  "userId": "user_...",
  "users": ["user_..."],
  "strokes": [ { "...stroke": "object" } ]
}
```

- **`userJoined`** (presence hint)

```json
{ "userId": "user_...", "users": ["user_..."] }
```

- **`strokeAdded`** (broadcast for both final strokes and preview segments)

```json
{ "...stroke": "object" }
```

- **`globalUndo`**

```json
{ "userId": "user_...", "strokeId": "stroke_..." }
```

- **`clearCanvas`**

```json
{ "room": "my-room" }
```

- **`cursorMove`**

```json
{ "userId": "user_...", "x": 120, "y": 300 }
```

- **`drawingState`**

```json
{ "userId": "user_...", "isDrawing": true }
```

- **`pong`**

```json
{ "timestamp": 1738480000000 }
```

## Undo / Redo Strategy

### Global Undo
- Undo is implemented as **“remove stroke by id”**.
- The client picks the most recent stroke it can remove locally and sends `globalUndo(room, strokeId)`.
- The server removes the stroke from `server/drawing-state.js` and broadcasts `globalUndo` so all clients remove the same stroke and redraw.

### Global Redo
- Redo is implemented as **“re-add the previously removed stroke”** by sending it again as a normal `addStroke`.
- To prevent conflicts, redo creates a **new `stroke.id`** when re-adding (same points/color/width, new identifier). This avoids duplicate IDs in shared history and keeps later `globalUndo` deterministic.

## Performance Decisions

### Why these optimizations exist
- **Stroke-based sync (not pixel streaming)**: much smaller payloads and natural undo (strokes are discrete objects).
- **Segment previews (`strokeSegment`)**: improves perceived “live collaboration” for long strokes; segments are not persisted to keep memory/bandwidth stable.
- **Throttling**:
  - Segments are throttled in `client/canvas.js` to avoid flooding the network while drawing.
  - Cursor updates are throttled in `client/websocket.js` to reduce noisy traffic.
- **Device Pixel Ratio (DPR) scaling**: keeps lines sharp on high-DPI screens while keeping coordinate math consistent.
- **History limit (`maxStrokesHistory`)**: prevents unbounded client memory growth.
- **`requestAnimationFrame` rendering**: keeps drawing smooth by aligning with the browser’s paint loop.

## Conflict Handling

### Simultaneous drawing
- Drawing is **additive**: most events are “append a stroke”, so concurrent strokes do not conflict logically.
- The system is **event-driven** and effectively **last-write-wins for ordering**:
  - The order of strokes is the order in which the server receives/stores them.
  - Clients render strokes in the order they arrive.

### Undo conflicts
- Undo targets a **specific stroke id**. If two users undo concurrently, both removals will be broadcast and applied; the final canvas state is the result of applying both operations in the order they arrive.

### State source of truth
- The server’s in-memory `drawing-state.js` is the authoritative store for final strokes in a room.
- If the server restarts, room state resets (no persistence).