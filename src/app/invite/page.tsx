"use client";

import AndroidDownloadNotice from "@/components/download/AndroidDownloadNotice";
import {
  APP_STORE_URL,
  PLAY_STORE_AVAILABLE,
  PLAY_STORE_URL,
} from "@/constants/urls";
import { track } from "@vercel/analytics";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

type InviteState = "detecting" | "android-unavailable";

const InvitePage = () => {
  const router = useRouter();
  const [state, setState] = useState<InviteState>("detecting");
  const hasTrackedAndroidInterest = useRef(false);

  useEffect(() => {
    const userAgent = navigator.userAgent;
    const LANDING_PAGE_URL = "/";

    if (/android/i.test(userAgent)) {
      if (PLAY_STORE_AVAILABLE) {
        window.location.replace(PLAY_STORE_URL);
        return;
      }

      setState("android-unavailable");

      if (!hasTrackedAndroidInterest.current) {
        track("android_invite_interest");
        hasTrackedAndroidInterest.current = true;
      }
    } else if (/iPad|iPhone|iPod/.test(userAgent)) {
      window.location.replace(APP_STORE_URL);
    } else {
      router.replace(LANDING_PAGE_URL);
    }
  }, [router]);

  if (state === "android-unavailable") {
    return (
      <main className="flex min-h-dvh items-center justify-center bg-gradient-to-b from-blue-100 to-blue-300 px-4 py-10">
        <div className="w-full max-w-md rounded-3xl bg-white px-6 py-10 shadow-xl sm:px-8">
          <AndroidDownloadNotice source="invite" showHomeLink />
        </div>
      </main>
    );
  }

  return (
    <main className="flex min-h-dvh items-center justify-center bg-gradient-to-b from-blue-100 to-blue-300 px-4">
      <div className="flex items-center gap-3 rounded-2xl bg-white px-5 py-4 text-sm font-medium text-gray-700 shadow-lg">
        <span
          aria-hidden="true"
          className="size-5 animate-spin rounded-full border-2 border-blue-200 border-t-blue-600"
        />
        앱 스토어로 이동하고 있어요...
      </div>
    </main>
  );
};

export default InvitePage;
