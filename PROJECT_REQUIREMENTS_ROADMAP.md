# Smart Time Manager - Project Requirements and Roadmap

## 1) Functional Requirements (Provided)

1. User Registration
- Mobile app allows account creation with email and password.
- Account stores task and schedule data in cloud for sync.

2. Device Pairing
- App discovers and pairs with Smart Time Manager device via BLE.
- One device paired per mobile account.

3. Create Task / Reminder
- User can create task with title, description, date, and time.
- System schedules on-screen alert at specified time.

4. Edit / Delete Task
- User can edit or delete existing tasks from mobile app.
- Changes sync to device in near real-time.

5. View Task List
- Mobile app shows chronological upcoming tasks/reminders.
- Completed tasks archived.

6. Set Alarm
- User can set one-time or recurring alarms.
- Alarm triggers device buzzer (if hardware exists) and fullscreen notification.

7. Photo Upload
- User can upload photos from gallery to device.
- Device shows photos in rotating slideshow.

8. Slideshow Mode
- If no reminder due in next 5 minutes, device shows slideshow.
- Slideshow interval configurable.

9. Reminder Display
- At scheduled time, slideshow is interrupted.
- Device prominently shows task title, description, and current time.

10. Dismiss Reminder
- Reminder can be dismissed from mobile app or physical button.

11. Daily Schedule View
- Device can show summary of remaining tasks at configured time (example 8:00 AM).

12. Device Clock Sync
- Device clock syncs automatically with mobile time on pairing/reconnection.

---

## 2) Current Project Status (As Built)

Completed now:
- Node.js + Express backend
- MongoDB connectivity configured (non-SRV confirmed working)
- Basic task create and list API
- Flutter basic UI: add task + list tasks
- Tablet web display with polling every 2 seconds

Not implemented yet:
- User accounts/authentication
- BLE pairing workflow
- Edit/delete/archive task APIs and UI
- Recurring alarm model
- Photo upload and slideshow file management
- Reminder dismiss endpoint and hardware button integration
- Daily schedule scheduler
- Device clock sync endpoint/protocol

---

## 3) Recommended Implementation Order

Phase 1 (Core Data and Auth)
- Add User model (email, passwordHash)
- Add register/login endpoints using JWT
- Scope task data per user
- Add task fields: description, dateTime, completed, archived
- Add APIs: create, list, update, delete, complete/archive

Phase 2 (Display Logic)
- Update tablet page to detect:
  - reminder due now
  - due within next 5 minutes
  - slideshow mode otherwise
- Add dismiss reminder endpoint and status field

Phase 3 (Photo and Slideshow)
- Add photo upload API (Multer)
- Store file URLs in DB
- Add slideshow interval setting per user/device

Phase 4 (Alarm and Schedule)
- Add one-time + recurring alarm schema
- Add scheduler service on backend (cron/tick)
- Add daily schedule summary generation

Phase 5 (BLE + Device Integration)
- Add BLE pairing state in backend and Flutter app
- Enforce one device per account
- Add clock sync payload and device acknowledgment flow

---

## 4) API Expansion Needed

Auth:
- POST /api/auth/register
- POST /api/auth/login

Tasks:
- POST /api/tasks
- GET /api/tasks
- PUT /api/tasks/:id
- DELETE /api/tasks/:id
- PATCH /api/tasks/:id/complete
- PATCH /api/tasks/:id/dismiss

Photos:
- POST /api/photos/upload
- GET /api/photos
- DELETE /api/photos/:id

Settings/Device:
- GET /api/settings
- PUT /api/settings
- POST /api/device/pair
- POST /api/device/clock-sync

---

## 5) Suggested Data Model Additions

User:
- email
- passwordHash
- pairedDeviceId
- createdAt

Task:
- userId
- title
- description
- dateTime
- completed
- archived
- dismissed
- createdAt

Alarm:
- userId
- label
- dateTime
- recurrence
- enabled

Photo:
- userId
- url
- filename
- uploadedAt

Settings:
- userId
- slideshowIntervalSeconds
- dailySummaryTime

---

## 6) Real-Time Strategy (As Required)

- Keep REST + polling (no WebSocket)
- Tablet polls every 2 seconds for current state
- Mobile app writes to backend APIs
- Backend is source of truth for tasks, alarms, photos, settings

---

## 7) Acceptance Checklist

- User can register/login and see only own data
- User can create/edit/delete/complete/archive tasks
- Tablet shows reminders at exact time
- Tablet falls back to slideshow when no reminder due within 5 minutes
- User can upload photos and slideshow rotates
- Reminder can be dismissed via app and device input
- Daily schedule summary appears at configured time
- Device time sync works after pairing/reconnect
