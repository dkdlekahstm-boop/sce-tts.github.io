/**
 * 단일 진실 소스(SSOT). docs/DESIGN.md 2장의 좌표 표와 반드시 동일하게 유지한다.
 * 모든 좌표는 오버월드 기준, 스타디움 원점(홈플레이트)을 (0, GROUND_Y, 0)에 둔다.
 * stadiumBuilder.js 가 world 첫 로드 시 이 좌표대로 지형을 깎고 건물을 짓는다.
 */

export const GROUND_Y = 5;

export const FIELD = {
  GROUND_Y,
  HOME: { x: 0, y: GROUND_Y, z: 0 },
  FIRST: { x: 27, y: GROUND_Y, z: 0 },
  SECOND: { x: 27, y: GROUND_Y, z: 27 },
  THIRD: { x: 0, y: GROUND_Y, z: 27 },
  MOUND: { x: 13, y: GROUND_Y, z: 13 },
  OUTFIELD_R_LINE: 60, // 파울라인 펜스까지 거리
  OUTFIELD_R_CENTER: 80, // 중견수 펜스까지 거리
  STANDS_TIERS: 4,
  STANDS_INNER_R: 63,
  STANDS_TIER_WIDTH: 8,
  STANDS_TIER_HEIGHT: 3,
  LIGHT_TOWER_R: 100,
  LIGHT_TOWER_COUNT: 8,
  LIGHT_TOWER_HEIGHT: 30,
  SCOREBOARD_DIST: 96, // 홈-2루 대각선 연장선 위, 외야 펜스 너머 거리
  HOME_DUGOUT: { min: { x: -18, y: GROUND_Y - 2, z: -6 }, max: { x: -6, y: GROUND_Y + 3, z: 10 } },
  AWAY_DUGOUT: { min: { x: -6, y: GROUND_Y - 2, z: -18 }, max: { x: 10, y: GROUND_Y + 3, z: -6 } },
};

// 타순 대기석(덕아웃 벤치) - 각 팀 5자리, 부족하면 순환 사용
export const DUGOUT_BENCH = {
  home: [
    { x: -16, y: GROUND_Y - 1, z: -4 },
    { x: -16, y: GROUND_Y - 1, z: -1 },
    { x: -16, y: GROUND_Y - 1, z: 2 },
    { x: -16, y: GROUND_Y - 1, z: 5 },
    { x: -16, y: GROUND_Y - 1, z: 8 },
  ],
  away: [
    { x: -4, y: GROUND_Y - 1, z: -16 },
    { x: -1, y: GROUND_Y - 1, z: -16 },
    { x: 2, y: GROUND_Y - 1, z: -16 },
    { x: 5, y: GROUND_Y - 1, z: -16 },
    { x: 8, y: GROUND_Y - 1, z: -16 },
  ],
};

// 9개 수비 위치 기본 대기 좌표 (Y는 GROUND_Y와 동일한 지면)
export const FIELDING_POSITIONS = {
  P: { x: 13, y: GROUND_Y, z: 13 },
  C: { x: 0, y: GROUND_Y, z: -2 },
  "1B": { x: 30, y: GROUND_Y, z: 8 },
  "2B": { x: 24, y: GROUND_Y, z: 24 },
  "3B": { x: -3, y: GROUND_Y, z: 24 },
  SS: { x: 18, y: GROUND_Y, z: 30 },
  LF: { x: 14, y: GROUND_Y, z: 52 },
  CF: { x: 40, y: GROUND_Y, z: 40 },
  RF: { x: 52, y: GROUND_Y, z: 14 },
};

export const POSITION_ORDER = ["P", "C", "1B", "2B", "3B", "SS", "LF", "CF", "RF"];

export const BASES = {
  first: FIELD.FIRST,
  second: FIELD.SECOND,
  third: FIELD.THIRD,
  home: FIELD.HOME,
};

/**
 * 구종 정의. speed = 초당 블록 이동량(투수마운드->홈플레이트 약 18.4블록),
 * gravity = 매틱 하강 가속(낙차), curve = 매틱 좌우 가속(변화량), control = 코스 흔들림 표준편차(블록).
 * 실제 MLB 구속/무브먼트 비율을 단순화해 근사했다 (완전 물리 시뮬레이션이 아님).
 */
export const PITCH_TYPES = {
  FASTBALL: { id: "FASTBALL", name: "직구", speedBps: 40, gravity: 0.055, curveX: 0, curveY: 0, control: 0.12 },
  CURVE: { id: "CURVE", name: "커브", speedBps: 27, gravity: 0.16, curveX: 0.01, curveY: 0, control: 0.3 },
  SLIDER: { id: "SLIDER", name: "슬라이더", speedBps: 31, gravity: 0.07, curveX: 0.11, curveY: 0, control: 0.26 },
  CHANGEUP: { id: "CHANGEUP", name: "체인지업", speedBps: 22, gravity: 0.09, curveX: 0.02, curveY: 0, control: 0.34 },
};

// 스트라이크 존 (홈플레이트 중심 기준 좌우/상하 폭, 블록)
export const STRIKE_ZONE = { halfWidth: 0.45, bottom: 1.0, top: 1.75 };

// 코스 선택지 (스트라이크존 상대 좌표, -1~1 정규화)
export const COURSES = {
  HIGH_IN: { dx: -0.9, dy: 0.9 }, HIGH_MID: { dx: 0, dy: 0.9 }, HIGH_OUT: { dx: 0.9, dy: 0.9 },
  MID_IN: { dx: -0.9, dy: 0 }, MID_MID: { dx: 0, dy: 0 }, MID_OUT: { dx: 0.9, dy: 0 },
  LOW_IN: { dx: -0.9, dy: -0.9 }, LOW_MID: { dx: 0, dy: -0.9 }, LOW_OUT: { dx: 0.9, dy: -0.9 },
};

export const GAME = {
  INNINGS: 9,
  MAX_BALLS: 4,
  MAX_STRIKES: 3,
  MAX_OUTS: 3,
  TICKS_PER_SEC: 20,
};

export const TEAM = { HOME: 0, AWAY: 1 };

export const SCOREBOARD = {
  SCORE_HOME: "sce_score_home",
  SCORE_AWAY: "sce_score_away",
  INNING: "sce_inning",
  HALF: "sce_half", // 0 = top(원정 공격), 1 = bottom(홈 공격)
  OUTS: "sce_outs",
  BALLS: "sce_balls",
  STRIKES: "sce_strikes",
};

export const TAGS = {
  ROLE_PREFIX: "sce_role_",
  TEAM_PREFIX: "sce_team_",
  POS_PREFIX: "sce_pos_",
  LOBBY_NPC: "sce_lobby_npc",
  MANAGED: "sce_managed",
};

export const DYN_PROPS = {
  STADIUM_BUILT: "sce:stadium_built",
  GAME_STATE: "sce:game_state",
};

/** 전광판 벽 앵커 좌표(스타디움 빌더와 scoreboard.js가 공유하는 단일 계산식). */
export function scoreboardAnchor() {
  const angle = (45 * Math.PI) / 180;
  const r = FIELD.OUTFIELD_R_CENTER + 16;
  return {
    x: Math.round(r * Math.cos(angle)),
    y: FIELD.GROUND_Y + 21,
    z: Math.round(r * Math.sin(angle)),
  };
}
