import { BoardRecommendClient } from "./client";
import { toLang } from "@/app/utils/lang";

export default async function BoardRecommendPage({
  searchParams,
}: {
  searchParams: Promise<{ theme?: string; lang?: string }>;
}) {
  const { theme, lang } = await searchParams;
  const isDark = theme === "dark";

  return <BoardRecommendClient isDark={isDark} lang={toLang(lang)} />;
}
