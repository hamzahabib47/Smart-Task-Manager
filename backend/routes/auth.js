const express = require("express");
const fs = require("fs");
const path = require("path");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const {
  isEmailConfigured,
  sendVerificationCodeEmail,
  sendPasswordResetCodeEmail,
} = require("../services/email");

const authMiddleware = require("../middleware/auth");
const Alarm = require("../models/Alarm");
const Photo = require("../models/Photo");
const Setting = require("../models/Setting");
const Task = require("../models/Task");
const User = require("../models/User");

const router = express.Router();

const VERIFICATION_CODE_MINUTES = 10;
const PASSWORD_RESET_CODE_MINUTES = 15;

const createNumericCode = () =>
  String(Math.floor(100000 + Math.random() * 900000));

const hashCode = (code) =>
  crypto.createHash("sha256").update(code).digest("hex");

const isDbUnavailableError = (error) => {
  const msg = (error?.message || "").toLowerCase();
  return (
    msg.includes("buffering timed out") ||
    msg.includes("topology") ||
    msg.includes("server selection") ||
    msg.includes("not connected")
  );
};

const handleRegisterRequest = async (req, res) => {
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
    if (exists && exists.isEmailVerified) {
      return res.status(409).json({
        success: false,
        message: "Email already registered",
      });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const verificationCode = createNumericCode();
    const verificationCodeHash = hashCode(verificationCode);
    const verificationCodeExpiry = new Date(
      Date.now() + VERIFICATION_CODE_MINUTES * 60 * 1000
    );

    let user = exists;
    if (!user) {
      user = await User.create({
        name,
        email,
        passwordHash,
        isEmailVerified: false,
        emailVerificationCodeHash: verificationCodeHash,
        emailVerificationCodeExpiry: verificationCodeExpiry,
      });
    } else {
      user.name = name;
      user.passwordHash = passwordHash;
      user.isEmailVerified = false;
      user.emailVerificationCodeHash = verificationCodeHash;
      user.emailVerificationCodeExpiry = verificationCodeExpiry;
      await user.save();
    }

    if (!isEmailConfigured()) {
      return res.status(503).json({
        success: false,
        message: "Email service is not configured. Please contact support.",
      });
    }

    await sendVerificationCodeEmail({
      to: email,
      name,
      code: verificationCode,
    });

    return res.status(202).json({
      success: true,
      message: "Verification code sent to your email",
      data: {
        email,
        expiresInMinutes: VERIFICATION_CODE_MINUTES,
      },
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message,
    });
  }
};

router.post("/auth/register-request", handleRegisterRequest);

// Backward-compatible alias for older clients
router.post("/auth/register", handleRegisterRequest);

router.post("/auth/verify-email", async (req, res) => {
  try {
    const email = (req.body.email || "").trim().toLowerCase();
    const code = (req.body.code || "").trim();

    if (!email || !code) {
      return res.status(400).json({
        success: false,
        message: "email and verification code are required",
      });
    }

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "No account found for this email",
      });
    }

    if (user.isEmailVerified) {
      return res.json({
        success: true,
        message: "Email already verified",
      });
    }

    if (!user.emailVerificationCodeHash || !user.emailVerificationCodeExpiry) {
      return res.status(400).json({
        success: false,
        message: "Verification code not found. Please request a new code.",
      });
    }

    if (user.emailVerificationCodeExpiry < new Date()) {
      return res.status(400).json({
        success: false,
        message: "Verification code has expired. Please request a new code.",
      });
    }

    if (hashCode(code) !== user.emailVerificationCodeHash) {
      return res.status(400).json({
        success: false,
        message: "Invalid verification code",
      });
    }

    user.isEmailVerified = true;
    user.emailVerificationCodeHash = null;
    user.emailVerificationCodeExpiry = null;
    await user.save();

    return res.json({
      success: true,
      message: "Email verified successfully",
      data: {
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

    if (user.isEmailVerified === false) {
      return res.status(403).json({
        success: false,
        message: "Please verify your email before signing in.",
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

router.post("/auth/forgot-password", async (req, res) => {
  try {
    const email = (req.body.email || "").trim().toLowerCase();

    if (!email) {
      return res.status(400).json({
        success: false,
        message: "email is required",
      });
    }

    const user = await User.findOne({ email });
    if (!user) {
      // For security, don't reveal if email exists
      return res.status(200).json({
        success: true,
        message: "If the email exists, a password reset code will be sent.",
      });
    }

    if (!isEmailConfigured()) {
      return res.status(503).json({
        success: false,
        message: "Email service is not configured. Please contact support.",
      });
    }

    const resetCode = createNumericCode();
    const resetCodeHash = hashCode(resetCode);
    const resetCodeExpiry = new Date(
      Date.now() + PASSWORD_RESET_CODE_MINUTES * 60 * 1000
    );

    user.passwordResetCodeHash = resetCodeHash;
    user.passwordResetCodeExpiry = resetCodeExpiry;
    user.resetToken = null;
    user.resetTokenExpiry = null;
    await user.save();

    await sendPasswordResetCodeEmail({
      to: user.email,
      name: user.name,
      code: resetCode,
    });

    return res.json({
      success: true,
      message: "If the email exists, a password reset code has been sent.",
      data: {
        expiresInMinutes: PASSWORD_RESET_CODE_MINUTES,
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

router.post("/auth/reset-password", async (req, res) => {
  try {
    const email = (req.body.email || "").trim().toLowerCase();
    const code = (req.body.code || "").trim();
    const token = (req.body.token || "").trim();
    const newPassword = req.body.newPassword || "";

    if ((!email || !code) && !token) {
      return res.status(400).json({
        success: false,
        message: "Provide either email+reset code or a reset token",
      });
    }

    if (!newPassword) {
      return res.status(400).json({
        success: false,
        message: "New password is required",
      });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({
        success: false,
        message: "Password must be at least 6 characters",
      });
    }

    let user = null;
    if (token) {
      user = await User.findOne({ resetToken: token });
      if (!user || !user.resetTokenExpiry || user.resetTokenExpiry < new Date()) {
        return res.status(400).json({
          success: false,
          message: "Invalid or expired reset token",
        });
      }
    } else {
      user = await User.findOne({ email });
    }

    if (!user) {
      return res.status(400).json({
        success: false,
        message: "Invalid or expired reset code",
      });
    }

    if (!token) {
      if (!user.passwordResetCodeHash || !user.passwordResetCodeExpiry) {
        return res.status(400).json({
          success: false,
          message: "Reset code not found. Please request a new one.",
        });
      }

      if (user.passwordResetCodeExpiry < new Date()) {
        return res.status(400).json({
          success: false,
          message: "Reset code has expired",
        });
      }

      if (hashCode(code) !== user.passwordResetCodeHash) {
        return res.status(400).json({
          success: false,
          message: "Invalid or expired reset code",
        });
      }
    }

    // Hash the new password
    const passwordHash = await bcrypt.hash(newPassword, 10);

    // Update user password and clear reset metadata
    user.passwordHash = passwordHash;
    user.isEmailVerified = true;
    user.resetToken = null;
    user.resetTokenExpiry = null;
    user.passwordResetCodeHash = null;
    user.passwordResetCodeExpiry = null;
    await user.save();

    return res.json({
      success: true,
      message: "Password reset successfully",
      data: {
        id: user._id,
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

module.exports = router;
