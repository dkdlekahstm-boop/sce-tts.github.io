/**
 * 짧은 카메라 연출. player.camera.set()/clear() 는 Bedrock Script API 안정 기능이다.
 * 플레이 방해를 최소화하기 위해 모든 연출은 0.5~2초 이내로 자동 해제한다.
 * 커스텀 프리셋(sce:free_cam)은 resource_packs/baseball_RP/cameras/camera_presets.json
 * 에서 내장 minecraft:free 를 상속해 정의했다 (Script API로 직접 카메라를 이동시키려면
 * RP에 프리셋이 정의되어 있어야 한다).
 */
import { system } from "@minecraft/server";

function clearAfter(player, ticks) {
  system.runTimeout(() => {
    try {
      player.camera.clear();
    } catch (e) {}
  }, ticks);
}

/** 위치 location에서 targetLocation을 바라보는 고정 샷을 durationTicks 동안 보여준다 */
export function fixedShot(player, location, targetLocation, durationTicks = 30) {
  try {
    player.camera.set("sce:free_cam", {
      location,
      facingLocation: targetLocation,
      easeOptions: { easeTime: 0.35, easeType: "InOutSine" },
    });
  } catch (e) {}
  clearAfter(player, durationTicks);
}

export function stadiumIntro(player, mound, home) {
  const overview = { x: mound.x, y: mound.y + 25, z: mound.z - 20 };
  fixedShot(player, overview, home, 40);
}

export function homeRunShot(player, batterLoc, outfieldTarget) {
  const cam = { x: batterLoc.x - 6, y: batterLoc.y + 6, z: batterLoc.z - 6 };
  fixedShot(player, cam, outfieldTarget, 36);
}

export function pitcherIntroShot(player, mound) {
  const cam = { x: mound.x - 4, y: mound.y + 3, z: mound.z - 4 };
  fixedShot(player, cam, mound, 24);
}
