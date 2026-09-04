/** @minecraft/server-ui 얇은 래퍼. 폼을 닫아버리면(취소) null을 반환한다. */
import { ActionFormData } from "@minecraft/server-ui";

/**
 * @param {import("@minecraft/server").Player} player
 * @param {string} title
 * @param {string} body
 * @param {string[]} buttons
 * @returns {Promise<number|null>} 선택된 버튼 인덱스, 취소 시 null
 */
export async function showChoice(player, title, body, buttons) {
  const form = new ActionFormData().title(title).body(body);
  for (const b of buttons) form.button(b);
  try {
    const res = await form.show(player);
    if (res.canceled) return null;
    return res.selection ?? null;
  } catch (e) {
    return null;
  }
}

// TitleDisplayOptions의 시간 단위는 모두 틱(tick, 1/20초)이다.
export function title(player, text, subtitle) {
  if (!player) return;
  try {
    player.onScreenDisplay.setTitle(text, {
      fadeInDuration: 4,
      stayDuration: 28,
      fadeOutDuration: 8,
      subtitle: subtitle ?? "",
    });
  } catch (e) {}
}

export function actionBar(player, text) {
  try {
    player.onScreenDisplay.setActionBar(text);
  } catch (e) {}
}
