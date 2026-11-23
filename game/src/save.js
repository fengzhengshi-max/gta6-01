// Save and load: one localStorage slot holding cash, health, mission progress,
// position and wanted level, plus the best cash ever held. Everything is plain
// JSON; a corrupt or missing slot just starts a new game.
import { BEST_KEY, SAVE_KEY } from './config.js';

export function readSave() {
  try {
    const raw = window.localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (!data || typeof data !== 'object') return null;
    return data;
  } catch {
    return null;
  }
}

export function writeSave(game) {
  try {
    const data = {
      version: 1,
      money: game.money,
      health: game.player.health,
      missionIndex: game.missions.index,
      missionStage: game.missions.stage,
      missionsDone: game.missions.completedCount,
      x: game.player.x,
      y: game.player.y,
      stars: game.police.stars,
      savedAt: Date.now(),
    };
    window.localStorage.setItem(SAVE_KEY, JSON.stringify(data));
    return true;
  } catch {
    return false;
  }
}

export function applySave(game, data) {
  if (!data) return false;
  game.money = typeof data.money === 'number' ? data.money : game.money;
  game.player.health = typeof data.health === 'number' ? data.health : game.player.health;
  game.missions.index = typeof data.missionIndex === 'number' ? data.missionIndex : 0;
  game.missions.stage = typeof data.missionStage === 'number' ? data.missionStage : 0;
  game.missions.completedCount = typeof data.missionsDone === 'number' ? data.missionsDone : 0;
  if (typeof data.x === 'number' && typeof data.y === 'number') {
    game.player.x = data.x;
    game.player.y = data.y;
  }
  game.police.stars = typeof data.stars === 'number' ? data.stars : 0;
  return true;
}

export function readBestCash() {
  try {
    return Number.parseInt(window.localStorage.getItem(BEST_KEY) ?? '0', 10) || 0;
  } catch {
    return 0;
  }
}

export function writeBestCash(value) {
  try {
    window.localStorage.setItem(BEST_KEY, String(value));
  } catch {
    // Storage can be off: best cash then lasts this visit only.
  }
}

export function clearSave() {
  try {
    window.localStorage.removeItem(SAVE_KEY);
  } catch {
    // Nothing to clear.
  }
}
