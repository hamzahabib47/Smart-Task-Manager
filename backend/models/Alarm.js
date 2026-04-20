const mongoose = require("mongoose");

const alarmSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    label: {
      type: String,
      required: true,
      trim: true,
    },
    date: {
      type: String,
      default: "",
      trim: true,
    },
    time: {
      type: String,
      required: true,
      trim: true,
    },
    recurrence: {
      type: String,
      enum: ["none", "daily"],
      default: "none",
    },
    enabled: {
      type: Boolean,
      default: true,
    },
    ringing: {
      type: Boolean,
      default: false,
    },
    ringStartedAt: {
      type: Date,
      default: null,
    },
    triggeredAt: {
      type: Date,
      default: null,
    },
    lastTriggeredDate: {
      type: String,
      default: "",
      trim: true,
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model("Alarm", alarmSchema);
