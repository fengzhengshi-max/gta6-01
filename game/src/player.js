// The player: on foot with fists and a pistol, or behind the wheel of a car
// (their own or one they just stole). Movement, driving physics, entering and
// leaving cars, punching and shooting — no drawing, no input reading.
import { CAR, HEAT, PLAYER, WORLD } from './config.js';
import { fireBullet, makeCar } from './entities.js';

export function createPlayer(spawn) {
  return {
    kind: 'player',
    x: spawn.x, y: spawn.y, angle: spawn.angle,
    health: PLAYER.health, dead: false,
    inCar: null, // the car object when driving, else null
    aimAngle: spawn.angle,
    ammo: PLAYER.magSize, reloading: 0,
    shootCooldown: 0, punchCooldown: 0, punchFlash: 0,
    hurtTimer: 0, bustTimer: 0,
    speed: 0, // current driving speed, for the HUD and engine sound
  };
}

/** The player's own car, parked outside the safehouse at the start. */
export function createPlayerCar(city) {
  const safe = city.landmarks.safehouse;
  const car = makeCar(safe.x + 90, safe.y + 46, 0, '#ff4fd8', 'player');
  car.occupied = false;
  return car;
}

function clampToWorld(body) {
  body.x = Math.max(PLAYER.radius, Math.min(WORLD.width - PLAYER.radius, body.x));
  body.y = Math.max(PLAYER.radius, Math.min(WORLD.height - PLAYER.radius, body.y));
}

/**
 * One step on foot. `move` is {x, y} (unit-ish), `sprint` a boolean.
 * Returns events: { punched: [...], shot: bool, enteredCar } via the game.
 */
export function updateOnFoot(player, dt, city, move, sprint, aimAngle) {
  player.aimAngle = aimAngle;
  const speed = sprint ? PLAYER.sprintSpeed : PLAYER.walkSpeed;
  const len = Math.hypot(move.x, move.y);
  if (len > 0.01) {
    const nx = player.x + (move.x / len) * speed * dt;
    const ny = player.y + (move.y / len) * speed * dt;
    const body = { x: nx, y: ny, radius: PLAYER.radius };
    city.collideCircle(body);
    clampToWorld(body);
    player.x = body.x;
    player.y = body.y;
    player.angle = Math.atan2(move.y, move.x);
  }
  if (player.shootCooldown > 0) player.shootCooldown -= dt;
  if (player.punchCooldown > 0) player.punchCooldown -= dt;
  if (player.punchFlash > 0) player.punchFlash -= dt;
  if (player.reloading > 0) {
    player.reloading -= dt;
    if (player.reloading <= 0) player.ammo = PLAYER.magSize;
  }
  if (player.hurtTimer > 0) player.hurtTimer -= dt;
}

/** Punch: every pedestrian/thug in the arc in front takes damage. Returns hits. */
export function playerPunch(player, targets) {
  if (player.punchCooldown > 0 || player.inCar) return [];
  player.punchCooldown = PLAYER.punchCooldown;
  player.punchFlash = 0.18;
  const hits = [];
  for (const t of targets) {
    if (t.dead) continue;
    const dx = t.x - player.x;
    const dy = t.y - player.y;
    const dist = Math.hypot(dx, dy);
    if (dist > PLAYER.punchRange + 12) continue;
    const toTarget = Math.atan2(dy, dx);
    let diff = Math.abs(toTarget - player.aimAngle);
    if (diff > Math.PI) diff = Math.PI * 2 - diff;
    if (diff < PLAYER.punchArc) hits.push({ target: t, kind: t.kind, damage: PLAYER.punchDamage });
  }
  return hits;
}

/** Shoot toward the aim angle. Returns true when a shot actually left the gun. */
export function playerShoot(player, bullets) {
  if (player.inCar || player.shootCooldown > 0 || player.reloading > 0) return false;
  if (player.ammo <= 0) {
    player.reloading = PLAYER.reloadTime;
    return false;
  }
  player.ammo -= 1;
  player.shootCooldown = PLAYER.shootCooldown;
  const mx = player.x + Math.cos(player.aimAngle) * 22;
  const my = player.y + Math.sin(player.aimAngle) * 22;
  fireBullet(bullets, mx, my, player.aimAngle, 'player', PLAYER.gunDamage);
  return true;
}

export function playerReload(player) {
  if (!player.inCar && player.reloading <= 0 && player.ammo < PLAYER.magSize) {
    player.reloading = PLAYER.reloadTime;
  }
}

/**
 * Driving: W/S accelerate and brake, A/D steer (steering flips in reverse),
 * the car slides a little, scrapes buildings and loses speed on impact.
 * Returns { crashed: boolean } when the car hit a building hard this step.
 */
export function updateDriving(player, dt, city, throttle, steer, brake) {
  const car = player.inCar;
  if (!car) return { crashed: false };
  const forward = Math.cos(car.angle);
  const right = Math.sin(car.angle);
  // Forward speed along the car's heading.
  let speed = car.speed;
  if (throttle > 0) speed += CAR.accel * throttle * dt;
  else if (throttle < 0) speed -= CAR.reverseAccel * dt;
  if (brake) speed -= Math.sign(speed) * CAR.brake * dt;
  // Drag and rolling resistance.
  speed -= speed * CAR.drag * dt;
  if (Math.abs(speed) < 4 && throttle === 0 && !brake) speed = 0;
  speed = Math.max(-CAR.maxReverse, Math.min(CAR.maxSpeed, speed));
  car.speed = speed;
  player.speed = speed;

  // Steering: less bite at a standstill, none in reverse beyond a crawl.
  const steerAmount = steer * CAR.steer * dt * Math.min(1, Math.abs(speed) / 140) * (speed >= 0 ? 1 : -1);
  car.angle += steerAmount;
  car.brakeLight = brake || throttle < 0;

  const nx = car.x + Math.cos(car.angle) * speed * dt;
  const ny = car.y + Math.sin(car.angle) * speed * dt;
  const hit = city.carHitsBuilding(nx, ny, car.angle, CAR.length, CAR.width);
  let crashed = false;
  if (hit) {
    // Scrape: stop, take a little damage, bounce back slightly.
    if (Math.abs(speed) > 120) {
      car.health -= Math.abs(speed) * 0.04;
      crashed = true;
    }
    car.speed *= -0.25;
    player.speed = car.speed;
  } else {
    car.x = nx;
    car.y = ny;
  }
  car.x = Math.max(30, Math.min(WORLD.width - 30, car.x));
  car.y = Math.max(30, Math.min(WORLD.height - 30, car.y));
  player.x = car.x;
  player.y = car.y;
  player.angle = car.angle;
  player.aimAngle = car.angle;
  return { crashed };
}

/** Nearest car the player could climb into, or null. */
export function nearestEnterableCar(player, cars) {
  let best = null;
  let bestDist = CAR.enterRange;
  for (const car of cars) {
    if (car.wrecked || car.dead) continue;
    const d = Math.hypot(car.x - player.x, car.y - player.y);
    if (d < bestDist) { bestDist = d; best = car; }
  }
  return best;
}

/**
 * Climb into a car. Stealing a traffic car scares its driver out and counts as
 * a crime; the player's own car and empty cars are free. Returns 'stole' |
 * 'entered' | null.
 */
export function enterCar(player, car) {
  if (!car || player.inCar) return null;
  const stole = car.kind === 'traffic' && car.occupied;
  if (stole) {
    car.occupied = false;
    // The driver bails and runs.
    if (car.driver) {
      car.driver.panic = 3;
      car.driver.angle = Math.atan2(car.driver.y - car.y, car.driver.x - car.x);
      car.driver = null;
    }
  }
  player.inCar = car;
  car.occupied = true;
  car.kind = 'player';
  player.speed = 0;
  return stole ? 'stole' : 'entered';
}

/** Step out onto the road beside the car. */
export function exitCar(player) {
  const car = player.inCar;
  if (!car) return;
  player.inCar = null;
  car.speed = 0;
  player.speed = 0;
  // Step out on the driver's side.
  player.x = car.x - Math.sin(car.angle) * 34;
  player.y = car.y + Math.cos(car.angle) * 34;
  player.angle = car.angle;
  const body = { x: player.x, y: player.y, radius: PLAYER.radius };
  // Never spawn inside a wall: nudge out if needed.
  player.x = body.x;
  player.y = body.y;
}

/** Damage the player; returns true when this kills them. */
export function hurtPlayer(player, damage) {
  if (player.dead) return false;
  player.health -= damage;
  player.hurtTimer = 0.4;
  if (player.health <= 0) {
    player.health = 0;
    player.dead = true;
    return true;
  }
  return false;
}

/** Heal (first-aid at the safehouse) and repair the driven car. */
export function healPlayer(player, amount) {
  player.health = Math.min(PLAYER.health, player.health + amount);
  if (player.inCar) player.inCar.health = Math.min(CAR.health, player.inCar.health + amount);
}

export { HEAT };
