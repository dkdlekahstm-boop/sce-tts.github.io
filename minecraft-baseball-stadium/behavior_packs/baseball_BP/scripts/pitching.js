/**
 * 투구 시스템.
 *
 * 공은 실제 물리엔진(중력 컴포넌트)이 아니라 이 파일이 매틱 위치를 계산해
 * entity.teleport() 로 옮기는 "스크립트 기반 운동학"으로 움직인다 (엔티티 정의에서
 * has_gravity/has_collision을 꺼둔 이유). 이렇게 해야 구종별 낙차/변화량을 정확하게
 * 재현하고, 스트라이크존 판정 시점도 정확히 알 수 있다.
 */
import { world, system, ItemStack } from "@minecraft/server";
import { FIELD, PITCH_TYPES, COURSES, STRIKE_ZONE } from "./constants.js";
import { state, PHASE } from "./state.js";
import { clock } from "./ticks.js";
import { recordPitchResult } from "./rules.js";
import { triggerNpcSwing } from "./batting.js";
import { showChoice, title, actionBar } from "./ui.js";
import { pitcherIntroShot } from "./camera.js";

const PITCH_TYPE_KEYS = Object.keys(PITCH_TYPES);
const COURSE_KEYS = Object.keys(COURSES);
const COURSE_LABELS = {
  HIGH_IN: "높은 몸쪽", HIGH_MID: "높은 가운데", HIGH_OUT: "높은 바깥쪽",
  MID_IN: "가운데 몸쪽", MID_MID: "한가운데", MID_OUT: "가운데 바깥쪽",
  LOW_IN: "낮은 몸쪽", LOW_MID: "낮은 가운데", LOW_OUT: "낮은 바깥쪽",
};

function isHoldingSelector(player) {
  try {
    const inv = player.getComponent("minecraft:inventory");
    const item = inv.container.getItem(player.selectedSlotIndex);
    return item?.typeId === "sce:pitch_selector";
  } catch (e) {
    return false;
  }
}

/** 이번 타석의 투수를 준비시킨다 (사람이면 아이템 지급/안내, NPC면 자동 투구 예약) */
export function preparePitcher(dimension) {
  state.phase = PHASE.PITCH_READY;
  const ref = state.pitcherRef;
  if (!ref) return;
  if (ref.kind === "human") {
    try {
      const inv = ref.player.getComponent("minecraft:inventory");
      inv.container.setItem(0, new ItemStack("sce:pitch_selector", 1));
      ref.player.selectedSlotIndex = 0;
    } catch (e) {}
    actionBar(ref.player, "§e투구 콜러 아이템을 사용해 구종을 선택하세요");
    pitcherIntroShot(ref.player, FIELD.MOUND);
  } else {
    const delay = 20 + Math.floor(Math.random() * 20);
    system.runTimeout(() => {
      if (state.phase !== PHASE.PITCH_READY) return;
      const t = PITCH_TYPE_KEYS[Math.floor(Math.random() * PITCH_TYPE_KEYS.length)];
      const c = COURSE_KEYS[Math.floor(Math.random() * COURSE_KEYS.length)];
      throwPitch(dimension, t, c);
    }, delay);
  }
}

export async function openPitchMenu(player, dimension) {
  if (state.phase !== PHASE.PITCH_READY) return;
  const typeIdx = await showChoice(
    player,
    "구종 선택",
    "던질 구종을 고르세요",
    PITCH_TYPE_KEYS.map((k) => PITCH_TYPES[k].name)
  );
  if (typeIdx === null || state.phase !== PHASE.PITCH_READY) return;
  const courseIdx = await showChoice(
    player,
    "코스 선택",
    "던질 코스를 고르세요",
    COURSE_KEYS.map((k) => COURSE_LABELS[k])
  );
  if (courseIdx === null || state.phase !== PHASE.PITCH_READY) return;
  throwPitch(dimension, PITCH_TYPE_KEYS[typeIdx], COURSE_KEYS[courseIdx]);
}

export function throwPitch(dimension, pitchTypeKey, courseKey) {
  if (state.phase !== PHASE.PITCH_READY) return;
  const pitchType = PITCH_TYPES[pitchTypeKey];
  const course = COURSES[courseKey];
  const mound = FIELD.MOUND;
  const home = FIELD.HOME;
  const dx = home.x - mound.x;
  const dz = home.z - mound.z;
  const dist = Math.hypot(dx, dz);
  const dirX = dx / dist;
  const dirZ = dz / dist;
  const perpX = -dirZ;
  const perpZ = dirX;

  const speedPerTick = pitchType.speedBps / 20;
  const travelTicks = Math.max(4, Math.round(dist / speedPerTick));
  const wobble = pitchType.control;

  const zoneCenterY = FIELD.GROUND_Y + (STRIKE_ZONE.bottom + STRIKE_ZONE.top) / 2;
  const zoneHalfH = (STRIKE_ZONE.top - STRIKE_ZONE.bottom) / 2;
  const targetY = zoneCenterY + course.dy * zoneHalfH + (Math.random() * 2 - 1) * wobble * 0.4;
  const lateralOffset = course.dx * STRIKE_ZONE.halfWidth * 1.6 + (Math.random() * 2 - 1) * wobble;

  const releaseY = mound.y + 1.6;
  const startPos = { x: mound.x, y: releaseY, z: mound.z };

  let ballEntity;
  try {
    ballEntity = dimension.spawnEntity("sce:baseball", startPos);
  } catch (e) {
    return;
  }

  state.pendingPitch = {
    pitchType,
    course,
    releaseTick: clock.tick,
    travelTicks,
    idealContactTick: clock.tick + travelTicks,
    mound: startPos,
    target: { x: home.x, y: targetY, z: home.z },
    dirX, dirZ, perpX, perpZ, lateralOffset,
    resolved: false,
    npcSwingTick: null,
  };

  if (state.currentBatter?.kind === "npc") {
    const skillJitter = Math.round((Math.random() * 2 - 1) * (2 + pitchType.control * 6));
    state.pendingPitch.npcSwingTick = Math.random() < 0.12 ? null : state.pendingPitch.idealContactTick + skillJitter;
  }

  state.currentBallEntity = ballEntity;
  state.phase = PHASE.BALL_IN_AIR;
}

/** main.js의 매틱 루프에서 호출 */
export function tickBall(dimension) {
  const p = state.pendingPitch;
  const ball = state.currentBallEntity;
  if (!p || !ball || p.resolved || state.phase !== PHASE.BALL_IN_AIR) return;

  const elapsed = clock.tick - p.releaseTick;
  const f = Math.min(1, elapsed / p.travelTicks);
  const linX = p.mound.x + (p.target.x - p.mound.x) * f + p.perpX * p.lateralOffset * f;
  const linZ = p.mound.z + (p.target.z - p.mound.z) * f + p.perpZ * p.lateralOffset * f;
  const linY = p.mound.y + (p.target.y - p.mound.y) * f;
  const curveMag = p.pitchType.curveX * elapsed * elapsed * 0.015;
  const x = linX + p.perpX * curveMag;
  const z = linZ + p.perpZ * curveMag;
  const y = linY - p.pitchType.gravity * elapsed * elapsed * 0.01;

  try {
    ball.teleport({ x, y, z }, { facingLocation: FIELD.HOME });
  } catch (e) {}

  if (p.npcSwingTick != null && clock.tick >= p.npcSwingTick) {
    triggerNpcSwing(p, dimension);
    return;
  }

  if (elapsed >= p.travelTicks) {
    p.resolved = true;
    const lateral = (x - FIELD.HOME.x) * p.perpX + (z - FIELD.HOME.z) * p.perpZ;
    const inZone = Math.abs(lateral) <= STRIKE_ZONE.halfWidth && y >= FIELD.GROUND_Y + STRIKE_ZONE.bottom && y <= FIELD.GROUND_Y + STRIKE_ZONE.top;
    try {
      ball.remove();
    } catch (e) {}
    state.currentBallEntity = null;
    state.phase = PHASE.PLAYING;
    if (state.currentBatter?.kind === "human") {
      title(state.currentBatter.player, inZone ? "§cSTRIKE" : "§9BALL");
    }
    recordPitchResult(inZone ? "strike" : "ball");
  }
}

export function init() {
  world.afterEvents.itemUse.subscribe((ev) => {
    if (ev.itemStack?.typeId !== "sce:pitch_selector") return;
    const player = ev.source;
    if (!isHoldingSelector(player)) return;
    if (state.pitcherRef?.kind !== "human" || state.pitcherRef.player.id !== player.id) return;
    openPitchMenu(player, player.dimension);
  });
}
