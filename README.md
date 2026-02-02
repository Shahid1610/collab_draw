# Collaborative Canvas

A real-time collaborative drawing application where multiple users can draw simultaneously on a shared canvas.

## Features

- **Real-time Collaboration**: Multiple users can draw simultaneously with live synchronization
- **Stroke-based Drawing**: Efficient stroke-based synchronization instead of pixel streaming
- **Ghost Cursors**: See other users' cursor positions in real-time
- **Undo System**: Each user can undo their own last stroke
- **Room-based Isolation**: Separate drawing spaces with room names
- **Responsive Design**: Full-screen canvas that adapts to any screen size
- **Touch Support**: Works on both desktop and mobile devices
- **High DPI Support**: Sharp rendering on high-resolution displays

## Quick Start

### Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd collaborative-canvas
```

2. Install dependencies:
```bash
npm install
```

3. Start the server:
```bash
npm start
```

4. Open your browser and navigate to:
```
http://localhost:3000
```

### Development Mode

For development with automatic server restarts:
```bash
npm run dev
```

## Usage

1. **Join a Room**: Enter a room name and click "Join" to create or join a drawing space
2. **Draw**: Click and drag on the canvas to draw
3. **Customize**: Use the color picker and brush size slider to change drawing style
4. **Undo**: Click "Undo" or press Ctrl+Z (Cmd+Z on Mac) to remove your last stroke
5. **Clear**: Click "Clear" to clear the entire canvas for everyone
6. **Collaborate**: Share the room name with others to draw together

## Technical Architecture

### Client-Side
- **HTML5 Canvas API**: Native 2D drawing without external libraries
- **Socket.io Client**: Real-time WebSocket communication
- **Responsive Design**: Adapts to any screen size and device
- **High DPI Support**: Proper handling of device pixel ratios

### Server-Side
- **Node.js + Express**: HTTP server and static file serving
- **Socket.io**: WebSocket server for real-time communication
- **Room Manager**: User presence and room management
- **State Manager**: Authoritative stroke history and undo logic

### Data Model
A stroke represents an atomic drawing action:
```javascript
{
  id: string,           // Unique identifier
  userId: string,       // User who created the stroke
  color: string,        // Stroke color (hex format)
  width: number,        // Stroke width in pixels
  points: [{x, y}, ...] // Array of coordinate points
}
```

## Performance Optimizations

- **Stroke Batching**: Small strokes are batched and sent together
- **Real-time Segments**: Long strokes send segments for immediate preview
- **Adaptive Throttling**: Cursor and stroke updates are throttled based on network conditions
- **Memory Management**: Limited stroke history prevents memory issues
- **Batch Rendering**: Strokes with similar properties are rendered together
- **RequestAnimationFrame**: Smooth rendering with browser optimization

## Testing

### Manual Testing
1. Open multiple browser tabs to simulate multiple users
2. Test drawing simultaneously from different tabs
3. Verify undo only affects your own strokes
4. Test ghost cursor movement accuracy
5. Test room isolation (different rooms should not interfere)

### Performance Testing
1. Create a room with many strokes
2. Test undo performance with large stroke history
3. Verify smooth drawing with multiple active users
4. Test on mobile devices and different screen sizes

## API Endpoints

### HTTP
- `GET /`: Serve the main application
- `GET /health`: Server health and statistics

### WebSocket Events
- `joinRoom`: Join or create a drawing room
- `addStroke`: Add a new stroke to the canvas
- `addStrokesBatch`: Add multiple strokes efficiently
- `strokeSegment`: Send partial stroke for real-time preview
- `undo`: Remove the user's last stroke
- `clearCanvas`: Clear all strokes in a room
- `cursorMove`: Send cursor position
- `drawingState`: Send drawing state (active/inactive)

## Browser Support

- Chrome 60+
- Firefox 55+
- Safari 12+
- Edge 79+

## Configuration

### Environment Variables
- `PORT`: Server port (default: 3000)
- `NODE_ENV`: Environment mode (development/production)

### Client Configuration
Performance settings can be adjusted in `client/canvas.js`:
- `maxStrokesHistory`: Maximum strokes to keep in memory
- `segmentThrottleDelay`: Throttling for stroke segments
- `resizeTimeout`: Debounce delay for window resizing

## Troubleshooting

### Common Issues

1. **Cursor not visible**: Check that you've joined a room
2. **Drawing not syncing**: Verify WebSocket connection in browser console
3. **Undo not working**: Ensure you have drawn strokes in the current room
4. **Performance issues**: Try clearing the canvas or reducing stroke count

### Debug Mode
Enable debug logging in browser console:
```javascript
localStorage.setItem('debug', 'socket.io-client:*');
```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly with multiple users
5. Submit a pull request

## License

MIT License - see LICENSE file for details