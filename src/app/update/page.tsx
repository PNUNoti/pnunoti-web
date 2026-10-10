import type { Metadata } from "next";
import { UpdateClient } from "./client";
import { toLang } from "@/app/utils/lang";

export const metadata: Metadata = {
  title: "PNU Noti 업데이트",
  description: "부산대 공지사항 알리미 | PNU Noti",
};

export default async function UpdatePage({
  searchParams,
}: {
  searchParams: Promise<{ theme?: string; lang?: string }>;
}) {
  const { theme, lang } = await searchParams;
  const isDark = theme === "dark";

  return <UpdateClient isDark={isDark} lang={toLang(lang)} />;
}
