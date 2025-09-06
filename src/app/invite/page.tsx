"use client";

import { APP_STORE_URL, PLAY_STORE_URL } from "@/constants/urls";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

const InvitePage = () => {
  const router = useRouter();
  useEffect(() => {
    const userAgent = navigator.userAgent;
    const LANDING_PAGE_URL = "/";

    if (/android/i.test(userAgent)) {
      window.location.href = PLAY_STORE_URL;
    } else if (/iPad|iPhone|iPod/.test(userAgent)) {
      window.location.href = APP_STORE_URL;
    } else {
      router.replace(LANDING_PAGE_URL);
    }
  }, [router]);

  return (
    <div>
      <p>잠시만 기다려 주세요. 앱 스토어로 리디렉션 중입니다...</p>
    </div>
  );
};

export default InvitePage;
