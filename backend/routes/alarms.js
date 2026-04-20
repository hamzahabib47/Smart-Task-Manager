const express = require("express");

const Alarm = require("../models/Alarm");
const Setting = require("../models/Setting");
const authMiddleware = require("../middleware/auth");

const router = express.Router();

const isValidTime = (value) => /^([01]?\d|2[0-3]):([0-5]\d)$/.test((value || "").trim());

router.patch("/alarms/public/:id/stop", async (req, res) => {
  try {
    const latestSetting = await Setting.findOne().sort({ updatedAt: -1 });
    const displayUserId = latestSetting?.user || null;

    if (!displayUserId) {
      return res.status(404).json({
        success: false,
        message: "No display owner settings found",
      });
    }

    const alarm = await Alarm.findOneAndUpdate(
      {
        _id: req.params.id,
        user: displayUserId,
      },
      { ringing: false, ringStartedAt: null },
      { new: true }
    );

    if (!alarm) {
      return res.status(404).json({
        success: false,
        message: "Alarm not found",
      });
    }

    return res.json({
      success: true,
      message: "Alarm stopped",
      data: alarm,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message,
    });
  }
});

router.use("/alarms", authMiddleware);

router.post("/alarms", async (req, res) => {
  try {
    const label = (req.body.label || "").trim();
    const time = (req.body.time || "").trim();
    const recurrence = (req.body.recurrence || "none").trim().toLowerCase();
    const date = (req.body.date || "").trim();

    if (!label || !time) {
      return res.status(400).json({
        success: false,
        message: "label and time are required",
      });
    }

    if (!isValidTime(time)) {
      return res.status(400).json({
        success: false,
        message: "time must be in HH:MM format",
      });
    }

    if (!["none", "daily"].includes(recurrence)) {
      return res.status(400).json({
        success: false,
        message: "recurrence must be none or daily",
      });
    }

    if (recurrence === "none" && !date) {
      return res.status(400).json({
        success: false,
        message: "date is required for one-time alarm",
      });
    }

    const alarm = await Alarm.create({
      user: req.user.id,
      label,
      date,
      time,
      recurrence,
    });

    return res.status(201).json({
      success: true,
      message: "Alarm created",
      data: alarm,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message,
    });
  }
});

router.get("/alarms", async (req, res) => {
  try {
    const now = Date.now();
    await Alarm.updateMany(
      {
        user: req.user.id,
        ringing: true,
        ringStartedAt: { $lte: new Date(now - 30000) },
      },
      { ringing: false, ringStartedAt: null }
    );

    const alarms = await Alarm.find({ user: req.user.id }).sort({
      createdAt: -1,
    });

    return res.json({
      success: true,
      count: alarms.length,
      data: alarms,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message,
    });
  }
});

router.patch("/alarms/:id/stop", async (req, res) => {
  try {
    const alarm = await Alarm.findOneAndUpdate(
      { _id: req.params.id, user: req.user.id },
      { ringing: false, ringStartedAt: null },
      { new: true }
    );

    if (!alarm) {
      return res.status(404).json({
        success: false,
        message: "Alarm not found",
      });
    }

    return res.json({
      success: true,
      message: "Alarm stopped",
      data: alarm,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message,
    });
  }
});

router.patch("/alarms/:id/toggle", async (req, res) => {
  try {
    const enabled = req.body.enabled;

    if (typeof enabled !== "boolean") {
      return res.status(400).json({
        success: false,
        message: "enabled must be boolean",
      });
    }

    const updateData = enabled
      ? { enabled: true }
      : { enabled: false, ringing: false, ringStartedAt: null };

    const alarm = await Alarm.findOneAndUpdate(
      { _id: req.params.id, user: req.user.id },
      updateData,
      { new: true }
    );

    if (!alarm) {
      return res.status(404).json({
        success: false,
        message: "Alarm not found",
      });
    }

    return res.json({
      success: true,
      message: enabled ? "Alarm enabled" : "Alarm disabled",
      data: alarm,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message,
    });
  }
});

router.delete("/alarms/:id", async (req, res) => {
  try {
    const alarm = await Alarm.findOneAndDelete({
      _id: req.params.id,
      user: req.user.id,
    });

    if (!alarm) {
      return res.status(404).json({
        success: false,
        message: "Alarm not found",
      });
    }

    return res.json({
      success: true,
      message: "Alarm deleted",
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
