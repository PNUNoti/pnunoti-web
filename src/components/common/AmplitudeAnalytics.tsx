"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { replayAnalytics } from "@/lib/amplitude";
import { isWebView } from "@/app/utils/webview";

export function AmplitudeAnalytics() {
  const pathname = usePathname();

  useEffect(() => {
    void replayAnalytics.pageView(pathname, isWebView() ? "app" : "web");
  }, [pathname]);

  return null;
}
