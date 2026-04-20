const fs = require("fs");
const path = require("path");
const express = require("express");
const multer = require("multer");

const authMiddleware = require("../middleware/auth");
const Photo = require("../models/Photo");

const router = express.Router();

const isVercelRuntime = process.env.VERCEL === "1";
const uploadDir = isVercelRuntime
  ? path.join("/tmp", "uploads")
  : path.join(__dirname, "..", "uploads");

try {
  fs.mkdirSync(uploadDir, { recursive: true });
} catch (error) {
  console.error("Failed to initialize upload directory:", error.message);
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadDir),
  filename: (_req, file, cb) => {
    const safeName = file.originalname.replace(/[^a-zA-Z0-9._-]/g, "_");
    cb(null, `${Date.now()}_${safeName}`);
  },
});

const upload = multer({ storage });

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

router.use("/photos", authMiddleware);

router.post("/photos/upload", upload.single("photo"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: "photo file is required",
      });
    }

    const photo = await Photo.create({
      user: req.user.id,
      filename: req.file.filename,
      url: `/uploads/${req.file.filename}`,
    });

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

    const filePath = path.join(uploadDir, photo.filename);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }

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
