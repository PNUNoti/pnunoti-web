export interface RecommendationAnalytics {
  event: "recommended_board_clicked";
  properties: {
    board_id: string;
    board_name: string;
    target_type: "board" | "subscription";
  };
}

export function deeplinkTo(path: string, analytics?: RecommendationAnalytics) {
  if (window.ReactNativeWebView) {
    window.ReactNativeWebView.postMessage(
      JSON.stringify({
        analytics,
        action: {
          type: "DEEP_LINK",
          payload: path,
        },
      }),
    );
  }
}

export function isWebView() {
  return typeof window !== "undefined" && !!window.ReactNativeWebView;
}
