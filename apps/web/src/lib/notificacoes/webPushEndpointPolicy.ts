/**
 * Browser PushSubscription endpoints are untrusted input. Never let service
 * role server-side Web Push POST to arbitrary URLs, including DNS-rebinding
 * hosts or private networks. Expand this allowlist only for verified vendors.
 */
const TRUSTED_HOSTS = new Set([
  "fcm.googleapis.com",               // Chrome / Chromium
  "android.googleapis.com",           // older Chromium push endpoints
  "updates.push.services.mozilla.com",// Firefox
  "updates-push.services.mozilla.com",// legacy Firefox
  "web.push.apple.com",               // Safari
]);

const TRUSTED_SUFFIXES = [
  ".push.services.mozilla.com",
  ".push.apple.com",
  ".notify.windows.com",             // Windows Push Notification Services
];

export function isTrustedWebPushEndpoint(value: unknown): value is string {
  if (typeof value !== "string" || value.length === 0 || value.length > 2048) return false;

  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return false;
  }

  if (url.protocol !== "https:" || url.port !== "" ||
      url.username || url.password || url.hash) return false;

  const host = url.hostname.toLowerCase().replace(/\.$/, "");
  return TRUSTED_HOSTS.has(host) || TRUSTED_SUFFIXES.some((suffix) => host.endsWith(suffix));
}
