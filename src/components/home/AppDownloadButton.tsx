import Image from "next/image";
import type { StaticImageData } from "next/image";
import Link from "next/link";

interface AppDownloadButtonProps {
  href: string;
  imageSrc: StaticImageData;
  altText: string;
}

export default function AppDownloadButton({
  href,
  imageSrc,
  altText,
}: AppDownloadButtonProps) {
  return (
    <Link href={href}>
      <Image
        src={imageSrc}
        alt={altText}
        className="max-w-72 h-auto w-full"
      />
    </Link>
  );
}
