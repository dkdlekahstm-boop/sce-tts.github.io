/** 짧은 거리 이동을 보간 텔레포트로 자연스럽게 보여주는 공용 유틸. */
import { system } from "@minecraft/server";

/**
 * @param {import("@minecraft/server").Entity | import("@minecraft/server").Player} actor
 * @param {{x:number,y:number,z:number}} dest
 * @param {number} ticks
 * @param {() => void} [onDone]
 */
export function lerpWalk(actor, dest, ticks = 30, onDone) {
  const start = actor.location;
  let t = 0;
  const iv = system.runInterval(() => {
    t++;
    const f = Math.min(1, t / ticks);
    try {
      actor.teleport({
        x: start.x + (dest.x - start.x) * f,
        y: dest.y ?? start.y,
        z: start.z + (dest.z - start.z) * f,
      });
    } catch (e) {
      system.clearRun(iv);
      return;
    }
    if (t >= ticks) {
      system.clearRun(iv);
      onDone?.();
    }
  }, 1);
  return iv;
}
