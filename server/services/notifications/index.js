import * as inAppProvider from "./inAppProvider.js";
import * as emailProvider from "./emailProvider.js";
import * as smsProvider from "./smsProvider.js";
import * as whatsappProvider from "./whatsappProvider.js";

const PROVIDERS = {
  in_app: inAppProvider,
  email: emailProvider,
  sms: smsProvider,
  whatsapp: whatsappProvider,
};

// Attempts delivery on one channel to one destination. Returns the same
// shape regardless of which provider handled it, so the worker (below)
// never needs a per-channel branch.
export async function dispatch(channel, destination, payload) {
  const provider = PROVIDERS[channel];
  if (!provider) {
    return { success: false, error: `Unknown channel: ${channel}` };
  }
  return provider.send(destination, payload);
}
