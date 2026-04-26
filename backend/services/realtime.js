const { EventEmitter } = require("events");

let Pusher = null;
try {
  Pusher = require("pusher");
} catch (_error) {
  Pusher = null;
}

const getRealtimeConfig = () => {
  const key = process.env.PUSHER_KEY || "";
  const cluster = process.env.PUSHER_CLUSTER || "";
  const channel = process.env.PUSHER_CHANNEL || "smart-task-manager";
  const event = process.env.PUSHER_EVENT || "dataUpdated";
  const appId = process.env.PUSHER_APP_ID || "";
  const secret = process.env.PUSHER_SECRET || "";

  const enabled = Boolean(Pusher && key && cluster && appId && secret);

  return {
    enabled,
    key,
    cluster,
    channel,
    event,
    appId,
    secret,
  };
};

const initializeRealtime = (app) => {
  const updateEmitter = new EventEmitter();
  app.locals.updateEmitter = updateEmitter;
  app.locals.io = null;

  const config = getRealtimeConfig();
  app.locals.realtime = {
    provider: config.enabled ? "pusher" : "none",
    enabled: config.enabled,
    key: config.key,
    cluster: config.cluster,
    channel: config.channel,
    event: config.event,
  };

  if (config.enabled) {
    app.locals.pusher = new Pusher({
      appId: config.appId,
      key: config.key,
      secret: config.secret,
      cluster: config.cluster,
      useTLS: true,
    });
  } else {
    app.locals.pusher = null;
  }
};

const broadcastUpdate = async (req, data) => {
  try {
    const io = req.app?.locals?.io;
    const updateEmitter = req.app?.locals?.updateEmitter;
    const pusher = req.app?.locals?.pusher;
    const realtime = req.app?.locals?.realtime;

    if (io) {
      io.emit("dataUpdated", data);
    }

    if (updateEmitter) {
      updateEmitter.emit("dataUpdated", data);
    }

    if (pusher && realtime?.enabled) {
      await pusher.trigger(realtime.channel, realtime.event, data);
    }
  } catch (error) {
    console.error("Error broadcasting real-time update:", error.message);
  }
};

module.exports = {
  initializeRealtime,
  broadcastUpdate,
};
