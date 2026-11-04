import { getImageProps } from "next/image";
import { PNU_NOTI_LOGO, PNU_NOTI_LOGO_DARK } from "@/constants/images";

// 다크 모드에서는 글자를 흰색으로 바꾼 로고를 쓴다. 브라우저는 둘 중 하나만 내려받는다.
export default function PnuNotiLogo({ alt = "", className }: { alt?: string; className?: string }) {
  const common = { alt, priority: true, className };
  const { props: { srcSet: dark } } = getImageProps({ ...common, src: PNU_NOTI_LOGO_DARK });
  const { props: { srcSet: light, ...rest } } = getImageProps({ ...common, src: PNU_NOTI_LOGO });
  return (
    <picture className="contents">
      <source media="(prefers-color-scheme: dark)" srcSet={dark} />
      <img {...rest} srcSet={light} />
    </picture>
  );
}
