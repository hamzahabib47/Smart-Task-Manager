# Backend API

Node.js + Express + Mongoose + MongoDB Atlas

## Setup

```bash
npm install
npm start
```

Server runs on `http://localhost:5000`

## API Routes

### Authentication

**POST `/api/auth/register`**
- Body: `{ name, email, password }`
- Response: `{ token, user: { id, name, email } }`

**POST `/api/auth/signin`**
- Body: `{ email, password }`
- Response: `{ token, user: { id, name, email } }`

**POST `/api/auth/change-name`**
- Headers: `Authorization: Bearer <token>`
- Body: `{ name }`
- Response: `{ success: true }`

**POST `/api/auth/delete-account`**
- Headers: `Authorization: Bearer <token>`
- Response: `{ success: true }`

### Tasks

**GET `/api/tasks`**
- Headers: `Authorization: Bearer <token>`
- Response: `[{ id, title, description, dueDate, dueTime, isCompleted, isArchived, isOneTime, ... }]`

**POST `/api/tasks`**
- Headers: `Authorization: Bearer <token>`
- Body: `{ title, description, dueDate, dueTime, isLocationBased, location }`
- Response: `{ id, ... }`

**PUT `/api/tasks/:id`**
- Headers: `Authorization: Bearer <token>`
- Body: `{ title, description, dueDate, dueTime, isLocationBased, location }`
- Response: `{ id, ... }`

**DELETE `/api/tasks/:id`**
- Headers: `Authorization: Bearer <token>`
- Response: `{ success: true }`

**GET `/api/tasks/public/display-state`**
- Public endpoint (no auth required)
- Response: `{ mode, upcomingTask, reminder, alarm, photos, displayState, ... }`
- Notes: Location-based tasks are excluded from display-state responses.

### Alarms

**GET `/api/alarms`**
- Headers: `Authorization: Bearer <token>`
- Response: `[{ id, title, time, isActive, isRinging, isOneTime, ... }]`

**POST `/api/alarms`**
- Headers: `Authorization: Bearer <token>`
- Body: `{ title, time, isOneTime }`
- Response: `{ id, ... }`

**PUT `/api/alarms/:id`**
- Headers: `Authorization: Bearer <token>`
- Body: `{ title, time, isActive, isRinging, isOneTime }`
- Response: `{ id, ... }`

**DELETE `/api/alarms/:id`**
- Headers: `Authorization: Bearer <token>`
- Response: `{ success: true }`

### Photos

**POST `/api/photos`**
- Headers: `Authorization: Bearer <token>`, `Content-Type: multipart/form-data`
- Body: FormData with `photos[]` or `photo` field(s)
  - Supports multiple file upload via `photos[]` array (max 10 files)
  - Backward compatible with single file via `photo` field
- Response: `{ count: <number of files uploaded>, photos: [{ id, url, ... }] }`

**GET `/api/photos`**
- Headers: `Authorization: Bearer <token>`
- Response: `[{ id, url, uploadedAt, ... }]`

**DELETE `/api/photos/:id`**
- Headers: `Authorization: Bearer <token>`
- Response: `{ success: true }`

### Settings

**GET `/api/settings`**
- Headers: `Authorization: Bearer <token>`
- Response: `{ timeFormat, displayMode, reminderStyle, photoDuration, ... }`

**PUT `/api/settings`**
- Headers: `Authorization: Bearer <token>`
- Body: `{ timeFormat, displayMode, reminderStyle, photoDuration, ... }`
- Response: `{ ... }`

### Device & Realtime

**GET `/api/device/status`**
- Response: `{ status: "ok" }`

**POST `/api/device/push-token`**
- Headers: `Authorization: Bearer <token>`
- Body: `{ token }`
- Response: `{ success: true }`

**DELETE `/api/device/push-token`**
- Headers: `Authorization: Bearer <token>`
- Body: `{ token }`
- Response: `{ success: true }`

**Push Notifications**
- Set one of: `FIREBASE_SERVICE_ACCOUNT_JSON`,
  `FIREBASE_SERVICE_ACCOUNT_BASE64`, or `FIREBASE_SERVICE_ACCOUNT_PATH`
  for Firebase Admin SDK credentials.

**WebSocket / SSE Events**
- `tasksUpdated`: Task list changed (created/updated/deleted)
- `alarmsUpdated`: Alarm state changed
- `photosUpdated`: Photos uploaded or deleted
- `displayStateChanged`: Display mode or content changed

## Models

- **User**: id, name, email, passwordHash, createdAt
- **Task**: id, userId, title, description, dueDate, dueTime, isCompleted, isArchived, isOneTime, reminderInterval
- **Alarm**: id, userId, title, time, isActive, isRinging, isOneTime, createdAt
- **Photo**: id, userId, url (file path/URL), uploadedAt
- **Setting**: id, userId, timeFormat, displayMode, reminderStyle, photoDuration

## Realtime Strategy

- Primary: Socket.IO
- Fallback: Pusher
- Final fallback: Server-Sent Events (SSE)

When data changes, the server emits events to all connected clients via the active realtime provider.

## Environment Variables

```
MONGO_URI=<MongoDB Atlas connection string>
JWT_SECRET=<secret key for token signing>
PUSHER_APP_ID=<Pusher app ID>
PUSHER_KEY=<Pusher key>
PUSHER_SECRET=<Pusher secret>
PUSHER_CLUSTER=<Pusher cluster>
```

## Notes

- All protected routes require valid JWT in Authorization header
- Photo uploads support both single (`photo`) and multiple (`photos[]`) fields
- Display state endpoint is public (no auth required) to enable kiosk displays
- Realtime events ensure display refreshes without manual reload
