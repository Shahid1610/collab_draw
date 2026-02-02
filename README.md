# Collaborative Canvas

## How to install and run the project

### Prerequisites
- Node.js (LTS recommended)
- npm (bundled with Node.js)

### Install
```bash
npm install
```

### Run
```bash
npm start
```

Then open `http://localhost:3000` in your browser.

## How to test the app with multiple users

- **Same machine (quick test)**:
  - Start the server with `npm start`
  - Open `http://localhost:3000` in **two different browser tabs** (or two different browsers)
  - Join the **same room name** in both sessions
  - Draw in one session and confirm updates appear in the other

- **Different machines (same network)**:
  - Find the host machine’s local IP address (e.g., `192.168.x.x`)
  - On the other machine, open `http://<HOST_IP>:3000`
  - Join the **same room name** and verify real-time sync

## Known issues or limitations

- **In-memory room state**: Room strokes are stored in memory only. Restarting the server clears all rooms and drawings.
- **Basic presence list**: The user list is minimal and may not represent all connected users accurately in every case.
- **No authentication**: Rooms are identified only by name; anyone with the room name can join.

## Total time spent on the project

5 hours