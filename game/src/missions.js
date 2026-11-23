// Neon Palms — Mara's five-mission story chain.
import { MISSION_REWARDS } from './config.js';
import { landmarkById } from './world.js';
import { dist, clamp } from './random.js';

export const MISSION_DEFS = [
  { id: 'm1', title: 'Meet Mara', target: 'bar',
    text: "Mara runs the bar on Palm Row. She has work for you. Go see her.",
    hint: 'Drive or walk to the pink beacon at the bar.' },
  { id: 'm2', title: 'Borrowed Wheels', target: 'hotel',
    text: "Mara needs a clean car. Steal any traffic car (E) and deliver it to the Palms Hotel.",
    hint: 'Press E near a car to take it, then drive to the hotel beacon.' },
  { id: 'm3', title: 'The Pickup', target: 'warehouse',
    text: "Pick up Mara's goods at the Dock Warehouse. No questions, no peeking.",
    hint: 'Reach the warehouse beacon to collect the goods.' },
  { id: 'm4', title: 'Dock Trouble', target: 'docks',
    text: "A rival crew is holding the docks. Clear them out — punch (F) or shoot (click).",
    hint: 'Defeat every gang member at the docks.' },
  { id: 'm5', title: 'The Neon Bank', target: 'bank',
    text: "The big one: rob the Neon Bank, then lose the heat. Grab the cash at the bank and get clear.",
    hint: 'Reach the bank, grab the cash, then survive with no police on your tail.' },
];

export function makeMissionState() {
  return { index: 0, stage: 'go', deliveredCar: null, gangLeft: 0, bankTimer: 0, done: false };
}

export function currentMission() { return MISSION_DEFS; }
export function missionTarget(game) {
  const def = MISSION_DEFS[game.missions.index];
  if (!def) return null;
  return landmarkById(game.world, def.target);
}
export function missionText(game) {
  const def = MISSION_DEFS[game.missions.index];
  if (!def) return 'Story complete. Neon Palms is yours.';
  return def.title + ' — ' + def.text;
}

export function completeMission(game) {
  const idx = game.missions.index;
  const reward = MISSION_REWARDS[idx] || 500;
  game.player.money += reward;
  game.player.cash = game.player.money;
  game.sound.missionDone();
  game.floaters.push({ x: game.player.x, y: game.player.y - 30, text: '+$' + reward, life: 2, color: '#a6ff3d' });
  game.missions.index += 1;
  game.missions.stage = 'go';
  game.missions.gangLeft = 0;
  if (game.missions.index >= MISSION_DEFS.length) {
    game.missions.done = true;
    game.screen = 'complete';
    game.bestCash = Math.max(game.bestCash || 0, game.player.money);
  }
  game.saveNow();
}

export function updateMissions(game, dt) {
  if (game.missions.done || game.screen !== 'play') return;
  const def = MISSION_DEFS[game.missions.index];
  const tgt = missionTarget(game);
  if (!tgt) return;
  const p = game.player;
  const d = dist(p.x, p.y, tgt.x, tgt.y);
  if (def.id === 'm1' && d < 95) { completeMission(game); return; }
  if (def.id === 'm2') {
    if (p.inCar && p.inCar.stolen && d < 100) {
      game.missions.deliveredCar = p.inCar;
      completeMission(game);
    }
    return;
  }
  if (def.id === 'm3' && d < 95) { completeMission(game); return; }
  if (def.id === 'm4') {
    if (game.missions.gangLeft === 0 && !game.missions.spawnedGang) {
      game.spawnGang(tgt.x, tgt.y);
      game.missions.spawnedGang = true;
    }
    if (game.missions.spawnedGang && game.missions.gangLeft <= 0) {
      game.missions.spawnedGang = false;
      completeMission(game);
    }
    return;
  }
  if (def.id === 'm5') {
    if (game.missions.stage === 'go' && d < 95) {
      game.missions.stage = 'escape';
      game.player.money += 1500;
      game.floaters.push({ x: p.x, y: p.y - 30, text: '+$1500 bank cash', life: 2, color: '#ffb02e' });
      game.addWanted(3, 'bank robbery');
    } else if (game.missions.stage === 'escape') {
      game.missions.bankTimer += dt;
      if (game.wanted === 0 && game.missions.bankTimer > 3) completeMission(game);
    }
  }
}
