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

질문은 최대 4,000자이며 Enter로 전송하고 Shift+Enter로 줄을 바꿉니다. 한글 조합 중 Enter는 전송하지 않습니다. 답변은 Markdown과 근거 발췌로 표시하고, 후속 질문에 `conversation_id`를 전달합니다. NotebookLM 서버가 완성된 답변을 반환하므로 대기 상태를 표시하며, 오류는 자동 재전송하지 않습니다.

현재 자료는 2026.10.26–11.02 수집 공지의 스냅샷입니다. 자동 갱신은 연결하지 않았습니다. 현재 NotebookLM 게이트웨이는 한 Google 계정의 같은 대화 맥락을 공유하므로 **공용 테스트 전용**입니다. 사용자별 비공개 대화 서비스로 운영하려면 서버의 대화 격리가 먼저 필요합니다. 화면을 새로고침해도 NotebookLM의 대화 기록을 지우지 않습니다.
