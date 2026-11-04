import Image from "next/image";
import type { StaticImageData } from "next/image";
import SlideUp from "../common/animation/SlideUp";

interface FeatureSectionProps {
  title: string;
  headline: string;
  description: string;
  image: StaticImageData;
}

// 히어로와 같은 규칙: 왼쪽 정렬 글자와 앱 화면. 넓은 화면에서도 글자-화면 순서를 바꾸지 않는다.
export default function FeatureSection({
  title,
  headline,
  description,
  image,
}: FeatureSectionProps) {
  return (
    <section className="grid items-center gap-8 sm:grid-cols-2 sm:gap-12">
      <SlideUp>
        <p className="text-[15px] font-semibold text-tds-blue">{title}</p>
        <h2 className="mt-3 text-[24px] leading-[1.4] font-semibold tracking-[-0.02em] text-balance whitespace-pre-line text-tds-grey-900 sm:text-[30px]">
          {headline}
        </h2>
        <p className="mt-4 text-[16px] leading-[1.7] whitespace-pre-line text-tds-grey-700">
          {description}
        </p>
      </SlideUp>
      <SlideUp>
        <Image src={image} alt={title} className="h-auto w-full" />
      </SlideUp>
    </section>
  );
}
