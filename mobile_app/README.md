# Flutter Mobile App (Controller)

Complete Flutter control app for Smart Task Manager with dashboard tabs for tasks, alarms, photos, display preview, and account settings.

## Features

### Authentication & Account
- Register with name, email, password (field-specific validation)
- Sign in with email and password
- Change user name from Settings tab
- Delete account with strict confirmation

### Tasks
- Create tasks with title, description, due date, and due time
- One-time or daily recurring tasks
- Edit, complete, archive, or dismiss tasks
- Immediate display preview refresh after task changes

### Alarms
- Create one-time or daily alarms with time
- View all alarms with visual indicators
- Toggle, stop, or delete alarms
- Real-time ringing state updates

### Photos & Display
- **Multi-image upload** (select and upload multiple photos at once)
- Slideshow mode with adjustable photo duration
- Single image mode with explicit save
- Real-time preview of current display state in-app
- Auto-refresh display preview on changes

### User Experience
- Time-based greeting with weather-aware Material icons
- Unified button styling via global theme
- Loading spinners on async operations (Add Task, Add Alarm, Upload Photos)
- Responsive layouts with proper spacing
- Support for 12-hour and 24-hour time formats

## Setup

1. Install Flutter (https://flutter.dev/docs/get-started/install)
2. Navigate to this folder:
   ```bash
   cd mobile_app
   ```
3. Get dependencies:
   ```bash
   flutter pub get
   ```
4. Update backend URL in `lib/main.dart` (if running locally):
   ```dart
   const String baseUrl = 'http://YOUR_SERVER_IP:5000/api';
   ```
5. Run on emulator or device:
   ```bash
   flutter run
   ```

## Supported Platforms

- Android
- iOS
- Web (dev build)

## Time Format

- 12-hour: `09:15 AM` or `06:45 PM`
- 24-hour: `09:15` or `18:45`
- Format configurable in Settings

## Dependencies

Key packages:
- `image_picker`: Multi-image and camera selection
- `http`: REST API requests with custom auth headers
- `shared_preferences`: Local token and user data storage
- `intl`: Time formatting and localization
- `flutter`: Material Design 3 UI components

## Architecture

- State management via `setState()`
- HTTP client with JWT Bearer token auth
- Local token storage with shared_preferences
- Real-time display preview polling (20-second interval + minute-boundary refresh)
