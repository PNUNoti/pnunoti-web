import { StaticImport } from "next/dist/shared/lib/get-img-props";
import Image from "next/image";
import Link from "next/link";

interface AppDownloadButtonProps {
  href: string;
  imageSrc: string | StaticImport;
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
        className="max-w-72 h-full w-full"
        width={1000}
        height={1000}
      />
    </Link>
  );
}
