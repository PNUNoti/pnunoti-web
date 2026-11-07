import assert from "node:assert/strict";
import { test } from "node:test";
import { downloadQrUrl, isMobileDownloadDevice } from "../src/lib/app-download";
import { APP_STORE_URL, PLAY_STORE_URL } from "../src/constants/urls";

test("phones and tablets keep the direct download flow", () => {
  for (const agent of [
    "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) Mobile/15E148",
    "Mozilla/5.0 (Linux; Android 15; Pixel 9) Chrome/130.0 Mobile Safari/537.36",
    "Mozilla/5.0 (Linux; Android 14; Tablet) Chrome/130.0 Safari/537.36",
    "Mozilla/5.0 (iPad; CPU OS 18_0 like Mac OS X) Mobile/15E148",
  ]) assert.equal(isMobileDownloadDevice(agent), true);
});

test("iPad desktop mode remains mobile without treating touchscreen PCs as phones", () => {
  const mac = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15) Safari/605.1.15";
  assert.equal(isMobileDownloadDevice(mac, 5), true);
  assert.equal(isMobileDownloadDevice(mac, 0), false);
  assert.equal(isMobileDownloadDevice("Mozilla/5.0 (Windows NT 10.0; Win64; x64)", 10), false);
  assert.equal(isMobileDownloadDevice("Mozilla/5.0 (X11; Linux x86_64)"), false);
});

test("App Store QR uses the existing store destination", () => {
  assert.equal(downloadQrUrl("app-store", APP_STORE_URL, "https://pnunoti.vercel.app"), APP_STORE_URL);
});

test("Google Play QR reaches the APK guide instead of the unavailable listing", () => {
  const url = new URL(downloadQrUrl("google-play", PLAY_STORE_URL, "https://pnunoti.vercel.app"));
  assert.equal(url.origin, "https://pnunoti.vercel.app");
  assert.equal(url.pathname, "/");
  assert.equal(url.searchParams.get("download"), "android");
});

test("preview and local QR destinations stay on the environment being tested", () => {
  assert.equal(downloadQrUrl("google-play", PLAY_STORE_URL, "http://localhost:3001"), "http://localhost:3001/?download=android");
});
