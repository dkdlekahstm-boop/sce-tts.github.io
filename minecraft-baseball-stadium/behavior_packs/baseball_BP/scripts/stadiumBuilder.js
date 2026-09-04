/**
 * 경기장 절차적 생성기.
 *
 * 왜 명령어 텍스트를 대량 하드코딩하지 않고 절차적으로 생성하는가?
 * - 반경 60~100블록급 타원형 외야/스탠드를 블록 하나하나 setblock으로 적으면
 *   수만 줄이 필요해 유지보수가 불가능하다.
 * - 대신 이 파일이 "행(row)/각도(angle) 단위로 fill 명령을 계산"해서 실행 시점에
 *   생성한다. 원/타원 채우기라도 반지름 개수(≈80~180개) 만큼의 fill 명령이면
 *   충분해서 실제로 가볍다.
 * - 대량의 dimension.runCommand 호출을 한 틱에 몰아서 실행하면 모바일에서 프레임이
 *   끊기므로, 안정 API인 system.runJob(제너레이터)으로 여러 틱에 걸쳐 분산 실행한다.
 *   (system.runJob은 정확히 이런 "무거운 월드 편집을 백그라운드로 분산 처리"용으로
 *   제공되는 문서화된 안정 API다.)
 * - fill 은 1회 호출당 처리 가능한 블록 수 제한(32768)이 있어 chunkedFill()이
 *   Y축 방향으로 자동 분할한다.
 */
import { system } from "@minecraft/server";
import { FIELD, scoreboardAnchor } from "./constants.js";

const FILL_LIMIT = 32768;
const DEG = Math.PI / 180;

function fillCmd(x1, y1, z1, x2, y2, z2, block) {
  return `fill ${x1} ${y1} ${z1} ${x2} ${y2} ${z2} ${block}`;
}

function chunkedFill(x1, y1, z1, x2, y2, z2, block, out) {
  const ax1 = Math.min(x1, x2), ax2 = Math.max(x1, x2);
  const ay1 = Math.min(y1, y2), ay2 = Math.max(y1, y2);
  const az1 = Math.min(z1, z2), az2 = Math.max(z1, z2);
  const layerVol = (ax2 - ax1 + 1) * (az2 - az1 + 1);
  const maxYPerChunk = Math.max(1, Math.floor(FILL_LIMIT / layerVol));
  for (let y = ay1; y <= ay2; y += maxYPerChunk) {
    const yTop = Math.min(ay2, y + maxYPerChunk - 1);
    out.push(fillCmd(ax1, y, az1, ax2, yTop, az2, block));
  }
}

function setCmd(x, y, z, block, out) {
  out.push(`setblock ${Math.round(x)} ${Math.round(y)} ${Math.round(z)} ${block}`);
}

/** 홈플레이트를 원점으로, 파울라인(0°=1루측, 90°=3루측) 사이 외야 펜스 반지름 */
function polarR(thetaDeg) {
  return FIELD.OUTFIELD_R_LINE + (FIELD.OUTFIELD_R_CENTER - FIELD.OUTFIELD_R_LINE) * Math.sin(thetaDeg * DEG);
}

function buildFlattenCmds() {
  const out = [];
  chunkedFill(-45, FIELD.GROUND_Y - 3, -45, 115, FIELD.GROUND_Y - 1, 115, "minecraft:stone", out);
  chunkedFill(-45, FIELD.GROUND_Y, -45, 115, FIELD.GROUND_Y + 36, 115, "minecraft:air", out);
  return out;
}

function buildOutfieldCmds() {
  const out = [];
  const Rc = Math.ceil(FIELD.OUTFIELD_R_CENTER);
  for (let x = 0; x <= Rc; x++) {
    let zMax = -1;
    for (let z = 0; z <= Rc; z++) {
      const theta = Math.atan2(z, x) / DEG;
      const dist = Math.hypot(x, z);
      if (dist <= polarR(theta)) zMax = z; else if (zMax >= 0) break;
    }
    if (zMax >= 0) out.push(fillCmd(x, FIELD.GROUND_Y, 0, x, FIELD.GROUND_Y, zMax, "minecraft:grass_block"));
  }
  return out;
}

function buildInfieldCmds() {
  const out = [];
  chunkedFill(-6, FIELD.GROUND_Y, -6, 33, FIELD.GROUND_Y, 33, "minecraft:dirt", out);
  chunkedFill(4, FIELD.GROUND_Y, 4, 23, FIELD.GROUND_Y, 23, "minecraft:grass_block", out);
  // 마운드 (작은 둔덕 + 투수판)
  chunkedFill(11, FIELD.GROUND_Y, 11, 15, FIELD.GROUND_Y, 15, "minecraft:dirt", out);
  chunkedFill(12, FIELD.GROUND_Y + 1, 12, 14, FIELD.GROUND_Y + 1, 14, "minecraft:dirt", out);
  setCmd(FIELD.MOUND.x, FIELD.GROUND_Y + 1, FIELD.MOUND.z, "minecraft:light_gray_concrete", out);
  // 베이스
  setCmd(FIELD.FIRST.x, FIELD.GROUND_Y, FIELD.FIRST.z, "minecraft:white_concrete", out);
  setCmd(FIELD.SECOND.x, FIELD.GROUND_Y, FIELD.SECOND.z, "minecraft:white_concrete", out);
  setCmd(FIELD.THIRD.x, FIELD.GROUND_Y, FIELD.THIRD.z, "minecraft:white_concrete", out);
  chunkedFill(FIELD.HOME.x - 1, FIELD.GROUND_Y, FIELD.HOME.z - 1, FIELD.HOME.x, FIELD.GROUND_Y, FIELD.HOME.z, "minecraft:white_concrete", out);
  // 파울라인
  chunkedFill(1, FIELD.GROUND_Y, 0, FIELD.OUTFIELD_R_LINE, FIELD.GROUND_Y, 0, "minecraft:white_concrete", out);
  chunkedFill(0, FIELD.GROUND_Y, 1, 0, FIELD.GROUND_Y, FIELD.OUTFIELD_R_LINE, "minecraft:white_concrete", out);
  // 타석
  chunkedFill(-3, FIELD.GROUND_Y, -2, -2, FIELD.GROUND_Y, 0, "minecraft:light_gray_concrete", out);
  chunkedFill(1, FIELD.GROUND_Y, -2, 2, FIELD.GROUND_Y, 0, "minecraft:light_gray_concrete", out);
  return out;
}

function buildBackstopCmds() {
  const out = [];
  const back = { x: -Math.SQRT1_2, z: -Math.SQRT1_2 };
  const perp = { x: Math.SQRT1_2, z: -Math.SQRT1_2 };
  const center = { x: FIELD.HOME.x + back.x * 6, z: FIELD.HOME.z + back.z * 6 };
  for (let t = -8; t <= 8; t += 1) {
    const x = Math.round(center.x + perp.x * t);
    const z = Math.round(center.z + perp.z * t);
    chunkedFill(x, FIELD.GROUND_Y, z, x, FIELD.GROUND_Y + 5, z, "minecraft:iron_bars", out);
  }
  return out;
}

function buildDugoutCmds(bounds, openSide) {
  const out = [];
  const { min, max } = bounds;
  chunkedFill(min.x + 1, min.y + 1, min.z + 1, max.x - 1, max.y - 1, max.z - 1, "minecraft:air", out);
  chunkedFill(min.x, min.y, min.z, max.x, min.y, max.z, "minecraft:light_gray_concrete", out);
  chunkedFill(min.x, min.y, min.z, max.x, max.y, max.z, "minecraft:stone_bricks", out); // 전체 벽/바닥 뼈대
  chunkedFill(min.x + 1, min.y + 1, min.z + 1, max.x - 1, max.y - 1, max.z - 1, "minecraft:air", out); // 내부 다시 비움
  if (openSide === "x") {
    chunkedFill(max.x, min.y + 1, min.z, max.x, max.y - 1, max.z, "minecraft:air", out); // 필드쪽 개방
  } else {
    chunkedFill(min.x, min.y + 1, max.z, max.x, max.y - 1, max.z, "minecraft:air", out);
  }
  chunkedFill(min.x, max.y, min.z, max.x, max.y, max.z, "minecraft:stone_bricks", out); // 지붕
  return out;
}

function buildBullpenCmds() {
  const out = [];
  const spots = [
    { x: -24, z: -4 }, { x: -24, z: 2 }, // 홈팀 불펜
    { x: -4, z: -24 }, { x: 2, z: -24 }, // 원정팀 불펜
  ];
  for (const s of spots) {
    chunkedFill(s.x - 1, FIELD.GROUND_Y, s.z - 1, s.x + 1, FIELD.GROUND_Y, s.z + 1, "minecraft:dirt", out);
    setCmd(s.x, FIELD.GROUND_Y, s.z, "minecraft:light_gray_concrete", out);
  }
  return out;
}

function buildFenceCmds() {
  const out = [];
  let prev = null;
  for (let theta = 0; theta <= 90; theta += 1.2) {
    const r = polarR(theta);
    const x = Math.round(r * Math.cos(theta * DEG));
    const z = Math.round(r * Math.sin(theta * DEG));
    if (prev) {
      const steps = Math.max(1, Math.ceil(Math.hypot(x - prev.x, z - prev.z)));
      for (let s = 0; s <= steps; s++) {
        const lx = Math.round(prev.x + (x - prev.x) * (s / steps));
        const lz = Math.round(prev.z + (z - prev.z) * (s / steps));
        chunkedFill(lx, FIELD.GROUND_Y, lz, lx, FIELD.GROUND_Y + 2, lz, "minecraft:blue_concrete", out);
        for (let d = 1; d <= 3; d++) {
          const tr = Math.max(0, r - d);
          const tx = Math.round(tr * Math.cos(theta * DEG));
          const tz = Math.round(tr * Math.sin(theta * DEG));
          setCmd(tx, FIELD.GROUND_Y, tz, "minecraft:coarse_dirt", out);
        }
      }
    }
    prev = { x, z };
  }
  return out;
}

function buildFoulPoleCmds() {
  const out = [];
  chunkedFill(FIELD.OUTFIELD_R_LINE, FIELD.GROUND_Y, 0, FIELD.OUTFIELD_R_LINE, FIELD.GROUND_Y + 12, 0, "minecraft:yellow_concrete", out);
  chunkedFill(0, FIELD.GROUND_Y, FIELD.OUTFIELD_R_LINE, 0, FIELD.GROUND_Y + 12, FIELD.OUTFIELD_R_LINE, "minecraft:yellow_concrete", out);
  return out;
}

function buildStandsCmds() {
  const out = [];
  for (let tier = 0; tier < FIELD.STANDS_TIERS; tier++) {
    const ringR = FIELD.STANDS_INNER_R + tier * FIELD.STANDS_TIER_WIDTH;
    const topY = FIELD.GROUND_Y + 1 + tier * FIELD.STANDS_TIER_HEIGHT;
    for (let angle = 0; angle < 360; angle += 3) {
      if (angle >= 250 && angle <= 290) continue; // 출입구 통로 확보
      const band = Math.floor(angle / 9) % 2 === 0 ? "minecraft:light_blue_concrete" : "minecraft:white_concrete";
      const x = Math.round(ringR * Math.cos(angle * DEG));
      const z = Math.round(ringR * Math.sin(angle * DEG));
      chunkedFill(x, FIELD.GROUND_Y, z, x, topY, z, band, out);
    }
  }
  return out;
}

function buildLightTowerCmds() {
  const out = [];
  for (let k = 0; k < FIELD.LIGHT_TOWER_COUNT; k++) {
    const angle = (360 / FIELD.LIGHT_TOWER_COUNT) * k;
    const x = Math.round(FIELD.LIGHT_TOWER_R * Math.cos(angle * DEG));
    const z = Math.round(FIELD.LIGHT_TOWER_R * Math.sin(angle * DEG));
    chunkedFill(x, FIELD.GROUND_Y, z, x, FIELD.GROUND_Y + FIELD.LIGHT_TOWER_HEIGHT, z, "minecraft:quartz_block", out);
    const topY = FIELD.GROUND_Y + FIELD.LIGHT_TOWER_HEIGHT + 1;
    setCmd(x, topY, z, "minecraft:glowstone", out);
    setCmd(x + 1, topY, z, "minecraft:glowstone", out);
    setCmd(x - 1, topY, z, "minecraft:glowstone", out);
    setCmd(x, topY, z + 1, "minecraft:glowstone", out);
    setCmd(x, topY, z - 1, "minecraft:glowstone", out);
  }
  return out;
}

function buildScoreboardWallCmds() {
  const out = [];
  const { x: ax, z: az } = scoreboardAnchor();
  const y0 = FIELD.GROUND_Y + 15;
  const y1 = FIELD.GROUND_Y + 27;
  chunkedFill(ax, y0 - 1, az - 11, ax, y1 + 1, az + 11, "minecraft:light_gray_concrete", out); // 테두리
  chunkedFill(ax, y0, az - 10, ax, y1, az + 10, "minecraft:black_concrete", out); // 화면
  return out;
}

function* runBatched(dimension, commands, batch = 10) {
  for (let i = 0; i < commands.length; i += batch) {
    const end = Math.min(i + batch, commands.length);
    for (let j = i; j < end; j++) {
      try {
        dimension.runCommand(commands[j]);
      } catch (e) {
        // 이미 로드되지 않은 청크 등 일시적 실패는 무시하고 계속 진행
      }
    }
    yield;
  }
}

function* buildStadiumJob(dimension, onDone) {
  yield* runBatched(dimension, buildFlattenCmds());
  yield* runBatched(dimension, buildOutfieldCmds());
  yield* runBatched(dimension, buildInfieldCmds());
  yield* runBatched(dimension, buildBackstopCmds());
  yield* runBatched(dimension, buildDugoutCmds(FIELD.HOME_DUGOUT, "x"));
  yield* runBatched(dimension, buildDugoutCmds(FIELD.AWAY_DUGOUT, "z"));
  yield* runBatched(dimension, buildBullpenCmds());
  yield* runBatched(dimension, buildFenceCmds());
  yield* runBatched(dimension, buildFoulPoleCmds());
  yield* runBatched(dimension, buildStandsCmds());
  yield* runBatched(dimension, buildLightTowerCmds());
  yield* runBatched(dimension, buildScoreboardWallCmds());
  if (onDone) onDone();
}

/** 경기장을 절차적으로 생성한다. 여러 틱에 걸쳐 백그라운드로 실행된다 (system.runJob). */
export function buildStadium(dimension, onDone) {
  system.runJob(buildStadiumJob(dimension, onDone));
}
