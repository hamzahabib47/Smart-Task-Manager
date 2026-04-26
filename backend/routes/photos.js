const fs = require("fs");
const path = require("path");
const express = require("express");
const multer = require("multer");
const mongoose = require("mongoose");

const authMiddleware = require("../middleware/auth");
const Photo = require("../models/Photo");

const router = express.Router();

// Helper function to emit updates to both Socket.IO and SSE
const emitUpdate = (req, data) => {
  const io = req.app.locals.io;
  const updateEmitter = req.app.locals.updateEmitter;
  
  // Emit to Socket.IO (for local development)
  if (io) {
    io.emit("dataUpdated", data);
  }
  
  // Emit to EventEmitter for SSE (works on Vercel)
  if (updateEmitter) {
    updateEmitter.emit("dataUpdated", data);
  }
};

const isVercelRuntime = process.env.VERCEL === "1";
const uploadDir = isVercelRuntime
  ? path.join("/tmp", "uploads")
  : path.join(__dirname, "..", "uploads");

try {
  fs.mkdirSync(uploadDir, { recursive: true });
} catch (error) {
  console.error("Failed to initialize upload directory:", error.message);
}

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
});

router.get("/photos/public", async (_req, res) => {
  try {
    const photos = await Photo.find().sort({ createdAt: -1 }).limit(30);

    return res.json({
      success: true,
      count: photos.length,
      data: photos,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message,
    });
  }
});

router.get("/photos/:id/file", async (req, res) => {
  try {
    const photo = await Photo.findById(req.params.id);
    if (!photo) {
      return res.status(404).json({
        success: false,
        message: "Photo not found",
      });
    }

    if (photo.dataBase64) {
      const binary = Buffer.from(photo.dataBase64, "base64");
      res.set("Content-Type", photo.mimeType || "image/jpeg");
      res.set("Cache-Control", "public, max-age=31536000, immutable");
      return res.send(binary);
    }

    const filePath = path.join(uploadDir, photo.filename || "");
    if (photo.filename && fs.existsSync(filePath)) {
      return res.sendFile(filePath);
    }

    return res.status(404).json({
      success: false,
      message: "Photo file not found",
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message,
    });
  }
});

router.use("/photos", authMiddleware);

router.post("/photos/upload", (req, res) => {
  upload.single("photo")(req, res, async (uploadError) => {
    try {
      if (uploadError instanceof multer.MulterError) {
        if (uploadError.code === "LIMIT_FILE_SIZE") {
          return res.status(413).json({
            success: false,
            message: "Image is too large. Max allowed size is 5MB.",
          });
        }

        return res.status(400).json({
          success: false,
          message: "Invalid upload request",
        });
      }

      if (uploadError) {
        return res.status(400).json({
          success: false,
          message: "Could not process uploaded image",
        });
      }

      if (!req.file) {
        return res.status(400).json({
          success: false,
          message: "photo file is required",
        });
      }

      const safeName = (req.file.originalname || "photo.jpg").replace(
        /[^a-zA-Z0-9._-]/g,
        "_"
      );

      const photoId = new mongoose.Types.ObjectId();
      const photo = await Photo.create({
        _id: photoId,
        user: req.user.id,
        filename: `${Date.now()}_${safeName}`,
        url: `/api/photos/${photoId}/file`,
        mimeType: req.file.mimetype || "image/jpeg",
        dataBase64: req.file.buffer.toString("base64"),
      });

      // Emit real-time update event
      emitUpdate(req, { type: "photo", action: "uploaded", data: photo });

      return res.status(201).json({
        success: true,
        message: "Photo uploaded",
        data: photo,
      });
    } catch (error) {
      return res.status(500).json({
        success: false,
        message: "Server error",
        error: error.message,
      });
    }
  });
});

router.get("/photos", async (req, res) => {
  try {
    const photos = await Photo.find({ user: req.user.id }).sort({ createdAt: -1 });

    return res.json({
      success: true,
      count: photos.length,
      data: photos,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message,
    });
  }
});

router.delete("/photos/:id", async (req, res) => {
  try {
    const photo = await Photo.findOneAndDelete({
      _id: req.params.id,
      user: req.user.id,
    });

    if (!photo) {
      return res.status(404).json({
        success: false,
        message: "Photo not found",
      });
    }

    const filePath = path.join(uploadDir, photo.filename || "");
    if (photo.filename && fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }

    // Emit real-time update event
    emitUpdate(req, { type: "photo", action: "deleted", data: photo });

    return res.json({
      success: true,
      message: "Photo deleted",
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
