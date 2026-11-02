import { track } from "@vercel/analytics";

// Analytics must never prevent navigation or downloads.
export function trackAnalytics(
  name: string,
  properties?: Record<string, string | number | boolean | null>,
) {
  try {
    track(name, { ...properties, analytics_schema_version: 2 });
  } catch {}
}
