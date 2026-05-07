# eodi-discordbot

디스코드 유저를 학생 DB와 연결하기 위한 인증 봇입니다.  
봇은 학생 정보를 직접 조회하지 않고, `nickname`, `discordUserId`, 필요 시 `studentId`를 백엔드로 전달하는 역할만 담당합니다.

## 기술 스택

- Node.js
- TypeScript
- discord.js v14

## 현재 명령어

- `/verify`
  - 실행한 유저의 서버 닉네임과 디스코드 유저 ID로 인증을 시작합니다.
  - 닉네임만으로 식별이 안 되는 경우, 봇이 학번 입력 모달을 추가로 띄웁니다.
- `/verify-panel`
  - 채널에 `인증 시작` 버튼이 포함된 안내 메시지를 전송합니다.
  - `ManageGuild` 권한이 있는 관리자만 사용할 수 있습니다.

## 인증 로직

### 1. 인증 패널 게시

1. 관리자가 `/verify-panel` 실행
2. 봇이 채널에 `인증 시작` 버튼 메시지 전송
3. 유저가 버튼 클릭

`/verify`를 직접 실행해도 같은 인증 흐름으로 들어갑니다.

### 2. 1차 인증 요청

봇은 아래 값을 수집합니다.

- `interaction.user.id` → `discordUserId`
- `member.nickname` → `nickname`

닉네임 형식은 반드시 `기수_이름` 이어야 합니다.

- 예: `4기_김현호`

형식이 맞지 않으면 봇이 즉시 에페메럴 메시지로 실패를 안내하고, 백엔드는 호출하지 않습니다.

1차 요청 payload:

```json
{
  "nickname": "4기_김현호",
  "discordUserId": "123456789012345678"
}
```

### 3. 중복 이름 처리

백엔드가 닉네임만으로 학생을 하나로 확정하지 못하면, 봇은 유저에게 `학번 입력` 버튼을 보여줍니다.

유저 흐름:

1. `학번 입력` 버튼 클릭
2. 디스코드 모달 열림
3. 유저가 학번 입력
4. 봇이 같은 API를 다시 호출

2차 요청 payload:

```json
{
  "studentId": "3101",
  "nickname": "4기_김현호",
  "discordUserId": "123456789012345678"
}
```

## 백엔드 역할

봇은 DB에 직접 접근하지 않습니다.  
학생 조회, 중복 판정, 최종 `discord_id` 연결은 전부 백엔드가 처리해야 합니다.

엔드포인트:

```http
POST /discord/verify
```

백엔드 처리 규칙:

1. `studentId`가 없으면 `nickname`으로 학생 조회
2. 조회 결과가 1명이면 바로 인증
3. 조회 결과가 여러 명이면 중복 응답 반환
4. 조회 결과가 0명이면 찾을 수 없음 응답 반환
5. `studentId`가 있으면 `nickname + studentId` 조합 검증
6. 일치하면 인증 완료
7. 불일치하면 실패 응답 반환

## 백엔드 응답 규칙

봇은 아래 케이스를 기준으로 동작합니다.

### 성공

- HTTP `200`

```json
{
  "success": true,
  "status": "verified",
  "message": "인증이 완료되었습니다."
}
```

### 이미 인증된 계정

- HTTP `200`

```json
{
  "success": true,
  "status": "already_verified",
  "message": "이미 인증된 계정입니다."
}
```

### 동명이인으로 학번 입력 필요

아래 중 하나면 봇이 학번 입력 UI를 띄웁니다.

- HTTP `409`
- `requiresStudentId: true`
- `status: "duplicate"`
- `code: "DUPLICATE_STUDENT"`

예시:

```json
{
  "success": false,
  "status": "duplicate",
  "code": "DUPLICATE_STUDENT",
  "requiresStudentId": true,
  "message": "동명이인이 있어 학번 입력이 필요합니다."
}
```

### 학생을 찾지 못함

- HTTP `404`

```json
{
  "success": false,
  "status": "not_found",
  "code": "STUDENT_NOT_FOUND",
  "message": "일치하는 학생 정보를 찾을 수 없습니다."
}
```

### 학번과 닉네임 불일치

- HTTP `400`

```json
{
  "success": false,
  "status": "mismatch",
  "code": "STUDENT_ID_MISMATCH",
  "message": "입력한 학번과 닉네임 정보가 일치하지 않습니다."
}
```

### 이미 다른 계정에 연결됨

- HTTP `409`

```json
{
  "success": false,
  "status": "already_linked",
  "code": "DISCORD_ALREADY_LINKED",
  "message": "이미 다른 디스코드 계정에 연결된 학생입니다."
}
```

## 픽업 날짜 DM 리스너

백엔드가 소유권 주장을 승인하면, 백엔드가 직접 유저에게 픽업 날짜 입력 안내 DM을 보냅니다.
유저가 봇과의 1:1 DM에 `M/D/HH:MM` 형식(예: `4/23/12:00`)으로 답장하면 봇이 백엔드에 전달합니다.

요청:

```http
POST {BACKEND_BASE_URL}/discord/pickup-date
Content-Type: application/json

{
  "discordId": "<메시지를 보낸 사용자의 Discord User ID>",
  "pickupDate": "<원본 메시지 그대로, 예: 4/23/12:00>"
}
```

응답에 따른 DM 답장:

- `200 { success: true }` → `✅ 픽업 날짜 등록 완료: M/D HH:MM에 찾으러 와주세요. 당일 아침에 다시 알려드릴게요.`
- `4xx { success: false, message }` → `⚠️ 등록 실패: {message}`
- `5xx` 또는 네트워크 오류 → `봇/서버 통신 오류가 발생했어요. 잠시 후 다시 시도해주세요.`

봇이 무시하는 메시지:

- 길드 채널에 올라온 메시지
- 봇 또는 다른 봇이 보낸 메시지
- 패턴(`^(\d{1,2})/(\d{1,2})/(\d{1,2}):(\d{2})$`)에 맞지 않는 일반 텍스트 (조용히 무시)

## 봇이 직접 처리하지 않는 흐름

다음 알림은 백엔드가 유저에게 직접 DM을 보냅니다. 봇이 중복 발송하면 같은 메시지가 두 번 가므로 봇 측에서는 처리하지 않습니다.

- 인증 완료 DM과 역할 부여 (BSM OAuth 완료 시점에 백엔드가 처리)
- 분실물 소유권 주장 승인/거절 DM (관리자가 백엔드에서 승인/거절)
- 픽업 리마인더 DM (백엔드 스케줄러가 매일 아침 7시 발송)

## 프로젝트 구조

```text
src/
  commands/verify.ts
  events/
    interactionCreate.ts
    messageCreate.ts
  index.ts
```

## 환경 변수

`.env.example` 기준:

```env
DISCORD_TOKEN=your-discord-bot-token
DISCORD_CLIENT_ID=your-discord-application-client-id
DISCORD_GUILD_ID=your-test-guild-id
BACKEND_BASE_URL=https://www.jojaemin.com
BSM_DISCORD_VERIFY_URL=https://www.jojaemin.com/discord-verify
```

설명:

- `DISCORD_TOKEN`: 디스코드 봇 토큰
- `DISCORD_CLIENT_ID`: 디스코드 애플리케이션 클라이언트 ID
- `DISCORD_GUILD_ID`: 길드 명령어를 빠르게 등록할 테스트 서버 ID (없으면 글로벌 명령어로 등록)
- `BACKEND_BASE_URL`: EODI 백엔드 API 서버 주소 (픽업 날짜 전달 등에서 사용). `EODI_API_BASE_URL`도 동일하게 인식합니다.
- `BSM_DISCORD_VERIFY_URL`: `/verify`가 안내하는 프론트 인증 페이지 URL (미지정 시 `https://www.jojaemin.com/discord-verify`)

## 실행 방법

기본 실행 기준은 Docker Compose입니다.

```bash
npm install
cp .env.example .env
# .env 값을 실제 Discord/BACKEND 값으로 수정
npm run docker:up
```

로그 확인:

```bash
npm run docker:logs
```

중지:

```bash
npm run docker:down
```

로컬에서 Node로 직접 실행해야 할 때만 아래를 사용합니다.

```bash
npm install
npm run dev
```

운영용 Compose:

```bash
npm run docker:prod:up
```

## 원칙

- 봇은 DB에 직접 접근하지 않음
- 모든 검증과 매칭은 서버에서 수행
- 봇은 디스코드 인터랙션 처리와 데이터 전달만 담당
