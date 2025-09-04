import type { Metadata } from "next";
import { Noto_Sans_KR } from "next/font/google";
import "./globals.css";

const notoSans = Noto_Sans_KR({
  variable: "--font-noto-sans",
  subsets: ["latin"],
});
export const metadata: Metadata = {
  title: "PNU Noti | 부산대 공지사항 알리미",
  description:
    "PNU Noti와 함께 공지사항을 한눈에 확인해보세요!\n중요한 공지사항을 놓칠 걱정은 이제 그만!\n앱 하나로 모든 공지사항을 모아 확인할 수 있어요!",
  openGraph: {
    images: "/images/og_meta_image.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko">
      <body className={`${notoSans.variable}`}>{children}</body>
    </html>
  );
}
