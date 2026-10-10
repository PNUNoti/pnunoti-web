// 앱 WebView가 ?lang=en 으로 언어를 넘긴다. 그 외 값이나 없으면 한국어.
export type Lang = "ko" | "en";

export function toLang(value?: string): Lang {
  return value === "en" ? "en" : "ko";
}
