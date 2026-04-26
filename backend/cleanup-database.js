#!/usr/bin/env node
/**
 * Database Cleanup Script - Deletes all users and related data
 * WARNING: This is a destructive operation. Use only for development/testing.
 * Run: node cleanup-database.js
 */

require("dotenv").config();
const mongoose = require("mongoose");

const User = require("./models/User");
const Setting = require("./models/Setting");
const Task = require("./models/Task");
const Alarm = require("./models/Alarm");
const Photo = require("./models/Photo");

const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI, {
      serverSelectionTimeoutMS: 10000,
      maxPoolSize: 10,
    });
    console.log("✅ MongoDB connected");
    return true;
  } catch (error) {
    console.error("❌ MongoDB connection error:", error.message);
    return false;
  }
};

const cleanupDatabase = async () => {
  try {
    // Get all user IDs first
    const users = await User.find({});
    const userIds = users.map((user) => user._id);
    
    console.log(`\n📋 Found ${users.length} user(s) to delete`);
    
    if (userIds.length === 0) {
      console.log("✅ No users to delete. Database is already clean.");
      return;
    }

    // Show users being deleted
    users.forEach((user) => {
      console.log(`   - ${user.email} (${user.name})`);
    });

    // Delete all related data for these users
    console.log("\n🗑️  Deleting user data...");

    const deletedSettings = await Setting.deleteMany({ user: { $in: userIds } });
    console.log(`   ✅ Deleted ${deletedSettings.deletedCount} setting(s)`);

    const deletedTasks = await Task.deleteMany({ user: { $in: userIds } });
    console.log(`   ✅ Deleted ${deletedTasks.deletedCount} task(s)`);

    const deletedAlarms = await Alarm.deleteMany({ user: { $in: userIds } });
    console.log(`   ✅ Deleted ${deletedAlarms.deletedCount} alarm(s)`);

    const deletedPhotos = await Photo.deleteMany({ user: { $in: userIds } });
    console.log(`   ✅ Deleted ${deletedPhotos.deletedCount} photo(s)`);

    const deletedUsers = await User.deleteMany({});
    console.log(`   ✅ Deleted ${deletedUsers.deletedCount} user(s)`);

    console.log("\n✨ Database cleanup completed successfully!");
    console.log("   All users and their associated data have been removed.");
  } catch (error) {
    console.error("\n❌ Error during cleanup:", error.message);
    throw error;
  }
};

const main = async () => {
  console.log("🔴 WARNING: This will DELETE ALL USERS and their data!");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");

  const connected = await connectDB();
  if (!connected) {
    console.error("Failed to connect to MongoDB");
    process.exit(1);
  }

  try {
    await cleanupDatabase();
    console.log("\n✅ All done!\n");
  } catch (error) {
    console.error("\n❌ Cleanup failed!\n");
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    console.log("🔌 Database connection closed\n");
  }
};

main();
