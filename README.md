# Smart Task Manager

Smart Task Manager is a full-stack scheduling and display system featuring:

1. **Backend API** (Node.js + Express + MongoDB)
2. **Mobile Controller App** (Flutter)
3. **Display Web App** (HTML/CSS/JS with realtime updates)

The mobile app manages tasks, alarms, photos, and settings. The display web app shows live state in slideshow, single image, upcoming task, reminder, or alarm modes—updated in real-time with zero manual refresh.

## Architecture

```
Mobile App (Flutter)
      ↓ REST + Realtime
Backend API (Node.js/Express/Mongoose)
      ↓ Realtime Events
Display Web App (JS/HTML/CSS)
```

## Project Structure

```
Smart-Task-Manager/
  ├── backend/
  │   ├── config/
  │   ├── middleware/
  │   ├── models/
  │   ├── routes/
  │   ├── services/
  │   ├── package.json
  │   └── server.js
  ├── mobile_app/
  │   ├── lib/
  │   │   └── main.dart
  │   ├── pubspec.yaml
  │   └── README.md
  ├── web_display/
  │   ├── index.html
  │   ├── styles.css
  │   ├── app.js
  │   └── README.md
  └── README.md
```

## Key Features

### Mobile App

**Authentication & Account**
- Register and sign-in with field-specific validation
- Change user name from Settings
- Account deletion with strict confirmation

**Tasks & Alarms**
- Create, edit, complete, archive, dismiss tasks
- One-time or daily alarms with visual indicators
- Stop/toggle/delete alarms with ringing state
- 12-hour and 24-hour time format support
- Compact form layouts for minimal overflow

**Photos & Display Control**
- Multi-image upload support (upload multiple photos at once)
- Slideshow mode with adjustable interval
- Single-image mode with explicit Save button
- Real-time preview of display state in-app

**User Experience**
- Time-based greeting with weather-aware icons
- Unified button styling across all sections
- Loading spinners on async operations (Add Task, Add Alarm, Upload Photos)
- Responsive UI with proper spacing

### Display Web App

**Display Modes**
- **Slideshow**: Auto-rotating uploaded photos
- **Single Image**: User-selected static image
- **Upcoming**: Next scheduled task with meta info
- **Reminder**: Task reminder in full-screen or banner style
- **Alarm**: Active alarm with recurrence and countdown

**Real-Time Features**
- Instant updates via Pusher, Socket.IO, or SSE
- Minute-boundary auto-refresh for time-based state transitions
- Tab focus/visibility awareness (refresh on tab return)
- Auto-dismiss countdown with visual countdown badge
- Banner alerts for reminder/alarm states

**User Experience**
- Loading skeleton during JS initialization (no blank flash)
- Smooth transitions between display modes
- Full-screen image containment (no crop)
- Meta info with compact styling
- Graceful error states

## Environment Variables (Backend)

Create `backend/.env`:

```
PORT=5000
MONGODB_URI=your_mongodb_connection_string
JWT_SECRET=your_long_random_secret
```

Important:

- Use `MONGODB_URI` (not `MONGO_URI`)
- `JWT_SECRET` is required or server will exit

## Local Development Setup

### 1) Backend

From workspace root:

```
npm install --prefix backend
npm run dev --prefix backend
```

Server URL:

```
http://localhost:5000/
```

### 2) Mobile App

From workspace root:

```
cd mobile_app
flutter pub get
flutter run -d chrome --web-hostname localhost --web-port 8080
```

Mobile web run URL:

```
http://localhost:8080
```

Note: Windows desktop run may fail if Developer Mode/symlink support is disabled.

### 3) Display Web App

The display app is served by backend static route:

```
http://localhost:5000/display/
```

## Base URL Rules

### Mobile App

In `mobile_app/lib/main.dart`:

- Must include `/api`
- Example:

```
http://localhost:5000/api
```

### Display Web App

In `tablet-web/app.js`:

- Must not include `/api` in base
- Example:

```
http://localhost:5000
```

The file appends endpoint paths like `/api/tasks/public/display-state` itself.

## Production / Live (Free-Friendly)

Recommended stable free flow:

1. Host backend API (for example Render free)
2. Keep MongoDB on Atlas free cluster
3. Host display static app (or use backend `/display` route)
4. Build Android APK for mobile app and install directly
5. Use browser fullscreen + screen pinning for kiosk-like display lock

If using free backend hosting, monitor wake-up/cold-start behavior with an uptime monitor.

## Quick Verification Checklist

1. `GET /` returns success JSON
2. Register and sign in succeed
3. Settings save succeeds
4. Display URL opens and updates
5. Task/alarm transitions render correctly
6. Reminder style (full screen/banner) reflects as selected
7. Empty-image message appears only when no display image exists

## Troubleshooting

### Backend does not start

- Check `backend/.env`
- Ensure `JWT_SECRET` is set
- Ensure `MONGODB_URI` is valid

### Mobile cannot connect to API

- Confirm mobile base URL has `/api`
- Confirm backend is running on port 5000

### Display cannot load state

- Confirm `API_BASE_URL` in `tablet-web/app.js` is correct
- Confirm display URL is opened from backend route `/display/`

### Port conflicts on mobile web

- If port 8080 is busy, stop stale dart/flutter process and re-run

## Tech Stack

- Backend: Node.js, Express, Mongoose, JWT, Multer
- Mobile: Flutter + HTTP
- Display: Vanilla HTML/CSS/JS polling model
- Database: MongoDB
