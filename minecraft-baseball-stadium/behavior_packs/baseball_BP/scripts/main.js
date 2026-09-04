/**
 * 엔트리 포인트. 여기서는 "무엇을 초기화하고 매 틱 무엇을 부를지"만 담당하고,
 * 실제 로직은 각 모듈(gameManager/pitching/batting/fielding/baserunning/rules)에 위임한다.
 */
import { world, system } from "@minecraft/server";
import { DYN_PROPS } from "./constants.js";
import { buildStadium } from "./stadiumBuilder.js";
import { clock } from "./ticks.js";
import * as gameManager from "./gameManager.js";
import * as pitching from "./pitching.js";
import * as batting from "./batting.js";

function boot() {
  const dimension = world.getDimension("overworld");
  batting.init();
  pitching.init();

  const alreadyBuilt = world.getDynamicProperty(DYN_PROPS.STADIUM_BUILT) === true;
  if (alreadyBuilt) {
    gameManager.init(dimension);
  } else {
    world.sendMessage("§e경기장을 생성하는 중입니다... (최초 1회, 잠시 기다려주세요)");
    buildStadium(dimension, () => {
      world.setDynamicProperty(DYN_PROPS.STADIUM_BUILT, true);
      world.sendMessage("§a경기장 생성 완료! 로비 NPC를 우클릭해 경기를 시작하세요.");
      gameManager.init(dimension);
    });
  }

  system.runInterval(() => {
    clock.tick++;
    pitching.tickBall(dimension);
  }, 1);
}

system.run(boot);
