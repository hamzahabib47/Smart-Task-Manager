# Tablet Web Display

Simple kiosk-style web display.

## Features

- Polls API every 2 seconds
- Shows latest task in large centered text
- Dark background with white text
- Optional alert mode when current time equals task time

## Setup

1. Open app.js
2. Set API_BASE_URL to your backend IP, for example:
   http://192.168.1.10:5000
3. Start backend server.
4. Open in browser:
   http://YOUR_SERVER_IP:5000/display/
5. Put browser in full-screen/kiosk mode.
