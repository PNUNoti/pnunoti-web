declare global {
  interface Window {
    __PNUNOTI_CHAT_PUSH__?: 1;
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
