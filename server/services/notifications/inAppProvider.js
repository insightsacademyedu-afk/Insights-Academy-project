// In-app notifications don't "send" anywhere — the NotificationRecipient
// row itself IS the delivery. This exists purely so the dispatcher in
// index.js can treat every channel uniformly.
export async function send(_destination, _payload) {
  return { success: true };
}
