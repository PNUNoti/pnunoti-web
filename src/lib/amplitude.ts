type EventProperties = Record<string, string>;

export type ReplayAnalytics = {
  getUserId(): string | undefined;
  setUserId(userId: string | undefined): void;
  reset(): void;
  getSessionId(): number | undefined;
  setSessionId(sessionId: number): void;
  track(name: string, properties: EventProperties): void;
};

// Keep identity updates while the SDK loads; analytics must never hold up chat.
export function createReplayAnalytics(load: () => Promise<ReplayAnalytics>, now = Date.now) {
  let loading: Promise<ReplayAnalytics | null> | undefined;
  let client: ReplayAnalytics | undefined;
  let userId: string | undefined;
  let lastPage: string | undefined;

  function applyIdentity() {
    if (!client || client.getUserId() === userId) return;
    if (client.getUserId()) {
      client.reset();
      // reset() changes the device ID but doesn't start a new replay session.
      client.setSessionId(Math.max(now(), (client.getSessionId() ?? 0) + 1));
    }
    client.setUserId(userId);
    client.track("web_identity_changed", { identity: userId ? "app_user" : "anonymous" });
  }

  return {
    setAppUser(nextUserId: string | null) {
      userId = nextUserId ?? undefined;
      try { applyIdentity(); } catch {}
    },
    async pageView(path: string, entryPoint: "app" | "web") {
      try {
        loading ??= load().then((sdk) => {
          client = sdk;
          // Remove any persisted account before sending the first event.
          applyIdentity();
          return sdk;
        }).catch(() => null);
        const sdk = await loading;
        if (!sdk || lastPage === path) return;
        lastPage = path;
        sdk.track("web_page_viewed", { path, entry_point: entryPoint });
      } catch {}
    },
  };
}

export function replaySampleRate(value: string | undefined) {
  const rate = value?.trim() ? Number(value) : 1;
  return Number.isFinite(rate) && rate >= 0 && rate <= 1 ? rate : 1;
}

async function loadAmplitude(): Promise<ReplayAnalytics> {
  const apiKey = process.env.NEXT_PUBLIC_AMPLITUDE_API_KEY;
  if (!apiKey) throw new Error("Amplitude is not configured");
  const [amplitude, { sessionReplayPlugin }] = await Promise.all([
    import("@amplitude/analytics-browser"),
    import("@amplitude/plugin-session-replay-browser"),
  ]);
  const replay = sessionReplayPlugin({
    sampleRate: replaySampleRate(process.env.NEXT_PUBLIC_AMPLITUDE_REPLAY_SAMPLE_RATE),
    privacyConfig: {
      defaultMaskLevel: "medium",
    },
  });
  // Keep replay identifiers aligned when reset() rotates the analytics device.
  replay.onSessionIdChanged = (sessionId) => replay.sessionReplay.setSessionId(sessionId, amplitude.getDeviceId()).promise;
  amplitude.add(replay);
  await amplitude.init(apiKey, {
    // Explicit events below avoid capturing form contents, clicks or API data.
    autocapture: false,
  }).promise;
  return {
    getUserId: amplitude.getUserId,
    setUserId: amplitude.setUserId,
    reset: amplitude.reset,
    getSessionId: amplitude.getSessionId,
    setSessionId: amplitude.setSessionId,
    track(name, properties) {
      void amplitude.track(name, properties).promise.catch(() => {});
    },
  };
}

export const replayAnalytics = createReplayAnalytics(loadAmplitude);
