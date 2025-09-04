"use client";

import { Metadata } from "next";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

export const metadata: Metadata = {
  title: "부산대 공지사항 알리미 PNU Noti에 초대합니다.",
  description: "부산대 공지사항 알리미 | PNU Noti",
  openGraph: {
    images: "/images/og_meta_image.png",
  },
};

const InvitePage = () => {
  const router = useRouter();
  useEffect(() => {
    const userAgent = navigator.userAgent;

    const playStoreUrl =
      "https://play.google.com/store/apps/details?id=com.pnunoti.PNUNoti";
    const appStoreUrl = "https://apple.co/464YSlG";
    // const landingPageUrl = "/"; // 랜딩 페이지 구현 후 변경
    const landingPageUrl = appStoreUrl; // 당분간 앱스토어로 리디렉션

    if (/android/i.test(userAgent)) {
      window.location.href = playStoreUrl;
    } else if (/iPad|iPhone|iPod/.test(userAgent)) {
      window.location.href = appStoreUrl;
    } else {
      router.replace(landingPageUrl);
    }
  }, [router]);

  return (
    <div>
      <p>잠시만 기다려 주세요. 앱 스토어로 리디렉션 중입니다...</p>
    </div>
  );
};

export default InvitePage;
