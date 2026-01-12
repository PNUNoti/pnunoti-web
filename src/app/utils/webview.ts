export function deeplinkTo(path: string) {
  if (window.ReactNativeWebView) {
    window.ReactNativeWebView.postMessage(
      JSON.stringify({
        action: {
          type: "DEEP_LINK",
          payload: path,
        },
      })
    );
  }
}

export function isWebView() {
  return typeof window !== "undefined" && !!window.ReactNativeWebView;
}
