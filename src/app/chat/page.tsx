import type { Metadata } from "next";
import { NoticeChat } from "@/components/chat/notice-chat";
// Pretendard는 글자 묶음별로 필요한 파일만 받는 dynamic subset을 쓴다.
import "pretendard/dist/web/variable/pretendardvariable-dynamic-subset.css";
import "./chat.css";

export const metadata: Metadata = {
  title: "공지 AI 채팅 | PNU Noti",
  description: "부산대학교 공지사항을 질문하고, 근거와 함께 답변을 확인하세요.",
  robots: { index: false, follow: false },
};

export default function ChatPage() {
  return <NoticeChat />;
}
