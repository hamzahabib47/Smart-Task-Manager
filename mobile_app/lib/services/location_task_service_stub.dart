import "location_task_models.dart";

class LocationTaskService {
  Future<bool> initialize() async {
    return false;
  }

  Future<void> updateGeofences(
    List<LocationTaskReminder> reminders,
    Future<void> Function(LocationTaskReminder reminder) onEnter,
  ) async {}

  Future<void> dispose() async {}
}
