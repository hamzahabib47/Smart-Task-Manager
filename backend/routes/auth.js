const express = require("express");
const fs = require("fs");
const path = require("path");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

const authMiddleware = require("../middleware/auth");
const Alarm = require("../models/Alarm");
const Photo = require("../models/Photo");
const Setting = require("../models/Setting");
const Task = require("../models/Task");
const User = require("../models/User");

const router = express.Router();

const isDbUnavailableError = (error) => {
  const msg = (error?.message || "").toLowerCase();
  return (
    msg.includes("buffering timed out") ||
    msg.includes("topology") ||
    msg.includes("server selection") ||
    msg.includes("not connected")
  );
};

router.post("/auth/register", async (req, res) => {
  try {
    const name = (req.body.name || "").trim();
    const email = (req.body.email || "").trim().toLowerCase();
    const password = req.body.password || "";

    if (!name || !email || !password) {
      return res.status(400).json({
        success: false,
        message: "name, email and password are required",
      });
    }

    if (password.length < 6) {
      return res.status(400).json({
        success: false,
        message: "password must be at least 6 characters",
      });
    }

    const exists = await User.findOne({ email });
    if (exists) {
      return res.status(409).json({
        success: false,
        message: "Email already registered",
      });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const user = await User.create({ name, email, passwordHash });

    return res.status(201).json({
      success: true,
      message: "Registration successful",
      data: {
        id: user._id,
        name: user.name,
        email: user.email,
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

router.post("/auth/login", async (req, res) => {
  try {
    const email = (req.body.email || "").trim().toLowerCase();
    const password = req.body.password || "";

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: "email and password are required",
      });
    }

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "No account found with this email. Please register first.",
      });
    }

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) {
      return res.status(401).json({
        success: false,
        message: "Incorrect password",
      });
    }

    const token = jwt.sign(
      {
        userId: user._id.toString(),
        email: user.email,
      },
      process.env.JWT_SECRET,
      { expiresIn: "7d" }
    );

    return res.json({
      success: true,
      message: "Login successful",
      data: {
        token,
        user: {
          id: user._id,
          name: user.name,
          email: user.email,
        },
      },
    });
  } catch (error) {
    if (isDbUnavailableError(error)) {
      return res.status(503).json({
        success: false,
        message: "Service temporarily unavailable. Please try again in a moment.",
      });
    }

    return res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message,
    });
  }
});

router.patch("/auth/name", authMiddleware, async (req, res) => {
  try {
    const nextName = (req.body.name || "").trim();

    if (!nextName) {
      return res.status(400).json({
        success: false,
        message: "name is required",
      });
    }

    if (nextName.length < 2) {
      return res.status(400).json({
        success: false,
        message: "name must be at least 2 characters",
      });
    }

    const updated = await User.findByIdAndUpdate(
      req.user.id,
      { name: nextName },
      { new: true, runValidators: true }
    );

    if (!updated) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    return res.json({
      success: true,
      message: "Name updated successfully",
      data: {
        id: updated._id,
        name: updated.name,
        email: updated.email,
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

router.delete("/auth/account", authMiddleware, async (req, res) => {
  try {
    const confirmationText = (req.body.confirmationText || "").trim();

    if (confirmationText !== "DELETE MY ACCOUNT") {
      return res.status(400).json({
        success: false,
        message: "Type DELETE MY ACCOUNT (all caps) to confirm account deletion",
      });
    }

    const userId = req.user.id;
    const uploadDir = path.join(__dirname, "..", "uploads");

    const existingUser = await User.findById(userId);
    if (!existingUser) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    const photos = await Photo.find({ user: userId });
    for (const photo of photos) {
      const filename = (photo.filename || "").trim();
      const fallbackName = (photo.url || "").split("/").pop() || "";
      const diskName = filename || fallbackName;
      if (!diskName) continue;

      const filePath = path.join(uploadDir, diskName);
      try {
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
        }
      } catch (_fileError) {
        // Keep account deletion resilient even if a file cannot be removed.
      }
    }

    await Task.deleteMany({ user: userId });
    await Alarm.deleteMany({ user: userId });
    await Setting.deleteMany({ user: userId });
    await Photo.deleteMany({ user: userId });

    const userDeleteResult = await User.deleteOne({ _id: userId });
    if (userDeleteResult.deletedCount !== 1) {
      return res.status(500).json({
        success: false,
        message: "Could not delete account",
      });
    }

    return res.json({
      success: true,
      message: "Account deleted successfully",
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
