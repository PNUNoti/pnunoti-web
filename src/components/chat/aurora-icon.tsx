import "./aurora-icon.css";

type Props = {
  className?: string;
  /** 겹친 빛이 서로 다른 방향으로 천천히 흐른다. */
  animated?: boolean;
};

export function AuroraIcon({ className, animated = false }: Props) {
  return (
    <span
      aria-hidden="true"
      className={`aurora-icon ${className ?? ""}`}
      data-animated={animated || undefined}
    >
      <i />
      <i />
      <i />
    </span>
  );
}
