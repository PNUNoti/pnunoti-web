import { DOWNLOAD_ON_APP_STORE, DOWNLOAD_ON_PLAY_STORE } from "@/constants/images";
import { APP_STORE_URL, PLAY_STORE_URL } from "@/constants/urls";
import AppDownloadButton, { type DownloadButtonSource } from "./AppDownloadButton";
import AiChatButton from "./AiChatButton";

export default function HomeActions({ source, className = "" }: { source: DownloadButtonSource; className?: string }) {
  return (
    <div className={`home-actions ${className}`}>
      <AppDownloadButton href={PLAY_STORE_URL} imageSrc={DOWNLOAD_ON_PLAY_STORE} altText="Google Play에서 다운로드" store="google-play" source={source} />
      <AppDownloadButton href={APP_STORE_URL} imageSrc={DOWNLOAD_ON_APP_STORE} altText="App Store에서 다운로드" store="app-store" source={source} />
      <AiChatButton />
    </div>
  );
}
