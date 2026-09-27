import nodemailer from "nodemailer";
import { config } from "../config/env.js";

let transporter;

async function sendWithResend({ recipient, code }) {
  if (!config.resend.from) throw new Error("RESEND_FROM is not configured");

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.resend.apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: config.resend.from,
      to: [recipient],
      subject: "Academy Management password reset code",
      text: `Your password reset code is ${code}. It expires in 10 minutes. If you did not request this, ignore this email.`,
    }),
    signal: AbortSignal.timeout(15000),
  });

  if (!response.ok) {
    const details = (await response.text()).slice(0, 500);
    throw new Error(`Resend API rejected the email (${response.status}): ${details}`);
  }
}

function getTransporter() {
  if (!config.smtp.host || !config.smtp.user || !config.smtp.pass) {
    throw new Error("SMTP is not configured");
  }
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: config.smtp.host,
      port: config.smtp.port,
      secure: config.smtp.secure,
      auth: { user: config.smtp.user, pass: config.smtp.pass },
    });
  }
  return transporter;
}

export async function sendPasswordResetCode({ recipient, code }) {
  if (config.resend.apiKey) return sendWithResend({ recipient, code });

  const sender = config.smtp.from || config.smtp.user;
  await getTransporter().sendMail({
    from: sender,
    to: recipient,
    subject: "Academy Management password reset code",
    text: `Your password reset code is ${code}. It expires in 10 minutes. If you did not request this, ignore this email.`,
  });
}
