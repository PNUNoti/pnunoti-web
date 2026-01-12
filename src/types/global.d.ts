declare global {
  interface Window {
    ReactNativeWebView?: {
      postMessage: (message: string) => void;
    };
    onAppResponse?: (result: {
      success: boolean;
      action?: string;
      error?: string;
    }) => void;
  }
}

export {};
