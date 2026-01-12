import { cn } from "@/app/utils/classname";

interface Props {
  children: React.ReactNode;
  className?: string;
  [key: string]: any;
}

function Card({ children, className, ...props }: Props) {
  const DEFAULT_STYLE =
    "flex gap-2 p-4 rounded-2xl bg-light-surface dark:bg-dark-surface";
  return (
    <div className={cn(DEFAULT_STYLE, className)} {...props}>
      {children}
    </div>
  );
}

export default Card;
