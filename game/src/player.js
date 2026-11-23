// Neon Palms — the player, on foot and behind the wheel.
import { CFG } from './config.js';
import { clamp, dist } from './random.js';
import { hitsBuilding as hitB } from './world.js';

export function makePlayer(x, y) {
  return { x, y, angle: -Math.PI / 2, health: 100, money: 0, cash: 0,
    inCar: null, speed: 0, aimAngle: 0, ammo: CFG.pistolMag, reserve: 48,
    punchCooldown: 0, shootCooldown: 0, reloadTimer: 0, walkPhase: 0, moving: false };
}

export function updateOnFoot(game, dt, input) {
  const p = game.player, w = game.world;
  let mx = 0, my = 0;
  if (input.down('KeyW') || input.down('ArrowUp')) my -= 1;
  if (input.down('KeyS') || input.down('ArrowDown')) my += 1;
  if (input.down('KeyA') || input.down('ArrowLeft')) mx -= 1;
  if (input.down('KeyD') || input.down('ArrowRight')) mx += 1;
  const run = input.down('ShiftLeft') || input.down('ShiftRight');
  const spd = (run ? CFG.runSpeed : CFG.walkSpeed);
  p.moving = mx !== 0 || my !== 0;
  if (p.moving) {
    const len = Math.hypot(mx, my); mx /= len; my /= len;
    p.angle = Math.atan2(my, mx);
    p.walkPhase += dt * (run ? 13 : 9);
    const nx = p.x + mx * spd * dt, ny = p.y + my * spd * dt;
    if (!hitB(w, nx, p.y, 12)) p.x = nx;
    if (!hitB(w, p.x, ny, 12)) p.y = ny;
  }
  p.x = clamp(p.x, 30, w.worldW - 30);
  p.y = clamp(p.y, 30, w.worldH - 30);
  p.punchCooldown = Math.max(0, p.punchCooldown - dt);
  p.shootCooldown = Math.max(0, p.shootCooldown - dt);
  if (p.reloadTimer > 0) {
    p.reloadTimer -= dt;
    if (p.reloadTimer <= 0) {
      const need = CFG.pistolMag - p.ammo, take = Math.min(need, p.reserve);
      p.ammo += take; p.reserve -= take;
    }
  }
  // Aim follows the mouse (screen -> world via camera).
  p.aimAngle = Math.atan2(input.mouseWorldY - p.y, input.mouseWorldX - p.x);
}

export function updateDriving(game, dt, input) {
  const p = game.player, car = p.inCar;
  const fwd = input.down('KeyW') || input.down('ArrowUp');
  const back = input.down('KeyS') || input.down('ArrowDown');
  const left = input.down('KeyA') || input.down('ArrowLeft');
  const right = input.down('KeyD') || input.down('ArrowRight');
  const dir = car.speed >= 0 ? 1 : -1;
  if (fwd) car.speed += CFG.carAccel * dt;
  if (back) car.speed -= (car.speed > 5 ? CFG.carBrake : CFG.carAccel * 0.6) * dt;
  if (!fwd && !back) car.speed -= car.speed * CFG.carDrag * dt;
  car.speed = clamp(car.speed, -CFG.carReverseMax, CFG.carMax);
  const steer = (left ? -1 : 0) + (right ? 1 : 0);
  const turnRate = CFG.carTurn * clamp(Math.abs(car.speed) / 120, 0, 1) * dir;
  car.angle += steer * turnRate * dt;
  // Drift feel: velocity blends toward heading instead of snapping to it.
  const vx = Math.cos(car.angle) * car.speed, vy = Math.sin(car.angle) * car.speed;
  car.vx = car.vx === undefined ? vx : car.vx + (vx - car.vx) * Math.min(1, CFG.carGrip * dt);
  car.vy = car.vy === undefined ? vy : car.vy + (vy - car.vy) * Math.min(1, CFG.carGrip * dt);
  const nx = car.x + car.vx * dt, ny = car.y + car.vy * dt;
  const w = game.world;
  if (hitB(w, nx, car.y, 18)) { car.speed *= -0.25; car.vx *= -0.3; game.onCrash(Math.abs(car.speed)); }
  else car.x = nx;
  if (hitB(w, car.x, ny, 18)) { car.speed *= -0.25; car.vy *= -0.3; game.onCrash(Math.abs(car.speed)); }
  else car.y = ny;
  car.x = clamp(car.x, 30, w.worldW - 30);
  car.y = clamp(car.y, 30, w.worldH - 30);
  p.x = car.x; p.y = car.y; p.angle = car.angle;
  game.sound.setEngine(clamp(Math.abs(car.speed) / CFG.carMax, 0, 1), true);
}

export function nearestCar(game, maxD) {
  let best = null, bd = maxD;
  for (const c of game.cars) {
    if (c.dead || c.police) continue;
    const d = dist(game.player.x, game.player.y, c.x, c.y);
    if (d < bd) { bd = d; best = c; }
  }
  return best;
}

export function enterCar(game, car) {
  const p = game.player;
  p.inCar = car; car.stolen = true; car.driver = null;
  game.sound.pickup();
}
export function exitCar(game) {
  const p = game.player, car = p.inCar;
  if (!car) return;
  p.inCar = null;
  p.x = car.x + Math.cos(car.angle + Math.PI / 2) * 34;
  p.y = car.y + Math.sin(car.angle + Math.PI / 2) * 34;
  game.sound.setEngine(0, false);
}
