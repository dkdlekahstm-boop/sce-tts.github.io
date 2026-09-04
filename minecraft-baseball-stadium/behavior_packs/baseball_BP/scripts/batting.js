/**
 * 타격 판정.
 *
 * 스윙 신호는 world.afterEvents.entityHitEntity (배트를 든 플레이어가 sce:baseball을
 * 공격)로 받는다. 다만 실제 결과(헛스윙/파울/땅볼/뜬공/안타 등급)는 "공을 물리적으로
 * 맞췄는가"가 아니라 스윙 시점과 이상적 타격 시점의 틱 차이(타이밍) + 코스 + 구종 +
 * 확률로 계산한다. Bedrock에는 배트-공 충돌의 물리적 접촉면/파워를 계산해주는 배팅
 * 물리 엔진이 없기 때문에, entityHitEntity는 "플레이어가 이 타이밍에 스윙을 시도했다"는
 * 신호로만 쓰고 실제 결과는 수학적으로 산출한다 (docs/DESIGN.md 3장 참고).
 */
import { world, system } from "@minecraft/server";
import { FIELD } from "./constants.js";
import { state, PHASE } from "./state.js";
import { clock } from "./ticks.js";
import { recordPitchResult } from "./rules.js";
import { resolveBattedBall } from "./fielding.js";
import { title } from "./ui.js";

const DEG = Math.PI / 180;
function fenceRadiusAt(directionDeg) {
  return FIELD.OUTFIELD_R_LINE + (FIELD.OUTFIELD_R_CENTER - FIELD.OUTFIELD_R_LINE) * Math.sin(directionDeg * DEG);
}

function isBatterAttacker(attacker) {
  const b = state.currentBatter;
  if (!b) return false;
  if (b.kind === "human") return attacker?.typeId === "minecraft:player" && attacker.id === b.player.id;
  return false; // NPC 타자는 이벤트가 아니라 triggerNpcSwing()으로 처리
}

function isHoldingBat(player) {
  try {
    const inv = player.getComponent("minecraft:inventory");
    const item = inv.container.getItem(player.selectedSlotIndex);
    return item?.typeId === "sce:baseball_bat";
  } catch (e) {
    return false;
  }
}

function classifyContact(quality, course, pitchType, rng = Math.random) {
  if (quality < 0.15) return { type: "MISS" };
  if (quality < 0.35) {
    if (rng() < 0.55) return { type: "FOUL" };
    quality = 0.3; // 빗맞은 땅볼
  }

  const launch = course.dy * 0.5 + (rng() * 2 - 1) * 0.6;
  let battedType;
  if (launch < -0.35) battedType = "GROUND";
  else if (launch < 0.15) battedType = "LINE";
  else if (launch < 0.75) battedType = "FLY";
  else battedType = "POPUP";

  const dirSeed = rng() * 2 - 1;
  let direction = 45 + course.dx * 30 + dirSeed * 18;
  direction = Math.min(88, Math.max(2, direction));
  // 파울라인에 아주 가깝게 당겨/밀어친 타구는 파울로 처리한다.
  if (direction <= 4 || direction >= 86) return { type: "FOUL" };

  const powerFactor = quality * (0.8 + rng() * 0.35) * (pitchType.id === "FASTBALL" ? 1.05 : 1.0);
  let distance;
  switch (battedType) {
    case "GROUND":
      distance = 10 + powerFactor * 32; // 아주 잘 맞은 강한 땅볼은 내야를 뚫고 나가기도 한다
      break;
    case "LINE":
      distance = 20 + powerFactor * 55;
      break;
    case "FLY":
      distance = 25 + powerFactor * 75;
      break;
    default: // POPUP
      distance = 6 + powerFactor * 18;
  }

  // 홈런은 아주 좋은 컨택트(quality>0.88)의 FLY/LINE 타구가 추가로 낮은 확률(22%)까지
  // 통과해야만 허용한다. 그 관문을 통과하지 못하면 펜스 근처(트랙 부근)로 거리를 눌러서
  // "펜스 직격 장타"가 되게 한다 — 이 게이트가 없으면 강하게 맞은 뜬공은 거의 항상 펜스를
  // 넘겨버려 "홈런이 너무 자주 나오지 않게" 요구사항을 어기게 된다.
  const homerunGate = (battedType === "FLY" || battedType === "LINE") && quality > 0.88 && rng() < 0.22;
  const fenceR = fenceRadiusAt(direction);
  if (!homerunGate && distance >= fenceR - 6) {
    distance = fenceR - 6 - rng() * 20;
  }
  const hangtimeTicks = battedType === "GROUND" ? 6 + rng() * 4 : 14 + distance / 8 + rng() * 6;

  return { type: "CONTACT", battedType, distance, direction, hangtimeTicks, quality };
}

export function computeResult(timingDiffTicks, pitch) {
  const controlPenalty = 1 - pitch.pitchType.control * 0.25;
  const baseQuality = Math.max(0, 1 - Math.abs(timingDiffTicks) / 7) * controlPenalty;
  return classifyContact(baseQuality, pitch.course, pitch.pitchType);
}

function dispatchResult(result, dimension, batterRunner) {
  if (result.type === "MISS") {
    const label = state.strikes + 1 >= 3 ? "" : "§7헛스윙!";
    if (label && batterRunner.kind === "human") title(batterRunner.player, label);
    recordPitchResult("strike");
    return;
  }
  if (result.type === "FOUL") {
    if (batterRunner.kind === "human") title(batterRunner.player, "§7FOUL");
    recordPitchResult("foul");
    return;
  }
  resolveBattedBall(dimension, result, batterRunner);
}

/** 사람 타자: 배트로 공을 스윙(공격)했을 때 호출 */
function onEntityHitEntity(ev) {
  const { damagingEntity, hitEntity } = ev;
  if (!hitEntity || hitEntity.typeId !== "sce:baseball") return;
  if (state.phase !== PHASE.BALL_IN_AIR) return;
  const pitch = state.pendingPitch;
  if (!pitch || pitch.resolved) return;
  if (!damagingEntity || damagingEntity.typeId !== "minecraft:player") return;
  if (!isBatterAttacker(damagingEntity)) return;
  if (!isHoldingBat(damagingEntity)) return;

  pitch.resolved = true;
  const timingDiff = clock.tick - pitch.idealContactTick;
  const result = computeResult(timingDiff, pitch);
  try {
    hitEntity.remove();
  } catch (e) {}
  state.currentBallEntity = null;
  state.phase = PHASE.PLAYING;
  dispatchResult(result, damagingEntity.dimension, state.currentBatter);
}

/** NPC 타자의 스윙을 흉내낸다. pitching.js가 매틱 호출해 스윙 타이밍이 되면 실행한다. */
export function triggerNpcSwing(pitch, dimension) {
  if (pitch.resolved) return;
  pitch.resolved = true;
  const timingDiff = clock.tick - pitch.idealContactTick; // npcSwingTick 자체가 이미 오차를 내포
  const result = computeResult(timingDiff, pitch);
  if (state.currentBallEntity) {
    try {
      state.currentBallEntity.remove();
    } catch (e) {}
    state.currentBallEntity = null;
  }
  state.phase = PHASE.PLAYING;
  dispatchResult(result, dimension, state.currentBatter);
}

export function init() {
  world.afterEvents.entityHitEntity.subscribe(onEntityHitEntity);
}
