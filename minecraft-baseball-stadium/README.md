# SCE Baseball Stadium — Minecraft Bedrock 야구 경기장 애드온

모바일(Android/iOS)에서도 실행되는, **로비 → 인원/팀 선택 → 9이닝 경기**까지 자동으로
진행되는 Minecraft Bedrock 야구 맵. Behavior Pack + Resource Pack + Script API
(`@minecraft/server`, `@minecraft/server-ui`)로만 구현했고, 유료 애드온이나 실험 기능
토글이 필요 없다.

먼저 읽을 것: **[docs/DESIGN.md](docs/DESIGN.md)** — 전체 구조, 경기장 좌표, 그리고
**Bedrock에서 실제로 되는 것과 안 되는 것**(3장, 가장 중요)을 정리했다.
설치는 **[docs/INSTALL.md](docs/INSTALL.md)** 참고.

## 빠른 시작

```bash
cd minecraft-baseball-stadium
./packaging/build_mcaddon.sh        # dist/SCE_Baseball_Stadium.mcaddon 생성
```

생성된 `.mcaddon`을 모바일/PC로 옮겨 열면 자동 임포트된다. 새 월드에서 두 팩을 켜고
접속하면 경기장이 스스로 지어진다 (수동 명령어 불필요).

## 프로젝트 구조

```
minecraft-baseball-stadium/
├── README.md                              # 이 파일
├── docs/
│   ├── DESIGN.md                          # 전체 설계 + 좌표 SSOT + API 가능/불가능 경계
│   └── INSTALL.md                         # 설치 가이드
├── packaging/
│   └── build_mcaddon.sh                   # BP+RP -> .mcaddon 빌드 스크립트
├── behavior_packs/baseball_BP/
│   ├── manifest.json
│   ├── pack_icon.png
│   ├── texts/{languages.json, en_US.lang, ko_KR.lang}
│   ├── entities/
│   │   ├── baseball.entity.json           # 투구/타구용 공 (script가 teleport로 직접 운동학 제어)
│   │   ├── player_npc.entity.json         # 모든 NPC 선수(수비/주루/타자) 공용 엔티티
│   │   ├── ball_marker.entity.json        # 수비 AI가 쫓아가는 표적 마커
│   │   └── base_marker.entity.json        # 주루 AI가 쫓아가는 베이스 마커
│   ├── items/
│   │   ├── baseball_bat.item.json         # 타자용 방망이 (스윙 판정 트리거)
│   │   └── pitch_selector.item.json       # 투수용 구종/코스 선택 아이템
│   └── scripts/
│       ├── main.js                        # 엔트리 포인트 (초기화 + 매틱 루프)
│       ├── constants.js                   # 좌표/구종/코스/스코어보드 상수 SSOT
│       ├── state.js                       # 경기 전역 상태
│       ├── ticks.js                       # 전역 틱 카운터
│       ├── stadiumBuilder.js              # 경기장 절차적 생성 (system.runJob)
│       ├── gameManager.js                 # 로비/인원선택/팀선택/이닝전환/승부종료
│       ├── pitching.js                    # 구종·코스 선택 UI + 공 운동학 + 볼/스트라이크 판정
│       ├── batting.js                     # 스윙 판정 + 타이밍/코스/구종 기반 타구 결과 산정
│       ├── fielding.js                    # 수비 AI(마커 추격) + 아웃/안타 판정
│       ├── baserunning.js                 # 주루 자동 처리(강제진루/득점/도루)
│       ├── rules.js                       # 볼넷/삼진/아웃/이닝 규칙 엔진
│       ├── scoreboard.js                  # 사이드바 + 전광판(armor_stand) 표시
│       ├── crowd.js                       # 관중/치어리더 연출 (최적화된 소수 NPC + 사운드/파티클)
│       ├── camera.js                      # 짧은 카메라 연출
│       ├── movement.js                    # 보간 이동 공용 유틸
│       └── ui.js                          # ActionFormData/타이틀/액션바 래퍼
└── resource_packs/baseball_RP/
    ├── manifest.json
    ├── pack_icon.png
    ├── texts/{languages.json, en_US.lang, ko_KR.lang}
    ├── entity/
    │   ├── baseball.entity.json
    │   ├── player_npc.entity.json
    │   ├── ball_marker.entity.json
    │   └── base_marker.entity.json
    ├── models/entity/{baseball.geo.json, marker.geo.json}
    ├── animations/player_npc.animation.json   # 걷기 절차적 애니메이션
    ├── render_controllers/player_npc.render_controllers.json  # 팀별 스킨 전환
    ├── cameras/camera_presets.json            # 카메라 연출용 커스텀 프리셋
    └── textures/
        ├── entity/{baseball.png, player_home.png, player_away.png}
        ├── items/{baseball_bat.png, pitch_selector.png}
        └── item_texture.json
```

## 요청 항목 대응표 (요약)

| 요청 | 구현 위치 |
|---|---|
| 1. 기본 조건(모바일/무료/자동 진행) | `main.js`, `docs/INSTALL.md` |
| 2. 경기장 시설 일체 | `stadiumBuilder.js`, 좌표는 `constants.js`/`docs/DESIGN.md` |
| 3. NPC 선수(9개 수비 위치, 자동 수비/송구) | `player_npc.entity.json`, `fielding.js` |
| 4. 인원 선택(1/2/3인) + 부족 포지션 NPC | `gameManager.js` (로비/로스터 구성) |
| 5. 투구 시스템(구종/코스/판정) | `pitching.js`, `constants.js`(PITCH_TYPES/COURSES) |
| 6. 타격 시스템(타이밍 기반 판정) | `batting.js` |
| 7. 실제 야구 규칙 | `rules.js`, `baserunning.js` |
| 8. 포수 시스템 | `gameManager.js`(포수 배치), `baserunning.js`(도루 판정) — 사인 연출은 단순화됨(DESIGN.md 3장) |
| 9. 전광판 | `scoreboard.js` |
| 10. 관중/응원 | `crowd.js` |
| 11. 경기 시작 시스템(로비→인원→팀→시작) | `gameManager.js` — 접속 즉시 1인 플레이로 자동 시작되며, 로비 NPC로 먼저 인원/팀을 고르면 그 설정이 우선한다 |
| 12. 경기 연출(자막) | `ui.js`(title), `rules.js`/`fielding.js` 호출부 |
| 13. 카메라 | `camera.js`, `cameras/camera_presets.json` |
| 14. 모바일 최적화 | `docs/DESIGN.md` 2장 하단 설명, `crowd.js`(관중 수 제한), `stadiumBuilder.js`(runJob 분산 생성) |

## 알려진 단순화 (정직한 고지)

전부 `docs/DESIGN.md` 3장에 근거와 함께 정리되어 있다. 핵심만 요약하면:

- **화면에 떠 있는 SWING 버튼은 없다** — Bedrock에 커스텀 HUD 버튼 API가 없어서, 방망이를
  들고 공을 공격(attack)하는 것으로 대체했다.
- **수비수의 실시간 길찾기 도착 여부가 아웃/세이프를 결정하지 않는다** — 거리/유효 이동속도
  기반 확률식으로 판정하고, 실제 NPC 추격은 연출용이다. (이유: 신뢰할 수 있는 판정을 위해)
- **주루는 사람도 포함해 자동으로 처리된다** — 자유 주루 판단(더 갈지 말지 스스로 결정)은
  이번 구현 범위 밖이며, 확장 지점으로 남겨두었다.
- **경기장 절대 크기는 실제 잠실(중견수 125m)보다 작다** — 비율은 유지하되 모바일 렌더링을
  고려해 축소했다.

## 재빌드 / 테스트 체크리스트

- `packaging/build_mcaddon.sh` 실행 후 새 월드에서 두 팩 활성화
- 첫 접속 시 경기장 자동 생성 확인 (콘솔/채팅 로그에 에러 없는지)
- 1인 → 2인 → 3인 순서로 로비 플로우 확인
- 투구 UI(구종→코스) → 스윙 → 안타/아웃/홈런 각각 최소 1회 확인
- 볼넷/삼진/이닝 교체/9회 종료(콜드/연장) 케이스 확인
