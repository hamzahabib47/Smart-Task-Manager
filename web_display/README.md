# Web Display App

Kiosk-style web display for Smart Task Manager showing real-time task, alarm, reminder, and slideshow states.

## Features

### Display Modes
- **Slideshow**: Auto-rotating uploaded photos with configurable interval
- **Single Image**: Static user-selected image
- **Upcoming**: Next scheduled task with time and description
- **Reminder**: Task reminder in full-screen or banner style
- **Alarm**: Active alarm with recurrence info and visual alert

### Real-Time Updates
- **Instant events**: Socket.IO, Pusher, or SSE for live data push
- **Minute-boundary auto-refresh**: Detects when active tasks/alarms transition based on time
- **Tab focus awareness**: Automatically refreshes when display tab regains focus
- **Tab visibility listeners**: Detects when display moves to/from background

### User Experience
- **Loading skeleton**: Branded skeleton animation during JS initialization (no blank flash)
- **Smooth transitions**: Fade and slide animations between display modes
- **Full-screen images**: Uses `object-fit: contain` to ensure full image visibility (no crop)
- **Auto-dismiss countdown**: Visual countdown badge for reminders/alarms
- **Compact meta info**: Title, description, and timing in minimal space
- **Graceful error states**: Handles missing images with centered message

## Setup

1. Ensure backend is running:
   ```bash
   cd backend
   npm start
   ```
   Backend serves the display at `http://localhost:5000/display/`

2. Access in browser:
   ```
   http://localhost:5000/display/
   ```

3. For remote access:
   ```
   http://YOUR_SERVER_IP:5000/display/
   ```

4. Put browser in full-screen or kiosk mode (F11 or Ctrl+Cmd+F)

## Architecture

### Display State Flow
1. Initial load: Show loading skeleton with shimmer animation
2. First fetch: Retrieve current display state from `/api/tasks/public/display-state`
3. Hide skeleton: Transition to `app-ready` state
4. Realtime listening: Subscribe to realtime events (Socket.IO/Pusher/SSE)
5. Minute-boundary polling: Every minute, check if time-based state changed
6. Focus listeners: Refresh on tab focus or visibility change

### Polling Strategy
- **Slideshow images**: 20-second interval for rotation
- **Time-based transitions**: 1-second minute-boundary check (detects 09:59 → 10:00)
- **On-demand**: Immediate refresh on realtime event
- **On focus**: Refresh when tab regains focus or becomes visible

### Fallback Chain
- Primary: Socket.IO WebSocket
- Secondary: Pusher channels
- Tertiary: Server-Sent Events (SSE)

## Configuration

Edit `app.js` to adjust:
- `API_BASE_URL`: Backend server URL (default: current origin)
- Realtime provider selection (Socket.IO → Pusher → SSE)
- Polling intervals for slideshow and minute boundary

## Browser Compatibility

- Chrome/Chromium
- Firefox
- Safari (15+)
- Edge
- Any modern browser supporting:
  - ES6 JavaScript
  - CSS Grid and Flexbox
  - CSS backdrop-filter and gradients
  - Fetch API

## Performance Notes

- Debounced display state requests prevent concurrent API calls
- Minute-boundary detection optimized to trigger only on time transitions
- Tab visibility/focus listeners reduce unnecessary polling
- Skeleton animation is GPU-accelerated for smooth 60fps
