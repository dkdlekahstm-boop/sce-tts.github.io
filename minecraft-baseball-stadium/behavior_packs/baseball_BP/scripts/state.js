/**
 * 경기 전체에서 공유하는 단일 상태 객체.
 * 스크립트 프로세스가 살아있는 동안 메모리에 유지된다(한 세션 내 재로드 없이 지속).
 * 화면에 보여줘야 하는 숫자(점수/이닝/볼/스트라이크/아웃)는 scoreboard.js가 매 변경마다
 * world.scoreboard 오브젝티브에도 동기화해서, 사이드바 표시와 서버 재시작 내구성을 함께 챙긴다.
 */
import { POSITION_ORDER } from "./constants.js";

export const PHASE = {
  LOBBY: "LOBBY",
  ASSIGN: "ASSIGN",
  PLAYING: "PLAYING",
  PITCH_READY: "PITCH_READY",
  BALL_IN_AIR: "BALL_IN_AIR",
  BALL_IN_PLAY: "BALL_IN_PLAY",
  INNING_BREAK: "INNING_BREAK",
  GAME_OVER: "GAME_OVER",
};

function emptyLineup() {
  return POSITION_ORDER.map((pos) => ({ position: pos, npc: null }));
}

export const state = {
  phase: PHASE.LOBBY,
  numHumans: 1,
  humans: {
    home: { batterPitcher: null, catcher: null },
    away: { batterPitcher: null, catcher: null },
  },
  inning: 1,
  half: "TOP", // TOP = 원정 공격, BOTTOM = 홈 공격
  outs: 0,
  balls: 0,
  strikes: 0,
  score: { home: 0, away: 0 },
  bases: { first: null, second: null, third: null }, // null | { kind:'human', player } | { kind:'npc', entity }
  lineup: { home: emptyLineup(), away: emptyLineup() },
  battingIndex: { home: 0, away: 0 },
  fielderEntities: { home: {}, away: {} }, // position -> entity (NPC만 관리)
  pitcherRef: null, // {kind:'human'|'npc', player|entity}
  catcherRef: null,
  currentBatter: null, // {kind:'human'|'npc', player|entity}
  currentBallEntity: null,
  pendingPitch: null, // { pitchType, course, releaseTick, idealContactTick, npcSwingTick, resolved }
  lastEvent: "",
};

export function battingTeam() {
  return state.half === "TOP" ? "away" : "home";
}
export function fieldingTeam() {
  return state.half === "TOP" ? "home" : "away";
}

export function resetForNewGame() {
  state.phase = PHASE.LOBBY;
  state.inning = 1;
  state.half = "TOP";
  state.outs = 0;
  state.balls = 0;
  state.strikes = 0;
  state.score = { home: 0, away: 0 };
  state.bases = { first: null, second: null, third: null };
  state.lineup = { home: emptyLineup(), away: emptyLineup() };
  state.battingIndex = { home: 0, away: 0 };
  state.fielderEntities = { home: {}, away: {} };
  state.pitcherRef = null;
  state.catcherRef = null;
  state.currentBatter = null;
  state.currentBallEntity = null;
  state.pendingPitch = null;
}

export function resetCount() {
  state.balls = 0;
  state.strikes = 0;
}
