const API_BASE_URL = "https://smart-task-manager-tan.vercel.app";
const DISPLAY_ENDPOINT = `${API_BASE_URL}/api/tasks/public/display-state`;
const DISMISS_TASK_ENDPOINT = `${API_BASE_URL}/api/tasks/public`;
const STOP_ALARM_ENDPOINT = `${API_BASE_URL}/api/alarms/public`;

const screen = document.getElementById("screen");
const heroImage = document.getElementById("heroImage");
const contentCard = document.getElementById("contentCard");
const emptyDisplayMessage = document.getElementById("emptyDisplayMessage");
const countdownBadge = document.getElementById("countdownBadge");
const clockBadge = document.getElementById("clockBadge");
const primaryText = document.getElementById("primaryText");
const secondaryText = document.getElementById("secondaryText");
const timeText = document.getElementById("timeText");
const hintText = document.getElementById("hintText");
const bannerStrip = document.getElementById("bannerStrip");
const bannerTitle = document.getElementById("bannerTitle");
const bannerSubtitle = document.getElementById("bannerSubtitle");

let slideshowPhotos = [];
let slideshowIndex = 0;
let slideshowTimer = null;
let slideshowIntervalSeconds = 5;
let lastSlideshowSignature = "";
let currentMode = "";
let currentTimeFormat = "12-hour";
let alarmSoundTimer = null;
let audioContext = null;
let countdownTimer = null;
let countdownDeadlineMs = null;
let countdownContextKey = "";
let autoDismissInFlight = false;

const SCREEN_MODES = [
  "mode-slideshow",
  "mode-upcoming",
  "mode-reminder-full",
  "mode-reminder-banner",
];

function startClock() {
  const updateClock = () => {
    const now = new Date();
    const is24 = currentTimeFormat === "24-hour";
    clockBadge.textContent = now.toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: !is24,
    });
  };

  updateClock();
  setInterval(updateClock, 1000);
}

function toAbsoluteUrl(url) {
  if (!url) return "";
  if (url.startsWith("http://") || url.startsWith("https://")) return url;
  return `${API_BASE_URL}${url}`;
}

function formatDateTime(task, preferred) {
  const date = (task?.date || "").trim();
  const time = (preferred || task?.time || "").trim();
  return `${date} ${time}`.trim() || "--:--";
}

function setModeClass(modeClass) {
  SCREEN_MODES.forEach((className) => screen.classList.remove(className));
  if (modeClass) screen.classList.add(modeClass);
}

function showBanner(title, subtitle) {
  bannerTitle.textContent = title;
  bannerSubtitle.textContent = subtitle;
  bannerStrip.classList.remove("hidden");
}

function hideBanner() {
  bannerStrip.classList.add("hidden");
}

function setSecondaryText(value) {
  const text = (value || "").toString().trim();
  secondaryText.textContent = text;
  if (text) {
    secondaryText.classList.remove("hidden");
  } else {
    secondaryText.classList.add("hidden");
  }
}

function setMetaVisible(visible) {
  if (visible) {
    timeText.classList.remove("hidden");
    hintText.classList.remove("hidden");
  } else {
    timeText.classList.add("hidden");
    hintText.classList.add("hidden");
  }
}

function setCardCompact(compact) {
  if (!contentCard) return;
  if (compact) {
    contentCard.classList.add("compact-card");
  } else {
    contentCard.classList.remove("compact-card");
  }
}

function setEmptyDisplayMessageVisible(visible) {
  if (!emptyDisplayMessage) return;
  if (visible) {
    emptyDisplayMessage.classList.remove("hidden");
  } else {
    emptyDisplayMessage.classList.add("hidden");
  }
}

function setHeroImage(url) {
  if (!url) {
    heroImage.classList.add("hidden");
    heroImage.removeAttribute("src");
    return;
  }

  heroImage.src = toAbsoluteUrl(url);
  heroImage.classList.remove("hidden");
}

function stopSlideshow() {
  if (slideshowTimer) {
    clearInterval(slideshowTimer);
    slideshowTimer = null;
  }
}

function clearCountdown() {
  countdownDeadlineMs = null;
  countdownContextKey = "";
  countdownBadge.classList.add("hidden");
}

function ensureAudioContext() {
  if (!audioContext) {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (Ctx) {
      audioContext = new Ctx();
    }
  }

  if (audioContext && audioContext.state === "suspended") {
    audioContext.resume().catch(() => {});
  }

  return audioContext;
}

function playAlarmBeep() {
  const ctx = ensureAudioContext();
  if (!ctx) return;

  const now = ctx.currentTime;
  const master = ctx.createGain();
  master.connect(ctx.destination);
  master.gain.setValueAtTime(0.0001, now);
  master.gain.exponentialRampToValueAtTime(0.1, now + 0.03);
  master.gain.exponentialRampToValueAtTime(0.0001, now + 0.62);

  const toneA = ctx.createOscillator();
  toneA.type = "sine";
  toneA.frequency.setValueAtTime(740, now);
  toneA.connect(master);
  toneA.start(now);
  toneA.stop(now + 0.2);

  const toneB = ctx.createOscillator();
  toneB.type = "triangle";
  toneB.frequency.setValueAtTime(988, now + 0.24);
  toneB.connect(master);
  toneB.start(now + 0.24);
  toneB.stop(now + 0.52);
}

function startAlarmSound() {
  if (alarmSoundTimer) return;
  playAlarmBeep();
  alarmSoundTimer = setInterval(playAlarmBeep, 1200);
}

function stopAlarmSound() {
  if (alarmSoundTimer) {
    clearInterval(alarmSoundTimer);
    alarmSoundTimer = null;
  }
}

async function dismissByContext(context) {
  if (!context || autoDismissInFlight) return;

  autoDismissInFlight = true;
  try {
    if (context.type === "alarm") {
      await fetch(`${STOP_ALARM_ENDPOINT}/${context.id}/stop`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
      });
    } else if (context.type === "reminder") {
      await fetch(`${DISMISS_TASK_ENDPOINT}/${context.id}/dismiss`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
      });
    }
  } catch (_error) {
    // Keep UI responsive even if dismiss call fails.
  } finally {
    autoDismissInFlight = false;
  }
}

function ensureCountdownTimer() {
  if (countdownTimer) return;

  countdownTimer = setInterval(async () => {
    if (!countdownDeadlineMs) {
      countdownBadge.classList.add("hidden");
      return;
    }

    const remainingMs = countdownDeadlineMs - Date.now();
    const remainingSeconds = Math.max(0, Math.ceil(remainingMs / 1000));

    countdownBadge.textContent = `Auto close in ${remainingSeconds}s`;
    countdownBadge.classList.remove("hidden");

    if (remainingSeconds <= 0) {
      const [type, id] = countdownContextKey.split(":");
      clearCountdown();
      if (type && id) {
        await dismissByContext({ type, id });
      }
      await loadDisplayState();
    }
  }, 250);
}

function syncCountdown(type, id, remainingSeconds) {
  if (!type || !id) {
    clearCountdown();
    return;
  }

  const key = `${type}:${id}`;
  const clampedSeconds = Math.max(0, Number(remainingSeconds || 0));

  if (countdownContextKey !== key) {
    countdownContextKey = key;
    countdownDeadlineMs = Date.now() + clampedSeconds * 1000;
    return;
  }

  const currentRemaining = Math.max(0, Math.ceil((countdownDeadlineMs - Date.now()) / 1000));
  if (Math.abs(currentRemaining - clampedSeconds) > 1) {
    countdownDeadlineMs = Date.now() + clampedSeconds * 1000;
  }
}

function showSlideAt(index) {
  if (!slideshowPhotos.length) {
    setHeroImage("");
    return;
  }

  slideshowIndex = index % slideshowPhotos.length;
  if (slideshowIndex < 0) slideshowIndex = 0;
  setHeroImage(slideshowPhotos[slideshowIndex]);
}

function startSlideshow() {
  stopSlideshow();

  if (!slideshowPhotos.length) {
    setHeroImage("");
    return;
  }

  showSlideAt(slideshowIndex);
  slideshowTimer = setInterval(() => {
    showSlideAt(slideshowIndex + 1);
  }, slideshowIntervalSeconds * 1000);
}

function applySlideshowData(result) {
  slideshowIntervalSeconds = Math.max(2, Number(result.slideshowIntervalSeconds || 5));

  const newPhotos = Array.isArray(result.slideshowPhotos)
    ? result.slideshowPhotos
    : [];

  const signature = `${slideshowIntervalSeconds}|${newPhotos.join("|")}`;
  const changed = signature !== lastSlideshowSignature;
  lastSlideshowSignature = signature;

  slideshowPhotos = newPhotos;
  if (changed) slideshowIndex = 0;

  return changed;
}

async function loadDisplayState() {
  try {
    const res = await fetch(DISPLAY_ENDPOINT);
    const result = await res.json();

    if (!result.success) {
      setEmptyDisplayMessageVisible(true);
      setCardCompact(true);
      primaryText.textContent = "NO UPCOMING TASK";
      setSecondaryText("");
      timeText.textContent = "--:--";
      hintText.textContent = "";
      setMetaVisible(false);
      setModeClass("mode-upcoming");
      hideBanner();
      clearCountdown();
      stopSlideshow();
      stopAlarmSound();
      setHeroImage("");
      currentMode = "error";
      return;
    }

    currentTimeFormat = result.timeFormat === "24-hour" ? "24-hour" : "12-hour";

    const slideshowChanged = applySlideshowData(result);
    const firstSlide = slideshowPhotos.length ? slideshowPhotos[0] : "";

    if (result.mode === "alarm" && result.alarm) {
      setEmptyDisplayMessageVisible(false);
      setCardCompact(false);
      const alarm = result.alarm;
      const alertStyle = result.reminderStyle === "banner" ? "banner" : "full_screen";
      const alarmRemaining = result.autoStopRemainingSeconds ?? result.autoStopSeconds ?? 30;
      const alarmTime = result.alarmTimeFormatted || alarm.time || "--:--";

      primaryText.textContent = alarm.label || "Alarm";
      setSecondaryText("Alarm active");
      timeText.textContent = `${alarm.recurrence || "none"} @ ${alarmTime}`;
      hintText.textContent = "Alarm running";
      setMetaVisible(true);

      setHeroImage(firstSlide);
      stopSlideshow();

      if (alertStyle === "banner") {
        setModeClass("mode-reminder-banner");
        showBanner("Alarm", `${alarm.label || "Alarm"} at ${alarmTime}`);
      } else {
        setModeClass("mode-reminder-full");
        hideBanner();
      }

      if (result.buzzerAlerts === false) {
        stopAlarmSound();
      } else {
        startAlarmSound();
      }
      syncCountdown("alarm", alarm._id, alarmRemaining);
      ensureCountdownTimer();
      currentMode = "alarm";
      return;
    }

    if (result.mode === "reminder" && result.reminder) {
      setEmptyDisplayMessageVisible(false);
      setCardCompact(false);
      const task = result.reminder;
      const reminderStyle = result.reminderStyle === "banner" ? "banner" : "full_screen";
      const reminderRemaining = result.autoDismissRemainingSeconds ?? result.autoDismissSeconds ?? 30;
      const taskTitle = (task.title || "TASK").toString().trim();
      const dateTimeText = formatDateTime(task, result.reminderTimeFormatted);

      primaryText.textContent = taskTitle;
      setSecondaryText(task.description || "Task reminder active");
      timeText.textContent = "";
      hintText.textContent = "";
      setMetaVisible(false);

      setHeroImage(firstSlide);
      stopSlideshow();
      if (result.buzzerAlerts === false) {
        stopAlarmSound();
      } else {
        startAlarmSound();
      }

      if (reminderStyle === "banner") {
        setModeClass("mode-reminder-banner");
        showBanner("Reminder", `${taskTitle} at ${dateTimeText}`);
      } else {
        setModeClass("mode-reminder-full");
        hideBanner();
      }

      syncCountdown("reminder", task._id, reminderRemaining);
      ensureCountdownTimer();
      currentMode = "reminder";
      return;
    }

    if (result.mode === "upcoming" && result.nextReminder) {
      setEmptyDisplayMessageVisible(false);
      setCardCompact(true);
      const task = result.nextReminder;
      const taskTitle = (task.title || "TASK").toString().trim();
      const dateTimeText = formatDateTime(task, result.nextReminderTimeFormatted);

      primaryText.textContent = "UPCOMING TASK";
      setSecondaryText("");
      timeText.textContent = taskTitle;
      hintText.textContent = dateTimeText;
      setMetaVisible(true);

      setModeClass("mode-upcoming");
      setHeroImage(firstSlide);
      hideBanner();
      clearCountdown();
      stopSlideshow();
      stopAlarmSound();
      currentMode = "upcoming";
      return;
    }

    if (result.mode === "single_image") {
      setCardCompact(true);
      const singleImage = result.singleImage || slideshowPhotos[0] || "";
      setEmptyDisplayMessageVisible(!singleImage);

      primaryText.textContent = "NO UPCOMING TASK";
      setSecondaryText("");
      timeText.textContent = "--:--";
      hintText.textContent = "";
      setMetaVisible(false);

      setModeClass("mode-slideshow");
      hideBanner();
      clearCountdown();
      stopSlideshow();
      stopAlarmSound();
      setHeroImage(singleImage);
      currentMode = "single_image";
      return;
    }

    if (result.mode === "slideshow") {
      setCardCompact(true);
      setEmptyDisplayMessageVisible(slideshowPhotos.length === 0);
      primaryText.textContent = "NO UPCOMING TASK";
      setSecondaryText("");
      timeText.textContent = "--:--";
      hintText.textContent = "";
      setMetaVisible(false);

      setModeClass("mode-slideshow");
      hideBanner();
      clearCountdown();
      stopAlarmSound();

      const enteredSlideshow = currentMode !== "slideshow";
      if (enteredSlideshow || slideshowChanged || !slideshowTimer) {
        startSlideshow();
      }

      currentMode = "slideshow";
      return;
    }

    setCardCompact(true);
    setEmptyDisplayMessageVisible(slideshowPhotos.length === 0);
    primaryText.textContent = "NO UPCOMING TASK";
    setSecondaryText("");
    timeText.textContent = "--:--";
    hintText.textContent = "";
    setMetaVisible(false);
    setModeClass("mode-slideshow");
    hideBanner();
    clearCountdown();
    stopSlideshow();
    stopAlarmSound();
    setHeroImage(firstSlide);
  } catch (error) {
    setEmptyDisplayMessageVisible(true);
    setCardCompact(true);
    primaryText.textContent = "NO UPCOMING TASK";
    setSecondaryText("");
    timeText.textContent = "--:--";
    hintText.textContent = "";
    setMetaVisible(false);
    setModeClass("mode-upcoming");
    hideBanner();
    clearCountdown();
    stopSlideshow();
    stopAlarmSound();
    setHeroImage("");
    currentMode = "error";
  }
}

document.addEventListener(
  "pointerdown",
  () => {
    ensureAudioContext();
  },
  { passive: true }
);

startClock();
ensureCountdownTimer();
loadDisplayState();
setInterval(loadDisplayState, 2000);
