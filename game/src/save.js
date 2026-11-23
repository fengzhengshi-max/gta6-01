// Neon Palms — localStorage autosave + best-cash record.
const KEY = 'neon-palms-save-v1';
const BEST_KEY = 'neon-palms-best-cash';

export function saveGame(game) {
  try {
    const p = game.player;
    const data = {
      money: p.money, health: p.health, missionIndex: game.missions.index,
      wanted: game.wanted, x: p.x, y: p.y, bestCash: game.bestCash || 0, savedAt: Date.now(),
    };
    localStorage.setItem(KEY, JSON.stringify(data));
    localStorage.setItem(BEST_KEY, String(Math.max(game.bestCash || 0, p.money)));
  } catch (e) { /* storage unavailable (private mode) — game still plays */ }
}
export function loadGame() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch (e) { return null; }
}
export function hasSave() { return loadGame() !== null; }
export function bestCash() {
  try { return Number(localStorage.getItem(BEST_KEY) || 0); } catch (e) { return 0; }
}
export function clearSave() {
  try { localStorage.removeItem(KEY); } catch (e) {}
}
