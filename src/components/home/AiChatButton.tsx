import Link from "next/link";
import { AuroraIcon } from "../chat/aurora-icon";

export default function AiChatButton() {
  return (
    <Link
      href="/chat"
      className="home-action home-ai-button relative gap-2 px-5 text-white transition active:scale-[0.98] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-tds-blue"
    >
      <span aria-hidden="true" className="home-ai-glow" />
      <span aria-hidden="true" className="home-ai-aurora" />
      <AuroraIcon className="size-6" />
      <span className="home-ai-label">PNU Noti AI</span>
      {/* 폰에서도 보이도록 말풍선을 버튼 아래에 항상 표시한다. */}
      <span className="pointer-events-none absolute top-full left-1/2 z-10 mt-2.5 -translate-x-1/2 animate-tooltip rounded-lg bg-tds-grey-900 px-3 py-2 text-[13px] leading-none font-medium whitespace-nowrap text-background shadow-[0_4px_16px_rgba(25,31,40,0.16)]">
        <span aria-hidden="true" className="absolute -top-1 left-1/2 size-2.5 -translate-x-1/2 rotate-45 rounded-[2px] bg-tds-grey-900" />
        딱 맞는 공지를 AI가 찾아드려요
      </span>
    </Link>
  );
}
