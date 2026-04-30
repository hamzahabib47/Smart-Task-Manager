const express = require("express");

const authMiddleware = require("../middleware/auth");
const Setting = require("../models/Setting");
const User = require("../models/User");

const router = express.Router();

router.post("/device/push-token", authMiddleware, async (req, res) => {
  const token = (req.body.token || "").trim();

  if (!token) {
    return res.status(400).json({
      success: false,
      message: "token is required",
    });
  }

  const user = await User.findByIdAndUpdate(
    req.user.id,
    { $addToSet: { fcmTokens: token } },
    { new: true }
  );

  if (!user) {
    return res.status(404).json({
      success: false,
      message: "User not found",
    });
  }

  return res.json({
    success: true,
    message: "Push token registered",
    data: { token },
  });
});

router.delete("/device/push-token", authMiddleware, async (req, res) => {
  const token = (req.body.token || "").trim();

  if (!token) {
    return res.status(400).json({
      success: false,
      message: "token is required",
    });
  }

  const user = await User.findByIdAndUpdate(
    req.user.id,
    { $pull: { fcmTokens: token } },
    { new: true }
  );

  if (!user) {
    return res.status(404).json({
      success: false,
      message: "User not found",
    });
  }

  return res.json({
    success: true,
    message: "Push token removed",
    data: { token },
  });
});

router.post("/device/clock-sync", authMiddleware, async (req, res) => {
  const now = new Date();

  const deviceTimeText = (req.body.deviceTime || "").trim();
  const protocolVersion = (req.body.protocolVersion || "1.0").trim();
  const timezoneOffsetMinutes = Number(req.body.timezoneOffsetMinutes ?? 0);

  if (!Number.isFinite(timezoneOffsetMinutes)) {
    return res.status(400).json({
      success: false,
      message: "timezoneOffsetMinutes must be a number",
    });
  }

  let offsetMs = null;
  if (deviceTimeText) {
    const deviceDate = new Date(deviceTimeText);
    if (Number.isNaN(deviceDate.getTime())) {
      return res.status(400).json({
        success: false,
        message: "deviceTime must be valid ISO datetime",
      });
    }
    offsetMs = now.getTime() - deviceDate.getTime();
  }

  await Setting.findOneAndUpdate(
    { user: req.user.id },
    { timezoneOffsetMinutes },
    { new: true, upsert: true, setDefaultsOnInsert: true }
  );

  return res.json({
    success: true,
    message: "Clock sync data generated",
    data: {
      protocolVersion,
      syncedAt: now.toISOString(),
      serverTime: now.toISOString(),
      serverEpochMs: now.getTime(),
      timezoneOffsetMinutes,
      offsetMs,
      maxDriftMs: 30000,
      shouldUpdateClock: offsetMs === null ? false : Math.abs(offsetMs) > 30000,
    },
  });
});

module.exports = router;
