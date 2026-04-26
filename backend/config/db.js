const mongoose = require("mongoose");

let connectionPromise = null;

const connectDB = async () => {
  if (mongoose.connection.readyState === 1) {
    return true;
  }

  if (mongoose.connection.readyState === 2 && connectionPromise) {
    try {
      await connectionPromise;
      return true;
    } catch (_error) {
      return false;
    }
  }

  try {
    connectionPromise = mongoose.connect(process.env.MONGODB_URI, {
      serverSelectionTimeoutMS: 10000,
      maxPoolSize: 10,
    });
    await connectionPromise;

    if (mongoose.connection.readyState === 1) {
      console.log("MongoDB connected");
    }
    return true;
  } catch (error) {
    console.error("MongoDB connection error:", error.message);
    console.warn("Running in fallback mode without MongoDB.");
    connectionPromise = null;
    return false;
  }
};

module.exports = connectDB;
