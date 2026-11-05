# AI 오로라 아이콘

`ai-aurora.png`가 웹과 앱에서 사용하는 아이콘 원본입니다.
웹은 이 원본을 무손실로 변환한 `ai-aurora.webp`를 표시하고, 앱은 PNG를 사용합니다.

- 256 × 256px 투명 PNG입니다.
- 기존 웹 CSS의 기본 프레임을 브라우저에서 블러까지 포함해 렌더링했습니다.
- 빛이 잘리지 않도록 투명 여백을 포함합니다.
- WebP는 원본의 RGBA 픽셀과 투명도를 그대로 유지합니다.
- 웹에서는 추가 이미지 최적화·필터·색상 변경 없이 WebP를 표시합니다.
- 앱도 동일한 PNG를 번들에 포함합니다. 아이콘을 따로 그리거나 애니메이션하지 않습니다.

원본 이미지를 바꾼 뒤 **웹 저장소**에서 WebP를 갱신합니다.
`cwebp`(libwebp)가 설치된 환경에서 실행합니다.

```sh
pnpm run asset:ai:webp
```

그다음 **앱 저장소**에서 PNG 원본을 동기화합니다.

```sh
npm run asset:ai:sync
npm run asset:ai:check
```

기본 경로는 앱 저장소 옆의 `pnunoti-web/public/images/ai-aurora.png`입니다.
다른 위치의 원본을 쓰려면 명령 뒤에 PNG 경로를 전달할 수 있습니다.
`--check`는 두 파일의 바이트가 같은지 검사하며, 다르면 실패합니다.
