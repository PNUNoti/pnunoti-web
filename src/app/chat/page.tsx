import type { Metadata, Viewport } from "next";
import { NoticeChat } from "@/components/chat/notice-chat";
import "./chat.css";

export const metadata: Metadata = {
  title: "공지 AI 채팅 | PNU Noti",
  description: "부산대학교 공지사항을 질문하고, 근거와 함께 답변을 확인하세요.",
  robots: { index: false, follow: false },
};

// 모바일 브라우저 상단 바 색을 화면 바탕과 맞춘다.
export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#18171b" },
  ],
};

export default function ChatPage() {
  return <NoticeChat />;
}
