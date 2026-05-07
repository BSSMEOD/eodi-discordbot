# eodi-discordbot

디스코드 인증 진입점을 제공하는 봇입니다.

- `/verify`: 유저에게 BSM 인증 링크를 에페메럴로 전송
- `/verify-panel`: 채널에 `인증 시작` 버튼이 포함된 안내 메시지 전송
- 버튼 클릭 시 `/verify`와 같은 흐름으로 인증 링크 전송

봇은 학생 DB를 직접 조회하지 않습니다. 디스코드 인터랙션만 처리하고, 실제 인증 연결은 백엔드/프론트 인증 페이지에서 처리합니다.

## 환경 변수

`.env.example`을 복사해 `.env`를 만들고 값을 채웁니다.

```env
DISCORD_TOKEN=your-discord-bot-token
DISCORD_CLIENT_ID=your-discord-application-client-id
DISCORD_GUILD_ID=your-guild-id
BACKEND_BASE_URL=https://your-backend-domain
BSM_DISCORD_VERIFY_URL=https://your-backend-domain/discord-verify
```

- `DISCORD_TOKEN`: 디스코드 봇 토큰
- `DISCORD_CLIENT_ID`: 디스코드 애플리케이션 클라이언트 ID
- `DISCORD_GUILD_ID`: 특정 서버에만 명령어를 등록하려면 설정, 글로벌 명령어면 비워둠
- `BACKEND_BASE_URL`: 백엔드 주소
- `BSM_DISCORD_VERIFY_URL`: 유저에게 안내할 인증 페이지 주소

## Docker 배포

이 프로젝트는 Docker Compose 기준으로 배포합니다.

1. 의존성을 설치합니다.

```bash
npm install
```

2. 환경 파일을 준비합니다.

```bash
cp .env.example .env
```

3. `.env` 값을 실제 운영값으로 수정합니다.

4. 컨테이너를 빌드하고 실행합니다.

```bash
npm run docker:up
```

5. 로그를 확인합니다.

```bash
npm run docker:logs
```

6. 중지합니다.

```bash
npm run docker:down
```

`docker-compose.yml`은 `.env`를 직접 읽도록 설정되어 있습니다.

## 구조

```text
src/
  commands/verify.ts
  events/interactionCreate.ts
  index.ts
```
