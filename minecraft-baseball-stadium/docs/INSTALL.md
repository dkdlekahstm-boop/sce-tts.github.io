# 설치 가이드 (Android / iOS / PC 공통)

## 1. .mcaddon 만들기

이 저장소에는 애드온 소스(`behavior_packs/`, `resource_packs/`)만 들어있다.
설치 파일은 아래 한 줄로 직접 빌드한다 (무료, 별도 프로그램 불필요, `zip`만 있으면 됨).

```bash
cd minecraft-baseball-stadium
./packaging/build_mcaddon.sh
# -> dist/SCE_Baseball_Stadium.mcaddon 생성
```

## 2. 기기에 설치

- **모바일(Android/iOS)**: `SCE_Baseball_Stadium.mcaddon` 파일을 기기로 옮긴 뒤 파일 앱에서 열거나
  "Minecraft로 공유"를 선택한다. Minecraft가 자동으로 실행되며 Behavior Pack과 Resource Pack이
  동시에 임포트된다.
- **PC(Windows)**: 파일을 더블클릭하면 동일하게 자동 임포트된다.

## 3. 월드에 적용

1. Minecraft에서 **새 월드 만들기**
2. **동작(Behavior Packs)** 탭에서 `SCE Baseball Stadium - Behavior Pack` 활성화
3. **리소스(Resource Packs)** 탭에서 `SCE Baseball Stadium - Resource Pack` 활성화
4. **실험 기능(Experiments)**: 이 애드온은 실험 토글이 필요 없는 안정 Script API만 사용한다.
   (별도 실험 기능을 켤 필요 없음)
5. 월드 생성 → 첫 접속 시 채팅에 "경기장을 생성하는 중입니다..." 메시지가 뜨고, 약 30초~1분
   내 자동으로 경기장이 완성된다 (수동 명령어 입력 불필요, `system.runJob`으로 백그라운드 생성).
6. **접속해 있는 플레이어가 있으면 그 즉시 1인 플레이(홈팀)로 자동 시작된다** — 로비 NPC를
   따로 찾아 상호작용할 필요가 없다. 2인/3인으로 플레이하고 싶다면, 자동 시작되기 전에
   (경기장 생성 완료 메시지가 뜬 직후) 로비의 "게임 시작" NPC를 먼저 우클릭해 인원과 팀을
   선택하면 그 설정이 우선 적용된다.

## 4. `.mcworld`로 배포하고 싶다면

Bedrock의 월드 저장 파일(`level.dat`)은 클라이언트만 생성하는 바이너리 포맷이라 텍스트로 안전하게
만들 수 없다 (docs/DESIGN.md 3장 참고). 위 3단계를 한 번 완료한 뒤, Minecraft의
**설정 → 전역 리소스 → 내보내기(Export)** 로 그 월드를 `.mcworld`로 내보내면 그 다음부터는
더블클릭 설치가 가능한 `.mcworld` 파일을 만들 수 있다.

## 문제 해결

- **팩 로드 실패 / 빨간 오류**: `manifest.json`의 `@minecraft/server` / `@minecraft/server-ui`
  버전이 설치된 Minecraft 버전과 맞지 않을 수 있다. 설정 → 실험/오류 로그에 표시되는 사용 가능한
  버전 목록으로 `behavior_packs/baseball_BP/manifest.json`의 `dependencies` 버전을 맞춰준다.
- **경기장이 이상한 지형 위에 생성됨**: `stadiumBuilder.js`가 원점(0,5,0) 부근을 자동으로
  평탄화하지만, 원래 그 자리에 다른 구조물이 있었다면 겹칠 수 있다. 새 월드에서 실행하는 것을
  권장한다.
