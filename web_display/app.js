const DEFAULT_API_BASE_URL = "https://smart-task-manager-tan.vercel.app";
const API_BASE_URL =
  window.location.origin && window.location.origin.startsWith("http")
    ? window.location.origin
    : DEFAULT_API_BASE_URL;
const DISPLAY_ENDPOINT = `${API_BASE_URL}/api/tasks/public/display-state`;
const DISMISS_TASK_ENDPOINT = `${API_BASE_URL}/api/tasks/public`;
const STOP_ALARM_ENDPOINT = `${API_BASE_URL}/api/alarms/public`;
const REALTIME_CONFIG_ENDPOINT = `${API_BASE_URL}/api/realtime/config`;
const ALARM_VOLUME = 0.22;

let socketIoClient = null;

// ============== PERFORMANCE OPTIMIZATION: Request Management ==============
// Prevent duplicate concurrent requests, cache responses, and debounce rapid calls
let displayStateInFlight = false;
let lastDisplayStateTimestamp = 0;
let cachedDisplayState = null;
const CACHE_TTL_MS = 2000; // Cache for 2 seconds
const MIN_REQUEST_INTERVAL_MS = 1000; // Minimum 1 second between requests
let pendingDisplayStateReload = false;
let reloadDebounceTimer = null;

function clearDisplayStateCache() {
  cachedDisplayState = null;
  lastDisplayStateTimestamp = 0;
}

function getValidCachedDisplayState() {
  if (
    cachedDisplayState &&
    Date.now() - lastDisplayStateTimestamp < CACHE_TTL_MS
  ) {
    console.log("Using cached display state");
    return cachedDisplayState;
  }
  return null;
}

function debouncedLoadDisplayState() {
  if (reloadDebounceTimer) clearTimeout(reloadDebounceTimer);
  
  pendingDisplayStateReload = true;
  reloadDebounceTimer = setTimeout(() => {
    pendingDisplayStateReload = false;
    reloadDebounceTimer = null;
    loadDisplayState();
  }, 300); // 300ms debounce window for rapid updates
}

// Real-time sources
let pusherClient = null;
let eventSource = null;
let pollingFallbackTimer = null;

function startPollingFallback() {
  if (!pollingFallbackTimer) {
    // Increased from 5s to 30s to reduce redundant polling
    pollingFallbackTimer = setInterval(loadDisplayState, 30000);
    console.log("Polling fallback active (30s)");
  }
}

function stopPollingFallback() {
  if (pollingFallbackTimer) {
    clearInterval(pollingFallbackTimer);
    pollingFallbackTimer = null;
  }
}

function initializeSSEUpdates() {
  try {
    eventSource = new EventSource(`${API_BASE_URL}/api/updates/subscribe`);

    eventSource.onopen = () => {
      console.log("Connected to SSE update stream");
      stopPollingFallback();
    };

    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data && data.connected) {
          console.log("SSE stream connected");
          return;
        }
        console.log("Data updated via SSE:", data);
        // Debounce rapid SSE updates to avoid request flooding
        debouncedLoadDisplayState();
      } catch (error) {
        console.error("Error parsing SSE message:", error);
      }
    };

    eventSource.onerror = (error) => {
      console.error("SSE connection error:", error);
      eventSource.close();
      startPollingFallback();
    };
  } catch (error) {
    console.error("Failed to initialize SSE updates:", error);
    startPollingFallback();
  }
}

function initializeSocketIoUpdates() {
  if (typeof io !== "function") {
    console.warn("Socket.IO client unavailable; falling back to other realtime providers");
    return false;
  }

  try {
    socketIoClient = io(API_BASE_URL, {
      transports: ["websocket", "polling"],
      reconnectionAttempts: 5,
    });

    socketIoClient.on("connect", () => {
      console.log("Connected to Socket.IO realtime stream");
      stopPollingFallback();
    });

    socketIoClient.on("dataUpdated", (data) => {
      console.log("Data updated via Socket.IO:", data);
      stopPollingFallback();
      debouncedLoadDisplayState();
    });

    socketIoClient.on("connect_error", (error) => {
      console.error("Socket.IO connect error:", error);
    });

    socketIoClient.on("error", (error) => {
      console.error("Socket.IO error:", error);
    });

    socketIoClient.on("disconnect", (reason) => {
      console.warn("Socket.IO disconnected:", reason);
      if (reason !== "io client disconnect") {
        startPollingFallback();
      }
    });

    return true;
  } catch (error) {
    console.error("Failed to initialize Socket.IO:", error);
    return false;
  }
}

function initializePusherUpdates(config) {
  if (!window.Pusher) {
    console.warn("Pusher SDK not loaded, falling back to SSE/polling");
    initializeSSEUpdates();
    return;
  }

  try {
    pusherClient = new window.Pusher(config.key, {
      cluster: config.cluster,
      forceTLS: true,
    });

    const channel = pusherClient.subscribe(config.channel);
    channel.bind(config.event, (data) => {
      console.log("Data updated via Pusher:", data);
      stopPollingFallback();
      // Debounce rapid Pusher events
      debouncedLoadDisplayState();
    });

    pusherClient.connection.bind("connected", () => {
      console.log("Connected to Pusher real-time stream");
      stopPollingFallback();
    });

    pusherClient.connection.bind("error", (error) => {
      console.error("Pusher connection error:", error);
      initializeSSEUpdates();
    });
  } catch (error) {
    console.error("Failed to initialize Pusher:", error);
    initializeSSEUpdates();
  }
}

async function initializeRealTimeUpdates() {
  if (initializeSocketIoUpdates()) {
    return;
  }

  try {
    const response = await fetch(REALTIME_CONFIG_ENDPOINT, {
      cache: "no-store",
    });

    if (response.ok) {
      const payload = await response.json();
      const config = payload?.data || {};
      const hasPusher =
        config.provider === "pusher" &&
        config.enabled &&
        config.key &&
        config.cluster;

      if (hasPusher) {
        initializePusherUpdates(config);
        return;
      }
    }
  } catch (error) {
    console.error("Realtime config fetch failed:", error);
  }

  initializeSSEUpdates();
}

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
  master.gain.exponentialRampToValueAtTime(ALARM_VOLUME, now + 0.03);
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
    // Clear cache after successful dismiss since server state changed
    clearDisplayStateCache();
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
        // Only reload after auto-dismiss completes
        await dismissByContext({ type, id });
        // Clear cache to force fresh fetch on reload
        clearDisplayStateCache();
        await loadDisplayState();
      }
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
  // Request deduplication: prevent concurrent requests
  if (displayStateInFlight) {
    console.log("Display state request already in flight, skipping");
    return;
  }

  // Rate limiting: ensure minimum interval between requests
  const timeSinceLastRequest = Date.now() - lastDisplayStateTimestamp;
  if (timeSinceLastRequest < MIN_REQUEST_INTERVAL_MS) {
    console.log("Too soon since last request, using cache or deferring");
    const cached = getValidCachedDisplayState();
    if (cached) {
      return; // Serve from cache silently
    }
    // Defer the request
    if (!pendingDisplayStateReload) {
      debouncedLoadDisplayState();
    }
    return;
  }

  // Try to use cached response if available
  const cachedResult = getValidCachedDisplayState();
  if (cachedResult) {
    console.log("Serving from cache");
    await renderDisplayState(cachedResult);
    return;
  }

  displayStateInFlight = true;
  try {
    const endpoint = `${DISPLAY_ENDPOINT}?t=${Date.now()}`;
    const res = await fetch(endpoint, {
      cache: "no-store",
      headers: {
        "Cache-Control": "no-cache",
        Pragma: "no-cache",
      },
    });
    
    const result = await res.json();
    
    // Cache the successful response
    cachedDisplayState = result;
    lastDisplayStateTimestamp = Date.now();
    
    await renderDisplayState(result);
  } catch (error) {
    console.error("Error loading display state:", error);
    renderDisplayState({
      success: false,
      mode: "error",
    });
  } finally {
    displayStateInFlight = false;
  }
}

async function renderDisplayState(result) {
  try {
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
    console.error("Error rendering display state:", error);
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

// ============== FULLSCREEN FUNCTIONALITY ==============
const fullscreenBtn = document.getElementById("fullscreenBtn");
let fullscreenControlsHideTimer = null;

function requestFullscreen() {
  if (!document.fullscreenElement) {
    const elem = document.documentElement;
    if (elem.requestFullscreen) {
      elem.requestFullscreen();
    }
  }
}

function exitFullscreen() {
  if (document.fullscreenElement) {
    document.exitFullscreen();
  }
}

function toggleFullscreen() {
  if (document.fullscreenElement) {
    exitFullscreen();
  } else {
    requestFullscreen();
  }
}

function hideFullscreenControls() {
  screen.classList.remove("show-controls");
}

function showFullscreenControls() {
  if (document.fullscreenElement) {
    screen.classList.add("show-controls");
    
    // Clear existing timer
    if (fullscreenControlsHideTimer) {
      clearTimeout(fullscreenControlsHideTimer);
    }
    
    // Hide controls after 3 seconds of inactivity
    fullscreenControlsHideTimer = setTimeout(() => {
      hideFullscreenControls();
    }, 3000);
  }
}

fullscreenBtn.addEventListener("click", toggleFullscreen);

document.addEventListener("fullscreenchange", () => {
  if (document.fullscreenElement) {
    screen.classList.add("fullscreen-active");
    showFullscreenControls();
  } else {
    screen.classList.remove("fullscreen-active", "show-controls");
    if (fullscreenControlsHideTimer) {
      clearTimeout(fullscreenControlsHideTimer);
    }
  }
});

// Show controls on any interaction when in fullscreen
document.addEventListener("pointerdown", () => {
  ensureAudioContext();
  if (document.fullscreenElement) {
    showFullscreenControls();
  }
}, { passive: true });

document.addEventListener("mousemove", () => {
  if (document.fullscreenElement) {
    showFullscreenControls();
  }
}, { passive: true });

document.addEventListener("keydown", () => {
  if (document.fullscreenElement) {
    showFullscreenControls();
  }
}, { passive: true });

startClock();
ensureCountdownTimer();
initializeRealTimeUpdates();
loadDisplayState();
