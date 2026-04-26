const path = require("path");
const fs = require("fs");
const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");

const connectDB = require("./config/db");
const authRoutes = require("./routes/auth");
const photoRoutes = require("./routes/photos");
const settingsRoutes = require("./routes/settings");
const deviceRoutes = require("./routes/device");
const alarmRoutes = require("./routes/alarms");
const taskRoutes = require("./routes/tasks");
const { initializeRealtime } = require("./services/realtime");

dotenv.config();
const isVercelRuntime = process.env.VERCEL === "1";

// Only require these on local development
let http, Server;
if (!isVercelRuntime) {
  http = require("http");
  Server = require("socket.io").Server;
}

const {
  startDailySummaryScheduler,
} = require("./services/dailySummaryScheduler");

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

initializeRealtime(app);

app.use(cors());
app.use(express.json());

// SSE endpoint for real-time updates (local development only)
// On Vercel, clients will use polling fallback instead
if (!isVercelRuntime) {
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
    req.app.locals.updateEmitter.on("dataUpdated", handleUpdate);

    // Clean up on disconnect
    req.on("close", () => {
      req.app.locals.updateEmitter.removeListener("dataUpdated", handleUpdate);
      res.end();
    });
  });
}

app.get("/api/realtime/config", (_req, res) => {
  const realtime = app.locals.realtime || {
    provider: "none",
    enabled: false,
  };

  return res.json({
    success: true,
    data: {
      provider: realtime.provider,
      enabled: realtime.enabled,
      key: realtime.key || "",
      cluster: realtime.cluster || "",
      channel: realtime.channel || "smart-task-manager",
      event: realtime.event || "dataUpdated",
    },
  });
});

app.get("/", (_req, res) => {
  res.json({
    success: true,
    message: "Smart Time Manager API running",
  });
});

app.use("/api", async (_req, res, next) => {
  const connected = await connectDB();
  if (!connected) {
    return res.status(503).json({
      success: false,
      message: "Service temporarily unavailable. Please try again in a moment.",
    });
  }

  return next();
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

app.get("/display", (_req, res) => {
  res.sendFile(path.join(displayPath, "index.html"));
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: "Route not found",
  });
});

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
  // Vercel serverless function
  if (process.env.NODE_ENV !== "production") {
    console.log("Server initialized for Vercel");
  }
}

// Global error handling middleware
app.use((err, req, res, next) => {
  console.error("Unhandled error:", err);
  res.status(500).json({
    success: false,
    message: "Internal server error",
    error: process.env.NODE_ENV === "development" ? err.message : undefined,
  });
});

module.exports = app;
