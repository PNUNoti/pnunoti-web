import { PLAY_STORE_AVAILABLE } from "../constants/urls";

export type AppStore = "app-store" | "google-play";
export const ANDROID_DOWNLOAD_PATH = "/?download=android";

export function isMobileDownloadDevice(userAgent: string, maxTouchPoints = 0) {
  return /Android|iPhone|iPad|iPod|Mobile/i.test(userAgent) ||
    (/Macintosh/i.test(userAgent) && maxTouchPoints > 1);
}

export function downloadQrUrl(store: AppStore, href: string, origin: string) {
  return store === "google-play" && !PLAY_STORE_AVAILABLE
    ? new URL(ANDROID_DOWNLOAD_PATH, origin).href
    : href;
}
