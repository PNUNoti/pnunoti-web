import Image from "next/image";
import SlideUp from "../common/animation/SlideUp";
import { StaticImport } from "next/dist/shared/lib/get-img-props";

interface FeatureSectionProps {
  title: string;
  headline: string;
  description: string;
  image: string | StaticImport;
  reverse?: boolean; // 이미지와 텍스트의 순서를 반전시키고 싶을 때
}

export default function FeatureSection({
  title,
  headline,
  description,
  image,
  reverse = false,
}: FeatureSectionProps) {
  return (
    <div
      className={`mx-8 flex flex-col gap-10 ${
        reverse ? "sm:flex-row-reverse" : "sm:flex-row"
      }`}
    >
      <div
        className={`flex-1 flex flex-col gap-4 justify-center ${
          reverse ? "sm:items-end sm:text-end" : ""
        }`}
      >
        <SlideUp className="sm:text-xl font-bold text-blue-600">
          {title}
        </SlideUp>
        <SlideUp className="font-bold sm:text-4xl text-2xl text-white whitespace-pre-line">
          {headline}
        </SlideUp>
        <SlideUp className="sm:text-lg text-sm text-gray-400 whitespace-pre-line">
          {description}
        </SlideUp>
      </div>
      <SlideUp className="flex-1">
        <Image
          src={image}
          alt={title}
          className="w-full"
          width={1000}
          height={1000}
        />
      </SlideUp>
    </div>
  );
}
