const admin = require("firebase-admin");

let initialized = false;

const getServiceAccount = () => {
  const rawJson = process.env.FIREBASE_SERVICE_ACCOUNT_JSON || "";
  if (rawJson.trim()) {
    return JSON.parse(rawJson);
  }

  const base64 = process.env.FIREBASE_SERVICE_ACCOUNT_BASE64 || "";
  if (base64.trim()) {
    const decoded = Buffer.from(base64, "base64").toString("utf8");
    return JSON.parse(decoded);
  }

  const path = process.env.FIREBASE_SERVICE_ACCOUNT_PATH || "";
  if (path.trim()) {
    // eslint-disable-next-line global-require, import/no-dynamic-require
    return require(path);
  }

  return null;
};

const ensureInitialized = () => {
  if (initialized) return true;

  const serviceAccount = getServiceAccount();
  if (!serviceAccount) {
    return false;
  }

  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
  initialized = true;
  return true;
};

const sendReminderPush = async ({ tokens, title, body, data = {} }) => {
  if (!tokens || tokens.length === 0) {
    return { successCount: 0, failureCount: 0, invalidTokens: [] };
  }

  if (!ensureInitialized()) {
    return { successCount: 0, failureCount: 0, invalidTokens: [] };
  }

  const message = {
    tokens,
    notification: {
      title,
      body,
    },
    data: Object.fromEntries(
      Object.entries(data).map(([key, value]) => [key, String(value)])
    ),
  };

  const response = await admin.messaging().sendEachForMulticast(message);
  const invalidTokens = [];

  response.responses.forEach((resp, index) => {
    if (resp.success) return;

    const code = resp.error?.code || "";
    if (
      code === "messaging/registration-token-not-registered" ||
      code === "messaging/invalid-registration-token"
    ) {
      invalidTokens.push(tokens[index]);
    }
  });

  return {
    successCount: response.successCount,
    failureCount: response.failureCount,
    invalidTokens,
  };
};

module.exports = {
  sendReminderPush,
};
