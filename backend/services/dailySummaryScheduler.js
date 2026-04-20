const Setting = require("../models/Setting");

const toLocalDateText = (d) => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
};

const toLocalTimeText = (d) => {
  const h = String(d.getHours()).padStart(2, "0");
  const m = String(d.getMinutes()).padStart(2, "0");
  return `${h}:${m}`;
};

let timer = null;

const runTick = async () => {
  try {
    const now = new Date();
    const today = toLocalDateText(now);
    const currentHHMM = toLocalTimeText(now);

    await Setting.updateMany(
      {
        dailySummaryTime: currentHHMM,
        lastDailySummaryDate: { $ne: today },
      },
      {
        lastDailySummaryDate: today,
        dailySummaryShownAt: now,
      }
    );
  } catch (error) {
    console.error("Daily summary scheduler tick failed:", error.message);
  }
};

const startDailySummaryScheduler = () => {
  if (timer) return;
  timer = setInterval(runTick, 30000);
  runTick();
  console.log("Daily summary scheduler started");
};

module.exports = { startDailySummaryScheduler };
