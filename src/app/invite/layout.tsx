import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "부산대 공지사항 알리미 PNU Noti에 초대합니다.",
  description: "부산대 공지사항 알리미 | PNU Noti",
};

export default function InviteLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return <>{children}</>;
}
