// The city itself: a road grid, blocks of buildings, a park, a beach strip and
// the named landmarks the missions point at. Pure data and geometry — no
// drawing, no input — so the same city can be built for play or for a shot.
import { CITY, PALETTE, WORLD, roadX, roadY } from './config.js';
import { int, pick, range } from './random.js';

const NEON = [PALETTE.neonPink, PALETTE.neonCyan, PALETTE.neonOrange, PALETTE.neonLime, PALETTE.neonYellow];
const ROOFS = ['#312a44', '#3a2f52', '#2c3a4a', '#453550', '#2f2a3d'];

/** Named places the story uses; each has a door spot on the road beside it. */
export const LANDMARKS = [
  { id: 'bar', name: "Mara's Bar — The Flamingo", block: [1, 1], color: PALETTE.neonPink },
  { id: 'hotel', name: 'Palm Court Hotel', block: [4, 1], color: PALETTE.neonCyan },
  { id: 'bank', name: 'Sunset Bank', block: [5, 3], color: PALETTE.neonYellow },
  { id: 'warehouse', name: 'Warehouse 9', block: [6, 4], color: PALETTE.neonOrange },
  { id: 'safehouse', name: 'Safehouse — Coral Court', block: [0, 4], color: PALETTE.neonLime },
  { id: 'pier', name: 'Neon Pier', block: [3, 4], color: PALETTE.neonCyan },
];

function blockRect(bx, by) {
  const m = CITY.sidewalk;
  return {
    x: roadX(bx) + CITY.roadWidth / 2 + m,
    y: roadY(by) + CITY.roadWidth / 2 + m,
    w: CITY.pitch - CITY.roadWidth - m * 2,
    h: CITY.pitch - CITY.roadWidth - m * 2,
  };
}

/** Is point (x, y) on a road (including sidewalks)? */
export function onRoad(x, y) {
  const half = CITY.roadWidth / 2;
  for (let i = 0; i < CITY.cols; i += 1) if (Math.abs(x - roadX(i)) <= half) return true;
  for (let j = 0; j < CITY.rows; j += 1) if (Math.abs(y - roadY(j)) <= half) return true;
  return false;
}

/** Nearest point on a road centreline to (x, y), for spawning cars and cops. */
export function nearestRoadPoint(x, y, random) {
  let best = null;
  let bestDist = Infinity;
  for (let i = 0; i < CITY.cols; i += 1) {
    const d = Math.abs(x - roadX(i));
    if (d < bestDist) { bestDist = d; best = { x: roadX(i), y, vertical: true }; }
  }
  for (let j = 0; j < CITY.rows; j += 1) {
    const d = Math.abs(y - roadY(j));
    if (d < bestDist) { bestDist = d; best = { x, y: roadY(j), vertical: false }; }
  }
  return best;
}

export function createCity(random) {
  const buildings = [];
  const parks = [];
  const palms = [];
  const landmarks = {};

  // The bottom row of blocks is the beach: sand, sea beyond, palm trees.
  const beachTop = roadY(CITY.rows - 1) + CITY.roadWidth / 2;

  for (let by = 0; by < CITY.rows - 1; by += 1) {
    for (let bx = 0; bx < CITY.cols - 1; bx += 1) {
      const rect = blockRect(bx, by);
      const landmark = LANDMARKS.find((entry) => entry.block[0] === bx && entry.block[1] === by);
      // Two blocks are parks, not buildings.
      if ((bx === 3 && by === 2) || (bx === 2 && by === 4)) {
        parks.push({ ...rect, trees: int(random, 5, 9) });
        continue;
      }
      const count = landmark ? 1 : int(random, 1, 3);
      if (count === 1) {
        const w = rect.w * range(random, 0.55, 0.8);
        const h = rect.h * range(random, 0.55, 0.8);
        buildings.push({
          x: rect.x + (rect.w - w) / 2, y: rect.y + (rect.h - h) / 2, w, h,
          roof: landmark ? '#3d2b52' : pick(random, ROOFS),
          neon: landmark ? landmark.color : pick(random, NEON),
          landmark: landmark ? landmark.id : null,
        });
      } else {
        // Split the block into two buildings side by side.
        const gap = 18;
        const w = (rect.w - gap) / 2;
        for (let half = 0; half < 2; half += 1) {
          const h = rect.h * range(random, 0.6, 0.9);
          buildings.push({
            x: rect.x + half * (w + gap), y: rect.y + (rect.h - h) / 2, w, h,
            roof: pick(random, ROOFS), neon: pick(random, NEON), landmark: null,
          });
        }
      }
      if (landmark) {
        const b = buildings[buildings.length - 1];
        // Door spot: the sidewalk just south of the landmark building.
        landmarks[landmark.id] = {
          ...landmark,
          x: b.x + b.w / 2,
          y: b.y + b.h + CITY.sidewalk + 6,
          building: b,
        };
      }
    }
  }

  // Palm trees along the beach and a few on park edges.
  for (let i = 0; i < 26; i += 1) {
    palms.push({
      x: range(random, 40, WORLD.width - 40),
      y: range(random, beachTop + 14, WORLD.height - 16),
      lean: range(random, -0.4, 0.4),
    });
  }
  for (const park of parks) {
    for (let i = 0; i < park.trees; i += 1) {
      palms.push({
        x: park.x + range(random, 16, park.w - 16),
        y: park.y + range(random, 16, park.h - 16),
        lean: range(random, -0.3, 0.3),
      });
    }
  }

  /** Push a circle (x, y, radius) out of every building it overlaps. Returns true if pushed. */
  function collideCircle(body) {
    let hit = false;
    for (const b of buildings) {
      const cx = Math.max(b.x, Math.min(body.x, b.x + b.w));
      const cy = Math.max(b.y, Math.min(body.y, b.y + b.h));
      const dx = body.x - cx;
      const dy = body.y - cy;
      const d2 = dx * dx + dy * dy;
      if (d2 >= body.radius * body.radius) continue;
      hit = true;
      if (d2 > 0.0001) {
        const d = Math.sqrt(d2);
        body.x = cx + (dx / d) * body.radius;
        body.y = cy + (dy / d) * body.radius;
      } else {
        // Dead centre: push out along the smallest penetration axis.
        const left = body.x - b.x;
        const right = b.x + b.w - body.x;
        const top = body.y - b.y;
        const bottom = b.y + b.h - body.y;
        const min = Math.min(left, right, top, bottom);
        if (min === left) body.x = b.x - body.radius;
        else if (min === right) body.x = b.x + b.w + body.radius;
        else if (min === top) body.y = b.y - body.radius;
        else body.y = b.y + b.h + body.radius;
      }
    }
    return hit;
  }

  /** Does an axis-aligned car rectangle (centre, angle) overlap a building? */
  function carHitsBuilding(x, y, angle, length, width) {
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    const hl = length / 2;
    const hw = width / 2;
    for (const b of buildings) {
      // Transform the building into the car's local frame and test overlap.
      const corners = [
        [b.x, b.y], [b.x + b.w, b.y], [b.x + b.w, b.y + b.h], [b.x, b.y + b.h],
      ];
      let minX = Infinity; let maxX = -Infinity; let minY = Infinity; let maxY = -Infinity;
      for (const [px, py] of corners) {
        const lx = (px - x) * cos + (py - y) * sin;
        const ly = -(px - x) * sin + (py - y) * cos;
        minX = Math.min(minX, lx); maxX = Math.max(maxX, lx);
        minY = Math.min(minY, ly); maxY = Math.max(maxY, ly);
      }
      if (maxX > -hl && minX < hl && maxY > -hw && minY < hw) return b;
    }
    return null;
  }

  return {
    buildings, parks, palms, landmarks, beachTop,
    collideCircle, carHitsBuilding,
  };
}

/** Player start: on the sidewalk outside Mara's bar. */
export function spawnPoint(city) {
  const bar = city.landmarks.bar;
  return { x: bar.x, y: bar.y + 30, angle: -Math.PI / 2 };
}
