"use client";
import { useEffect, useRef, useState } from "react";

interface SlideUpProps {
  children: React.ReactNode;
  threshold?: number; // 언제 애니메이션을 실행할지 결정 (기본값: 0.1)
  className?: string; // 추가할 클래스들
}

export default function SlideUp({
  children,
  threshold = 0.1,
  className = "",
}: SlideUpProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;

    const observer = new IntersectionObserver(
      (entries, observer) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setIsVisible(true);
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold }
    );

    observer.observe(element);

    return () => observer.disconnect();
  }, [threshold]);

  return (
    <div
      ref={ref}
      className={`${className} ${isVisible ? "animate-slide-up" : "opacity-0"}`}
    >
      {children}
    </div>
  );
}
