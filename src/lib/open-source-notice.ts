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
  const path = sourcePostPath(notice);
  return path && isWebView() ? requestDeeplink(path) : null;
}
