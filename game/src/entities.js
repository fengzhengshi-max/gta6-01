// Neon Palms — cars, pedestrians, bullets and the little AIs that drive them.
import { CFG } from './config.js';
import { makeRng, pick, range, clamp, dist, angleDiff } from './random.js';
import { randomRoadPoint, randomSidewalkPoint, nearestRoadPoint, hitsBuilding, roadDirection } from './world.js';

const CAR_COLORS = ['#e8452c', '#2c7de8', '#e8c832', '#38c96a', '#c94fd6', '#e8e8e8', '#222831', '#ff7a2e'];
const PED_SHIRTS = ['#e8e8e8', '#ff7a2e', '#38c96a', '#c94fd6', '#2c7de8', '#ffb02e'];

export function makeCar(id, x, y, angle, color) {
  return { id, kind: 'car', x, y, angle, speed: 0, color: color || '#e8452c',
    health: 100, driver: null, police: false, stolen: false, dead: false, smoke: 0 };
}

export function spawnTraffic(world, rng, n, avoid) {
  const cars = [];
  for (let i = 0; i < n; i++) {
    const p = randomRoadPoint(world, rng);
    if (avoid && dist(p.x, p.y, avoid.x, avoid.y) < 220) continue;
    cars.push(makeCar('t' + i, p.x, p.y, p.dir, pick(rng, CAR_COLORS)));
    cars[cars.length - 1].speed = range(rng, 60, 130);
  }
  return cars;
}

export function spawnPedestrians(world, rng, n, avoid) {
  const peds = [];
  for (let i = 0; i < n; i++) {
    const p = randomSidewalkPoint(world, rng);
    if (avoid && dist(p.x, p.y, avoid.x, avoid.y) < 160) continue;
    peds.push({ id: 'p' + i, kind: 'ped', x: p.x, y: p.y, angle: range(rng, 0, Math.PI * 2),
      speed: range(rng, 28, 55), shirt: pick(rng, PED_SHIRTS), flee: 0, dead: false, walkPhase: range(rng, 0, 6) });
  }
  return peds;
}

export function updateTrafficCar(world, car, dt, cars, playerCar) {
  if (car.dead) return;
  // Slow for the car ahead on the same lane.
  let target = car.police ? 260 : 120;
  const aheadX = car.x + Math.cos(car.angle) * 70, aheadY = car.y + Math.sin(car.angle) * 70;
  for (const o of cars) {
    if (o === car || o.dead) continue;
    if (dist(aheadX, aheadY, o.x, o.y) < 46) { target = 0; break; }
  }
  if (playerCar && playerCar !== car && dist(aheadX, aheadY, playerCar.x, playerCar.y) < 46) target = 0;
  car.speed += clamp(target - car.speed, -260 * dt, 180 * dt);
  car.x += Math.cos(car.angle) * car.speed * dt;
  car.y += Math.sin(car.angle) * car.speed * dt;
  // Wrap around the city edges so traffic never runs out.
  if (car.x < 40) car.x = world.worldW - 60;
  if (car.x > world.worldW - 40) car.x = 60;
  if (car.y < 40) car.y = world.worldH - 60;
  if (car.y > world.worldH - 40) car.y = 60;
  // Snap back onto the road if drifting off (keeps the grid tidy).
  if (!car.police) {
    const np = nearestRoadPoint(world, car.x, car.y);
    if (np.d > 90) { car.x = np.x; car.y = np.y; }
  }
}

export function updatePed(world, ped, dt, danger) {
  if (ped.dead) return;
  ped.walkPhase += dt * 6;
  if (danger && dist(ped.x, ped.y, danger.x, danger.y) < 260) {
    ped.flee = 2.5;
    ped.angle = Math.atan2(ped.y - danger.y, ped.x - danger.x);
  }
  if (ped.flee > 0) {
    ped.flee -= dt;
    ped.x += Math.cos(ped.angle) * 130 * dt;
    ped.y += Math.sin(ped.angle) * 130 * dt;
  } else {
    ped.x += Math.cos(ped.angle) * ped.speed * dt;
    ped.y += Math.sin(ped.angle) * ped.speed * dt;
    if (Math.random() < dt * 0.25) ped.angle += (Math.random() - 0.5) * 1.6;
    if (hitsBuilding(world, ped.x, ped.y, 8)) ped.angle += Math.PI / 2;
  }
  ped.x = clamp(ped.x, 40, world.worldW - 40);
  ped.y = clamp(ped.y, 40, world.worldH - 40);
}

export function makeBullet(x, y, angle, fromPlayer) {
  return { x, y, vx: Math.cos(angle) * CFG.bulletSpeed, vy: Math.sin(angle) * CFG.bulletSpeed, life: 0.7, fromPlayer };
}
export function updateBullets(bullets, dt) {
  for (const b of bullets) { b.x += b.vx * dt; b.y += b.vy * dt; b.life -= dt; }
  return bullets.filter((b) => b.life > 0);
}
