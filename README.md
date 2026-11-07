This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

Use pnpm 10.29.3 (pinned in `package.json`). Install dependencies, then run the development server:

```bash
pnpm install --frozen-lockfile
pnpm run dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.

## Amplitude Session Replay

루트 레이아웃에서 브라우저 SDK와 Session Replay를 비동기로 한 번 초기화합니다.
`.env.local` 및 배포 환경에 앱과 같은 프로젝트의 공개 수집 키를 설정합니다.
`NEXT_PUBLIC_` 환경 변수는 빌드 시 적용됩니다.

```dotenv
NEXT_PUBLIC_AMPLITUDE_API_KEY=<Amplitude 프로젝트 API key>
NEXT_PUBLIC_AMPLITUDE_REPLAY_SAMPLE_RATE=1
```

샘플링은 기본 100%이며 `0`~`1`로 조절합니다. Amplitude의 원격 설정이 있으면 해당
설정이 적용될 수 있습니다. 페이지 경로·앱/웹 진입 구분·계정 연결 상태를 이벤트로
보냅니다. 전송한 질문·답변·출처는 리플레이에 그대로 보이며, 입력 중인 내용은 SDK의
기본 마스킹을 유지합니다. 폼·클릭·네트워크 자동 수집은 사용하지 않습니다.
기존 Vercel Analytics도 유지합니다.

앱 채팅에서는 기존 일회용 티켓을 서버에서 검증한 뒤 받은 `user_id`를 연결합니다.
네이티브 Amplitude와 동일한 Supabase 사용자 UUID를 사용하며, 연결 실패·로그아웃 시
익명으로 전환하고 기존 계정의 기기/세션을 분리합니다. 일반 브라우저는 익명으로
기록합니다. SDK 초기화나 전송 실패는 채팅을 막지 않습니다.

## 공지 AI 채팅 (`/chat`)

NotebookLM 서버의 공지 자료를 질문하는 테스트 화면입니다. [shadcn AI Elements](https://ui.shadcn.com/docs/ai-elements)의 Chat, Message, Prompt Input, Sources 패턴과 공식 `message-scroller`, `message`, `bubble`, `input-group`, `collapsible` 컴포넌트를 TDS(토스 디자인 시스템) 스타일로 사용합니다.

`.env.local`에 서버 전용 변수를 설정합니다. 기존 환경 변수는 유지해주세요.

```dotenv
NOTEBOOKLM_API_URL=https://pnunoti-chat.uncoverlab.net
NOTEBOOKLM_API_KEY=<NotebookLM 서버의 CHAT_API_KEY>
```

API 키에 `NEXT_PUBLIC_` 접두사를 붙이지 않습니다. 브라우저는 같은 사이트의 `POST /api/chat`만 호출하고, Next.js 서버가 인증 헤더를 붙여 NotebookLM 서버의 `POST /chat`으로 전달합니다. 배포할 때도 위 두 변수를 호스팅 환경에 별도로 설정해야 합니다. API 실행 제한은 120초 이상 지원하는 환경을 사용합니다.

NotebookLM 요청에만 IPv4 연결과 15초 연결 제한을 적용합니다. 일부 네트워크에서 Node의 IPv6/IPv4 주소 선택 중 연결이 조기에 끊기는 문제를 방지합니다. TLS 인증서 검증은 유지합니다.

```bash
pnpm run dev
# http://localhost:3000/chat
pnpm run test:chat
pnpm exec tsc --noEmit
pnpm run build
```

다른 개발 서버를 실행한 상태에서 빌드를 검증할 때는 `NEXT_DIST_DIR=.next-chat-check pnpm run build`로 출력 디렉터리를 분리할 수 있습니다. 해당 빌드 실행은 `NEXT_DIST_DIR=.next-chat-check pnpm start --port 3001`입니다.

질문은 최대 4,000자이며 Enter로 전송하고 Shift+Enter로 줄을 바꿉니다. 한글 조합 중 Enter는 전송하지 않습니다. 답변은 Markdown과 근거 발췌로 표시하고, 후속 질문에 `conversation_id`를 전달합니다. 서버 접수 전에는 전송 중으로 표시하고, 접수 후 실제 요청 상태를 조회합니다. 질문을 보내기 전에 원래 요청 UUID와 질문을 localStorage에 보관합니다. 다시 접속하면 서버 상태를 먼저 조회하고, 접수되지 않은 질문만 같은 UUID로 재전송합니다. 답변 확인 또는 명시적 중지/새 대화 시 로컬 기록을 정리하며 최대 30일 보관합니다. 로그인·푸시 토큰은 브라우저 저장소에 저장하지 않습니다.

앱에서는 기존 로그인 브릿지를 화면 초기화 시 한 번 사용해 검증된 계정을 현재 HttpOnly 채팅 세션과 연결합니다. 질문은 `X-App-User-Id`로 계정을 전달하고, 서버가 세션과의 일치를 확인합니다. 답변 완료 시 해당 계정의 활성 푸시 토큰을 조회해 등록 기기에 알립니다. 일반 브라우저 질문에는 푸시를 연결하지 않습니다. Vercel에는 기존 두 환경 변수만 필요하며, Supabase 비밀 키를 추가하지 않습니다. 기존 iOS 빌드 45의 브릿지와 호환됩니다.

알림 탭이나 아직 확인하지 못한 요청만 자동 복구하며, 일반 이전 대화는 ‘이전 대화 이어하기’ 버튼으로 불러옵니다. 기존 대화를 무시해도 서버 DB에서 삭제하지 않는 설정을 유지합니다. 대화 맥락은 서버에서 세션별로 분리합니다.

### 로컬 Gemini 에이전트 서버 연결

`pnunoti-notebooklm`의 `local_agent.py`를 실행하면 현재 브랜치의 에이전트 제공자를
`127.0.0.1:8082`에서 기존 채팅 API 형태로 이용할 수 있습니다. 웹 `.env.local`의
`NOTEBOOKLM_API_URL`을 `http://127.0.0.1:8082`로 설정하고 `NOTEBOOKLM_API_KEY`에는
개발 서버의 키를 사용합니다. `NEXT_PUBLIC_CHAT_STORAGE_NAMESPACE=gemini-agent-local`을
설정하면 기존 서버의 미확인 질문을 개발 서버로 재전송하지 않도록 로컬 복구 기록을
분리합니다. 다른 환경 변수는 유지하고 `pnpm dev`로 실행합니다.

HTTP는 개발 환경의 loopback 주소에만 허용하며, 운영 환경에서는 HTTPS를 사용합니다.
Google 인증 파일과 서버 키를 `NEXT_PUBLIC_` 변수에 넣지 않습니다.
