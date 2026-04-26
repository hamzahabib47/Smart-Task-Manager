const nodemailer = require("nodemailer");

const smtpHost = process.env.SMTP_HOST || "";
const smtpPort = Number(process.env.SMTP_PORT || 587);
const smtpUser = process.env.SMTP_USER || "";
const smtpPass = process.env.SMTP_PASS || "";
const smtpSecure = (process.env.SMTP_SECURE || "false").toLowerCase() === "true";
const smtpService = process.env.SMTP_SERVICE || "";
const mailFrom = process.env.MAIL_FROM || smtpUser || "no-reply@smarttaskmanager.app";

let transporter = null;

const isEmailConfigured = () =>
  Boolean(smtpHost && smtpPort && smtpUser && smtpPass);

const getTransporter = () => {
  if (!isEmailConfigured()) {
    return null;
  }

  if (!transporter) {
    const transportOptions = {
      host: smtpHost,
      port: smtpPort,
      secure: smtpSecure,
      auth: {
        user: smtpUser,
        pass: smtpPass,
      },
      authMethod: "LOGIN",
      logger: false,
      debug: false,
      connectionTimeout: 10000,
      greetingTimeout: 10000,
      socketTimeout: 10000,
      tls: {
        rejectUnauthorized: false,
      },
    };

    if (smtpService) {
      transportOptions.service = smtpService;
    }

    if (!smtpSecure) {
      transportOptions.requireTLS = true;
    }

    transporter = nodemailer.createTransport(transportOptions);

    transporter.verify((error, success) => {
      if (error) {
        console.error("SMTP transporter verification failed:", error.message);
      } else {
        console.log("SMTP transporter verified successfully");
      }
    });
  }

  return transporter;
};

const sendMail = async ({ to, subject, text, html }) => {
  const tx = getTransporter();
  if (!tx) {
    throw new Error("Email service not configured. Set SMTP_* env variables.");
  }

  await tx.sendMail({
    from: mailFrom,
    to,
    subject,
    text,
    html,
  });
};

const sendVerificationCodeEmail = async ({ to, name, code }) => {
  const safeName = (name || "there").trim() || "there";
  const subject = "Verify your Smart Task Manager email";
  const text = `Hi ${safeName},\n\nYour verification code is: ${code}\n\nThis code expires in 10 minutes.\n\nIf you did not request this, ignore this email.`;
  const html = `
    <div style="font-family:Arial,sans-serif;max-width:520px;margin:0 auto;line-height:1.5;color:#111827;">
      <h2 style="margin-bottom:8px;">Email Verification</h2>
      <p>Hi ${safeName},</p>
      <p>Your Smart Task Manager verification code is:</p>
      <div style="font-size:32px;letter-spacing:4px;font-weight:700;margin:16px 0;color:#0f766e;">${code}</div>
      <p>This code expires in <strong>10 minutes</strong>.</p>
      <p style="color:#6b7280;">If you did not request this, please ignore this email.</p>
    </div>
  `;

  await sendMail({ to, subject, text, html });
};

const sendPasswordResetCodeEmail = async ({ to, name, code }) => {
  const safeName = (name || "there").trim() || "there";
  const subject = "Reset your Smart Task Manager password";
  const text = `Hi ${safeName},\n\nYour password reset code is: ${code}\n\nThis code expires in 15 minutes.\n\nIf you did not request this, ignore this email.`;
  const html = `
    <div style="font-family:Arial,sans-serif;max-width:520px;margin:0 auto;line-height:1.5;color:#111827;">
      <h2 style="margin-bottom:8px;">Password Reset</h2>
      <p>Hi ${safeName},</p>
      <p>Use this code to reset your Smart Task Manager password:</p>
      <div style="font-size:32px;letter-spacing:4px;font-weight:700;margin:16px 0;color:#b45309;">${code}</div>
      <p>This code expires in <strong>15 minutes</strong>.</p>
      <p style="color:#6b7280;">If you did not request this, please ignore this email.</p>
    </div>
  `;

  await sendMail({ to, subject, text, html });
};

module.exports = {
  isEmailConfigured,
  sendVerificationCodeEmail,
  sendPasswordResetCodeEmail,
};
