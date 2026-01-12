import { BoardRecommendClient } from "./client";

export default async function BoardRecommendPage({
  searchParams,
}: {
  searchParams: Promise<{ theme?: string }>;
}) {
  const { theme } = await searchParams;
  const isDark = theme === "dark";

  return <BoardRecommendClient isDark={isDark} theme={theme} />;
}
