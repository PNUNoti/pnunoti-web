// 시험 운영 중인 기능에 붙이는 작은 표시. 파란 라벨 옆에 붙으므로 회색으로 조용하게 두어 라벨과 구분한다.
export default function BetaBadge({ className = "" }: { className?: string }) {
  return (
    <span className={`inline-flex h-[18px] shrink-0 items-center rounded-[5px] bg-tds-grey-100 px-1.5 text-[11px] leading-none font-semibold text-tds-grey-600 ${className}`}>
      Beta
    </span>
  );
}
