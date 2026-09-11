// Stub. The official WhatsApp Business API isn't free at any real volume,
// so this ships disabled by default (per the free-tier build plan) — swap
// this file's body for a real Meta Cloud API / Twilio WhatsApp integration
// later without touching any code that calls NotificationService.
export async function send(_destination, _payload) {
  return { success: false, error: "WhatsApp provider not yet configured" };
}
