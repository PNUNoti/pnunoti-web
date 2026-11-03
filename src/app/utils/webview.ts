export interface RecommendationAnalytics {
  event: "recommended_board_clicked";
  properties: {
    board_id: string;
    board_name: string;
    target_type: "board" | "subscription";
  };
}

export function deeplinkTo(path: string, analytics?: RecommendationAnalytics) {
  if (isWebView()) {
    window.ReactNativeWebView!.postMessage(
      JSON.stringify({
        analytics,
        action: {
          type: "DEEP_LINK",
          payload: path,
        },
      }),
    );
    return true;
  }
  return false;
}

export function isWebView() {
  return typeof window !== "undefined" && typeof window.ReactNativeWebView?.postMessage === "function";
}

type AppResponse = Parameters<NonNullable<Window["onAppResponse"]>>[0];
const listeners = new Set<(response: AppResponse) => void>();
let previousResponse: Window["onAppResponse"];

function receiveAppResponse(response: AppResponse) {
  const previous = previousResponse;
  for (const listener of [...listeners]) listener(response);
  previous?.(response);
}

// The existing app acknowledges receipt, rather than completion of navigation.
// A missing/failed acknowledgement must leave the original notice reachable.
export function requestDeeplink(path: string, timeoutMs = 1500): Promise<boolean> {
  if (!isWebView()) return Promise.resolve(false);
  return new Promise((resolve) => {
    let settled = false;
    const finish = (success: boolean) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      listeners.delete(onResponse);
      if (!listeners.size) {
        if (window.onAppResponse === receiveAppResponse) window.onAppResponse = previousResponse;
        previousResponse = undefined;
      }
      resolve(success);
    };
    const onResponse = (response: AppResponse) => {
      if (response.action === "DEEP_LINK" || (!response.action && response.success === false)) finish(response.success === true);
    };
    if (!listeners.size) {
      previousResponse = window.onAppResponse;
      window.onAppResponse = receiveAppResponse;
    }
    listeners.add(onResponse);
    const timer = setTimeout(() => finish(false), timeoutMs);
    try {
      if (!deeplinkTo(path)) finish(false);
    } catch { finish(false); }
  });
}
