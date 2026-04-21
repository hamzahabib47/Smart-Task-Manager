import "dart:async";
import "dart:convert";

import "package:flutter/material.dart";
import "package:http/http.dart" as http;
import "package:image_picker/image_picker.dart";

void main() {
  runApp(const SmartTimeManagerApp());
}

class SmartTimeManagerApp extends StatefulWidget {
  const SmartTimeManagerApp({super.key});

  @override
  State<SmartTimeManagerApp> createState() => _SmartTimeManagerAppState();
}

class _SmartTimeManagerAppState extends State<SmartTimeManagerApp> {
  String? token;
  String? signedInEmail;
  String? signedInName;

  void onLoggedIn(String newToken, String email, String name) {
    setState(() {
      token = newToken;
      signedInEmail = email;
      signedInName = name;
    });
  }

  void onLogout() {
    setState(() {
      token = null;
      signedInEmail = null;
      signedInName = null;
    });
  }

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      debugShowCheckedModeBanner: false,
      title: "Smart Task Manager",
      theme: ThemeData(
        useMaterial3: true,
        colorScheme: ColorScheme.fromSeed(seedColor: const Color(0xFF0D9488)),
        scaffoldBackgroundColor: const Color(0xFFF6F8FB),
        appBarTheme: const AppBarTheme(centerTitle: false),
        inputDecorationTheme: InputDecorationTheme(
          filled: true,
          fillColor: Colors.white,
          border: OutlineInputBorder(
            borderRadius: BorderRadius.circular(14),
          ),
          enabledBorder: OutlineInputBorder(
            borderRadius: BorderRadius.circular(14),
            borderSide: const BorderSide(color: Color(0xFFD0D7E2)),
          ),
        ),
      ),
      home: token == null
          ? AuthScreen(onLoggedIn: onLoggedIn)
          : TaskScreen(
              token: token!,
              onLogout: onLogout,
              signedInEmail: signedInEmail ?? "user@example.com",
              signedInName: signedInName ?? "User",
            ),
    );
  }
}

class ApiConfig {
  static const String baseUrl = "https://smart-task-manager-tan.vercel.app/api";
}

class Task {
  final String id;
  final String title;
  final String description;
  final String date;
  final String time;
  final bool completed;
  final bool archived;

  Task({
    required this.id,
    required this.title,
    required this.description,
    required this.date,
    required this.time,
    required this.completed,
    required this.archived,
  });

  factory Task.fromJson(Map<String, dynamic> json) {
    return Task(
      id: json["_id"] ?? "",
      title: json["title"] ?? "",
      description: json["description"] ?? "",
      date: json["date"] ?? "",
      time: json["time"] ?? "",
      completed: json["completed"] ?? false,
      archived: json["archived"] ?? false,
    );
  }
}

class PhotoItem {
  final String id;
  final String filename;
  final String url;

  PhotoItem({required this.id, required this.filename, required this.url});

  factory PhotoItem.fromJson(Map<String, dynamic> json) {
    return PhotoItem(
      id: json["_id"] ?? "",
      filename: json["filename"] ?? "",
      url: json["url"] ?? "",
    );
  }
}

class AlarmItem {
  final String id;
  final String label;
  final String date;
  final String time;
  final String recurrence;
  final bool enabled;
  final bool ringing;

  AlarmItem({
    required this.id,
    required this.label,
    required this.date,
    required this.time,
    required this.recurrence,
    required this.enabled,
    required this.ringing,
  });

  factory AlarmItem.fromJson(Map<String, dynamic> json) {
    return AlarmItem(
      id: json["_id"] ?? "",
      label: json["label"] ?? "",
      date: json["date"] ?? "",
      time: json["time"] ?? "",
      recurrence: json["recurrence"] ?? "none",
      enabled: json["enabled"] ?? true,
      ringing: json["ringing"] ?? false,
    );
  }
}

class AuthScreen extends StatefulWidget {
  final void Function(String token, String email, String name) onLoggedIn;

  const AuthScreen({super.key, required this.onLoggedIn});

  @override
  State<AuthScreen> createState() => _AuthScreenState();
}

class _AuthScreenState extends State<AuthScreen> {
  final TextEditingController loginEmailController = TextEditingController();
  final TextEditingController loginPasswordController = TextEditingController();
  final TextEditingController registerNameController = TextEditingController();
  final TextEditingController registerEmailController = TextEditingController();
  final TextEditingController registerPasswordController =
      TextEditingController();
  final TextEditingController registerConfirmPasswordController =
      TextEditingController();

  bool isLoading = false;
  String? loginEmailError;
  String? loginPasswordError;
  String? loginGeneralError;
  String? registerNameError;
  String? registerEmailError;
  String? registerPasswordError;
  String? registerConfirmPasswordError;
  String? registerGeneralError;

  void clearAuthErrors({required bool isRegister}) {
    if (isRegister) {
      registerNameError = null;
      registerEmailError = null;
      registerPasswordError = null;
      registerConfirmPasswordError = null;
      registerGeneralError = null;
      return;
    }

    loginEmailError = null;
    loginPasswordError = null;
    loginGeneralError = null;
  }

  Future<void> submit({required bool isRegister}) async {
    final registerName = registerNameController.text.trim();
    final email = (isRegister
            ? registerEmailController.text
            : loginEmailController.text)
        .trim();
    final password = (isRegister
            ? registerPasswordController.text
            : loginPasswordController.text)
        .trim();

    setState(() => clearAuthErrors(isRegister: isRegister));

    bool hasError = false;

    if (isRegister && registerName.isEmpty) {
      registerNameError = "Name is required";
      hasError = true;
    }

    if (email.isEmpty) {
      if (isRegister) {
        registerEmailError = "Email is required";
      } else {
        loginEmailError = "Email is required";
      }
      hasError = true;
    }

    if (password.isEmpty) {
      if (isRegister) {
        registerPasswordError = "Password is required";
      } else {
        loginPasswordError = "Password is required";
      }
      hasError = true;
    }

    if (!isRegister && hasError) {
      setState(() {});
      return;
    }

    if (isRegister) {
      if (password.length < 6) {
        registerPasswordError = "Password must be at least 6 characters";
        hasError = true;
      }

      final confirm = registerConfirmPasswordController.text.trim();
      if (confirm.isEmpty) {
        registerConfirmPasswordError = "Confirm password is required";
        hasError = true;
      }

      if (password != confirm) {
        registerConfirmPasswordError = "Passwords do not match";
        hasError = true;
      }

      if (hasError) {
        setState(() {});
        return;
      }
    }

    setState(() => isLoading = true);

    try {
      if (isRegister) {
        final registerResponse = await http.post(
          Uri.parse("${ApiConfig.baseUrl}/auth/register"),
          headers: {"Content-Type": "application/json"},
          body: json.encode({
            "name": registerName,
            "email": email,
            "password": password,
          }),
        );

        if (registerResponse.statusCode != 201) {
          final body = json.decode(registerResponse.body);
          final message = (body["message"] ?? "Registration failed").toString();
          setState(() {
            if (message.toLowerCase().contains("email")) {
              registerEmailError = message;
            } else if (message.toLowerCase().contains("password")) {
              registerPasswordError = message;
            } else if (message.toLowerCase().contains("name")) {
              registerNameError = message;
            } else {
              registerGeneralError = message;
            }
          });
          return;
        }
      }

      final loginResponse = await http.post(
        Uri.parse("${ApiConfig.baseUrl}/auth/login"),
        headers: {"Content-Type": "application/json"},
        body: json.encode({"email": email, "password": password}),
      );

      if (loginResponse.statusCode == 200) {
        final body = json.decode(loginResponse.body);
        final token = body["data"]?["token"];
        final apiName = (body["data"]?["user"]?["name"] ?? "").toString().trim();
        final fallbackName = isRegister
            ? registerName
            : email.split("@").first.trim();
        final resolvedName = apiName.isNotEmpty ? apiName : fallbackName;

        if (token is String && token.isNotEmpty) {
          widget.onLoggedIn(token, email, resolvedName);
        } else {
          setState(() {
            if (isRegister) {
              registerGeneralError = "Token missing in response";
            } else {
              loginGeneralError = "Token missing in response";
            }
          });
        }
      } else {
        final body = json.decode(loginResponse.body);
        final message = (body["message"] ?? "Sign in failed").toString();
        setState(() {
          if (isRegister) {
            registerGeneralError = message;
          } else {
            final lower = message.toLowerCase();
            if (lower.contains("email")) {
              loginEmailError = message;
            } else if (lower.contains("password")) {
              loginPasswordError = message;
            } else {
              loginGeneralError = message;
            }
          }
        });
      }
    } catch (_) {
      setState(() {
        if (isRegister) {
          registerGeneralError = "Server error";
        } else {
          loginGeneralError = "Server error";
        }
      });
    } finally {
      if (mounted) {
        setState(() => isLoading = false);
      }
    }
  }

  @override
  void dispose() {
    loginEmailController.dispose();
    loginPasswordController.dispose();
    registerNameController.dispose();
    registerEmailController.dispose();
    registerPasswordController.dispose();
    registerConfirmPasswordController.dispose();
    super.dispose();
  }

  Widget buildAuthForm({required bool isRegister}) {
    final emailController = isRegister
        ? registerEmailController
        : loginEmailController;
    final passwordController = isRegister
        ? registerPasswordController
        : loginPasswordController;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        const SizedBox(height: 14),
        if (isRegister) ...[
          TextField(
            controller: registerNameController,
            onChanged: (_) {
              if (registerNameError != null || registerGeneralError != null) {
                setState(() {
                  registerNameError = null;
                  registerGeneralError = null;
                });
              }
            },
            decoration: InputDecoration(
              labelText: "Name",
              prefixIcon: Icon(Icons.person_outline),
              errorText: registerNameError,
            ),
          ),
          const SizedBox(height: 12),
        ],
        TextField(
          controller: emailController,
          keyboardType: TextInputType.emailAddress,
          onChanged: (_) {
            setState(() {
              if (isRegister) {
                registerEmailError = null;
                registerGeneralError = null;
              } else {
                loginEmailError = null;
                loginGeneralError = null;
              }
            });
          },
          decoration: InputDecoration(
            labelText: "Email",
            prefixIcon: const Icon(Icons.alternate_email),
            errorText: isRegister ? registerEmailError : loginEmailError,
          ),
        ),
        const SizedBox(height: 12),
        TextField(
          controller: passwordController,
          obscureText: true,
          onChanged: (_) {
            setState(() {
              if (isRegister) {
                registerPasswordError = null;
                registerGeneralError = null;
              } else {
                loginPasswordError = null;
                loginGeneralError = null;
              }
            });
          },
          decoration: InputDecoration(
            labelText: "Password",
            prefixIcon: const Icon(Icons.lock_outline),
            errorText: isRegister ? registerPasswordError : loginPasswordError,
          ),
        ),
        if (isRegister) ...[
          const SizedBox(height: 12),
          TextField(
            controller: registerConfirmPasswordController,
            obscureText: true,
            onChanged: (_) {
              if (registerConfirmPasswordError != null ||
                  registerGeneralError != null) {
                setState(() {
                  registerConfirmPasswordError = null;
                  registerGeneralError = null;
                });
              }
            },
            decoration: InputDecoration(
              labelText: "Confirm Password",
              prefixIcon: const Icon(Icons.lock_reset_outlined),
              errorText: registerConfirmPasswordError,
            ),
          ),
        ],
        if ((isRegister ? registerGeneralError : loginGeneralError) != null) ...[
          const SizedBox(height: 8),
          Text(
            isRegister ? registerGeneralError! : loginGeneralError!,
            style: const TextStyle(
              color: Color(0xFFB91C1C),
              fontWeight: FontWeight.w600,
            ),
          ),
        ],
        const SizedBox(height: 16),
        FilledButton.icon(
          onPressed: isLoading ? null : () => submit(isRegister: isRegister),
          icon: Icon(isRegister ? Icons.person_add_alt : Icons.login),
          label: Text(isRegister ? "Register" : "Sign in"),
          style: FilledButton.styleFrom(
            backgroundColor: const Color(0xFFE95B0C),
            foregroundColor: Colors.white,
            minimumSize: const Size.fromHeight(48),
          ),
        ),
        const SizedBox(height: 8),
        Builder(
          builder: (context) {
            return TextButton(
              onPressed: isLoading
                  ? null
                  : () {
                      final controller = DefaultTabController.of(context);
                      controller.animateTo(isRegister ? 0 : 1);
                    },
              child: Text(
                isRegister
                    ? "Already have an account? Sign in"
                    : "Don't have an account? Register now",
              ),
            );
          },
        ),
      ],
    );
  }

  @override
  Widget build(BuildContext context) {
    return DefaultTabController(
      length: 2,
      child: Scaffold(
        body: Container(
          decoration: const BoxDecoration(
            gradient: LinearGradient(
              begin: Alignment.topCenter,
              end: Alignment.bottomCenter,
              colors: [Color(0xFFF5E9DA), Color(0xFFDCEDEA)],
            ),
          ),
          child: SafeArea(
            child: SingleChildScrollView(
              padding: const EdgeInsets.all(18),
              child: Center(
                child: ConstrainedBox(
                  constraints: const BoxConstraints(maxWidth: 430),
                  child: Card(
                    elevation: 0,
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(22),
                    ),
                    child: Padding(
                      padding: const EdgeInsets.all(18),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.stretch,
                        children: [
                          const Text(
                            "Smart Task Manager",
                            style: TextStyle(
                              fontSize: 34,
                              fontWeight: FontWeight.w900,
                              color: Color(0xFF0F172A),
                            ),
                          ),
                          const SizedBox(height: 6),
                          const Text(
                            "Sign in to continue or create a new account.",
                            style: TextStyle(
                              color: Color(0xFF6B7280),
                              fontSize: 15,
                            ),
                          ),
                          const SizedBox(height: 14),
                          const TabBar(
                            tabs: [
                              Tab(text: "Sign in"),
                              Tab(text: "Register"),
                            ],
                          ),
                          const SizedBox(height: 18),
                          SizedBox(
                            height: 420,
                            child: TabBarView(
                              children: [
                                buildAuthForm(isRegister: false),
                                buildAuthForm(isRegister: true),
                              ],
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}

class TaskScreen extends StatefulWidget {
  final String token;
  final VoidCallback onLogout;
  final String signedInEmail;
  final String signedInName;

  const TaskScreen({
    super.key,
    required this.token,
    required this.onLogout,
    required this.signedInEmail,
    required this.signedInName,
  });

  @override
  State<TaskScreen> createState() => _TaskScreenState();
}

class _TaskScreenState extends State<TaskScreen> {
  final TextEditingController titleController = TextEditingController();
  final TextEditingController descriptionController = TextEditingController();
  final TextEditingController dateController = TextEditingController();
  final TextEditingController timeController = TextEditingController();
  final TextEditingController slideshowIntervalController =
      TextEditingController();
  final TextEditingController dailySummaryTimeController =
      TextEditingController();
  final TextEditingController alarmLabelController = TextEditingController();
  final TextEditingController alarmDateController = TextEditingController();
  final TextEditingController alarmTimeController = TextEditingController();
  final TextEditingController deleteAccountConfirmController =
      TextEditingController();
  final TextEditingController changeNameController = TextEditingController();

  List<Task> tasks = [];
  List<PhotoItem> photos = [];
  List<AlarmItem> alarms = [];
  String selectedView = "upcoming";
  String selectedRecurrence = "none";
  bool isLoading = false;
  bool isUploadingPhoto = false;
  bool isDeletingAccount = false;
  bool isSyncingClock = false;
  bool slideshowEnabled = true;
  bool pushNotifications = true;
  bool buzzerAlerts = true;
  bool autoClockSync = true;
  bool archiveCompletedTasks = true;
  String selectedSinglePhotoId = "";
  String timeFormat = "12-hour";
  String reminderStyle = "full_screen";
  String clockSyncStatus = "";
  int selectedDashboardTab = 0;
  String headerTimeText = "--:--:--";
  String previewModeTitle = "Slideshow";
  String previewDescription = "No uploaded photos yet";
  String previewImageUrl = "";
  String previewTimeText = "--:--:--";
  String previewPrimaryText = "NO UPCOMING TASK";
  String previewSecondaryText = "";
  String previewMetaTop = "--:--";
  String previewMetaBottom = "";
  bool previewShowMeta = false;
  bool previewShowBanner = false;
  String previewBannerTitle = "Reminder";
  String previewBannerSubtitle = "";
  bool previewShowEmptyDisplayMessage = false;
  int? previewCountdownSeconds;
  String currentUserName = "";
  Timer? headerClockTimer;
  Timer? displayPollTimer;

  final ImagePicker imagePicker = ImagePicker();

  bool get canDeleteAccount =>
      deleteAccountConfirmController.text.trim() == "DELETE MY ACCOUNT";

  Map<String, String> get authHeaders => {
        "Content-Type": "application/json",
        "Authorization": "Bearer ${widget.token}",
      };

  @override
  void initState() {
    super.initState();
    currentUserName = widget.signedInName.trim();
    changeNameController.text = currentUserName;
    fetchTasks();
    fetchSettings();
    fetchPhotos();
    fetchAlarms();
    syncHeaderClock();
    startHeaderClock();
    fetchDisplayPreview();
    displayPollTimer = Timer.periodic(
      const Duration(seconds: 3),
      (_) => fetchDisplayPreview(),
    );
  }

  String _clockText(DateTime dt) {
    final m = dt.minute.toString().padLeft(2, "0");
    final s = dt.second.toString().padLeft(2, "0");

    if (timeFormat == "24-hour") {
      final h24 = dt.hour.toString().padLeft(2, "0");
      return "$h24:$m:$s";
    }

    final suffix = dt.hour >= 12 ? "PM" : "AM";
    final hour12 = dt.hour % 12 == 0 ? 12 : dt.hour % 12;
    final h12 = hour12.toString().padLeft(2, "0");
    return "$h12:$m:$s $suffix";
  }

  String _userDisplayName() {
    final rawName = currentUserName.trim();
    if (rawName.isEmpty) return "User";
    final normalized = rawName.replaceAll(RegExp(r"[._-]+"), " ").trim();
    if (normalized.isEmpty) return "User";
    return normalized
        .split(RegExp(r"\s+"))
        .where((word) => word.isNotEmpty)
        .map(
          (word) =>
              "${word[0].toUpperCase()}${word.substring(1).toLowerCase()}",
        )
        .join(" ");
  }

  String _timeGreeting() {
    final hour = DateTime.now().hour;
    if (hour >= 5 && hour < 12) return "Good Morning";
    if (hour >= 12 && hour < 17) return "Good Afternoon";
    if (hour >= 17 && hour < 21) return "Good Evening";
    return "Good Night";
  }

  Future<void> confirmSignOut() async {
    final shouldLogout = await showDialog<bool>(
      context: context,
      builder: (context) {
        return AlertDialog(
          title: const Text("Sign out"),
          content: const Text("Are you sure to sign out?"),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(context, false),
              child: const Text("No"),
            ),
            FilledButton(
              onPressed: () => Navigator.pop(context, true),
              child: const Text("Yes"),
            ),
          ],
        );
      },
    );

    if (shouldLogout == true && mounted) {
      widget.onLogout();
    }
  }

  void syncHeaderClock() {
    if (!mounted) return;
    setState(() => headerTimeText = _clockText(DateTime.now()));
  }

  void startHeaderClock() {
    headerClockTimer?.cancel();
    headerClockTimer = Timer.periodic(
      const Duration(seconds: 1),
      (_) => syncHeaderClock(),
    );
  }

  String formatTimeByPreference(String hhmm) {
    if (timeFormat == "24-hour") return hhmm;
    final parts = hhmm.split(":");
    if (parts.length != 2) return hhmm;
    final hour = int.tryParse(parts[0]);
    final minute = int.tryParse(parts[1]);
    if (hour == null || minute == null) return hhmm;
    final suffix = hour >= 12 ? "PM" : "AM";
    final h12 = hour % 12 == 0 ? 12 : hour % 12;
    final mm = minute.toString().padLeft(2, "0");
    return "${h12.toString().padLeft(2, "0")}:$mm $suffix";
  }

  String toDisplayImageUrl(String url) {
    if (url.isEmpty) return "";
    if (url.startsWith("http://") || url.startsWith("https://")) return url;
    return "${ApiConfig.baseUrl.replaceFirst('/api', '')}$url";
  }

  String _formatPreviewDateTime(Map<String, dynamic>? task, String preferred) {
    final date = (task?["date"] ?? "").toString().trim();
    final time = preferred.trim().isNotEmpty
        ? preferred.trim()
        : (task?["time"] ?? "").toString().trim();
    final combined = "$date $time".trim();
    return combined.isEmpty ? "--:--" : combined;
  }

  Future<void> fetchDisplayPreview() async {
    try {
      final response = await http.get(
        Uri.parse("${ApiConfig.baseUrl}/tasks/public/display-state"),
      );

      if (response.statusCode != 200) return;

      final body = json.decode(response.body) as Map<String, dynamic>;
      if (body["success"] != true || !mounted) return;

      final mode = (body["mode"] ?? "slideshow").toString();
      final photos = (body["slideshowPhotos"] as List<dynamic>? ?? [])
          .map((e) => e.toString())
          .where((e) => e.isNotEmpty)
          .toList();

      String nextImage = "";
      String nextDescription = "";
      String nextModeTitle = "Slideshow";
      String nextPrimary = "NO UPCOMING TASK";
      String nextSecondary = "";
      String nextMetaTop = "--:--";
      String nextMetaBottom = "";
      bool nextShowMeta = false;
      bool nextShowBanner = false;
      String nextBannerTitle = "Reminder";
      String nextBannerSubtitle = "";
      bool nextShowEmptyDisplayMessage = false;
      int? nextCountdownSeconds;
      final firstPhoto = photos.isEmpty ? "" : toDisplayImageUrl(photos.first);

      if (mode == "single_image") {
        nextModeTitle = "Single Image";
        nextImage = toDisplayImageUrl((body["singleImage"] ?? "").toString());
        nextPrimary = "NO UPCOMING TASK";
        nextDescription = nextImage.isEmpty
            ? "Add Images from mobile app to show on the display"
            : "";
        nextShowEmptyDisplayMessage = nextImage.isEmpty;
      } else if (mode == "slideshow") {
        nextModeTitle = "Slideshow";
        nextImage = firstPhoto;
        nextPrimary = "NO UPCOMING TASK";
        nextDescription = "";
        nextShowEmptyDisplayMessage = photos.isEmpty;
      } else if (mode == "alarm") {
        nextModeTitle = "Alarm";
        final alarm = body["alarm"] as Map<String, dynamic>?;
        final alarmTime = (body["alarmTimeFormatted"] ?? alarm?["time"] ?? "--:--")
            .toString();
        final alarmLabel = (alarm?["label"] ?? "Alarm").toString();
        nextImage = firstPhoto;
        nextPrimary = alarmLabel;
        nextSecondary = "Alarm active";
        nextMetaTop = "${(alarm?["recurrence"] ?? "none")} @ $alarmTime";
        nextMetaBottom = "Alarm running";
        nextShowMeta = true;
        final style = (body["reminderStyle"] ?? "full_screen").toString();
        if (style == "banner") {
          nextShowBanner = true;
          nextBannerTitle = "Alarm";
          nextBannerSubtitle = "$alarmLabel at $alarmTime";
        }
        nextCountdownSeconds =
            (body["autoStopRemainingSeconds"] ?? body["autoStopSeconds"] ?? 30)
                as int?;
      } else if (mode == "reminder") {
        nextModeTitle = "Reminder";
        final reminder = body["reminder"] as Map<String, dynamic>?;
        final title = (reminder?["title"] ?? "Task").toString();
        final dateTime = _formatPreviewDateTime(
          reminder,
          (body["reminderTimeFormatted"] ?? "").toString(),
        );
        nextImage = firstPhoto;
        nextPrimary = title;
        nextSecondary =
            (reminder?["description"] ?? "Task reminder active").toString();
        final style = (body["reminderStyle"] ?? "full_screen").toString();
        if (style == "banner") {
          nextShowBanner = true;
          nextBannerTitle = "Reminder";
          nextBannerSubtitle = "$title at $dateTime";
        }
        nextCountdownSeconds = (body["autoDismissRemainingSeconds"] ??
            body["autoDismissSeconds"] ??
            30) as int?;
      } else if (mode == "upcoming") {
        nextModeTitle = "Upcoming";
        final nextReminder = body["nextReminder"] as Map<String, dynamic>?;
        final title = (nextReminder?["title"] ?? "TASK").toString();
        final dateTime = _formatPreviewDateTime(
          nextReminder,
          (body["nextReminderTimeFormatted"] ?? "").toString(),
        );
        nextImage = firstPhoto;
        nextPrimary = "UPCOMING TASK";
        nextMetaTop = title;
        nextMetaBottom = dateTime;
        nextShowMeta = true;
      } else if (mode == "daily_summary") {
        nextModeTitle = "Daily Summary";
        final count = (body["summary"]?["remainingCount"] ?? 0).toString();
        nextDescription = "Remaining tasks: $count";
      } else {
        nextImage = firstPhoto;
        nextShowEmptyDisplayMessage = firstPhoto.isEmpty;
      }

      setState(() {
        previewModeTitle = nextModeTitle;
        previewDescription = nextDescription;
        previewImageUrl = nextImage;
        previewTimeText = _clockText(DateTime.now());
        previewPrimaryText = nextPrimary;
        previewSecondaryText = nextSecondary;
        previewMetaTop = nextMetaTop;
        previewMetaBottom = nextMetaBottom;
        previewShowMeta = nextShowMeta;
        previewShowBanner = nextShowBanner;
        previewBannerTitle = nextBannerTitle;
        previewBannerSubtitle = nextBannerSubtitle;
        previewShowEmptyDisplayMessage = nextShowEmptyDisplayMessage;
        previewCountdownSeconds = nextCountdownSeconds;
      });
    } catch (_) {
      // Keep last preview state if display polling fails temporarily.
    }
  }

  String formatDate(DateTime date) {
    final y = date.year.toString().padLeft(4, "0");
    final m = date.month.toString().padLeft(2, "0");
    final d = date.day.toString().padLeft(2, "0");
    return "$y-$m-$d";
  }

  String formatTime(TimeOfDay time) {
    final h = time.hour.toString().padLeft(2, "0");
    final m = time.minute.toString().padLeft(2, "0");
    return "$h:$m";
  }

  Future<void> pickTaskDate() async {
    final now = DateTime.now();
    final picked = await showDatePicker(
      context: context,
      initialDate: now,
      firstDate: DateTime(now.year - 2),
      lastDate: DateTime(now.year + 5),
    );

    if (picked != null) {
      setState(() => dateController.text = formatDate(picked));
    }
  }

  Future<void> pickTaskTime() async {
    final picked = await showTimePicker(
      context: context,
      initialTime: TimeOfDay.now(),
    );

    if (picked != null) {
      setState(() => timeController.text = formatTime(picked));
    }
  }

  Future<void> pickAlarmDate() async {
    final now = DateTime.now();
    final picked = await showDatePicker(
      context: context,
      initialDate: now,
      firstDate: DateTime(now.year - 2),
      lastDate: DateTime(now.year + 5),
    );

    if (picked != null) {
      setState(() => alarmDateController.text = formatDate(picked));
    }
  }

  Future<void> pickAlarmTime() async {
    final picked = await showTimePicker(
      context: context,
      initialTime: TimeOfDay.now(),
    );

    if (picked != null) {
      setState(() => alarmTimeController.text = formatTime(picked));
    }
  }

  Future<void> pickDailySummaryTime() async {
    final picked = await showTimePicker(
      context: context,
      initialTime: TimeOfDay.now(),
    );

    if (picked != null) {
      setState(
        () => dailySummaryTimeController.text = formatTime(picked),
      );
    }
  }

  Future<void> fetchAlarms() async {
    try {
      final response = await http.get(
        Uri.parse("${ApiConfig.baseUrl}/alarms"),
        headers: authHeaders,
      );

      if (response.statusCode == 200) {
        final body = json.decode(response.body);
        final List<dynamic> data = body["data"] ?? [];
        if (!mounted) return;
        setState(() {
          alarms = data.map((item) => AlarmItem.fromJson(item)).toList();
        });
      } else if (response.statusCode == 401) {
        widget.onLogout();
      } else {
        showMessage("Could not fetch alarms");
      }
    } catch (_) {
      showMessage("Server error while fetching alarms");
    }
  }

  Future<void> addAlarm() async {
    final label = alarmLabelController.text.trim();
    final date = alarmDateController.text.trim();
    final time = alarmTimeController.text.trim();

    if (label.isEmpty || time.isEmpty) {
      showMessage("Please fill alarm label and time");
      return;
    }

    if (selectedRecurrence == "none" && date.isEmpty) {
      showMessage("Please add date for one-time alarm");
      return;
    }

    try {
      final response = await http.post(
        Uri.parse("${ApiConfig.baseUrl}/alarms"),
        headers: authHeaders,
        body: json.encode({
          "label": label,
          "date": date,
          "time": time,
          "recurrence": selectedRecurrence,
        }),
      );

      if (response.statusCode == 201) {
        alarmLabelController.clear();
        alarmDateController.clear();
        alarmTimeController.clear();
        await fetchAlarms();
      } else if (response.statusCode == 401) {
        widget.onLogout();
      } else {
        final body = json.decode(response.body);
        showMessage(body["message"] ?? "Could not create alarm");
      }
    } catch (_) {
      showMessage("Server error while creating alarm");
    }
  }

  Future<void> stopAlarm(String alarmId) async {
    try {
      final response = await http.patch(
        Uri.parse("${ApiConfig.baseUrl}/alarms/$alarmId/stop"),
        headers: authHeaders,
      );

      if (response.statusCode == 200) {
        await fetchAlarms();
      } else if (response.statusCode == 401) {
        widget.onLogout();
      } else {
        showMessage("Could not stop alarm");
      }
    } catch (_) {
      showMessage("Server error while stopping alarm");
    }
  }

  Future<void> toggleAlarm(String alarmId, bool enabled) async {
    try {
      final response = await http.patch(
        Uri.parse("${ApiConfig.baseUrl}/alarms/$alarmId/toggle"),
        headers: authHeaders,
        body: json.encode({"enabled": enabled}),
      );

      if (response.statusCode == 200) {
        await fetchAlarms();
      } else if (response.statusCode == 401) {
        widget.onLogout();
      } else {
        showMessage("Could not update alarm");
      }
    } catch (_) {
      showMessage("Server error while updating alarm");
    }
  }

  Future<void> deleteAlarm(String alarmId) async {
    try {
      final response = await http.delete(
        Uri.parse("${ApiConfig.baseUrl}/alarms/$alarmId"),
        headers: authHeaders,
      );

      if (response.statusCode == 200) {
        await fetchAlarms();
      } else if (response.statusCode == 401) {
        widget.onLogout();
      } else {
        showMessage("Could not delete alarm");
      }
    } catch (_) {
      showMessage("Server error while deleting alarm");
    }
  }

  Future<void> fetchSettings() async {
    try {
      final response = await http.get(
        Uri.parse("${ApiConfig.baseUrl}/settings"),
        headers: authHeaders,
      );

      if (response.statusCode == 200) {
        final body = json.decode(response.body);
        final data = body["data"] as Map<String, dynamic>?;
        if (!mounted) return;
        slideshowIntervalController.text =
            (data?["slideshowIntervalSeconds"] ?? 5).toString();
        dailySummaryTimeController.text =
            (data?["dailySummaryTime"] ?? "08:00").toString();
        setState(() {
          slideshowEnabled = data?["slideshowEnabled"] ?? true;
          selectedSinglePhotoId = data?["selectedSinglePhotoId"] ?? "";
          pushNotifications = data?["pushNotifications"] ?? true;
          buzzerAlerts = data?["buzzerAlerts"] ?? true;
          autoClockSync = data?["autoClockSync"] ?? true;
          archiveCompletedTasks = data?["archiveCompletedTasks"] ?? true;
          final incomingTimeFormat =
            (data?["timeFormat"] ?? "12-hour").toString();
          final incomingReminderStyle =
            (data?["reminderStyle"] ?? "full_screen").toString();
          timeFormat =
            incomingTimeFormat == "24-hour" ? "24-hour" : "12-hour";
          reminderStyle = incomingReminderStyle == "banner"
            ? "banner"
            : "full_screen";
        });
      } else if (response.statusCode == 401) {
        widget.onLogout();
      }
    } catch (_) {
      showMessage("Could not load settings");
    }
  }

  Future<void> saveSettings({bool showSuccess = true}) async {
    final parsed = int.tryParse(slideshowIntervalController.text.trim());
    final dailySummaryTime = dailySummaryTimeController.text.trim();

    if (parsed == null) {
      showMessage("Enter numeric slideshow interval");
      return;
    }

    final isValidTime = RegExp(r"^([01]?\d|2[0-3]):([0-5]\d)$")
        .hasMatch(dailySummaryTime);
    if (!isValidTime) {
      showMessage("Daily summary time must be HH:MM");
      return;
    }

    try {
      final response = await http.put(
        Uri.parse("${ApiConfig.baseUrl}/settings"),
        headers: authHeaders,
        body: json.encode({
          "slideshowIntervalSeconds": parsed,
          "dailySummaryTime": dailySummaryTime,
          "slideshowEnabled": slideshowEnabled,
          "selectedSinglePhotoId": selectedSinglePhotoId,
          "pushNotifications": pushNotifications,
          "buzzerAlerts": buzzerAlerts,
          "autoClockSync": autoClockSync,
          "archiveCompletedTasks": archiveCompletedTasks,
          "timeFormat": timeFormat,
          "reminderStyle": reminderStyle,
        }),
      );

      if (response.statusCode == 200) {
        if (showSuccess) {
          showMessage("Display settings updated");
        }
      } else if (response.statusCode == 401) {
        widget.onLogout();
      } else {
        final body = json.decode(response.body);
        showMessage(body["message"] ?? "Could not update settings");
      }
    } catch (_) {
      showMessage("Server error while updating settings");
    }
  }

  Future<void> syncDeviceClock() async {
    if (!mounted) return;
    setState(() => isSyncingClock = true);

    try {
      final now = DateTime.now();
      final response = await http.post(
        Uri.parse("${ApiConfig.baseUrl}/device/clock-sync"),
        headers: authHeaders,
        body: json.encode({
          "deviceTime": now.toIso8601String(),
          "timezoneOffsetMinutes": now.timeZoneOffset.inMinutes,
          "protocolVersion": "1.0",
        }),
      );

      if (response.statusCode == 200) {
        final body = json.decode(response.body);
        final data = body["data"] as Map<String, dynamic>?;
        if (!mounted) return;
        setState(() {
          clockSyncStatus =
              "Clock synced at ${data?["syncedAt"] ?? now.toIso8601String()}";
        });
      } else if (response.statusCode == 401) {
        widget.onLogout();
      } else {
        final body = json.decode(response.body);
        if (!mounted) return;
        setState(() {
          clockSyncStatus = body["message"] ?? "Clock sync failed";
        });
      }
    } catch (_) {
      if (!mounted) return;
      setState(() => clockSyncStatus = "Server error while syncing clock");
    } finally {
      if (mounted) {
        setState(() => isSyncingClock = false);
      }
    }
  }

  Future<void> deleteMyAccount() async {
    final confirmation = deleteAccountConfirmController.text.trim();

    if (confirmation != "DELETE MY ACCOUNT") {
      showMessage("Type DELETE MY ACCOUNT in all caps to delete account");
      return;
    }

    setState(() => isDeletingAccount = true);

    try {
      final response = await http.delete(
        Uri.parse("${ApiConfig.baseUrl}/auth/account"),
        headers: authHeaders,
        body: json.encode({"confirmationText": confirmation}),
      );

      if (response.statusCode == 200) {
        if (!mounted) return;
        showMessage("Account deleted successfully");
        widget.onLogout();
      } else if (response.statusCode == 401) {
        widget.onLogout();
      } else {
        final body = json.decode(response.body);
        showMessage(body["message"] ?? "Could not delete account");
      }
    } catch (_) {
      showMessage("Server error while deleting account");
    } finally {
      if (mounted) {
        setState(() => isDeletingAccount = false);
      }
    }
  }

  Future<void> updateUserName() async {
    final nextName = changeNameController.text.trim();

    if (nextName.isEmpty) {
      showMessage("Please enter a new name");
      return;
    }

    try {
      final response = await http.patch(
        Uri.parse("${ApiConfig.baseUrl}/auth/name"),
        headers: authHeaders,
        body: json.encode({"name": nextName}),
      );

      if (response.statusCode == 200) {
        final body = json.decode(response.body) as Map<String, dynamic>;
        final updatedName =
            (body["data"]?["name"] ?? nextName).toString().trim();

        if (!mounted) return;
        setState(() {
          currentUserName = updatedName;
          changeNameController.text = updatedName;
          changeNameController.selection = TextSelection.collapsed(
            offset: updatedName.length,
          );
        });
        showMessage("Name changed successfully");
      } else if (response.statusCode == 401) {
        widget.onLogout();
      } else {
        final body = json.decode(response.body);
        showMessage(body["message"] ?? "Could not change name");
      }
    } catch (_) {
      showMessage("Server error while changing name");
    }
  }

  Future<void> fetchPhotos() async {
    try {
      final response = await http.get(
        Uri.parse("${ApiConfig.baseUrl}/photos"),
        headers: authHeaders,
      );

      if (response.statusCode == 200) {
        final body = json.decode(response.body);
        final List<dynamic> data = body["data"] ?? [];
        final photoItems = data
            .map((item) => PhotoItem.fromJson(item))
            .toList();

        final hasSelected = photoItems.any(
          (item) => item.id == selectedSinglePhotoId,
        );
        final nextSelected = hasSelected
            ? selectedSinglePhotoId
            : (photoItems.isNotEmpty ? photoItems.first.id : "");

        if (!mounted) return;
        setState(() {
          photos = photoItems;
          selectedSinglePhotoId = nextSelected;
        });
      } else if (response.statusCode == 401) {
        widget.onLogout();
      } else {
        showMessage("Could not fetch photos");
      }
    } catch (_) {
      showMessage("Server error while fetching photos");
    }
  }

  Future<void> uploadPhoto() async {
    final picked = await imagePicker.pickImage(source: ImageSource.gallery);
    if (picked == null) {
      return;
    }

    if (!mounted) return;
    setState(() => isUploadingPhoto = true);

    try {
      final bytes = await picked.readAsBytes();
      if (bytes.isEmpty) {
        showMessage("Selected image is empty");
        return;
      }

      final fileName = picked.name.isNotEmpty
          ? picked.name
          : "photo_${DateTime.now().millisecondsSinceEpoch}.jpg";

      final request = http.MultipartRequest(
        "POST",
        Uri.parse("${ApiConfig.baseUrl}/photos/upload"),
      );

      request.headers["Authorization"] = "Bearer ${widget.token}";
      request.files.add(
        http.MultipartFile.fromBytes(
          "photo",
          bytes,
          filename: fileName,
        ),
      );

      final streamed = await request.send();
      final response = await http.Response.fromStream(streamed);

      if (response.statusCode == 201) {
        await fetchPhotos();
        showMessage("Photo uploaded");
      } else if (response.statusCode == 401) {
        widget.onLogout();
      } else {
        final body = json.decode(response.body);
        showMessage(body["message"] ?? "Upload failed");
      }
    } catch (_) {
      showMessage("Server error while uploading photo");
    } finally {
      if (mounted) {
        setState(() => isUploadingPhoto = false);
      }
    }
  }

  Future<void> deletePhoto(String photoId) async {
    try {
      final response = await http.delete(
        Uri.parse("${ApiConfig.baseUrl}/photos/$photoId"),
        headers: authHeaders,
      );

      if (response.statusCode == 200) {
        await fetchPhotos();
      } else if (response.statusCode == 401) {
        widget.onLogout();
      } else {
        showMessage("Could not delete photo");
      }
    } catch (_) {
      showMessage("Server error while deleting photo");
    }
  }

  Future<void> fetchTasks() async {
    if (!mounted) return;
    setState(() => isLoading = true);

    try {
      final isArchivedView = selectedView == "archived";
      final response = await http.get(
        Uri.parse(
          "${ApiConfig.baseUrl}/tasks?archived=${isArchivedView ? "true" : "false"}",
        ),
        headers: authHeaders,
      );

      if (response.statusCode == 200) {
        final body = json.decode(response.body);
        final List<dynamic> data = body["data"] ?? [];

        if (!mounted) return;
        setState(() {
          tasks = data.map((item) => Task.fromJson(item)).toList();
        });
      } else if (response.statusCode == 401) {
        widget.onLogout();
      } else {
        showMessage("Could not fetch tasks");
      }
    } catch (_) {
      showMessage("Server error while fetching tasks");
    } finally {
      if (mounted) {
        setState(() => isLoading = false);
      }
    }
  }

  Future<void> addTask() async {
    final title = titleController.text.trim();
    final description = descriptionController.text.trim();
    final date = dateController.text.trim();
    final time = timeController.text.trim();

    if (title.isEmpty || date.isEmpty || time.isEmpty) {
      showMessage("Please fill title, date and time");
      return;
    }

    try {
      final response = await http.post(
        Uri.parse("${ApiConfig.baseUrl}/tasks"),
        headers: authHeaders,
        body: json.encode({
          "title": title,
          "description": description,
          "date": date,
          "time": time,
        }),
      );

      if (response.statusCode == 201) {
        titleController.clear();
        descriptionController.clear();
        dateController.clear();
        timeController.clear();
        await fetchTasks();
      } else if (response.statusCode == 401) {
        widget.onLogout();
      } else {
        final body = json.decode(response.body);
        showMessage(body["message"] ?? "Could not add task");
      }
    } catch (_) {
      showMessage("Server error while adding task");
    }
  }

  Future<void> deleteTask(String taskId) async {
    try {
      final response = await http.delete(
        Uri.parse("${ApiConfig.baseUrl}/tasks/$taskId"),
        headers: authHeaders,
      );

      if (response.statusCode == 200) {
        await fetchTasks();
      } else if (response.statusCode == 401) {
        widget.onLogout();
      } else {
        showMessage("Could not delete task");
      }
    } catch (_) {
      showMessage("Server error while deleting task");
    }
  }

  Future<void> completeTask(String taskId) async {
    try {
      final response = await http.patch(
        Uri.parse("${ApiConfig.baseUrl}/tasks/$taskId/complete"),
        headers: authHeaders,
      );

      if (response.statusCode == 200) {
        await fetchTasks();
      } else if (response.statusCode == 401) {
        widget.onLogout();
      } else {
        showMessage("Could not complete task");
      }
    } catch (_) {
      showMessage("Server error while completing task");
    }
  }

  Future<void> archiveTask(String taskId) async {
    try {
      final response = await http.patch(
        Uri.parse("${ApiConfig.baseUrl}/tasks/$taskId/archive"),
        headers: authHeaders,
      );

      if (response.statusCode == 200) {
        await fetchTasks();
      } else if (response.statusCode == 401) {
        widget.onLogout();
      } else {
        showMessage("Could not archive task");
      }
    } catch (_) {
      showMessage("Server error while archiving task");
    }
  }

  Future<void> dismissTask(String taskId) async {
    try {
      final response = await http.patch(
        Uri.parse("${ApiConfig.baseUrl}/tasks/$taskId/dismiss"),
        headers: authHeaders,
      );

      if (response.statusCode == 200) {
        await fetchTasks();
      } else if (response.statusCode == 401) {
        widget.onLogout();
      } else {
        showMessage("Could not dismiss reminder");
      }
    } catch (_) {
      showMessage("Server error while dismissing reminder");
    }
  }

  DateTime? _taskDateTime(Task task) {
    final date = task.date.trim();
    final time = task.time.trim();
    if (date.isEmpty || time.isEmpty) return null;
    return DateTime.tryParse("${date}T${time}:00");
  }

  List<Task> get visibleTasks {
    if (selectedView == "completed") {
      return tasks.where((task) => task.completed).toList();
    }

    if (selectedView == "upcoming") {
      final now = DateTime.now();
      return tasks.where((task) {
        if (task.completed || task.archived) return false;
        final scheduled = _taskDateTime(task);
        if (scheduled == null) return false;
        return scheduled.isAfter(now) || scheduled.isAtSameMomentAs(now);
      }).toList();
    }

    return tasks;
  }

  Future<void> editTask(Task task) async {
    final editTitle = TextEditingController(text: task.title);
    final editDescription = TextEditingController(text: task.description);
    final editDate = TextEditingController(text: task.date);
    final editTime = TextEditingController(text: task.time);

    final saved = await showDialog<bool>(
      context: context,
      builder: (context) {
        return AlertDialog(
          title: const Text("Edit Task"),
          content: SingleChildScrollView(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                TextField(
                  controller: editTitle,
                  decoration: const InputDecoration(labelText: "Title"),
                ),
                TextField(
                  controller: editDescription,
                  decoration: const InputDecoration(labelText: "Description"),
                ),
                TextField(
                  controller: editDate,
                  decoration: const InputDecoration(labelText: "Date"),
                ),
                TextField(
                  controller: editTime,
                  decoration: const InputDecoration(labelText: "Time"),
                ),
              ],
            ),
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(context, false),
              child: const Text("Cancel"),
            ),
            ElevatedButton(
              onPressed: () => Navigator.pop(context, true),
              child: const Text("Save"),
            ),
          ],
        );
      },
    );

    if (saved != true) return;

    try {
      final response = await http.put(
        Uri.parse("${ApiConfig.baseUrl}/tasks/${task.id}"),
        headers: authHeaders,
        body: json.encode({
          "title": editTitle.text.trim(),
          "description": editDescription.text.trim(),
          "date": editDate.text.trim(),
          "time": editTime.text.trim(),
        }),
      );

      if (response.statusCode == 200) {
        await fetchTasks();
      } else if (response.statusCode == 401) {
        widget.onLogout();
      } else {
        showMessage("Could not update task");
      }
    } catch (_) {
      showMessage("Server error while updating task");
    } finally {
      editTitle.dispose();
      editDescription.dispose();
      editDate.dispose();
      editTime.dispose();
    }
  }

  void showMessage(String message) {
    if (!mounted) return;
    ScaffoldMessenger.of(context)
        .showSnackBar(SnackBar(content: Text(message)));
  }

  Widget sectionCard({
    required String title,
    required IconData icon,
    required Widget child,
  }) {
    return Card(
      elevation: 0,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
      child: Padding(
        padding: const EdgeInsets.all(14),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Row(
              children: [
                Icon(icon, size: 18),
                const SizedBox(width: 8),
                Text(
                  title,
                  style: const TextStyle(
                    fontWeight: FontWeight.w700,
                    fontSize: 15,
                  ),
                ),
              ],
            ),
            const SizedBox(height: 12),
            child,
          ],
        ),
      ),
    );
  }

  Widget buildDashboardTabs() {
    final tabs = ["Photos", "Task", "Alarm", "Display", "Settings", "Sign out"];
    return Container(
      padding: const EdgeInsets.all(10),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(18),
      ),
      child: Wrap(
        spacing: 8,
        runSpacing: 8,
        children: List.generate(tabs.length, (index) {
          final tabLabel = tabs[index];
          final isSignOutTab = tabLabel == "Sign out";
          final selected = !isSignOutTab && selectedDashboardTab == index;
          final tabBackgroundColor = selected
              ? const Color(0xFFE95B0C)
              : (isSignOutTab ? const Color(0xFFFFF1F2) : Colors.white);
          final tabTextColor = selected
              ? Colors.white
              : (isSignOutTab ? const Color(0xFFB91C1C) : const Color(0xFF0F172A));

          return InkWell(
            borderRadius: BorderRadius.circular(12),
            onTap: () async {
              if (isSignOutTab) {
                await confirmSignOut();
                return;
              }
              setState(() => selectedDashboardTab = index);
            },
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 9),
              decoration: BoxDecoration(
                color: tabBackgroundColor,
                borderRadius: BorderRadius.circular(12),
                border: Border.all(color: const Color(0xFFE5E7EB)),
              ),
              child: Text(
                tabLabel,
                style: TextStyle(
                  color: tabTextColor,
                  fontWeight: FontWeight.w600,
                ),
              ),
            ),
          );
        }),
      ),
    );
  }

  Widget buildDeviceDisplayCard() {
    final modeLabel = previewModeTitle.toUpperCase();
    final hasImage = previewImageUrl.isNotEmpty;
    final isReminderStyle = previewModeTitle == "Reminder" || previewModeTitle == "Alarm";

    return Card(
      elevation: 0,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(24)),
      child: Padding(
        padding: const EdgeInsets.all(22),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            const Text(
              "Device Display",
              style: TextStyle(
                fontSize: 22,
                fontWeight: FontWeight.w800,
                color: Color(0xFF111827),
              ),
            ),
            const SizedBox(height: 4),
            const Text(
              "Preview what your device is showing now.",
              style: TextStyle(color: Color(0xFF6B7280)),
            ),
            const SizedBox(height: 14),
            Container(
              decoration: BoxDecoration(
                color: const Color(0xFF0B1737),
                borderRadius: BorderRadius.circular(18),
              ),
              padding: const EdgeInsets.all(12),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Expanded(
                        child: Text(
                          modeLabel,
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: const TextStyle(
                            color: Colors.white,
                            fontWeight: FontWeight.w700,
                            letterSpacing: 0.6,
                          ),
                        ),
                      ),
                      Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          if (previewCountdownSeconds != null)
                            Container(
                              margin: const EdgeInsets.only(right: 6),
                              padding: const EdgeInsets.symmetric(
                                horizontal: 8,
                                vertical: 4,
                              ),
                              decoration: BoxDecoration(
                                color: const Color(0xFF713F12),
                                borderRadius: BorderRadius.circular(999),
                                border: Border.all(
                                  color: const Color(0xFFFACC15),
                                ),
                              ),
                              child: Text(
                                "${previewCountdownSeconds}s",
                                style: const TextStyle(
                                  color: Color(0xFFFEF08A),
                                  fontSize: 11,
                                  fontWeight: FontWeight.w700,
                                ),
                              ),
                            ),
                          Text(
                            previewTimeText,
                            style: const TextStyle(color: Colors.white70),
                          ),
                        ],
                      ),
                    ],
                  ),
                  const SizedBox(height: 10),
                  SizedBox(
                    height: 230,
                    child: Stack(
                      children: [
                        Container(
                          decoration: BoxDecoration(
                            borderRadius: BorderRadius.circular(12),
                            border: Border.all(color: const Color(0xFF334155)),
                            gradient: !hasImage
                                ? const LinearGradient(
                                    colors: [Color(0xFF0F172A), Color(0xFF1E293B)],
                                  )
                                : null,
                          ),
                          clipBehavior: Clip.antiAlias,
                          child: hasImage
                              ? Image.network(
                                  previewImageUrl,
                                  width: double.infinity,
                                  height: double.infinity,
                                  fit: BoxFit.contain,
                                  errorBuilder: (_, __, ___) {
                                    return const SizedBox.shrink();
                                  },
                                )
                              : const SizedBox.expand(),
                        ),
                        if (previewShowEmptyDisplayMessage)
                          const Center(
                            child: Padding(
                              padding: EdgeInsets.symmetric(horizontal: 16),
                              child: Text(
                                "Add Images from mobile app to show on the display",
                                textAlign: TextAlign.center,
                                style: TextStyle(
                                  color: Color(0xFFE2E8F0),
                                  fontWeight: FontWeight.w700,
                                  fontSize: 15,
                                ),
                              ),
                            ),
                          ),
                        Positioned(
                          left: 10,
                          right: isReminderStyle ? 10 : null,
                          bottom: 10,
                          child: Container(
                            constraints: const BoxConstraints(maxWidth: 270),
                            padding: const EdgeInsets.all(10),
                            decoration: BoxDecoration(
                              color: const Color(0xCC0F172A),
                              borderRadius: BorderRadius.circular(12),
                              border: Border.all(color: const Color(0x475A6A81)),
                            ),
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(
                                  previewPrimaryText,
                                  maxLines: 2,
                                  overflow: TextOverflow.ellipsis,
                                  style: const TextStyle(
                                    color: Colors.white,
                                    fontWeight: FontWeight.w800,
                                  ),
                                ),
                                if (previewSecondaryText.isNotEmpty) ...[
                                  const SizedBox(height: 4),
                                  Text(
                                    previewSecondaryText,
                                    maxLines: 2,
                                    overflow: TextOverflow.ellipsis,
                                    style: const TextStyle(
                                      color: Color(0xFFE2E8F0),
                                      fontSize: 12,
                                    ),
                                  ),
                                ],
                                if (previewShowMeta) ...[
                                  const SizedBox(height: 6),
                                  Container(
                                    padding: const EdgeInsets.symmetric(
                                      horizontal: 8,
                                      vertical: 4,
                                    ),
                                    decoration: BoxDecoration(
                                      color: const Color(0x7A1E293B),
                                      borderRadius: BorderRadius.circular(8),
                                    ),
                                    child: Text(
                                      previewMetaTop,
                                      maxLines: 1,
                                      overflow: TextOverflow.ellipsis,
                                      style: const TextStyle(
                                        color: Color(0xFFE2E8F0),
                                        fontSize: 12,
                                        fontWeight: FontWeight.w700,
                                      ),
                                    ),
                                  ),
                                  if (previewMetaBottom.isNotEmpty) ...[
                                    const SizedBox(height: 4),
                                    Container(
                                      padding: const EdgeInsets.symmetric(
                                        horizontal: 8,
                                        vertical: 4,
                                      ),
                                      decoration: BoxDecoration(
                                        color: const Color(0x7A1E293B),
                                        borderRadius: BorderRadius.circular(8),
                                      ),
                                      child: Text(
                                        previewMetaBottom,
                                        maxLines: 1,
                                        overflow: TextOverflow.ellipsis,
                                        style: const TextStyle(
                                          color: Color(0xFFCBD5E1),
                                          fontSize: 11,
                                        ),
                                      ),
                                    ),
                                  ],
                                ],
                              ],
                            ),
                          ),
                        ),
                      ],
                    ),
                  ),
                  if (previewShowBanner) ...[
                    const SizedBox(height: 8),
                    Container(
                      padding: const EdgeInsets.symmetric(
                        horizontal: 10,
                        vertical: 8,
                      ),
                      decoration: BoxDecoration(
                        color: const Color(0x8F92400E),
                        borderRadius: BorderRadius.circular(12),
                        border: Border.all(color: const Color(0xFFFBBF24)),
                      ),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            previewBannerTitle,
                            style: const TextStyle(
                              color: Color(0xFFFEF3C7),
                              fontWeight: FontWeight.w800,
                            ),
                          ),
                          const SizedBox(height: 2),
                          Text(
                            previewBannerSubtitle,
                            style: const TextStyle(
                              color: Color(0xFFFFEDD5),
                              fontSize: 12,
                            ),
                          ),
                        ],
                      ),
                    ),
                  ],
                  if (previewDescription.isNotEmpty) ...[
                    const SizedBox(height: 8),
                    Text(
                      previewDescription,
                      style: const TextStyle(color: Colors.white70),
                    ),
                  ],
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget buildActiveTabContent() {
    switch (selectedDashboardTab) {
      case 0:
        return buildImagesTab();
      case 1:
        return buildTasksTab();
      case 2:
        return buildAlarmTab();
      case 3:
        return buildDisplayTab();
      case 4:
        return buildSettingsTab();
      default:
        return buildSettingsTab();
    }
  }

  Widget buildDisplayTab() {
    return SingleChildScrollView(
      padding: const EdgeInsets.all(14),
      child: buildDeviceDisplayCard(),
    );
  }

  Widget buildImagesTab() {
    return SingleChildScrollView(
      padding: const EdgeInsets.all(14),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          sectionCard(
            title: "Images & Slideshow",
            icon: Icons.photo_library_outlined,
            child: Column(
              children: [
                SwitchListTile(
                  contentPadding: EdgeInsets.zero,
                  title: const Text("Enable slideshow mode"),
                  subtitle: Text(
                    slideshowEnabled
                        ? "Photos rotate automatically"
                        : "Only one selected image will be shown",
                  ),
                  value: slideshowEnabled,
                  onChanged: (value) async {
                    setState(() => slideshowEnabled = value);
                    await saveSettings(showSuccess: false);
                  },
                ),
                if (slideshowEnabled) ...[
                  const SizedBox(height: 8),
                  Row(
                    children: [
                      Expanded(
                        child: TextField(
                          controller: slideshowIntervalController,
                          keyboardType: TextInputType.number,
                          decoration: const InputDecoration(
                            labelText: "Slideshow interval (sec)",
                          ),
                        ),
                      ),
                      const SizedBox(width: 8),
                      FilledButton(
                        onPressed: saveSettings,
                        child: const Text("Save"),
                      ),
                    ],
                  ),
                ],
                if (!slideshowEnabled) ...[
                  const SizedBox(height: 10),
                  DropdownButtonFormField<String>(
                    isExpanded: true,
                    key: ValueKey(
                      "single-image-${photos.length}-$selectedSinglePhotoId",
                    ),
                    initialValue: photos.any((p) => p.id == selectedSinglePhotoId)
                        ? selectedSinglePhotoId
                        : null,
                    items: photos
                        .map(
                          (photo) => DropdownMenuItem<String>(
                            value: photo.id,
                            child: Text(
                              photo.filename,
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                            ),
                          ),
                        )
                        .toList(),
                    selectedItemBuilder: (context) {
                      return photos
                          .map(
                            (photo) => Align(
                              alignment: Alignment.centerLeft,
                              child: Text(
                                photo.filename,
                                maxLines: 1,
                                overflow: TextOverflow.ellipsis,
                              ),
                            ),
                          )
                          .toList();
                    },
                    onChanged: photos.isEmpty
                        ? null
                        : (value) async {
                            setState(() {
                              selectedSinglePhotoId = value ?? "";
                            });
                            await saveSettings(showSuccess: false);
                          },
                    decoration: const InputDecoration(
                      labelText: "Select single image for display",
                    ),
                  ),
                ],
              ],
            ),
          ),
          const SizedBox(height: 10),
          sectionCard(
            title: "Photos",
            icon: Icons.image_outlined,
            child: Column(
              children: [
                Row(
                  children: [
                    Expanded(
                      child: OutlinedButton(
                        onPressed: fetchPhotos,
                        child: const Text("Refresh"),
                      ),
                    ),
                    const SizedBox(width: 8),
                    Expanded(
                      child: FilledButton(
                        onPressed: isUploadingPhoto ? null : uploadPhoto,
                        child: Text(
                          isUploadingPhoto ? "Uploading..." : "Upload",
                        ),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 10),
                SizedBox(
                  height: 180,
                  child: photos.isEmpty
                      ? const Center(child: Text("No photos uploaded"))
                      : ListView.builder(
                          scrollDirection: Axis.horizontal,
                          itemCount: photos.length,
                          itemBuilder: (context, index) {
                            final photo = photos[index];
                            final imageUrl = photo.url.startsWith("http")
                                ? photo.url
                                : "${ApiConfig.baseUrl.replaceFirst('/api', '')}${photo.url}";

                            return Container(
                              width: 190,
                              margin: const EdgeInsets.only(right: 8),
                              child: Card(
                                child: Column(
                                  children: [
                                    Expanded(
                                      child: ClipRRect(
                                        borderRadius:
                                            const BorderRadius.vertical(
                                          top: Radius.circular(4),
                                        ),
                                        child: Image.network(
                                          imageUrl,
                                          width: double.infinity,
                                          fit: BoxFit.cover,
                                          errorBuilder: (_, __, ___) {
                                            return const Center(
                                              child: Text("Preview unavailable"),
                                            );
                                          },
                                        ),
                                      ),
                                    ),
                                    Padding(
                                      padding: const EdgeInsets.symmetric(
                                        horizontal: 6,
                                      ),
                                      child: Text(
                                        photo.filename,
                                        maxLines: 1,
                                        overflow: TextOverflow.ellipsis,
                                      ),
                                    ),
                                    TextButton(
                                      onPressed: () => deletePhoto(photo.id),
                                      child: const Text("Delete"),
                                    ),
                                  ],
                                ),
                              ),
                            );
                          },
                        ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget buildTasksTab() {
    return SingleChildScrollView(
      padding: const EdgeInsets.all(14),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          sectionCard(
            title: "Create Task",
            icon: Icons.playlist_add_circle_outlined,
            child: Column(
              children: [
                TextField(
                  controller: titleController,
                  decoration: const InputDecoration(labelText: "Task title"),
                ),
                const SizedBox(height: 8),
                TextField(
                  controller: descriptionController,
                  decoration: const InputDecoration(labelText: "Description"),
                ),
                const SizedBox(height: 8),
                Row(
                  children: [
                    Expanded(
                      child: TextField(
                        controller: dateController,
                        readOnly: true,
                        onTap: pickTaskDate,
                        decoration: const InputDecoration(
                          labelText: "Date",
                          suffixIcon: Icon(Icons.calendar_today),
                        ),
                      ),
                    ),
                    const SizedBox(width: 8),
                    Expanded(
                      child: TextField(
                        controller: timeController,
                        readOnly: true,
                        onTap: pickTaskTime,
                        decoration: const InputDecoration(
                          labelText: "Time",
                          suffixIcon: Icon(Icons.access_time),
                        ),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 8),
                SizedBox(
                  width: double.infinity,
                  child: FilledButton(
                    onPressed: addTask,
                    child: const Text("Add Task"),
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 10),
          sectionCard(
            title: "Tasks",
            icon: Icons.checklist_rtl,
            child: Column(
              children: [
                Wrap(
                  spacing: 8,
                  children: [
                    ChoiceChip(
                      label: const Text("Upcoming"),
                      selected: selectedView == "upcoming",
                      onSelected: (_) {
                        setState(() => selectedView = "upcoming");
                        fetchTasks();
                      },
                    ),
                    ChoiceChip(
                      label: const Text("Completed"),
                      selected: selectedView == "completed",
                      onSelected: (_) {
                        setState(() => selectedView = "completed");
                        fetchTasks();
                      },
                    ),
                    ChoiceChip(
                      label: const Text("Archived"),
                      selected: selectedView == "archived",
                      onSelected: (_) {
                        setState(() => selectedView = "archived");
                        fetchTasks();
                      },
                    ),
                  ],
                ),
                const SizedBox(height: 8),
                Row(
                  mainAxisAlignment: MainAxisAlignment.end,
                  children: [
                    TextButton(
                      onPressed: fetchTasks,
                      child: const Text("Refresh"),
                    ),
                  ],
                ),
                isLoading
                    ? const Padding(
                        padding: EdgeInsets.all(20),
                        child: CircularProgressIndicator(),
                      )
                    : visibleTasks.isEmpty
                        ? const Padding(
                            padding: EdgeInsets.all(14),
                            child: Text("No tasks available"),
                          )
                        : ListView.builder(
                            shrinkWrap: true,
                            physics: const NeverScrollableScrollPhysics(),
                            itemCount: visibleTasks.length,
                            itemBuilder: (context, index) {
                              final task = visibleTasks[index];
                              final timeLine =
                                  "${task.date} ${formatTimeByPreference(task.time)}";
                              final description = task.description.trim();
                              final subtitleText = description.isEmpty
                                  ? timeLine
                                  : "$timeLine\n$description";

                              final actionButtons = [
                                IconButton(
                                  onPressed: () => editTask(task),
                                  icon: const Icon(Icons.edit),
                                  tooltip: "Edit",
                                ),
                                IconButton(
                                  onPressed: task.completed
                                      ? null
                                      : () => completeTask(task.id),
                                  icon: const Icon(Icons.check),
                                  tooltip: "Complete",
                                ),
                                IconButton(
                                  onPressed: task.archived
                                      ? null
                                      : () => archiveTask(task.id),
                                  icon: const Icon(Icons.archive),
                                  tooltip: "Archive",
                                ),
                                IconButton(
                                  onPressed: task.completed
                                      ? null
                                      : () => dismissTask(task.id),
                                  icon: const Icon(Icons.notifications_off),
                                  tooltip: "Dismiss",
                                ),
                                IconButton(
                                  onPressed: () => deleteTask(task.id),
                                  icon: const Icon(Icons.delete),
                                  tooltip: "Delete",
                                ),
                              ];

                              return Card(
                                child: LayoutBuilder(
                                  builder: (context, constraints) {
                                    final isNarrow = constraints.maxWidth < 560;

                                    if (!isNarrow) {
                                      return ListTile(
                                        title: Text(
                                          task.title,
                                          maxLines: 2,
                                          overflow: TextOverflow.ellipsis,
                                          style: TextStyle(
                                            decoration: task.completed
                                                ? TextDecoration.lineThrough
                                                : TextDecoration.none,
                                          ),
                                        ),
                                        subtitle: Text(subtitleText),
                                        isThreeLine: true,
                                        trailing: Wrap(
                                          spacing: 2,
                                          children: actionButtons,
                                        ),
                                      );
                                    }

                                    return Padding(
                                      padding: const EdgeInsets.fromLTRB(12, 10, 8, 8),
                                      child: Column(
                                        crossAxisAlignment: CrossAxisAlignment.start,
                                        children: [
                                          Text(
                                            task.title,
                                            maxLines: 2,
                                            overflow: TextOverflow.ellipsis,
                                            style: TextStyle(
                                              fontWeight: FontWeight.w600,
                                              decoration: task.completed
                                                  ? TextDecoration.lineThrough
                                                  : TextDecoration.none,
                                            ),
                                          ),
                                          const SizedBox(height: 4),
                                          Text(
                                            subtitleText,
                                            maxLines: 4,
                                            overflow: TextOverflow.ellipsis,
                                          ),
                                          const SizedBox(height: 6),
                                          Align(
                                            alignment: Alignment.centerRight,
                                            child: Wrap(
                                              spacing: 2,
                                              runSpacing: 2,
                                              children: actionButtons,
                                            ),
                                          ),
                                        ],
                                      ),
                                    );
                                  },
                                ),
                              );
                            },
                          ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget buildAlarmTab() {
    return SingleChildScrollView(
      padding: const EdgeInsets.all(14),
      child: sectionCard(
        title: "Alarm Manager",
        icon: Icons.alarm,
        child: Column(
          children: [
            TextField(
              controller: alarmLabelController,
              decoration: const InputDecoration(labelText: "Alarm label"),
            ),
            const SizedBox(height: 8),
            TextField(
              controller: alarmDateController,
              readOnly: selectedRecurrence == "daily",
              onTap: selectedRecurrence == "daily" ? null : pickAlarmDate,
              decoration: const InputDecoration(
                labelText: "Alarm date",
                suffixIcon: Icon(Icons.calendar_month),
              ),
            ),
            const SizedBox(height: 8),
            TextField(
              controller: alarmTimeController,
              readOnly: true,
              onTap: pickAlarmTime,
              decoration: const InputDecoration(
                labelText: "Alarm time",
                suffixIcon: Icon(Icons.schedule),
              ),
            ),
            const SizedBox(height: 8),
            DropdownButtonFormField<String>(
              isExpanded: true,
              initialValue: selectedRecurrence,
              decoration: const InputDecoration(
                labelText: "Recurrence",
              ),
              items: const [
                DropdownMenuItem(value: "none", child: Text("One-time")),
                DropdownMenuItem(value: "daily", child: Text("Daily")),
              ],
              onChanged: (value) {
                if (value == null) return;
                setState(() => selectedRecurrence = value);
              },
            ),
            const SizedBox(height: 8),
            Wrap(
              spacing: 8,
              runSpacing: 8,
              crossAxisAlignment: WrapCrossAlignment.center,
              children: [
                FilledButton(
                  onPressed: addAlarm,
                  child: const Text("Add Alarm"),
                ),
                TextButton(
                  onPressed: fetchAlarms,
                  child: const Text("Refresh"),
                ),
              ],
            ),
            const SizedBox(height: 8),
            alarms.isEmpty
                ? const Padding(
                    padding: EdgeInsets.all(14),
                    child: Text("No alarms created"),
                  )
                : ListView.builder(
                    shrinkWrap: true,
                    physics: const NeverScrollableScrollPhysics(),
                    itemCount: alarms.length,
                    itemBuilder: (context, index) {
                      final alarm = alarms[index];
                      return Card(
                        color: alarm.ringing
                            ? Colors.red.shade50
                            : Colors.grey.shade50,
                        child: ListTile(
                          title: Text(
                            alarm.ringing
                                ? "${alarm.label} (RINGING)"
                                : alarm.label,
                          ),
                          subtitle: Text(
                            "${alarm.recurrence == "daily" ? "Daily" : alarm.date} ${formatTimeByPreference(alarm.time)}",
                          ),
                          trailing: Wrap(
                            spacing: 2,
                            children: [
                              IconButton(
                                onPressed: alarm.ringing
                                    ? () => stopAlarm(alarm.id)
                                    : null,
                                icon: const Icon(Icons.alarm_off),
                                tooltip: "Stop",
                              ),
                              IconButton(
                                onPressed: () => toggleAlarm(
                                  alarm.id,
                                  !alarm.enabled,
                                ),
                                icon: Icon(
                                  alarm.enabled
                                      ? Icons.toggle_on
                                      : Icons.toggle_off,
                                ),
                                tooltip: alarm.enabled ? "Disable" : "Enable",
                              ),
                              IconButton(
                                onPressed: () => deleteAlarm(alarm.id),
                                icon: const Icon(Icons.delete),
                                tooltip: "Delete",
                              ),
                            ],
                          ),
                        ),
                      );
                    },
                  ),
          ],
        ),
      ),
    );
  }

  Widget buildSettingsTab() {
    return SingleChildScrollView(
      padding: const EdgeInsets.all(14),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          sectionCard(
            title: "Settings",
            icon: Icons.settings_outlined,
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Container(
                  padding: const EdgeInsets.symmetric(
                    horizontal: 12,
                    vertical: 10,
                  ),
                  decoration: BoxDecoration(
                    color: const Color(0xFFF8FAFC),
                    border: Border.all(color: const Color(0xFFE5E7EB)),
                    borderRadius: BorderRadius.circular(12),
                  ),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const Text(
                        "Change user name",
                        style: TextStyle(
                          color: Color(0xFF6B7280),
                          fontSize: 12,
                        ),
                      ),
                      const SizedBox(height: 6),
                      TextField(
                        controller: changeNameController,
                        decoration: const InputDecoration(
                          labelText: "New name",
                          isDense: true,
                        ),
                      ),
                      const SizedBox(height: 8),
                      SizedBox(
                        width: double.infinity,
                        child: FilledButton(
                          onPressed: updateUserName,
                          child: const Text("Change name"),
                        ),
                      ),
                      const SizedBox(height: 10),
                      const Text(
                        "Signed in as",
                        style: TextStyle(
                          color: Color(0xFF6B7280),
                          fontSize: 12,
                        ),
                      ),
                      const SizedBox(height: 2),
                      Text(
                        "${_userDisplayName()} (${widget.signedInEmail})",
                        style: const TextStyle(fontWeight: FontWeight.w700),
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: 10),
                CheckboxListTile(
                  dense: true,
                  contentPadding: EdgeInsets.zero,
                  value: pushNotifications,
                  title: const Text("Push notifications"),
                  controlAffinity: ListTileControlAffinity.trailing,
                  onChanged: (v) {
                    if (v == null) return;
                    setState(() => pushNotifications = v);
                    saveSettings(showSuccess: false);
                  },
                ),
                CheckboxListTile(
                  dense: true,
                  contentPadding: EdgeInsets.zero,
                  value: buzzerAlerts,
                  title: const Text("Buzzer alerts"),
                  controlAffinity: ListTileControlAffinity.trailing,
                  onChanged: (v) {
                    if (v == null) return;
                    setState(() => buzzerAlerts = v);
                    saveSettings(showSuccess: false);
                  },
                ),
                CheckboxListTile(
                  dense: true,
                  contentPadding: EdgeInsets.zero,
                  value: autoClockSync,
                  title: const Text("Auto clock sync"),
                  controlAffinity: ListTileControlAffinity.trailing,
                  onChanged: (v) {
                    if (v == null) return;
                    setState(() => autoClockSync = v);
                    saveSettings(showSuccess: false);
                  },
                ),
                CheckboxListTile(
                  dense: true,
                  contentPadding: EdgeInsets.zero,
                  value: archiveCompletedTasks,
                  title: const Text("Archive completed tasks"),
                  controlAffinity: ListTileControlAffinity.trailing,
                  onChanged: (v) {
                    if (v == null) return;
                    setState(() => archiveCompletedTasks = v);
                    saveSettings(showSuccess: false);
                  },
                ),
                const SizedBox(height: 8),
                LayoutBuilder(
                  builder: (context, constraints) {
                    final isNarrow = constraints.maxWidth < 520;

                    final timeFormatField = DropdownButtonFormField<String>(
                      key: ValueKey("time-format-$timeFormat"),
                      isExpanded: true,
                      initialValue: timeFormat,
                      decoration: const InputDecoration(labelText: "Time format"),
                      items: const [
                        DropdownMenuItem(
                          value: "12-hour",
                          child: Text("12-hour"),
                        ),
                        DropdownMenuItem(
                          value: "24-hour",
                          child: Text("24-hour"),
                        ),
                      ],
                      onChanged: (v) {
                        if (v == null) return;
                        setState(() => timeFormat = v);
                        saveSettings(showSuccess: false);
                      },
                    );

                    final reminderStyleField = DropdownButtonFormField<String>(
                      key: ValueKey("reminder-style-$reminderStyle"),
                      isExpanded: true,
                      initialValue: reminderStyle,
                      decoration: const InputDecoration(
                        labelText: "Reminder style",
                      ),
                      items: const [
                        DropdownMenuItem(
                          value: "full_screen",
                          child: Text("Full screen"),
                        ),
                        DropdownMenuItem(
                          value: "banner",
                          child: Text("Banner"),
                        ),
                      ],
                      onChanged: (v) {
                        if (v == null) return;
                        setState(() => reminderStyle = v);
                        saveSettings(showSuccess: false);
                      },
                    );

                    if (isNarrow) {
                      return Column(
                        children: [
                          timeFormatField,
                          const SizedBox(height: 8),
                          reminderStyleField,
                        ],
                      );
                    }

                    return Row(
                      children: [
                        Expanded(child: timeFormatField),
                        const SizedBox(width: 8),
                        Expanded(child: reminderStyleField),
                      ],
                    );
                  },
                ),
                const SizedBox(height: 8),
                TextField(
                  controller: dailySummaryTimeController,
                  readOnly: true,
                  onTap: pickDailySummaryTime,
                  decoration: const InputDecoration(
                    labelText: "Daily summary time",
                    suffixIcon: Icon(Icons.timer_outlined),
                  ),
                ),
                const SizedBox(height: 10),
                Wrap(
                  spacing: 8,
                  runSpacing: 8,
                  children: [
                    FilledButton(
                      onPressed: saveSettings,
                      child: const Text("Save Settings"),
                    ),
                    OutlinedButton(
                      onPressed: () => saveSettings(showSuccess: false),
                      child: const Text("Save Summary Time"),
                    ),
                    OutlinedButton.icon(
                      onPressed: isSyncingClock ? null : syncDeviceClock,
                      icon: const Icon(Icons.sync),
                      label: Text(isSyncingClock ? "Syncing..." : "Sync Clock"),
                    ),
                  ],
                ),
                const SizedBox(height: 10),
                Text(
                  "Current summary time: ${formatTimeByPreference(dailySummaryTimeController.text)}",
                  style: const TextStyle(fontWeight: FontWeight.w600),
                ),
                if (clockSyncStatus.isNotEmpty)
                  Padding(
                    padding: const EdgeInsets.only(top: 8),
                    child: Text(clockSyncStatus),
                  ),
                const SizedBox(height: 14),
                Container(
                  padding: const EdgeInsets.all(12),
                  decoration: BoxDecoration(
                    color: const Color(0xFFFFF5F5),
                    border: Border.all(color: const Color(0xFFFCA5A5)),
                    borderRadius: BorderRadius.circular(12),
                  ),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      const Text(
                        "Delete account",
                        style: TextStyle(
                          fontWeight: FontWeight.w700,
                          color: Color(0xFFB91C1C),
                        ),
                      ),
                      const SizedBox(height: 6),
                      const Text(
                        "To permanently delete your account, type DELETE MY ACCOUNT (all capital letters) below.",
                        style: TextStyle(color: Color(0xFF7F1D1D)),
                      ),
                      const SizedBox(height: 10),
                      TextField(
                        controller: deleteAccountConfirmController,
                        textCapitalization: TextCapitalization.characters,
                        onChanged: (value) {
                          final upper = value.toUpperCase();
                          if (value != upper) {
                            deleteAccountConfirmController.value =
                                deleteAccountConfirmController.value.copyWith(
                                  text: upper,
                                  selection: TextSelection.collapsed(
                                    offset: upper.length,
                                  ),
                                );
                          }
                          setState(() {});
                        },
                        decoration: const InputDecoration(
                          labelText: "Type DELETE MY ACCOUNT",
                          helperText:
                              "Account and all your data will be deleted permanently.",
                        ),
                      ),
                      const SizedBox(height: 10),
                      FilledButton(
                        onPressed: isDeletingAccount || !canDeleteAccount
                            ? null
                            : deleteMyAccount,
                        style: FilledButton.styleFrom(
                          backgroundColor: const Color(0xFFB91C1C),
                        ),
                        child: Text(
                          isDeletingAccount
                              ? "Deleting account..."
                              : "Delete account",
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  @override
  void dispose() {
    headerClockTimer?.cancel();
    displayPollTimer?.cancel();
    titleController.dispose();
    descriptionController.dispose();
    dateController.dispose();
    timeController.dispose();
    slideshowIntervalController.dispose();
    dailySummaryTimeController.dispose();
    alarmLabelController.dispose();
    alarmDateController.dispose();
    alarmTimeController.dispose();
    deleteAccountConfirmController.dispose();
    changeNameController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      extendBody: true,
      backgroundColor: Colors.transparent,
      body: Container(
        decoration: const BoxDecoration(
          gradient: LinearGradient(
            begin: Alignment.topLeft,
            end: Alignment.bottomRight,
            colors: [Color(0xFFF5E9DA), Color(0xFFDCEDEA)],
          ),
        ),
        child: SafeArea(
          bottom: false,
          child: LayoutBuilder(
            builder: (context, constraints) {
              final titleColor = Theme.of(context).colorScheme.primary;
              final titleSize = constraints.maxWidth < 420 ? 30.0 : 36.0;

              return SingleChildScrollView(
                padding: const EdgeInsets.fromLTRB(20, 18, 20, 8),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    Container(
                      padding: const EdgeInsets.all(20),
                      decoration: BoxDecoration(
                        color: Colors.white,
                        borderRadius: BorderRadius.circular(24),
                      ),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.stretch,
                        children: [
                          Text(
                            "Smart Task Manager",
                            textAlign: TextAlign.center,
                            style: TextStyle(
                              fontSize: titleSize,
                              height: 1.05,
                              fontWeight: FontWeight.w900,
                              color: titleColor,
                            ),
                          ),
                          const SizedBox(height: 14),
                          Row(
                            crossAxisAlignment: CrossAxisAlignment.center,
                            children: [
                              Expanded(
                                child: Row(
                                  children: [
                                    Expanded(
                                      child: Text(
                                        "${_timeGreeting()}, ${_userDisplayName()}!",
                                        maxLines: 1,
                                        overflow: TextOverflow.ellipsis,
                                        style: const TextStyle(
                                          fontWeight: FontWeight.w900,
                                          fontSize: 18,
                                          color: Color(0xFF0F172A),
                                        ),
                                      ),
                                    ),
                                    const SizedBox(width: 10),
                                    Text(
                                      headerTimeText,
                                      style: const TextStyle(
                                        color: Color(0xFF374151),
                                        fontWeight: FontWeight.w700,
                                        fontSize: 16,
                                      ),
                                    ),
                                  ],
                                ),
                              ),
                            ],
                          ),
                        ],
                      ),
                    ),
                    const SizedBox(height: 16),
                    buildDashboardTabs(),
                    const SizedBox(height: 16),
                    Card(
                      margin: EdgeInsets.zero,
                      elevation: 0,
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(24),
                      ),
                      child: buildActiveTabContent(),
                    ),
                  ],
                ),
              );
            },
          ),
        ),
      ),
    );
  }
}
