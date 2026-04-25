const express = require("express");

const authMiddleware = require("../middleware/auth");
const Setting = require("../models/Setting");

const router = express.Router();
const isValidHHMM = (value) => /^([01]?\d|2[0-3]):([0-5]\d)$/.test((value || "").trim());

router.get("/settings/public", async (_req, res) => {
  try {
    const latestSetting = await Setting.findOne().sort({ updatedAt: -1 });

    return res.json({
      success: true,
      data: {
        slideshowIntervalSeconds: latestSetting?.slideshowIntervalSeconds ?? 5,
        slideshowEnabled: latestSetting?.slideshowEnabled ?? true,
        selectedSinglePhotoId: latestSetting?.selectedSinglePhotoId ?? "",
        dailySummaryTime: latestSetting?.dailySummaryTime ?? "08:00",
        pushNotifications: latestSetting?.pushNotifications ?? true,
        buzzerAlerts: latestSetting?.buzzerAlerts ?? true,
        autoClockSync: latestSetting?.autoClockSync ?? true,
        archiveCompletedTasks: latestSetting?.archiveCompletedTasks ?? true,
        timeFormat: latestSetting?.timeFormat ?? "12-hour",
        reminderStyle: latestSetting?.reminderStyle ?? "full_screen",
      },
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message,
    });
  }
});

router.use("/settings", authMiddleware);

router.get("/settings", async (req, res) => {
  try {
    let setting = await Setting.findOne({ user: req.user.id });

    if (!setting) {
      setting = await Setting.create({ user: req.user.id });
    }

    return res.json({
      success: true,
      data: setting,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message,
    });
  }
});

router.put("/settings", async (req, res) => {
  try {
    const slideshowIntervalSecondsRaw = req.body.slideshowIntervalSeconds;
    const slideshowIntervalSeconds = Number(slideshowIntervalSecondsRaw);
    const slideshowEnabled = req.body.slideshowEnabled;
    const selectedSinglePhotoId = req.body.selectedSinglePhotoId;
    const dailySummaryTime = (req.body.dailySummaryTime || "").trim();
    const pushNotifications = req.body.pushNotifications;
    const buzzerAlerts = req.body.buzzerAlerts;
    const autoClockSync = req.body.autoClockSync;
    const archiveCompletedTasks = req.body.archiveCompletedTasks;
    const timeFormat = (req.body.timeFormat || "").trim();
    const reminderStyle = (req.body.reminderStyle || "").trim();

    if (
      slideshowIntervalSecondsRaw !== undefined &&
      !Number.isFinite(slideshowIntervalSeconds)
    ) {
      return res.status(400).json({
        success: false,
        message: "slideshowIntervalSeconds must be a number",
      });
    }

    if (
      slideshowIntervalSecondsRaw !== undefined &&
      (slideshowIntervalSeconds < 2 || slideshowIntervalSeconds > 60)
    ) {
      return res.status(400).json({
        success: false,
        message: "slideshowIntervalSeconds must be between 2 and 60",
      });
    }

    if (dailySummaryTime && !isValidHHMM(dailySummaryTime)) {
      return res.status(400).json({
        success: false,
        message: "dailySummaryTime must be in HH:MM format",
      });
    }

    if (
      slideshowEnabled !== undefined &&
      typeof slideshowEnabled !== "boolean"
    ) {
      return res.status(400).json({
        success: false,
        message: "slideshowEnabled must be true or false",
      });
    }

    if (
      selectedSinglePhotoId !== undefined &&
      typeof selectedSinglePhotoId !== "string"
    ) {
      return res.status(400).json({
        success: false,
        message: "selectedSinglePhotoId must be a string",
      });
    }

    if (
      pushNotifications !== undefined &&
      typeof pushNotifications !== "boolean"
    ) {
      return res.status(400).json({
        success: false,
        message: "pushNotifications must be true or false",
      });
    }

    if (buzzerAlerts !== undefined && typeof buzzerAlerts !== "boolean") {
      return res.status(400).json({
        success: false,
        message: "buzzerAlerts must be true or false",
      });
    }

    if (autoClockSync !== undefined && typeof autoClockSync !== "boolean") {
      return res.status(400).json({
        success: false,
        message: "autoClockSync must be true or false",
      });
    }

    if (
      archiveCompletedTasks !== undefined &&
      typeof archiveCompletedTasks !== "boolean"
    ) {
      return res.status(400).json({
        success: false,
        message: "archiveCompletedTasks must be true or false",
      });
    }

    if (timeFormat && !["12-hour", "24-hour"].includes(timeFormat)) {
      return res.status(400).json({
        success: false,
        message: "timeFormat must be 12-hour or 24-hour",
      });
    }

    if (reminderStyle && !["full_screen", "banner"].includes(reminderStyle)) {
      return res.status(400).json({
        success: false,
        message: "reminderStyle must be full_screen or banner",
      });
    }

    const update = {};

    if (slideshowIntervalSecondsRaw !== undefined) {
      update.slideshowIntervalSeconds = slideshowIntervalSeconds;
    }

    if (dailySummaryTime) {
      update.dailySummaryTime = dailySummaryTime;
    }

    if (typeof slideshowEnabled === "boolean") {
      update.slideshowEnabled = slideshowEnabled;
    }

    if (typeof selectedSinglePhotoId === "string") {
      update.selectedSinglePhotoId = selectedSinglePhotoId.trim();
    }

    if (typeof pushNotifications === "boolean") {
      update.pushNotifications = pushNotifications;
    }

    if (typeof buzzerAlerts === "boolean") {
      update.buzzerAlerts = buzzerAlerts;
    }

    if (typeof autoClockSync === "boolean") {
      update.autoClockSync = autoClockSync;
    }

    if (typeof archiveCompletedTasks === "boolean") {
      update.archiveCompletedTasks = archiveCompletedTasks;
    }

    if (timeFormat) {
      update.timeFormat = timeFormat;
    }

    if (reminderStyle) {
      update.reminderStyle = reminderStyle;
    }

    const setting = await Setting.findOneAndUpdate(
      { user: req.user.id },
      update,
      { new: true, upsert: true, setDefaultsOnInsert: true }
    );

    // Emit WebSocket event for real-time update
    const io = req.app.locals.io;
    if (io) {
      io.emit("dataUpdated", { type: "settings", action: "updated", data: setting });
    }

    return res.json({
      success: true,
      message: "Settings updated",
      data: setting,
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
