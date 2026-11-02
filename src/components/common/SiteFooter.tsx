"use client";

import { usePathname } from "next/navigation";
import Footer from "./Footer";

export default function SiteFooter() {
  const pathname = usePathname();
  return pathname === "/chat" || pathname.startsWith("/chat/") ? null : <Footer />;
}
