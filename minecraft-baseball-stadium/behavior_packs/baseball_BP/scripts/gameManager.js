/**
 * 로비/인원선택/팀선택부터 이닝 전환, 승부 종료까지 전체 경기 흐름을 조율한다.
 * 다른 시스템(pitching/batting/fielding/baserunning/rules)은 "지금 무슨 일이 있었는지"만
 * 콜백으로 알려주고, "다음에 뭘 해야 하는지"는 전부 이 파일이 결정한다.
 */
import { world, system, ItemStack } from "@minecraft/server";
import { FIELD, FIELDING_POSITIONS, POSITION_ORDER, DUGOUT_BENCH, TAGS, GAME } from "./constants.js";
import { state, PHASE, battingTeam, fieldingTeam, resetForNewGame, resetCount } from "./state.js";
import { recordRuns, onAfterAtBat } from "./rules.js";
import { advanceOnWalk, clearBases } from "./baserunning.js";
import { onAfterPlay } from "./fielding.js";
import { preparePitcher } from "./pitching.js";
import { spawnBillboard, updateBillboard, syncSidebar, initScoreboard } from "./scoreboard.js";
import { spawnCrowd } from "./crowd.js";
import { lerpWalk } from "./movement.js";
import { showChoice, title, actionBar } from "./ui.js";
import { stadiumIntro } from "./camera.js";

const LOBBY_SPAWN = { x: -30, y: FIELD.GROUND_Y, z: -30 };
const BATTER_BOX = { x: FIELD.HOME.x - 2, y: FIELD.GROUND_Y, z: FIELD.HOME.z - 1 };
const CATCHER_SPOT = { x: FIELD.HOME.x - 1, y: FIELD.GROUND_Y, z: FIELD.HOME.z - 3 };

let lobby = { numHumans: null, joined: [] };

function allHumans() {
  const list = [];
  for (const team of ["home", "away"]) {
    if (state.humans[team].batterPitcher) list.push(state.humans[team].batterPitcher);
    if (state.humans[team].catcher) list.push(state.humans[team].catcher);
  }
  return list;
}

function giveBat(player) {
  try {
    const inv = player.getComponent("minecraft:inventory");
    inv.container.setItem(0, new ItemStack("sce:baseball_bat", 1));
    player.selectedSlotIndex = 0;
  } catch (e) {}
}

function teleportSmooth(player, dest) {
  try {
    player.teleport(dest, { facingLocation: FIELD.MOUND });
  } catch (e) {}
}

// ---------------------------------------------------------------- 로비
export function spawnLobbyNpc(dimension) {
  try {
    const e = dimension.spawnEntity("sce:player_npc", LOBBY_SPAWN);
    e.nameTag = "§a§l게임 시작 (우클릭)";
    e.triggerEvent("sce:become_idle");
    e.addTag(TAGS.LOBBY_NPC);
  } catch (e) {}
}

async function handleLobbyJoin(player, dimension) {
  if (state.phase !== PHASE.LOBBY) {
    actionBar(player, "§c이미 경기가 진행 중입니다");
    return;
  }
  if (lobby.joined.find((j) => j.player.id === player.id)) return;

  if (lobby.numHumans === null) {
    const idx = await showChoice(player, "SCE 야구 경기장", "플레이 인원을 선택하세요", ["1인 플레이", "2인 플레이", "3인 플레이"]);
    if (idx === null) return;
    lobby.numHumans = idx + 1;
    world.sendMessage(`§a${lobby.numHumans}인 플레이로 설정되었습니다. 로비 NPC를 우클릭해 참가하세요 (0/${lobby.numHumans})`);
  }
  if (lobby.joined.length >= lobby.numHumans) {
    actionBar(player, "§c이미 정원이 찼습니다");
    return;
  }

  const teamIdx = await showChoice(player, "팀 선택", "홈팀 또는 원정팀을 선택하세요", ["§9홈팀 (HOME)", "§c원정팀 (AWAY)"]);
  if (teamIdx === null) return;
  const team = teamIdx === 0 ? "home" : "away";
  const role = state.humans[team].batterPitcher ? "catcher" : "batterPitcher";
  state.humans[team][role] = player;
  lobby.joined.push({ player, team, role });
  actionBar(player, `§a${team === "home" ? "홈팀" : "원정팀"} ${role === "catcher" ? "포수" : "타자/투수"}로 참가!`);

  if (lobby.joined.length >= lobby.numHumans) {
    state.numHumans = lobby.numHumans;
    startGame(dimension);
  } else {
    world.sendMessage(`§a${player.name}님 참가 (${lobby.joined.length}/${lobby.numHumans})`);
  }
}

// ---------------------------------------------------------------- 로스터 구성
function spawnAllFielders(dimension) {
  for (const team of ["home", "away"]) {
    for (const pos of POSITION_ORDER) {
      if (pos === "P" && state.humans[team].batterPitcher) continue;
      if (pos === "C" && state.humans[team].catcher) continue;
      const spot = FIELDING_POSITIONS[pos];
      try {
        const entity = dimension.spawnEntity("sce:player_npc", { x: spot.x, y: FIELD.GROUND_Y, z: spot.z });
        entity.triggerEvent(team === "home" ? "sce:set_team_home" : "sce:set_team_away");
        entity.triggerEvent("sce:become_idle");
        entity.nameTag = `${pos}`;
        entity.addTag(TAGS.MANAGED);
        state.fielderEntities[team][pos] = entity;
      } catch (e) {}
    }
  }
}

function buildLineups() {
  for (const team of ["home", "away"]) {
    state.lineup[team] = POSITION_ORDER.map((pos) => ({ position: pos, npc: state.fielderEntities[team][pos] ?? null }));
  }
}

function cleanupManagedEntities(dimension) {
  try {
    for (const e of dimension.getEntities({ tags: [TAGS.MANAGED] })) e.remove();
  } catch (e) {}
  state.fielderEntities = { home: {}, away: {} };
}

// ---------------------------------------------------------------- 경기 진행
function startGame(dimension) {
  resetForNewGame();
  state.numHumans = lobby.numHumans;
  state.phase = PHASE.ASSIGN;
  world.sendMessage("§6§l경기 준비 중...");
  spawnAllFielders(dimension);
  buildLineups();
  for (const p of allHumans()) stadiumIntro(p, FIELD.MOUND, FIELD.HOME);
  system.runTimeout(() => beginHalfInning(dimension, true), 50);
}

function positionDugoutSpot(team, i) {
  const bench = DUGOUT_BENCH[team];
  return bench[i % bench.length];
}

function beginHalfInning(dimension, isGameStart = false) {
  const fielding = fieldingTeam();
  const batting = battingTeam();

  POSITION_ORDER.forEach((pos, i) => {
    const battingNpc = state.fielderEntities[batting][pos];
    if (battingNpc) lerpWalk(battingNpc, positionDugoutSpot(batting, i), 30);
    const fieldingNpc = state.fielderEntities[fielding][pos];
    if (fieldingNpc) lerpWalk(fieldingNpc, FIELDING_POSITIONS[pos], 40);
  });

  const pitcherHuman = state.humans[fielding].batterPitcher;
  state.pitcherRef = pitcherHuman ? { kind: "human", player: pitcherHuman } : { kind: "npc", entity: state.fielderEntities[fielding].P };
  const catcherHuman = state.humans[fielding].catcher;
  state.catcherRef = catcherHuman ? { kind: "human", player: catcherHuman } : { kind: "npc", entity: state.fielderEntities[fielding].C };

  if (pitcherHuman) teleportSmooth(pitcherHuman, { x: FIELD.MOUND.x, y: FIELD.GROUND_Y, z: FIELD.MOUND.z });
  if (catcherHuman) teleportSmooth(catcherHuman, CATCHER_SPOT);

  clearBases();
  state.outs = 0;
  state.balls = 0;
  state.strikes = 0;
  syncSidebar();
  updateBillboard(`${state.inning}회 ${state.half === "TOP" ? "초" : "말"}`);

  if (isGameStart) {
    for (const p of allHumans()) title(p, "§6§lPLAY BALL!");
  }

  system.runTimeout(() => nextBatter(dimension), 20);
}

function nextBatter(dimension) {
  if (state.phase === PHASE.GAME_OVER) return;
  const battingKey = battingTeam();
  const idx = state.battingIndex[battingKey];
  const slot = state.lineup[battingKey][idx];
  state.battingIndex[battingKey] = (idx + 1) % POSITION_ORDER.length;

  const humanBatter = state.humans[battingKey].batterPitcher;
  if (humanBatter) {
    state.currentBatter = { kind: "human", player: humanBatter };
    giveBat(humanBatter);
    teleportSmooth(humanBatter, BATTER_BOX);
    title(humanBatter, `§f${idx + 1}번 타자 (${slot.position})`, "당신 차례입니다!");
  } else {
    const npc = slot.npc;
    state.currentBatter = { kind: "npc", entity: npc };
    if (npc) lerpWalk(npc, BATTER_BOX, 20);
  }

  state.phase = PHASE.PLAYING;
  system.runTimeout(() => preparePitcher(dimension), 26);
}

function isWalkoff() {
  return state.half === "BOTTOM" && state.inning >= GAME.INNINGS && state.score.home > state.score.away;
}

function endGame(dimension) {
  state.phase = PHASE.GAME_OVER;
  const winner = state.score.home > state.score.away ? "홈팀" : state.score.away > state.score.home ? "원정팀" : "무승부";
  updateBillboard(`§l${winner} 승리! ${state.score.home}:${state.score.away}`);
  for (const p of allHumans()) title(p, `§6${winner} 승리!`, `${state.score.home} : ${state.score.away}`);
  world.sendMessage(`§6§l경기 종료 - ${winner} (${state.score.home}:${state.score.away})`);
  system.runTimeout(() => {
    cleanupManagedEntities(dimension);
    resetForNewGame();
    lobby = { numHumans: null, joined: [] };
    world.sendMessage("§a로비로 돌아갑니다. 다시 시작하려면 로비 NPC를 우클릭하세요.");
  }, 200);
}

function afterHalfInningOuts(dimension) {
  if (state.half === "TOP") {
    state.half = "BOTTOM";
  } else {
    if (state.inning >= GAME.INNINGS && state.score.home !== state.score.away) return endGame(dimension);
    state.inning++;
    state.half = "TOP";
  }
  system.runTimeout(() => beginHalfInning(dimension), 60);
}

function afterAnyPlay(dimension, inningOver) {
  resetCount(); // 타석 종료 사유(볼넷/삼진/타구 판정)와 무관하게 카운트는 항상 초기화
  syncSidebar();
  if (isWalkoff()) return endGame(dimension);
  if (inningOver) return afterHalfInningOuts(dimension);
  system.runTimeout(() => nextBatter(dimension), 30);
}

/**
 * 로비 NPC 상호작용 없이, 월드에 들어오면 바로 경기가 시작되도록 하는 자동 시작.
 * 이미 접속해 있는 플레이어가 있으면(경기장 생성을 기다리던 그 플레이어) 그 사람을
 * 홈팀 타자/투수로 자동 배정해 1인 플레이로 즉시 시작한다. 이후 새로 들어오는
 * 플레이어를 위해 playerSpawn 이벤트도 함께 구독해둔다(같은 로직 재사용).
 * 로비 NPC(우클릭으로 인원/팀을 직접 고르는 방식)는 그대로 남겨뒀으니, 자동 시작 전에
 * NPC로 먼저 2인/3인 플레이를 설정해두면 그 설정이 우선한다.
 */
function autoStartSolo(player, dimension) {
  if (state.phase !== PHASE.LOBBY) return;
  if (lobby.numHumans !== null) return; // 이미 누군가 로비 NPC로 인원을 설정한 경우 존중
  lobby.numHumans = 1;
  state.humans.home.batterPitcher = player;
  lobby.joined.push({ player, team: "home", role: "batterPitcher" });
  actionBar(player, "§a혼자 플레이 - 홈팀으로 자동 시작!");
  startGame(dimension);
}

function tryAutoStart(dimension) {
  const players = world.getAllPlayers();
  if (players.length === 0) return;
  system.runTimeout(() => autoStartSolo(players[0], dimension), 40);
}

// ---------------------------------------------------------------- init
export function init(dimension) {
  initScoreboard();
  spawnBillboard(dimension);
  spawnCrowd(dimension);
  spawnLobbyNpc(dimension);

  world.afterEvents.playerInteractWithEntity.subscribe((ev) => {
    if (!ev.target?.hasTag?.(TAGS.LOBBY_NPC)) return;
    handleLobbyJoin(ev.player, dimension);
  });

  world.afterEvents.playerSpawn.subscribe((ev) => {
    if (!ev.initialSpawn) return;
    system.runTimeout(() => autoStartSolo(ev.player, dimension), 40);
  });

  onAfterPlay(({ inningOver }) => afterAnyPlay(dimension, inningOver));

  onAfterAtBat(({ reason, inningOver }) => {
    if (reason === "WALK") {
      const runs = advanceOnWalk(dimension, state.currentBatter);
      if (runs > 0) recordRuns(runs);
    }
    afterAnyPlay(dimension, inningOver);
  });

  tryAutoStart(dimension); // 경기장 생성을 기다리던 플레이어가 이미 접속해 있는 경우
}
