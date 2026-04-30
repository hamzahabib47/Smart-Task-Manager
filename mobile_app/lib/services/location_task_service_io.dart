import "dart:io";

import "package:geofence_service/geofence_service.dart" as geofence;
import "package:geolocator/geolocator.dart" as geo;

import "location_task_models.dart";

class LocationTaskService {
  final geofence.GeofenceService _service = geofence.GeofenceService.instance;
  bool _initialized = false;
  bool _running = false;
  Map<String, LocationTaskReminder> _reminders = {};
  Future<void> Function(LocationTaskReminder reminder)? _onEnter;

  Future<bool> initialize() async {
    if (!Platform.isAndroid) return false;
    if (_initialized) return true;

    final enabled = await geo.Geolocator.isLocationServiceEnabled();
    if (!enabled) return false;

    var permission = await geo.Geolocator.checkPermission();
    if (permission == geo.LocationPermission.denied) {
      permission = await geo.Geolocator.requestPermission();
    }

    if (permission == geo.LocationPermission.denied ||
        permission == geo.LocationPermission.deniedForever) {
      return false;
    }

    _service.setup(
      interval: 60000,
      accuracy: 100,
      loiteringDelayMs: 10000,
      statusChangeDelayMs: 10000,
      useActivityRecognition: true,
      allowMockLocations: false,
      printDevLog: false,
    );

    _service.addGeofenceStatusChangeListener(_handleStatusChange);
    _initialized = true;
    return true;
  }

  Future<void> updateGeofences(
    List<LocationTaskReminder> reminders,
    Future<void> Function(LocationTaskReminder reminder) onEnter,
  ) async {
    if (!Platform.isAndroid) return;

    _onEnter = onEnter;
    _reminders = {for (final reminder in reminders) reminder.id: reminder};

    final ok = await initialize();
    if (!ok) return;

    if (reminders.isEmpty) {
      if (_running) {
        await _service.stop();
        _running = false;
      }
      return;
    }

    final geofences = reminders
        .map(
          (reminder) => geofence.Geofence(
            id: reminder.id,
            latitude: reminder.latitude,
            longitude: reminder.longitude,
            radius: [
              geofence.GeofenceRadius(
                id: "radius",
                length: reminder.radiusMeters,
              ),
            ],
          ),
        )
        .toList();

    if (_running) {
      await _service.stop();
      _running = false;
    }

    await _service.start(geofences);
    _running = true;
  }

  Future<void> dispose() async {
    if (_running) {
      await _service.stop();
      _running = false;
    }
  }

  Future<void> _handleStatusChange(
    geofence.Geofence fence,
    geofence.GeofenceRadius radius,
    geofence.GeofenceStatus status,
    geofence.Location location,
  ) async {
    if (status != geofence.GeofenceStatus.ENTER) return;
    final reminder = _reminders[fence.id];
    if (reminder == null || _onEnter == null) return;
    await _onEnter!(reminder);
  }
}
