const mongoose = require("mongoose");

const settingSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
      index: true,
    },
    slideshowIntervalSeconds: {
      type: Number,
      default: 5,
      min: 2,
      max: 60,
    },
    slideshowEnabled: {
      type: Boolean,
      default: true,
    },
    selectedSinglePhotoId: {
      type: String,
      default: "",
      trim: true,
    },
    dailySummaryTime: {
      type: String,
      default: "08:00",
      trim: true,
    },
    lastDailySummaryDate: {
      type: String,
      default: "",
      trim: true,
    },
    dailySummaryShownAt: {
      type: Date,
      default: null,
    },
    pushNotifications: {
      type: Boolean,
      default: true,
    },
    buzzerAlerts: {
      type: Boolean,
      default: true,
    },
    autoClockSync: {
      type: Boolean,
      default: true,
    },
    archiveCompletedTasks: {
      type: Boolean,
      default: true,
    },
    timeFormat: {
      type: String,
      default: "12-hour",
      enum: ["12-hour", "24-hour"],
      trim: true,
    },
    reminderStyle: {
      type: String,
      default: "full_screen",
      enum: ["full_screen", "banner"],
      trim: true,
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model("Setting", settingSchema);
