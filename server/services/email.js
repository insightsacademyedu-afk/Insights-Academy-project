import nodemailer from "nodemailer";
import { config } from "../config/env.js";

let transporter;

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
  const sender = config.smtp.from || config.smtp.user;
  await getTransporter().sendMail({
    from: sender,
    to: recipient,
    subject: "Academy Management password reset code",
    text: `Your password reset code is ${code}. It expires in 10 minutes. If you did not request this, ignore this email.`,
  });
}
