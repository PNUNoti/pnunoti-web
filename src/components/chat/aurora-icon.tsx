import Image from "next/image";

type Props = {
  className?: string;
};

export function AuroraIcon({ className }: Props) {
  return (
    <Image
      src="/images/ai-aurora.png"
      alt=""
      aria-hidden="true"
      width={256}
      height={256}
      unoptimized
      draggable={false}
      className={`pointer-events-none shrink-0 ${className ?? ""}`}
    />
  );
}
