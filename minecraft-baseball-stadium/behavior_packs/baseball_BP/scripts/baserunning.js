/**
 * 주루 처리.
 *
 * 설계상 중요한 단순화: 사람이 직접 베이스 사이를 걸어서 판정받는 방식은 채택하지
 * 않았다. Bedrock에는 "주자가 수비수의 송구보다 먼저 도착했는지"를 물리적으로 판정할
 * 방법(정밀 충돌/타이밍 엔진)이 없고, 이를 흉내내려 하면 결과가 들쭉날쭉해진다.
 * 대신 fielding.js 가 계산한 타구 판정 결과(안타/2루타/…/아웃)에 따라 이 모듈이
 * 주자(사람 포함) 진루를 규칙 기반으로 "자동 연출"한다:
 *   - AI 주자는 sce:base_marker 를 목표로 자동 추격(엔티티 behavior)해서 실제로
 *     베이스까지 뛰어가는 모습을 보여준다.
 *   - 사람 주자는 짧은 시간 동안 보간 텔레포트로 베이스까지 자동 이동시키고
 *     화면에 "1루로 진루!" 같은 안내를 띄운다. (자유 주루 판단은 18번 항목 "테스트 및
 *     향후 개선"에 남겨둔 확장 지점이다.)
 */
import { system } from "@minecraft/server";
import { BASES } from "./constants.js";
import { state } from "./state.js";
import { title } from "./ui.js";

const BASE_ORDER = ["first", "second", "third", "home"];

function nextBase(current) {
  const i = BASE_ORDER.indexOf(current);
  return BASE_ORDER[i + 1];
}

function runnerPos(runner) {
  return runner.kind === "human" ? runner.player.location : runner.entity.location;
}

function moveRunner(dimension, runner, targetBaseKey, onArrive) {
  const dest = BASES[targetBaseKey] ?? null;
  if (runner.kind === "npc") {
    try {
      const marker = dimension.spawnEntity("sce:base_marker", dest ? { ...dest, y: dest.y } : runner.entity.location);
      runner.entity.triggerEvent("sce:become_runner");
      system.runTimeout(() => {
        try {
          marker.remove();
        } catch (e) {}
        onArrive?.();
      }, 30);
    } catch (e) {
      onArrive?.();
    }
    return;
  }
  // 사람 주자: 20틱에 걸쳐 보간 이동
  const player = runner.player;
  const start = player.location;
  if (!dest) {
    onArrive?.();
    return;
  }
  title(player, targetBaseKey === "home" ? "§e홈으로 질주!" : `§f${targetBaseKey.toUpperCase()}로 진루!`);
  let t = 0;
  const total = 20;
  const iv = system.runInterval(() => {
    t++;
    const f = t / total;
    try {
      player.teleport({
        x: start.x + (dest.x - start.x) * f,
        y: dest.y,
        z: start.z + (dest.z - start.z) * f,
      });
    } catch (e) {}
    if (t >= total) {
      system.clearRun(iv);
      onArrive?.();
    }
  }, 1);
}

/**
 * hitBases: 타자가 도달하는 베이스 수 (1=단타,2=2루타,3=3루타,4=홈런)
 * 기존 주자는 표준 강제진루 휴리스틱으로 hitBases 만큼(또는 홈까지) 전진한다.
 * 반환값: 이번 플레이로 득점한 인원 수
 */
export function advanceOnHit(dimension, batterRunner, hitBases) {
  let runs = 0;
  const newBases = { first: null, second: null, third: null };
  const order = ["third", "second", "first"]; // 뒤쪽부터 처리해야 충돌 없음

  for (const baseKey of order) {
    const runner = state.bases[baseKey];
    if (!runner) continue;
    const from = BASE_ORDER.indexOf(baseKey);
    const to = from + hitBases;
    if (to >= 3) {
      runs++;
      moveRunner(dimension, runner, "home");
    } else {
      const destKey = BASE_ORDER[to];
      newBases[destKey] = runner;
      moveRunner(dimension, runner, destKey);
    }
  }

  if (hitBases >= 4) {
    runs++;
    moveRunner(dimension, batterRunner, "home");
  } else {
    const destKey = BASE_ORDER[hitBases - 1];
    newBases[destKey] = batterRunner;
    moveRunner(dimension, batterRunner, destKey);
  }

  state.bases = newBases;
  return runs;
}

/** 볼넷/사구: 강제 진루가 필요한 주자만 한 베이스 전진 */
export function advanceOnWalk(dimension, batterRunner) {
  let runs = 0;
  if (state.bases.first) {
    if (state.bases.second) {
      if (state.bases.third) {
        runs++;
        moveRunner(dimension, state.bases.third, "home");
      }
      state.bases.third = state.bases.second;
      moveRunner(dimension, state.bases.second, "third");
    }
    state.bases.second = state.bases.first;
    moveRunner(dimension, state.bases.first, "second");
  }
  state.bases.first = batterRunner;
  moveRunner(dimension, batterRunner, "first");
  return runs;
}

/** 희생플라이: 3루 주자만 자동 득점 (2아웃 미만일 때 fielding.js가 호출 조건 판단) */
export function sacFlyScore(dimension) {
  if (!state.bases.third) return 0;
  const runner = state.bases.third;
  state.bases.third = null;
  moveRunner(dimension, runner, "home");
  return 1;
}

/** 도루 시도 (경량 구현): 확률 기반으로 성공/실패만 판정 */
export function attemptSteal(dimension, fromBase) {
  const to = fromBase === "first" ? "second" : fromBase === "second" ? "third" : null;
  if (!to || !state.bases[fromBase] || state.bases[to]) return null;
  const success = Math.random() < 0.55;
  const runner = state.bases[fromBase];
  state.bases[fromBase] = null;
  if (success) {
    state.bases[to] = runner;
    moveRunner(dimension, runner, to);
  }
  return { success, runner, to };
}

export function clearBases() {
  state.bases = { first: null, second: null, third: null };
}
