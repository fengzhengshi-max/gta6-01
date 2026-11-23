// Neon Palms — wanted stars and the police who answer them.
import { CFG } from './config.js';
import { makeRng, pick, range, clamp, dist, angleDiff, angleTo } from './random.js';
import { randomRoadPoint, nearestRoadPoint } from './world.js';
import { makeCar } from './entities.js';

export function addWanted(game, stars, reason) {
  game.wanted = clamp(game.wanted + stars, 0, 5);
  game.quietTimer = 0;
  game.lastCrime = reason || 'crime';
  if (game.wanted > 0) game.sound.sirenTick(true);
}
export function updateWanted(game, dt) {
  if (game.wanted === 0) return;
  game.quietTimer += dt;
  if (game.quietTimer >= CFG.wantedDecayQuiet) {
    game.wanted -= 1; game.quietTimer = 0;
    if (game.wanted === 0) game.sound.sirenTick(false);
  }
}
export function spawnPolice(game, rng) {
  // Spawn on a road near the player, up to one car per wanted star.
  const want = Math.min(game.wanted, CFG.maxPolice);
  while (game.police.length < want) {
    const p = randomRoadPoint(game.world, rng);
    if (dist(p.x, p.y, game.player.x, game.player.y) < 320) continue;
    const car = makeCar('cop' + game.police.length + Date.now() % 1000, p.x, p.y, p.dir, '#1c3fae');
    car.police = true; car.speed = 200;
    game.police.push(car); game.cars.push(car);
  }
  // Remove surplus when stars decay.
  while (game.police.length > want) {
    const c = game.police.pop(); c.dead = true;
    game.cars = game.cars.filter((x) => x !== c);
  }
}
export function updatePolice(game, dt) {
  const p = game.player;
  for (const cop of game.police) {
    if (cop.dead) continue;
    const d = dist(cop.x, cop.y, p.x, p.y);
    const targetAngle = angleTo(cop.x, cop.y, p.x, p.y);
    // Steer toward the player, faster when the player is in a car.
    const chaseSpeed = p.inCar ? 300 : 170;
    cop.angle += clamp(angleDiff(cop.angle, targetAngle), -2.4 * dt, 2.4 * dt);
    cop.speed += clamp(chaseSpeed - cop.speed, -300 * dt, 200 * dt);
    cop.x += Math.cos(cop.angle) * cop.speed * dt;
    cop.y += Math.sin(cop.angle) * cop.speed * dt;
    cop.x = clamp(cop.x, 30, game.world.worldW - 30);
    cop.y = clamp(cop.y, 30, game.world.worldH - 30);
    if (p.inCar && d < 52) {
      // Ram: shove the player's car and dent it.
      const a = angleTo(cop.x, cop.y, p.inCar.x, p.inCar.y);
      p.inCar.x += Math.cos(a) * 26; p.inCar.y += Math.sin(a) * 26;
      p.inCar.health -= 6 * dt * 10; cop.speed *= 0.55;
      if (p.inCar.health <= 0) { p.inCar.health = 0; game.onCarWrecked(); }
      game.sound.crash();
    }
    if (!p.inCar && d < 30) {
      game.bustedTimer += dt;
      if (game.bustedTimer >= CFG.bustedHold) game.onBusted();
    }
  }
  if (game.police.length === 0 || dist(game.police[0].x, game.police[0].y, p.x, p.y) > 40) {
    if (!p.inCar) game.bustedTimer = Math.max(0, game.bustedTimer - dt * 2);
  }
}
