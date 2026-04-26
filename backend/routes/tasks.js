const express = require("express");
const Alarm = require("../models/Alarm");
const Photo = require("../models/Photo");
const Setting = require("../models/Setting");
const Task = require("../models/Task");
const authMiddleware = require("../middleware/auth");
const { broadcastUpdate } = require("../services/realtime");

const router = express.Router();

const emitUpdate = (req, data) => {
  void broadcastUpdate(req, data);
};

const parseTaskDateTime = (dateText, timeText, timezoneOffsetMinutes = 0) => {
  const date = (dateText || "").trim();
  const time = (timeText || "").trim();
  const dateMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  const timeMatch = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(time);
  if (!dateMatch || !timeMatch) return null;

  const year = Number(dateMatch[1]);
  const month = Number(dateMatch[2]);
  const day = Number(dateMatch[3]);
  const hour = Number(timeMatch[1]);
  const minute = Number(timeMatch[2]);

  // timezoneOffsetMinutes is local - UTC. Convert local task time to UTC instant.
  const utcMs =
    Date.UTC(year, month - 1, day, hour, minute, 0) - timezoneOffsetMinutes * 60000;
  const parsed = new Date(utcMs);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed;
};

const localNowByOffset = (nowUtc, timezoneOffsetMinutes = 0) => {
  return new Date(nowUtc.getTime() + timezoneOffsetMinutes * 60000);
};

const isSameMinute = (a, b) =>
  a.getFullYear() === b.getFullYear() &&
  a.getMonth() === b.getMonth() &&
  a.getDate() === b.getDate() &&
  a.getHours() === b.getHours() &&
  a.getMinutes() === b.getMinutes();

const localDateText = (d) => {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
};

const toTwelveHour = (timeText) => {
  const match = /^([01]?\d|2[0-3]):([0-5]\d)$/.exec((timeText || "").trim());
  if (!match) return timeText;
  const hour = Number(match[1]);
  const minute = match[2];
  const suffix = hour >= 12 ? "PM" : "AM";
  const hour12 = hour % 12 === 0 ? 12 : hour % 12;
  return `${String(hour12).padStart(2, "0")}:${minute} ${suffix}`;
};

const formatByPreference = (timeText, timeFormat) => {
  if ((timeFormat || "12-hour") === "24-hour") {
    return (timeText || "").trim();
  }
  return toTwelveHour(timeText);
};

const shouldTriggerAlarmNow = (alarm, nowUtc, timezoneOffsetMinutes, todayText) => {
  const scheduledToday = parseTaskDateTime(
    todayText,
    alarm.time,
    timezoneOffsetMinutes
  );
  if (!scheduledToday) return false;

  if (alarm.recurrence === "daily") {
    return isSameMinute(scheduledToday, nowUtc);
  }

  if (!alarm.date) return false;
  const scheduled = parseTaskDateTime(
    alarm.date,
    alarm.time,
    timezoneOffsetMinutes
  );
  if (!scheduled) return false;
  return isSameMinute(scheduled, nowUtc);
};

router.get("/tasks/public/latest", async (_req, res) => {
  try {
    const latestTask = await Task.findOne({ archived: false }).sort({
      createdAt: -1,
    });

    return res.json({
      success: true,
      data: latestTask,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message,
    });
  }
});

router.get("/tasks/public/display-state", async (_req, res) => {
  try {
    res.set("Cache-Control", "no-store, no-cache, must-revalidate");
    res.set("Pragma", "no-cache");
    res.set("Expires", "0");

    const alarmAutoStopSeconds = 30;
    const reminderAutoDismissSeconds = 30;
    const now = new Date();

    const latestSetting = await Setting.findOne().sort({ updatedAt: -1 });
    const displayUserId = latestSetting?.user || null;
    const timezoneOffsetMinutes = Number(latestSetting?.timezoneOffsetMinutes ?? 0);
    const safeTimezoneOffsetMinutes = Number.isFinite(timezoneOffsetMinutes)
      ? timezoneOffsetMinutes
      : 0;
    const nowLocal = localNowByOffset(now, safeTimezoneOffsetMinutes);
    const todayText = localDateText(nowLocal);

    const dataScope = displayUserId ? { user: displayUserId } : null;
    const tasksQuery = {
      archived: false,
      completed: false,
      ...(dataScope || {}),
    };

    const tasks = await Task.find(tasksQuery).sort({ date: 1, time: 1, createdAt: 1 });
    const slideshowIntervalSeconds = latestSetting?.slideshowIntervalSeconds ?? 5;
    const slideshowEnabled = latestSetting?.slideshowEnabled ?? true;
    const selectedSinglePhotoId = latestSetting?.selectedSinglePhotoId ?? "";
    const dailySummaryTime = latestSetting?.dailySummaryTime ?? "08:00";
    const pushNotifications = latestSetting?.pushNotifications ?? true;
    const buzzerAlerts = latestSetting?.buzzerAlerts ?? true;
    const reminderStyle = latestSetting?.reminderStyle ?? "full_screen";
    const timeFormat = latestSetting?.timeFormat ?? "12-hour";

    const basePayload = {
      success: true,
      serverTime: now.toISOString(),
      dailySummaryTime,
      dailySummaryTimeFormatted: formatByPreference(dailySummaryTime, timeFormat),
      slideshowEnabled,
      selectedSinglePhotoId,
      slideshowIntervalSeconds,
      pushNotifications,
      buzzerAlerts,
      reminderStyle,
      timeFormat,
      timezoneOffsetMinutes: safeTimezoneOffsetMinutes,
    };

    if (!displayUserId) {
      return res.json({
        ...basePayload,
        mode: "slideshow",
        slideshowPhotos: [],
        reminder: null,
      });
    }

    const photos = await Photo.find(dataScope || {}).sort({ createdAt: -1 }).limit(30);
    const slideshowPhotos = photos.map((photo) => photo.url);
    const selectedSinglePhoto =
      photos.find((photo) => String(photo._id) === selectedSinglePhotoId) || null;
    const singleImage = selectedSinglePhoto?.url || slideshowPhotos[0] || "";

    let activeAlarm = await Alarm.findOne({
      enabled: true,
      ringing: true,
      ...(dataScope || {}),
    }).sort({ ringStartedAt: 1, updatedAt: -1 });

    if (activeAlarm && activeAlarm.ringStartedAt) {
      const elapsed = now.getTime() - new Date(activeAlarm.ringStartedAt).getTime();
      if (elapsed >= alarmAutoStopSeconds * 1000) {
        activeAlarm.ringing = false;
        activeAlarm.ringStartedAt = null;
        await activeAlarm.save();
        activeAlarm = null;
      }
    }

    if (!activeAlarm) {
      const alarms = await Alarm.find({
        enabled: true,
        ...(dataScope || {}),
      }).sort({ createdAt: 1 });

      for (const alarm of alarms) {
        const triggeredToday = alarm.lastTriggeredDate === todayText;
        if (alarm.recurrence === "daily" && triggeredToday) {
          continue;
        }

        if (alarm.recurrence === "none" && alarm.triggeredAt) {
          continue;
        }

        if (!shouldTriggerAlarmNow(alarm, now, safeTimezoneOffsetMinutes, todayText)) {
          continue;
        }

        alarm.ringing = true;
        alarm.ringStartedAt = now;

        if (alarm.recurrence === "daily") {
          alarm.lastTriggeredDate = todayText;
        } else {
          alarm.triggeredAt = now;
        }

        activeAlarm = await alarm.save();
        break;
      }
    }

    if (activeAlarm) {
      const elapsed = activeAlarm.ringStartedAt
        ? now.getTime() - new Date(activeAlarm.ringStartedAt).getTime()
        : 0;
      const autoStopRemainingSeconds = Math.max(
        0,
        alarmAutoStopSeconds - Math.floor(elapsed / 1000)
      );

      return res.json({
        ...basePayload,
        mode: "alarm",
        autoStopSeconds: alarmAutoStopSeconds,
        autoStopRemainingSeconds,
        slideshowPhotos,
        alarm: activeAlarm,
        alarmTimeFormatted: formatByPreference(activeAlarm.time, timeFormat),
      });
    }

    const dueNowTask = tasks.find((task) => {
      if (task.dismissed) return false;
      const scheduled = parseTaskDateTime(
        task.date,
        task.time,
        safeTimezoneOffsetMinutes
      );
      if (!scheduled) return false;
      return isSameMinute(scheduled, now);
    });

    if (pushNotifications && dueNowTask) {
      if (!dueNowTask.reminderShownAt) {
        dueNowTask.reminderShownAt = now;
        await dueNowTask.save();
      }

      const shownAt = dueNowTask.reminderShownAt
        ? new Date(dueNowTask.reminderShownAt)
        : now;
      const elapsedMs = now.getTime() - shownAt.getTime();

      if (elapsedMs >= reminderAutoDismissSeconds * 1000) {
        dueNowTask.dismissed = true;
        dueNowTask.reminderShownAt = null;
        await dueNowTask.save();
      } else {
        const autoDismissRemainingSeconds = Math.max(
          0,
          reminderAutoDismissSeconds - Math.floor(elapsedMs / 1000)
        );

        return res.json({
          ...basePayload,
          mode: "reminder",
          slideshowPhotos,
          reminder: dueNowTask,
          reminderStyle,
          reminderTimeFormatted: formatByPreference(dueNowTask.time, timeFormat),
          autoDismissSeconds: reminderAutoDismissSeconds,
          autoDismissRemainingSeconds,
        });
      }
    }

    const summaryShownAt = latestSetting?.dailySummaryShownAt
      ? new Date(latestSetting.dailySummaryShownAt)
      : null;
    const canShowDailySummary =
      summaryShownAt &&
      now.getTime() - summaryShownAt.getTime() <= 60000 &&
      now.getTime() - summaryShownAt.getTime() >= 0;

    if (pushNotifications && canShowDailySummary) {
      const remainingTasks = tasks.filter((task) => !task.dismissed);
      return res.json({
        ...basePayload,
        mode: "daily_summary",
        summary: {
          remainingCount: remainingTasks.length,
          items: remainingTasks.slice(0, 5),
        },
        slideshowPhotos,
        reminderStyle,
      });
    }

    const nextTask = tasks.find((task) => {
      if (task.dismissed) return false;
      const scheduled = parseTaskDateTime(
        task.date,
        task.time,
        safeTimezoneOffsetMinutes
      );
      if (!scheduled) return false;
      return scheduled >= now;
    });

    if (pushNotifications && nextTask) {
      return res.json({
        ...basePayload,
        mode: "upcoming",
        slideshowPhotos,
        nextReminder: nextTask,
        reminderStyle,
        nextReminderTimeFormatted: formatByPreference(nextTask.time, timeFormat),
      });
    }

    if (!slideshowEnabled) {
      return res.json({
        ...basePayload,
        mode: "single_image",
        slideshowPhotos,
        singleImage,
      });
    }

    return res.json({
      ...basePayload,
      mode: "slideshow",
      slideshowPhotos,
      reminder: null,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message,
    });
  }
});

router.patch("/tasks/public/:id/dismiss", async (req, res) => {
  try {
    const latestSetting = await Setting.findOne().sort({ updatedAt: -1 });
    const displayUserId = latestSetting?.user || null;

    if (!displayUserId) {
      return res.status(404).json({
        success: false,
        message: "No display owner settings found",
      });
    }

    const task = await Task.findOneAndUpdate(
      {
        _id: req.params.id,
        user: displayUserId,
      },
      {
        dismissed: true,
        reminderShownAt: null,
      },
      { new: true }
    );

    if (!task) {
      return res.status(404).json({
        success: false,
        message: "Task not found",
      });
    }

    // Emit real-time update event
    emitUpdate(req, { type: "task", action: "dismissed", data: task });

    return res.json({
      success: true,
      message: "Reminder dismissed",
      data: task,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message,
    });
  }
});

router.use(authMiddleware);

router.post("/tasks", async (req, res) => {
  try {
    const { title, description = "", date, time } = req.body;

    if (!title || !date || !time) {
      return res.status(400).json({
        success: false,
        message: "title, date and time are required",
      });
    }

    const task = await Task.create({
      user: req.user.id,
      title,
      description,
      date,
      time,
    });

    // Emit real-time update event
    emitUpdate(req, { type: "task", action: "created", data: task });

    res.status(201).json({
      success: true,
      message: "Task created",
      data: task,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message,
    });
  }
});

router.get("/tasks", async (req, res) => {
  try {
    const showArchived = req.query.archived === "true";
    const tasks = await Task.find({
      user: req.user.id,
      archived: showArchived,
    }).sort({ date: 1, time: 1, createdAt: -1 });

    res.json({
      success: true,
      count: tasks.length,
      data: tasks,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message,
    });
  }
});

router.put("/tasks/:id", async (req, res) => {
  try {
    const { title, description = "", date, time } = req.body;

    if (!title || !date || !time) {
      return res.status(400).json({
        success: false,
        message: "title, date and time are required",
      });
    }

    const task = await Task.findOneAndUpdate(
      { _id: req.params.id, user: req.user.id },
      { title, description, date, time },
      { new: true }
    );

    if (!task) {
      return res.status(404).json({
        success: false,
        message: "Task not found",
      });
    }

    // Emit real-time update event
    emitUpdate(req, { type: "task", action: "updated", data: task });

    return res.json({
      success: true,
      message: "Task updated",
      data: task,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message,
    });
  }
});

router.delete("/tasks/:id", async (req, res) => {
  try {
    const task = await Task.findOneAndDelete({
      _id: req.params.id,
      user: req.user.id,
    });

    if (!task) {
      return res.status(404).json({
        success: false,
        message: "Task not found",
      });
    }

    // Emit real-time update event
    emitUpdate(req, { type: "task", action: "deleted", data: task });

    return res.json({
      success: true,
      message: "Task deleted",
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message,
    });
  }
});

router.patch("/tasks/:id/complete", async (req, res) => {
  try {
    const task = await Task.findOneAndUpdate(
      { _id: req.params.id, user: req.user.id },
      { completed: true },
      { new: true }
    );

    if (!task) {
      return res.status(404).json({
        success: false,
        message: "Task not found",
      });
    }

    // Emit real-time update event
    emitUpdate(req, { type: "task", action: "completed", data: task });

    return res.json({
      success: true,
      message: "Task completed",
      data: task,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message,
    });
  }
});

router.patch("/tasks/:id/archive", async (req, res) => {
  try {
    const task = await Task.findOneAndUpdate(
      { _id: req.params.id, user: req.user.id },
      { archived: true },
      { new: true }
    );

    if (!task) {
      return res.status(404).json({
        success: false,
        message: "Task not found",
      });
    }

    // Emit real-time update event
    emitUpdate(req, { type: "task", action: "archived", data: task });

    return res.json({
      success: true,
      message: "Task archived",
      data: task,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message,
    });
  }
});

router.patch("/tasks/:id/dismiss", async (req, res) => {
  try {
    const task = await Task.findOneAndUpdate(
      { _id: req.params.id, user: req.user.id },
      { dismissed: true },
      { new: true }
    );

    if (!task) {
      return res.status(404).json({
        success: false,
        message: "Task not found",
      });
    }

    // Emit real-time update event
    emitUpdate(req, { type: "task", action: "dismissed", data: task });

    return res.json({
      success: true,
      message: "Reminder dismissed",
      data: task,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message,
    });
  }
});

module.exports = router;
