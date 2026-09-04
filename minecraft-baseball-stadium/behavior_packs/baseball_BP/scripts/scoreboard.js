/**
 * 전광판 = 두 겹으로 구현한다.
 *  1) world.scoreboard 사이드바 — 화면 우측 상단 항상 표시, 안정 API.
 *  2) 중견수 뒤 전광판 벽 앞의 "보이지 않는 armor_stand" 1기 — nameTag에 여러 줄
 *     텍스트(§색상코드 포함)를 넣어 실제 "월드 안의 전광판처럼 보이는" 대형 문자판을
 *     재현한다. nameTag는 투명화(invisibility) 상태에서도 항상 렌더링되는 성질을 이용한
 *     정석적인 Bedrock 트릭이다.
 */
import { world, DisplaySlotId, ObjectiveSortOrder } from "@minecraft/server";
import { GAME, scoreboardAnchor } from "./constants.js";
import { state } from "./state.js";

const OBJ_ID = "sce_info";
let billboard = null;

export function initScoreboard() {
  let obj = world.scoreboard.getObjective(OBJ_ID);
  if (!obj) obj = world.scoreboard.addObjective(OBJ_ID, "⚾ 경기 정보");
  try {
    world.scoreboard.setObjectiveAtDisplaySlot(DisplaySlotId.Sidebar, {
      objective: obj,
      sortOrder: ObjectiveSortOrder.Descending,
    });
  } catch (e) {}
}

function setRow(obj, name, value) {
  try {
    obj.setScore(name, value);
  } catch (e) {}
}

export function syncSidebar() {
  const obj = world.scoreboard.getObjective(OBJ_ID);
  if (!obj) return;
  setRow(obj, "§9HOME", state.score.home);
  setRow(obj, "§cAWAY", state.score.away);
  setRow(obj, "§eINNING", state.inning);
  setRow(obj, "§7OUT", state.outs);
  setRow(obj, "§fBALL", state.balls);
  setRow(obj, "§fSTRIKE", state.strikes);
}

function dots(count, max) {
  return "●".repeat(Math.min(count, max)) + "○".repeat(Math.max(0, max - count));
}

/** dimension: 전광판 벽 앞에 armor_stand 전광판을 최초 1회 스폰 */
export function spawnBillboard(dimension) {
  if (billboard) return billboard;
  const anchor = scoreboardAnchor();
  try {
    billboard = dimension.spawnEntity("minecraft:armor_stand", {
      x: anchor.x - 1,
      y: anchor.y,
      z: anchor.z,
    });
    billboard.nameTag = "SCE BASEBALL STADIUM";
    billboard.addEffect("invisibility", 20000000, { showParticles: false, amplifier: 0 });
  } catch (e) {}
  return billboard;
}

export function updateBillboard(extraLine) {
  if (!billboard) return;
  const s = state;
  const lines = [
    "§l§fSCE BASEBALL STADIUM",
    `§9HOME §f${s.score.home}   §cAWAY §f${s.score.away}`,
    `§e${s.half === "TOP" ? "▲ TOP" : "▼ BOT"} ${s.inning}회`,
    `§fB ${dots(s.balls, GAME.MAX_BALLS - 1)}  §fS ${dots(s.strikes, GAME.MAX_STRIKES - 1)}  §7O ${dots(s.outs, GAME.MAX_OUTS - 1)}`,
  ];
  if (extraLine) lines.push(`§l§6${extraLine}`);
  // 대상 엔티티가 사라졌을 수 있으므로(청크 언로드 등) 실패 시 참조를 정리해 다음 tick에 재사용하지 않는다.
  try {
    billboard.nameTag = lines.join("\n");
  } catch (e) {
    billboard = null;
  }
}

export function flashBillboard(text) {
  updateBillboard(text);
}
