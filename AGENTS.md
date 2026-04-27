# AGENTS.md — Discord Bot (Verification)

## 🎯 목적
디스코드 유저의 `discordUserId`를 백엔드 인증 API에 전달하여  
학생 DB의 `discord_id`와 연결한다.

봇은 학생을 직접 조회하지 않고, 디스코드 인터랙션 처리와 데이터 전달만 담당한다.

---

## 🧱 기술 스택
- Node.js
- TypeScript
- discord.js v14

---

## 🗂️ 구조

```text
src/
  commands/verify.ts
  events/interactionCreate.ts
  index.ts
```

---

## 🤖 주요 기능

### /verify
- 유저가 직접 실행하는 인증 시작 명령어
- 입력값 없음
- 수행:
  1. `interaction.user.id` → `discordUserId` 확보
  2. `member.nickname` 확보
  3. 닉네임 형식 검증 (`기수_이름`)
  4. 백엔드 `/discord/verify` 호출

### /verify-panel
- 채널에 `인증 시작` 버튼이 달린 안내 메시지를 올리는 관리자용 명령어
- `ManageGuild` 권한이 있는 사용자만 실행 가능

### 인증 시작 버튼
- 유저가 버튼을 클릭하면 `/verify`와 동일한 인증 흐름 시작

### 학번 입력 버튼 + 모달
- 백엔드가 동명이인이라고 응답하면 봇이 `학번 입력` 버튼을 노출
- 버튼 클릭 시 모달을 띄워 학번 입력을 받음
- 입력받은 학번으로 `/discord/verify` 재호출

---

## 🔁 동작 흐름

### 기본 흐름
1. 관리자가 `/verify-panel` 실행
2. 봇이 채널에 `인증 시작` 버튼 메시지 전송
3. 유저가 `인증 시작` 버튼 클릭
4. 봇이 `nickname + discordUserId` 수집
5. 서버로 전달
6. 결과를 유저에게 에페메럴 메시지로 응답

`/verify`를 직접 실행해도 같은 흐름으로 동작한다.

### 동명이인 흐름
1. 유저가 인증 시작
2. 봇이 닉네임과 디스코드 ID로 1차 인증 요청
3. 서버가 동명이인이라고 판단
4. 봇이 `학번 입력` 버튼 표시
5. 유저가 버튼 클릭
6. 모달에서 학번 입력
7. 봇이 `studentId + nickname + discordUserId`로 2차 요청
8. 서버 응답을 유저에게 표시

---

## 🌐 API 요청

### POST /discord/verify

1차 요청:

```json
{
  "nickname": "4기_김현호",
  "discordUserId": "123456789012345678"
}
```

2차 요청:

```json
{
  "studentId": "3101",
  "nickname": "4기_김현호",
  "discordUserId": "123456789012345678"
}
```

---

## ⚠️ 서버 매칭 규칙

닉네임 형식:
- `기수_이름`
- 예: `4기_김현호`

서버 처리 원칙:
- `studentId`가 없으면 `nickname`으로 학생 조회
- 조회 결과가 1명이면 바로 인증
- 조회 결과가 여러 명이면 동명이인 응답 반환
- 조회 결과가 0명이면 찾을 수 없음 응답 반환
- `studentId`가 있으면 `nickname + studentId` 조합 검증

동명이인 처리:
- 과거처럼 첫 번째 레코드를 임의 선택하지 않음
- 반드시 백엔드가 중복 상태를 반환하고, 봇이 학번을 추가 입력받아 재시도함

---

## 📡 백엔드 응답 규칙

성공:
- HTTP `200`

```json
{
  "success": true,
  "status": "verified",
  "message": "인증이 완료되었습니다."
}
```

이미 인증됨:
- HTTP `200`

```json
{
  "success": true,
  "status": "already_verified",
  "message": "이미 인증된 계정입니다."
}
```

동명이인:
- HTTP `409`
또는 아래 필드 포함:
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

학생 없음:
- HTTP `404`

```json
{
  "success": false,
  "status": "not_found",
  "code": "STUDENT_NOT_FOUND",
  "message": "일치하는 학생 정보를 찾을 수 없습니다."
}
```

학번 불일치:
- HTTP `400`

```json
{
  "success": false,
  "status": "mismatch",
  "code": "STUDENT_ID_MISMATCH",
  "message": "입력한 학번과 닉네임 정보가 일치하지 않습니다."
}
```

이미 다른 계정에 연결됨:
- HTTP `409`

```json
{
  "success": false,
  "status": "already_linked",
  "code": "DISCORD_ALREADY_LINKED",
  "message": "이미 다른 디스코드 계정에 연결된 학생입니다."
}
```

---

## 🔒 규칙
- 봇은 DB 직접 접근 금지
- 모든 검증과 매칭은 서버에서 수행
- 봇은 디스코드 인터랙션 처리와 데이터 전달만 수행
- 닉네임 형식 검증은 봇에서 선처리 가능
- 서버는 봇 입력값을 신뢰하지 말고 방어적으로 재검증해야 함

---

## 💬 핵심
👉 인증 시작은 디스코드 버튼으로 진행하고  
👉 닉네임으로 바로 식별되면 즉시 인증하고  
👉 동명이인이면 학번 모달을 통해 추가 확인한다
