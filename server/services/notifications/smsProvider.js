// Stub, same reasoning as whatsappProvider.js — nearly every SMS gateway
// charges per message, so this stays disabled until the academy budgets
// for one (Twilio, a local Pakistani gateway, etc.).
export async function send(_destination, _payload) {
  return { success: false, error: "SMS provider not yet configured" };
}
