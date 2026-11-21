import test from "node:test";
import assert from "node:assert/strict";

import { isTrustedWebPushEndpoint } from "../../src/lib/notificacoes/webPushEndpointPolicy";

test("recognized browser services remain available", () => {
  for (const endpoint of [
    "https://fcm.googleapis.com/fcm/send/token",
    "https://android.googleapis.com/gcm/send/token",
    "https://updates.push.services.mozilla.com/wpush/v2/token",
    "https://web.push.apple.com/qL0/abc",
    "https://sub.web.push.apple.com/abc",
    "https://wns2-foo.notify.windows.com/w/?token=abc",
  ]) {
    assert.equal(isTrustedWebPushEndpoint(endpoint), true, endpoint);
  }
});

test("Web Push cannot be abused as arbitrary server-side HTTP client", () => {
  for (const endpoint of [
    "http://fcm.googleapis.com/fcm/send/token",
    "https://127.0.0.1/private",
    "https://192.168.1.1/private",
    "https://localhost/private",
    "https://metadata.google.internal/private",
    "https://fcm.googleapis.com.evil.org/fcm/send/token",
    "https://fcm.googleapis.com:8443/fcm/send/token",
    "https://user:secret@fcm.googleapis.com/private",
    "https://fcm.googleapis.com/token#fragment",
    "https://[::1]/private",
    "not a URL",
    "",
  ]) {
    assert.equal(isTrustedWebPushEndpoint(endpoint), false, endpoint);
  }
  assert.equal(isTrustedWebPushEndpoint(null), false);
  assert.equal(isTrustedWebPushEndpoint("x".repeat(2100)), false);
});
