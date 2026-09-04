/**
 * 관중 연출. 요청사항 14번(모바일 최적화)과 정면 충돌하는 "수백 명의 관중 NPC"는
 * 만들지 않는다. 대신:
 *  - 스탠드 앞줄에 한정된 수(기본 20명)의 관중 NPC만 배치 (건축은 stadiumBuilder의
 *    색깔 블록 밴딩이 "채워진 관중석" 느낌을 대신 담당)
 *  - 안타/득점/홈런 시 playSound + particle 로 "반응하는 느낌"을 재현
 *  - 배치된 관중 NPC는 득점 시 위로 살짝 튀어오르는(applyImpulse) 저비용 리액션만 수행
 */
import { FIELD } from "./constants.js";

const MAX_CROWD = 20;
const MAX_CHEERLEADERS = 4;
let crowdEntities = [];
let cheerleaderEntities = [];

function ring(count, radius, yOffset) {
  const pts = [];
  for (let i = 0; i < count; i++) {
    const angle = ((360 / count) * i * Math.PI) / 180;
    pts.push({
      x: Math.round(radius * Math.cos(angle)),
      y: FIELD.GROUND_Y + 1 + yOffset,
      z: Math.round(radius * Math.sin(angle)),
    });
  }
  return pts;
}

export function spawnCrowd(dimension) {
  if (crowdEntities.length) return;
  const spots = ring(MAX_CROWD, FIELD.STANDS_INNER_R + 1, 0);
  for (const p of spots) {
    try {
      const e = dimension.spawnEntity("sce:player_npc", p);
      e.triggerEvent("sce:become_idle");
      e.triggerEvent(Math.random() < 0.5 ? "sce:set_team_home" : "sce:set_team_away");
      crowdEntities.push(e);
    } catch (err) {}
  }
  const cheerSpots = [
    { x: -12, y: FIELD.GROUND_Y + 3, z: 12 },
    { x: -12, y: FIELD.GROUND_Y + 3, z: 15 },
    { x: 12, y: FIELD.GROUND_Y + 3, z: -12 },
    { x: 15, y: FIELD.GROUND_Y + 3, z: -12 },
  ].slice(0, MAX_CHEERLEADERS);
  for (const p of cheerSpots) {
    try {
      const e = dimension.spawnEntity("sce:player_npc", p);
      e.triggerEvent("sce:become_idle");
      cheerleaderEntities.push(e);
    } catch (err) {}
  }
}

function hop(entity, power) {
  try {
    entity.applyImpulse({ x: 0, y: power, z: 0 });
  } catch (e) {}
}

/** level: 'clap' | 'hit' | 'homerun' */
export function cheer(dimension, origin, level = "clap") {
  const sounds = {
    clap: "mob.villager.yes",
    hit: "random.levelup",
    homerun: "raid.horn",
  };
  const particles = {
    clap: "minecraft:villager_happy",
    hit: "minecraft:totem_particle",
    homerun: "minecraft:firework_particle",
  };
  try {
    dimension.playSound(sounds[level] ?? sounds.clap, origin, { volume: 1, pitch: level === "homerun" ? 0.7 : 1.1 });
  } catch (e) {}
  try {
    dimension.spawnParticle(particles[level] ?? particles.clap, origin);
  } catch (e) {}

  const hopPower = level === "homerun" ? 0.5 : level === "hit" ? 0.3 : 0.15;
  const sample = level === "homerun" ? crowdEntities : crowdEntities.slice(0, 8);
  for (const e of sample) hop(e, hopPower * (0.7 + Math.random() * 0.6));
  if (level !== "clap") for (const e of cheerleaderEntities) hop(e, hopPower + 0.1);
}
