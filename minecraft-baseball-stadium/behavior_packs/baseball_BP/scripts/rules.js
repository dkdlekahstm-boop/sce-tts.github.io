/**
 * 볼/스트라이크/아웃/이닝/득점 판정 엔진. 순수 상태(state)를 조작하고, 화면 표시는
 * scoreboard.js 에 위임한다. gameManager.js 가 이닝 종료/경기 종료 후속 처리를 담당한다.
 */
import { GAME } from "./constants.js";
import { state, PHASE, resetCount } from "./state.js";
import { updateBillboard, syncSidebar } from "./scoreboard.js";
import { title } from "./ui.js";

function battingHumanPlayer() {
  const team = state.half === "TOP" ? "away" : "home";
  return state.humans[team]?.batterPitcher ?? null;
}
function fieldingHumanPlayer() {
  const team = state.half === "TOP" ? "home" : "away";
  return state.humans[team]?.batterPitcher ?? null;
}

function announceAll(text) {
  for (const p of [battingHumanPlayer(), fieldingHumanPlayer()]) {
    if (p) title(p, text);
  }
}

let afterAtBat = () => {};
/** gameManager.js가 등록: 볼넷/삼진으로 타석이 종료되면 다음 타자/이닝 전환을 처리 */
export function onAfterAtBat(fn) {
  afterAtBat = fn;
}

/** result: 'ball' | 'strike' | 'foul' */
export function recordPitchResult(result) {
  if (result === "ball") {
    state.balls++;
    if (state.balls >= GAME.MAX_BALLS) {
      announceAll("§bBALL FOUR - 볼넷!");
      endAtBat("WALK");
      afterAtBat({ reason: "WALK", inningOver: false });
      return;
    }
  } else if (result === "strike") {
    state.strikes++;
    if (state.strikes >= GAME.MAX_STRIKES) {
      announceAll("§cSTRIKE OUT!");
      const inningOver = recordOut();
      endAtBat("STRIKEOUT");
      afterAtBat({ reason: "STRIKEOUT", inningOver });
      return;
    }
  } else if (result === "foul") {
    if (state.strikes < GAME.MAX_STRIKES - 1) state.strikes++;
  }
  syncSidebar();
  updateBillboard();
}

export function recordOut(count = 1) {
  state.outs += count;
  syncSidebar();
  updateBillboard(`OUT! (${state.outs}/${GAME.MAX_OUTS})`);
  if (state.outs >= GAME.MAX_OUTS) {
    announceAll("§6CHANGE!");
    return true; // 이닝 전환 필요 -> gameManager가 처리
  }
  return false;
}

export function recordRuns(n, causedByHomeRun = false) {
  if (n <= 0) return;
  const battingTeamKey = state.half === "TOP" ? "away" : "home";
  state.score[battingTeamKey] += n;
  syncSidebar();
  updateBillboard(causedByHomeRun ? "§c§lHOME RUN!" : n > 1 ? `${n}점 득점!` : "득점!");
}

export function endAtBat(reason) {
  resetCount();
  syncSidebar();
  return reason;
}

export function isInningOver() {
  return state.outs >= GAME.MAX_OUTS;
}

export function isGameOver() {
  if (state.inning < GAME.INNINGS) return false;
  if (state.inning === GAME.INNINGS && state.half === "TOP") return false; // 9회 초는 계속
  if (state.score.home !== state.score.away) return true;
  return false; // 동점이면 연장 (이닝 계속 증가)
}
