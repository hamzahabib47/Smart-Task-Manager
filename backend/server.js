const path = require("path");
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
const {
  startDailySummaryScheduler,
} = require("./services/dailySummaryScheduler");

dotenv.config();
if (!process.env.JWT_SECRET) {
  console.error("JWT_SECRET is required in .env");
  process.exit(1);
}
connectDB();

const app = express();

app.use(cors());
app.use(express.json());

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

const uploadsPath = path.join(__dirname, "uploads");
app.use("/uploads", express.static(uploadsPath));

const displayPath = path.join(__dirname, "..", "tablet-web");
app.use("/display", express.static(displayPath));

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  startDailySummaryScheduler();
});
