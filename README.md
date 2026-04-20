# Smart Time Manager - Smart Display System

This project contains 3 parts:

1. Backend API (Node.js + Express + MongoDB Atlas)
2. Mobile controller app (Flutter)
3. Tablet display web page (HTML/CSS/JS polling every 2 seconds)

## Folder Structure

smart-time-manager/
  backend/
    config/
      db.js
    models/
      Task.js
    routes/
      tasks.js
    .env.example
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

## Data Flow

Flutter App -> REST API -> MongoDB Atlas -> Tablet Web Page

## API Endpoints

Base URL: http://YOUR_SERVER_IP:5000/api

- POST /tasks
  - body:
    {
      "title": "Meeting with supervisor",
      "time": "14:30"
    }
- GET /tasks

## Quick Start

### 1) Backend setup

- Open terminal in backend folder.
- Install packages:
  npm install
- Create .env file from .env.example.
- Add your MongoDB Atlas URI in MONGODB_URI.
- Start server:
  npm run dev

Server starts on http://localhost:5000

### 2) Tablet display setup

- Open tablet-web/app.js
- Replace:
  http://YOUR_SERVER_IP:5000
  with your computer local IP, for example:
  http://192.168.1.10:5000
- On tablet browser open:
  http://YOUR_SERVER_IP:5000/display/
- Turn on browser full-screen/kiosk mode.

### 3) Flutter mobile app setup

- Open terminal in mobile_app folder.
- If this is first time in this folder, generate platform folders:
  flutter create .
- Get packages:
  flutter pub get
- Open lib/main.dart
- Replace baseUrl value with your backend IP:
  http://YOUR_SERVER_IP:5000/api
- Run app:
  flutter run

## Kiosk Mode Tip (Android tablet)

- Open Chrome and navigate to display URL.
- Use full-screen mode.
- For true kiosk lock, use Android screen pinning or any kiosk browser app.

## Notes

- No Firebase used.
- No WebSockets used.
- Polling is used every 2 seconds in tablet-web/app.js.
- Task schema fields: title, time, createdAt.
