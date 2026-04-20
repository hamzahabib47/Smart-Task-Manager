# Smart Time Manager

Smart Time Manager is a multi-client scheduling system with:

1. Backend API (Node.js + Express + MongoDB)
2. Mobile controller app (Flutter)
3. Display web app (HTML/CSS/JS)

The mobile app controls tasks, alarms, photos, settings, and account actions.
The display web app shows the live state (slideshow, upcoming task, reminder, alarm).

## Architecture

Mobile App -> REST API -> MongoDB -> Display Web App

## Project Structure

```
stm/
  backend/
    config/
    middleware/
    models/
    routes/
    services/
    uploads/
    package.json
    server.js
  mobile_app/
    lib/
      main.dart
    pubspec.yaml
  tablet-web/
    index.html
    styles.css
    app.js
  README.md
```

Note: The folder is named `tablet-web`, but in product behavior it is the display web app.

## Key Features

### Auth and Account

- Register with required name, email, password
- Sign in with field-specific errors:
  - incorrect email
  - incorrect password
- Change user name from Settings
- Delete account with strict confirmation text

### Tasks and Alarms

- Create, edit, complete, archive, dismiss tasks
- Create one-time or daily alarms
- Stop/toggle/delete alarms
- Time format support (12-hour / 24-hour)

### Display Behavior

- Modes: slideshow, single image, upcoming, reminder, alarm
- Reminder style setting:
  - full screen
  - banner
- Auto close countdown for reminder/alarm
- Empty image state center message:
  - "Add Images from mobile app to show on the display"
- Full image visibility using contain-fit (no crop)

### Mobile Display Tab Preview

- Mirrors live display behavior and mode content
- Shows matching primary text, meta info, banner state, and empty-image message

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
