/**
 * 타구 판정(수비) 시스템.
 *
 * 설계 핵심: "수비수가 실제로 제시간에 도착했는가"의 최종 판정은 NPC 길찾기의
 * 실시간 도착 여부에 의존하지 않는다. Bedrock의 behavior 기반 내비게이션은 지형/다른
 * 엔티티 상황에 따라 도착 시간이 들쭉날쭉해서, 그걸 판정 기준으로 삼으면 같은 상황에서
 * 결과가 매번 달라지는 불안정한 게임이 된다. 그래서:
 *   - 판정 자체는 "수비수 기본 위치 → 낙구 지점" 거리 / 가상 이동속도로 계산한
 *     결정론적+확률적 공식으로 낸다 (아래 catchProbability).
 *   - 동시에 실제 sce:ball_marker 를 스폰해서 가장 가까운 수비수가 진짜로 그 쪽으로
 *     달려가게 만든다 (docs/DESIGN.md 3장의 표적 마커 기법). 이건 순전히 "보여주기"용
 *     연출이며, 판정 결과와는 별개다. 이렇게 분리해야 모바일에서도 판정이 안정적이다.
 */
import { system } from "@minecraft/server";
import { FIELDING_POSITIONS, FIELD, GAME } from "./constants.js";
import { state, fieldingTeam, PHASE } from "./state.js";
import { recordOut, recordRuns } from "./rules.js";
import { advanceOnHit, sacFlyScore } from "./baserunning.js";
import { cheer } from "./crowd.js";

const FIELDER_SPEED_BPT = 0.32; // 게임플레이 상수(엔티티 movement 컴포넌트와 별개, 판정용 근사치)
const OF_POSITIONS = ["1B", "2B", "3B", "SS", "LF", "CF", "RF"];
const DEG = Math.PI / 180;

let afterPlay = () => {};
export function onAfterPlay(fn) {
  afterPlay = fn;
}

function fieldingFielders() {
  const teamKey = fieldingTeam();
  return state.fielderEntities[teamKey] ?? {};
}

function landingPoint(contact) {
  const rad = contact.direction * DEG;
  return {
    x: Math.round(contact.distance * Math.cos(rad)),
    y: FIELD.GROUND_Y,
    z: Math.round(contact.distance * Math.sin(rad)),
  };
}

function nearestFielder(landing) {
  const fielders = fieldingFielders();
  let best = null;
  let bestDist = Infinity;
  for (const pos of OF_POSITIONS) {
    const entity = fielders[pos];
    if (!entity) continue;
    const def = FIELDING_POSITIONS[pos];
    const d = Math.hypot(def.x - landing.x, def.z - landing.z);
    if (d < bestDist) {
      bestDist = d;
      best = { pos, entity, defaultPos: def, dist: d };
    }
  }
  return best;
}

function sendFielderToChase(dimension, fielderInfo, landing) {
  if (!fielderInfo) return;
  try {
    const marker = dimension.spawnEntity("sce:ball_marker", landing);
    fielderInfo.entity.triggerEvent("sce:become_fielder");
    system.runTimeout(() => {
      try {
        marker.remove();
      } catch (e) {}
      try {
        fielderInfo.entity.triggerEvent("sce:become_idle");
      } catch (e) {}
      // 원위치로 복귀
      returnFielderHome(dimension, fielderInfo);
    }, 60);
  } catch (e) {}
}

function returnFielderHome(dimension, fielderInfo) {
  const entity = fielderInfo.entity;
  const start = entity.location;
  const dest = fielderInfo.defaultPos;
  let t = 0;
  const total = 30;
  const iv = system.runInterval(() => {
    t++;
    const f = t / total;
    try {
      entity.teleport({
        x: start.x + (dest.x - start.x) * f,
        y: dest.y,
        z: start.z + (dest.z - start.z) * f,
      });
    } catch (e) {
      system.clearRun(iv);
      return;
    }
    if (t >= total) system.clearRun(iv);
  }, 1);
}

function fenceRadiusAt(directionDeg) {
  return FIELD.OUTFIELD_R_LINE + (FIELD.OUTFIELD_R_CENTER - FIELD.OUTFIELD_R_LINE) * Math.sin(directionDeg * DEG);
}

function catchProbability(fielderInfo, hangtimeTicks) {
  if (!fielderInfo) return 0.1;
  const timeToReach = fielderInfo.dist / FIELDER_SPEED_BPT;
  return Math.min(0.92, Math.max(0.05, 0.9 - (timeToReach - hangtimeTicks) * 0.05));
}

function hitBasesFromDistance(distance, directionDeg) {
  const fenceR = fenceRadiusAt(directionDeg);
  if (distance >= fenceR) return 4; // 홈런 (펜스를 넘김)
  if (distance >= fenceR - 14) return 3;
  if (distance >= fenceR - 30) return 2;
  return 1;
}

/**
 * contact: batting.js의 classifyContact() 결과 (battedType, distance, direction, hangtimeTicks, quality)
 * batterRunner: { kind:'human'|'npc', player|entity }
 */
export function resolveBattedBall(dimension, contact, batterRunner) {
  const landing = landingPoint(contact);
  state.phase = PHASE.BALL_IN_PLAY;

  if (contact.battedType === "GROUND") {
    resolveGroundBall(dimension, contact, landing, batterRunner);
    return;
  }
  resolveAirBall(dimension, contact, landing, batterRunner);
}

function resolveGroundBall(dimension, contact, landing, batterRunner) {
  const dist = Math.hypot(landing.x, landing.z);
  const fielderInfo = nearestFielder(landing);
  sendFielderToChase(dimension, fielderInfo, landing);

  const infield = dist <= 34;
  const outChance = infield ? Math.max(0.35, 0.82 - contact.quality * 0.25) : 0.08;

  system.runTimeout(() => {
    if (Math.random() < outChance) {
      finishAsOut(dimension, "GROUND OUT", true);
    } else {
      finishAsHit(dimension, contact, batterRunner, infield ? 1 : Math.min(2, hitBasesFromDistance(dist, contact.direction)));
    }
  }, 14);
}

function resolveAirBall(dimension, contact, landing, batterRunner) {
  const fielderInfo = nearestFielder(landing);
  sendFielderToChase(dimension, fielderInfo, landing);
  const hangtime = Math.max(6, Math.round(contact.hangtimeTicks));
  const forcedHomeRun = hitBasesFromDistance(contact.distance, contact.direction) >= 4;

  system.runTimeout(() => {
    if (forcedHomeRun) {
      finishAsHit(dimension, contact, batterRunner, 4);
      return;
    }
    const caught = Math.random() < catchProbability(fielderInfo, hangtime);
    if (caught) {
      const deepEnough = contact.distance >= 40 && contact.battedType !== "POPUP";
      const sac = deepEnough && state.bases.third && state.outs < GAME.MAX_OUTS - 1;
      finishAsOut(dimension, "FLY OUT", false, sac);
    } else {
      const bases = hitBasesFromDistance(contact.distance, contact.direction);
      finishAsHit(dimension, contact, batterRunner, bases);
    }
  }, hangtime);
}

function finishAsOut(dimension, label, isGroundOut, sacFly = false) {
  cheer(dimension, FIELD.MOUND, "clap");
  if (sacFly) {
    const runs = sacFlyScore(dimension);
    recordRuns(runs);
  }
  const inningOver = recordOut(1);
  afterPlay({ inningOver, label });
}

function finishAsHit(dimension, contact, batterRunner, bases) {
  const runs = advanceOnHit(dimension, batterRunner, bases);
  const isHR = bases >= 4;
  recordRuns(runs, isHR);
  cheer(dimension, FIELD.HOME, isHR ? "homerun" : "hit");
  const labels = ["", "HIT!", "2루타!", "3루타!", "HOME RUN!"];
  afterPlay({ inningOver: false, label: labels[bases] ?? "HIT!", isHit: true });
}
