"use client";
import { useEffect, useRef, useState } from "react";

interface SlideUpProps {
  children: React.ReactNode;
  threshold?: number; // 언제 애니메이션을 실행할지 결정 (기본값: 0.1)
  delay?: number; // 애니메이션 시작 지연 시간 (ms, 기본값: 0)
  className?: string; // 추가할 클래스들
}

export default function SlideUp({
  children,
  threshold = 0.1,
  delay = 0,
  className = "",
}: SlideUpProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [shouldAnimate, setShouldAnimate] = useState(false);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;

    const observer = new IntersectionObserver(
      (entries, observer) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            // delay 후에 애니메이션 시작
            setTimeout(() => {
              setShouldAnimate(true);
            }, delay);
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold }
    );

    observer.observe(element);

    return () => observer.disconnect();
  }, [threshold, delay]);

  return (
    <div
      ref={ref}
      className={`${className} ${shouldAnimate ? "animate-slide-up" : "opacity-0"}`}
    >
      {children}
    </div>
  );
}
