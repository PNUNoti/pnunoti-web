import { useId } from "react";

// 네 꼭지 별(사각별) 경로. 꼭지마다 조금 앞에서 곡선을 끊고 꼭지를 제어점으로 이어 끝을 살짝 둥글린다.
type Point = [number, number];
function sparkle(cx: number, cy: number, r: number) {
  const a = 0.17, b = 0.42, round = 0.4;
  const p = ([x, y]: Point) => `${+(cx + x * r).toFixed(2)} ${+(cy + y * r).toFixed(2)}`;
  const lerp = ([x1, y1]: Point, [x2, y2]: Point): Point => [x1 + (x2 - x1) * round, y1 + (y2 - y1) * round];
  const tips: Point[] = [[0, -1], [1, 0], [0, 1], [-1, 0]];
  // 위→오른쪽→아래→왼쪽 꼭지를 잇는 오목한 변
  const sides = tips.map((from, i) => {
    const to = tips[(i + 1) % 4];
    const c1: Point = [from[0] * b + to[0] * a, from[1] * b + to[1] * a];
    const c2: Point = [from[0] * a + to[0] * b, from[1] * a + to[1] * b];
    return { c1, c2, start: lerp(from, c1), end: lerp(to, c2) };
  });
  return `M${p(sides[0].start)}` + sides.map(({ c1, c2, end }, i) =>
    `C${p(c1)} ${p(c2)} ${p(end)}Q${p(tips[(i + 1) % 4])} ${p(sides[(i + 1) % 4].start)}`).join("") + "Z";
}

// 번지는 빛이 잘리지 않도록 가장자리에 여백을 둔다.
// 입체 음영 대신 색을 겹쳐 오묘하게: 파란 바탕에 좌상단은 하늘빛, 우하단은 보랏빛이 번지고
// 밝은 별을 살짝 비껴 겹쳐 2.5D 느낌을 낸다.
const outer = sparkle(32, 32, 25);
const inner = sparkle(29.5, 29.5, 10);

type Props = {
  className?: string;
  /** 숨 쉬듯 천천히 커졌다 작아진다 */
  animated?: boolean;
  /** 뒤에 번지는 빛. 크게 쓸 때만 켠다 */
  glow?: boolean;
};

export function SparkleIcon({ className, animated = false, glow = false }: Props) {
  const id = useId().replace(/[^a-zA-Z0-9_-]/g, "");
  const url = (name: string) => `url(#${id}-${name})`;
  return (
    <svg viewBox="0 0 64 64" fill="none" overflow="visible" aria-hidden="true" className={`chat-sparkle ${className ?? ""}`} data-animated={animated || undefined}>
      <defs>
        <linearGradient id={`${id}-body`} x1="0.1" y1="0" x2="0.9" y2="1">
          <stop offset="0" stopColor="#5fb4ff" />
          <stop offset="0.5" stopColor="#0064ff" />
          <stop offset="1" stopColor="#5b4cf5" />
        </linearGradient>
        <radialGradient id={`${id}-sky`} cx="0.22" cy="0.2" r="0.6">
          <stop offset="0" stopColor="#a8f0ff" stopOpacity="0.75" />
          <stop offset="1" stopColor="#a8f0ff" stopOpacity="0" />
        </radialGradient>
        <radialGradient id={`${id}-violet`} cx="0.82" cy="0.85" r="0.55">
          <stop offset="0" stopColor="#c09bff" stopOpacity="0.6" />
          <stop offset="1" stopColor="#c09bff" stopOpacity="0" />
        </radialGradient>
        <linearGradient id={`${id}-inner`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#fff" stopOpacity="0.6" />
          <stop offset="1" stopColor="#e2f4ff" stopOpacity="0.1" />
        </linearGradient>
        {glow && (
          <>
            <linearGradient id={`${id}-halo`} x1="0" y1="0" x2="1" y2="1">
              <stop offset="0" stopColor="#5fd0ff" />
              <stop offset="1" stopColor="#7b5cff" />
            </linearGradient>
            <filter id={`${id}-blur`} x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur stdDeviation="6" />
            </filter>
          </>
        )}
      </defs>

      <g data-part="main">
        {glow && <path d={outer} fill={url("halo")} opacity="0.5" filter={url("blur")} />}
        <path d={outer} fill={url("body")} />
        <path d={outer} fill={url("sky")} />
        <path d={outer} fill={url("violet")} />
        <path d={inner} fill={url("inner")} />
      </g>
    </svg>
  );
}
