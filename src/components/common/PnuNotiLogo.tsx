import { getImageProps } from "next/image";
import { PNU_NOTI_LOGO, PNU_NOTI_LOGO_DARK } from "@/constants/images";

// 시스템 설정과 사용자가 고른 테마 모두 같은 로고 전환 규칙을 따른다.
export default function PnuNotiLogo({ alt = "", className }: { alt?: string; className?: string }) {
  const common = { alt, priority: true, className };
  const { props: dark } = getImageProps({ ...common, src: PNU_NOTI_LOGO_DARK });
  const { props: light } = getImageProps({ ...common, src: PNU_NOTI_LOGO });
  return (
    <span className="contents">
      <img {...light} className={`block dark:hidden ${className ?? ""}`} />
      <img {...dark} className={`hidden dark:block ${className ?? ""}`} />
    </span>
  );
}
