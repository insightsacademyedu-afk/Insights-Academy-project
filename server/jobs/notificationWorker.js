import Notification from "../models/Notification.js";
import NotificationRecipient from "../models/NotificationRecipient.js";
import { dispatch } from "../services/notifications/index.js";

async function deliver(id, notification, expectedStatus, maxAttempts = 3) {
  // Claim each row once even when workers or retry requests overlap.
  const recipient = await NotificationRecipient.findOneAndUpdate(
    { _id: id, status: expectedStatus, attempts: { $lt: maxAttempts } },
    { $set: { status: "processing" }, $inc: { attempts: 1 } }, { new: true }
  );
  if (!recipient) return false;
  try {
    const result = await dispatch(recipient.channel, recipient.destination, { title: notification.title, body: notification.body });
    recipient.status = result.success ? "sent" : "failed";
    recipient.lastError = result.success ? "" : result.error || "Unknown error";
    if (result.success) recipient.sentAt = new Date();
  } catch (error) { recipient.status = "failed"; recipient.lastError = error.message; }
  await recipient.save();
  return true;
}
export async function processNotification(notificationId) {
  const notification = await Notification.findById(notificationId);
  if (!notification) return;
  notification.status = "processing";
  await notification.save();
  const pending = await NotificationRecipient.find({ notification: notificationId, status: "pending" });
  for (const recipient of pending) await deliver(recipient._id, notification, "pending");
  if (!await NotificationRecipient.exists({ notification: notificationId, status: { $in: ["pending", "processing"] } })) {
    notification.status = "completed"; await notification.save();
  }
}
export async function retryFailedRecipients(maxAttempts = 3) {
  const failed = await NotificationRecipient.find({ status: "failed", attempts: { $lt: maxAttempts } }).populate("notification");
  let retriedCount = 0;
  for (const recipient of failed) {
    if (recipient.notification && await deliver(recipient._id, recipient.notification, "failed", maxAttempts)) retriedCount += 1;
  }
  // A crash after an external send is ambiguous. Processing rows require operator
  // review; automatically resending them could duplicate a delivered message.
  return { retriedCount };
}
