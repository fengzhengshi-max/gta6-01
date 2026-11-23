// Neon Palms — the city. A seeded road grid, buildings, park, beach and named landmarks.
import { CFG, LANDMARKS } from './config.js';
import { makeRng, pick, range, rangeInt, clamp } from './random.js';

export const ROAD_W = 64;
export const BLOCK_W = 300, BLOCK_H = 260;

export function buildWorld(seed) {
  const rng = makeRng(seed);
  const cols = 8, rows = 6;
  const roadsX = [], roadsY = [];
  for (let i = 0; i <= cols; i++) roadsX.push(120 + i * (BLOCK_W + ROAD_W));
  for (let j = 0; j <= rows; j++) roadsY.push(100 + j * (BLOCK_H + ROAD_W));
  const worldW = roadsX[cols] + 160, worldH = roadsY[rows] + 160;

  const buildings = [];
  const neon = ['#ff2e88', '#22e6ff', '#a6ff3d', '#ffb02e', '#c96bff'];
  for (let i = 0; i < cols; i++) {
    for (let j = 0; j < rows; j++) {
      // Park block (row 2, col 3) and beach strip along the east edge stay open.
      if (i === 3 && j === 2) continue;
      if (i === cols - 1 && j >= 4) continue;
      const bx = roadsX[i] + ROAD_W + 14, by = roadsY[j] + ROAD_W + 14;
      const bw = BLOCK_W - 60, bh = BLOCK_H - 60; // keep clear of the next road (block interior is 254 x 214)
      const n = rangeInt(rng, 1, 2);
      for (let k = 0; k < n; k++) {
        const w = n === 1 ? bw : bw / 2 - 8;
        const h = n === 1 ? bh : bh - 8;
        const x = n === 1 ? bx : bx + k * (bw / 2 + 8);
        const y = by;
        buildings.push({
          x, y, w, h,
          color: pick(rng, ['#2b2b4d', '#3d2b4d', '#1f3a4d', '#402a3a', '#26324d']),
          neon: pick(rng, neon), floors: rangeInt(rng, 2, 9),
          windows: rangeInt(rng, 12, 40),
        });
      }
    }
  }
  // Landmark spots: fixed block corners so missions always have a real place.
  const spot = (ci, cj, dx, dy) => ({
    x: roadsX[ci] + ROAD_W + dx, y: roadsY[cj] + ROAD_W + dy,
  });
  const spots = {
    bar: spot(1, 1, 60, 60), hotel: spot(5, 1, 60, 60),
    bank: spot(5, 3, 60, 60), warehouse: spot(1, 4, 60, 60),
    safehouse: spot(2, 0, 60, 60), docks: spot(6, 5, 40, 40),
    station: spot(0, 3, 60, 60), park: spot(3, 2, 90, 70),
    beach: { x: roadsX[cols] - 40, y: roadsY[4] + 120 },
  };
  const landmarks = LANDMARKS.map((lm) => ({ ...lm, ...spots[lm.id] }));
  // Landmark buildings sit on top of the block so they read as real places.
  for (const lm of landmarks) {
    if (lm.kind === 'park' || lm.kind === 'beach' || lm.kind === 'docks') continue;
    buildings.push({ x: lm.x - 70, y: lm.y - 50, w: 140, h: 100, color: '#33254d', neon: '#ff2e88', floors: 3, windows: 18, landmark: lm.id });
  }
  return { seed, cols, rows, roadsX, roadsY, worldW, worldH, buildings, landmarks, rng };
}

export function landmarkById(world, id) {
  return world.landmarks.find((l) => l.id === id);
}
export function isOnRoad(world, x, y) {
  const m = ROAD_W / 2;
  for (const rx of world.roadsX) if (Math.abs(x - rx) <= m) return true;
  for (const ry of world.roadsY) if (Math.abs(y - ry) <= m) return true;
  return false;
}
export function nearestRoadPoint(world, x, y) {
  let best = { x, y, d: Infinity };
  for (const rx of world.roadsX) {
    const d = Math.abs(x - rx);
    if (d < best.d) best = { x: rx, y: clamp(y, 60, world.worldH - 60), d };
  }
  for (const ry of world.roadsY) {
    const d = Math.abs(y - ry);
    if (d < best.d) best = { x: clamp(x, 60, world.worldW - 60), y: ry, d };
  }
  return best;
}
export function roadDirection(world, x, y) {
  // Which road the point is closest to, and its axis: 'h' or 'v'.
  let dv = Infinity, dh = Infinity;
  for (const rx of world.roadsX) dv = Math.min(dv, Math.abs(x - rx));
  for (const ry of world.roadsY) dh = Math.min(dh, Math.abs(y - ry));
  return dv < dh ? 'v' : 'h';
}
export function hitsBuilding(world, x, y, r) {
  for (const b of world.buildings) {
    if (x + r > b.x && x - r < b.x + b.w && y + r > b.y && y - r < b.y + b.h) return b;
  }
  return null;
}
export function randomRoadPoint(world, rng) {
  const horiz = rng() < 0.5;
  if (horiz) {
    return { x: range(rng, 140, world.worldW - 140), y: pick(rng, world.roadsY), dir: rng() < 0.5 ? 0 : Math.PI };
  }
  return { x: pick(rng, world.roadsX), y: range(rng, 120, world.worldH - 120), dir: rng() < 0.5 ? Math.PI / 2 : -Math.PI / 2 };
}
export function randomSidewalkPoint(world, rng) {
  const p = randomRoadPoint(world, rng);
  const off = ROAD_W / 2 + 14;
  if (p.dir === 0 || p.dir === Math.PI) return { x: p.x, y: p.y + (rng() < 0.5 ? off : -off) };
  return { x: p.x + (rng() < 0.5 ? off : -off), y: p.y };
}
