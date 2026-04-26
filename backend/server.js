const path = require("path");
const fs = require("fs");
const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");
const http = require("http");
const { Server } = require("socket.io");
const { EventEmitter } = require("events");

const connectDB = require("./config/db");
const authRoutes = require("./routes/auth");
const photoRoutes = require("./routes/photos");
const settingsRoutes = require("./routes/settings");
const deviceRoutes = require("./routes/device");
const alarmRoutes = require("./routes/alarms");
const taskRoutes = require("./routes/tasks");
const {
  startDailySummaryScheduler,
} = require("./services/dailySummaryScheduler");

dotenv.config();
const isVercelRuntime = process.env.VERCEL === "1";

if (!process.env.JWT_SECRET) {
  const msg = "JWT_SECRET is required";
  if (isVercelRuntime) {
    console.error(`${msg} in Vercel Environment Variables`);
  } else {
    console.error(`${msg} in .env`);
    process.exit(1);
  }
}

connectDB();

const app = express();

// Global event emitter for real-time updates (works on Vercel)
const updateEmitter = new EventEmitter();
app.locals.updateEmitter = updateEmitter;

app.use(cors());
app.use(express.json());

// SSE endpoint for real-time updates (works on Vercel)
app.get("/api/updates/subscribe", (req, res) => {
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("Access-Control-Allow-Origin", "*");

  // Send initial connection message
  res.write("data: {\"connected\":true}\n\n");

  const handleUpdate = (data) => {
    res.write(`data: ${JSON.stringify(data)}\n\n`);
  };

  // Listen for updates
  updateEmitter.on("dataUpdated", handleUpdate);

  // Clean up on disconnect
  req.on("close", () => {
    updateEmitter.removeListener("dataUpdated", handleUpdate);
    res.end();
  });
});

app.get("/", (_req, res) => {
  res.json({
    success: true,
    message: "Smart Time Manager API running",
  });
});

app.use("/api", authRoutes);
app.use("/api", settingsRoutes);
app.use("/api", photoRoutes);
app.use("/api", deviceRoutes);
app.use("/api", alarmRoutes);
app.use("/api", taskRoutes);

const uploadsPath = isVercelRuntime
  ? path.join("/tmp", "uploads")
  : path.join(__dirname, "uploads");
app.use("/uploads", express.static(uploadsPath));

const legacyDisplayPath = path.join(__dirname, "..", "tablet-web");
const renamedDisplayPath = path.join(__dirname, "..", "web_display");
const displayPath = fs.existsSync(renamedDisplayPath)
  ? renamedDisplayPath
  : legacyDisplayPath;
app.use(
  "/display",
  express.static(displayPath, {
    etag: false,
    lastModified: false,
    setHeaders: (res) => {
      res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate");
      res.setHeader("Pragma", "no-cache");
      res.setHeader("Expires", "0");
    },
  })
);

if (!isVercelRuntime) {
  const PORT = process.env.PORT || 5000;
  
  // Create HTTP server
  const httpServer = http.createServer(app);
  
  // Setup Socket.IO with CORS
  const io = new Server(httpServer, {
    cors: {
      origin: "*",
      methods: ["GET", "POST"],
    },
  });

  // Store io instance for access in routes
  app.locals.io = io;

  // Socket.IO connection handling
  io.on("connection", (socket) => {
    console.log(`Client connected: ${socket.id}`);

    socket.on("disconnect", () => {
      console.log(`Client disconnected: ${socket.id}`);
    });
  });

  httpServer.listen(PORT, () => {
    console.log(`Server running on port ${PORT} with Socket.IO and SSE`);
    startDailySummaryScheduler();
  });
} else {
  // SSE works on Vercel, log that it's active
  console.log("Server running on Vercel with SSE real-time updates");
}

module.exports = app;
