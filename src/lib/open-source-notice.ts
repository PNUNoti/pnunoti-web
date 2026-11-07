import { isWebView, requestDeeplink } from "../app/utils/webview";
import { safePostId, safeSourceUrl } from "./chat-types";
import type { SourceNotice } from "./chat-citations";

export function sourcePostPath(notice: SourceNotice): string | null {
  const postId = safePostId(notice.postId);
  const url = safeSourceUrl(notice.url);
  if (!postId || !url) return null;
  return `/post?${new URLSearchParams({ postId, url, title: notice.title || "공지" })}`;
}

// null lets the anchor keep its normal browser behavior, including new tabs.
export function tryOpenSourceNotice(notice: SourceNotice): Promise<boolean> | null {
  if (!isWebView()) return null;
  const path = sourcePostPath(notice);
  if (path) return requestDeeplink(path);
  const url = safeSourceUrl(notice.url);
  if (!url) return null;
  // The app intercepts top-level URL navigation to open the browser. Unlike
  // target=_blank, this does not depend on a popup or the external-link message.
  try {
    window.location.assign(url);
    return Promise.resolve(true);
  } catch { return null; }
}
