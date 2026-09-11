import nodemailer from "nodemailer";
import { config } from "../../config/env.js";

let transporter = null;

function getTransporter() {
  if (transporter) return transporter;

  if (!config.smtp.host || !config.smtp.user || !config.smtp.pass) {
    return null; // not configured - send() below will report a clean failure
  }

  transporter = nodemailer.createTransport({
    host: config.smtp.host,
    port: config.smtp.port,
    secure: config.smtp.port === 465,
    connectionTimeout: 15000, greetingTimeout: 15000, socketTimeout: 30000,
    auth: { user: config.smtp.user, pass: config.smtp.pass },
  });
  return transporter;
}

// Provider interface every channel implements: send(destination, {title, body})
// -> { success, providerMessageId?, error? }. Swapping SMTP providers (Brevo,
// SES, etc.) later only means changing config/env.js, never this file's callers.
export async function send(destination, { title, body }) {
  const t = getTransporter();
  if (!t) {
    return { success: false, error: "Email provider not configured (missing SMTP env vars)" };
  }

  try {
    const info = await t.sendMail({
      from: config.smtp.fromAddress,
      to: destination,
      subject: title,
      text: body,
    });
    return { success: true, providerMessageId: info.messageId };
  } catch (err) {
    return { success: false, error: err.message };
  }
}
