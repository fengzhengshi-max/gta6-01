// The living city: traffic cars that drive the roads, pedestrians on the
// sidewalks, bullets in flight and the thugs some missions send after you.
// All of it is plain data updated by fixed steps; drawing lives in render.js.
import { CAR, CITY, PALETTE, PEDS, PLAYER, TRAFFIC, WORLD, roadX, roadY } from './config.js';
import { int, pick, range } from './random.js';

const CAR_COLORS = ['#8f9bb3', '#c96a5a', '#5a8fc9', '#c9b25a', '#7a5ac9', '#5ac98f', '#d8d8d8', '#3d3d4a'];
const PED_SHIRTS = ['#e8e2d4', '#ff9a3d', '#37e6ff', '#ff4fd8', '#a8ff4f', '#f2f2f2', '#c96a5a'];

/** A car body shared by traffic, the player's ride and police cars. */
export function makeCar(x, y, angle, color, kind) {
  return {
    kind, x, y, angle, color,
    speed: 0, health: CAR.health, occupied: kind === 'traffic',
    driver: null, // a pedestrian id when a traffic car has a driver
    dead: false, wrecked: false, brakeLight: false,
  };
}

/** Spawn one traffic car on a random road lane. */
export function spawnTrafficCar(random) {
  const vertical = random() < 0.5;
  const laneOffset = CITY.roadWidth / 4;
  let x; let y; let angle;
  if (vertical) {
    const road = int(random, 0, CITY.cols - 1);
    const dir = random() < 0.5 ? 1 : -1;
    x = roadX(road) + (dir > 0 ? laneOffset : -laneOffset);
    y = range(random, 0, WORLD.height);
    angle = dir > 0 ? Math.PI / 2 : -Math.PI / 2;
  } else {
    const road = int(random, 0, CITY.rows - 1);
    const dir = random() < 0.5 ? 1 : -1;
    x = range(random, 0, WORLD.width);
    y = roadY(road) + (dir > 0 ? laneOffset : -laneOffset);
    angle = dir > 0 ? 0 : Math.PI;
  }
  const car = makeCar(x, y, angle, random() < 0.12 ? PALETTE.taxi : pick(random, CAR_COLORS), 'traffic');
  car.speed = range(random, TRAFFIC.minSpeed, TRAFFIC.maxSpeed);
  car.cruise = car.speed;
  return car;
}

/** Spawn the traffic fleet on random road lanes. */
export function createTraffic(random) {
  const cars = [];
  for (let i = 0; i < TRAFFIC.count; i += 1) cars.push(spawnTrafficCar(random));
  return cars;
}

/** Drive traffic straight along its lane; slow for the car ahead, wrap at the edge. */
export function updateTraffic(cars, dt) {
  for (const car of cars) {
    if (car.wrecked || car.dead) continue;
    // Car ahead in the same lane?
    let ahead = Infinity;
    for (const other of cars) {
      if (other === car || other.wrecked || other.dead) continue;
      const dx = other.x - car.x;
      const dy = other.y - car.y;
      const along = dx * Math.cos(car.angle) + dy * Math.sin(car.angle);
      const side = Math.abs(-dx * Math.sin(car.angle) + dy * Math.cos(car.angle));
      if (along > 0 && along < 110 && side < 30) ahead = Math.min(ahead, along);
    }
    const target = ahead < 90 ? 0 : car.cruise;
    car.speed += (target - car.speed) * Math.min(1, dt * 2.5);
    car.x += Math.cos(car.angle) * car.speed * dt;
    car.y += Math.sin(car.angle) * car.speed * dt;
    if (car.x < -80) car.x = WORLD.width + 70;
    if (car.x > WORLD.width + 80) car.x = -70;
    if (car.y < -80) car.y = WORLD.height + 70;
    if (car.y > WORLD.height + 80) car.y = -70;
  }
}

/** Pedestrians: id, position, heading, speed, shirt colour, state. */
export function createPedestrians(random, city) {
  const peds = [];
  for (let i = 0; i < PEDS.count; i += 1) {
    // Start on a sidewalk beside a random block.
    const bx = int(random, 0, CITY.cols - 2);
    const by = int(random, 0, CITY.rows - 2);
    const edge = int(random, 0, 3);
    const blockX = roadX(bx) + CITY.roadWidth / 2;
    const blockY = roadY(by) + CITY.roadWidth / 2;
    const blockW = CITY.pitch - CITY.roadWidth;
    let x; let y;
    if (edge === 0) { x = blockX + range(random, 0, blockW); y = blockY - 7; }
    else if (edge === 1) { x = blockX + range(random, 0, blockW); y = blockY + blockW + 7; }
    else if (edge === 2) { x = blockX - 7; y = blockY + range(random, 0, blockW); }
    else { x = blockX + blockW + 7; y = blockY + range(random, 0, blockW); }
    peds.push({
      id: i, x, y, angle: range(random, 0, Math.PI * 2),
      speed: range(random, PEDS.walkSpeed * 0.7, PEDS.walkSpeed * 1.2),
      shirt: pick(random, PED_SHIRTS), state: 'walk', panic: 0,
      wanderTimer: range(random, 2, 6), dead: false, downTimer: 0,
    });
  }
  return peds;
}

/** Wander the sidewalks; run from the last gunshot or car that came too close. */
export function updatePedestrians(peds, dt, city, scare, random) {
  for (const ped of peds) {
    if (ped.dead) {
      ped.downTimer = Math.max(0, ped.downTimer - dt);
      continue;
    }
    if (ped.panic > 0) ped.panic -= dt;
    if (scare && ped.panic <= 0) {
      const dx = ped.x - scare.x;
      const dy = ped.y - scare.y;
      if (dx * dx + dy * dy < 320 * 320) {
        ped.panic = range(random, 1.5, 3);
        ped.angle = Math.atan2(dy, dx);
      }
    }
    ped.wanderTimer -= dt;
    if (ped.wanderTimer <= 0 && ped.panic <= 0) {
      ped.angle += range(random, -1.2, 1.2);
      ped.wanderTimer = range(random, 2, 6);
    }
    const speed = ped.panic > 0 ? PEDS.fleeSpeed : ped.speed;
    const nx = ped.x + Math.cos(ped.angle) * speed * dt;
    const ny = ped.y + Math.sin(ped.angle) * speed * dt;
    // Stay out of buildings and inside the world; bounce off the edges.
    const body = { x: nx, y: ny, radius: 12 };
    if (!city.collideCircle(body) && nx > 10 && nx < WORLD.width - 10 && ny > 10 && ny < WORLD.height - 10) {
      ped.x = nx;
      ped.y = ny;
    } else {
      ped.angle += Math.PI * (0.5 + random() * 0.5);
    }
  }
}

/** Bullets: fired by the player or by thugs. */
export function createBullets() {
  return [];
}

export function fireBullet(bullets, x, y, angle, from, damage) {
  bullets.push({
    x, y,
    vx: Math.cos(angle) * PLAYER.bulletSpeed,
    vy: Math.sin(angle) * PLAYER.bulletSpeed,
    from, damage, life: 1.2, dead: false,
  });
}

/**
 * Move bullets; returns hits as {target, kind, damage} for the caller to apply.
 * Targets are pedestrians, thugs and cars (traffic, police, player car).
 */
export function updateBullets(bullets, dt, city, targets) {
  const hits = [];
  for (const b of bullets) {
    if (b.dead) continue;
    b.x += b.vx * dt;
    b.y += b.vy * dt;
    b.life -= dt;
    if (b.life <= 0 || b.x < 0 || b.x > WORLD.width || b.y < 0 || b.y > WORLD.height) {
      b.dead = true;
      continue;
    }
    for (const t of targets) {
      if (t.dead || t.wrecked) continue;
      if (t.kind === 'ped' || t.kind === 'thug' || t.kind === 'player') {
        const dx = b.x - t.x;
        const dy = b.y - t.y;
        if (dx * dx + dy * dy < 16 * 16) {
          b.dead = true;
          hits.push({ target: t, kind: t.kind, damage: b.damage, from: b.from });
          break;
        }
      } else {
        // Car: test in the car's local frame.
        const cos = Math.cos(t.angle);
        const sin = Math.sin(t.angle);
        const lx = (b.x - t.x) * cos + (b.y - t.y) * sin;
        const ly = -(b.x - t.x) * sin + (b.y - t.y) * cos;
        if (Math.abs(lx) < CAR.length / 2 + 4 && Math.abs(ly) < CAR.width / 2 + 4) {
          b.dead = true;
          hits.push({ target: t, kind: 'car', damage: b.damage, from: b.from });
          break;
        }
      }
    }
  }
  return hits;
}

/** Thugs: hostile NPCs with health who shoot at the player when close. */
export function createThugs(random, positions) {
  return positions.map((pos, i) => ({
    kind: 'thug', id: `thug-${i}`, x: pos.x, y: pos.y,
    angle: range(random, 0, Math.PI * 2), health: 60, dead: false,
    shootTimer: range(random, 0.5, 1.5), speed: 120,
  }));
}

export function updateThugs(thugs, dt, player, bullets, random) {
  for (const thug of thugs) {
    if (thug.dead) continue;
    const dx = player.x - thug.x;
    const dy = player.y - thug.y;
    const dist = Math.hypot(dx, dy);
    thug.angle = Math.atan2(dy, dx);
    if (dist > 260) {
      // Close the distance.
      thug.x += (dx / dist) * thug.speed * dt;
      thug.y += (dy / dist) * thug.speed * dt;
    } else if (dist > 120) {
      // Strafe at mid range.
      thug.x += Math.cos(thug.angle + Math.PI / 2) * thug.speed * 0.4 * dt;
      thug.y += Math.sin(thug.angle + Math.PI / 2) * thug.speed * 0.4 * dt;
    }
    thug.shootTimer -= dt;
    if (thug.shootTimer <= 0 && dist < 420 && !player.dead) {
      fireBullet(bullets, thug.x + Math.cos(thug.angle) * 20, thug.y + Math.sin(thug.angle) * 20, thug.angle, 'thug', 12);
      thug.shootTimer = range(random, 0.9, 1.6);
    }
  }
}
