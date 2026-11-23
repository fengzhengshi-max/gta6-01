// The wanted system: stars rise with crimes, police cars spawn at the edge of
// view and chase the player, ramming cars and busting the player on foot.
// Stars decay after a quiet spell with no cops nearby.
import { CAR, HEAT, POLICE, WORLD } from './config.js';
import { makeCar } from './entities.js';
import { nearestRoadPoint } from './world.js';

export function createPolice() {
  return {
    stars: 0, // fractional heat; the HUD shows the ceiling, capped at 5
    heat: 0,
    quietTimer: 0,
    decayTimer: 0,
    cars: [],
    bustProgress: 0,
    sirenPhase: 0,
  };
}

/** Whole stars shown on the HUD, 0 to 5. */
export function wantedStars(police) {
  return Math.max(0, Math.min(5, Math.ceil(police.stars - 0.001)));
}

/** Add heat for a crime and reset the quiet timer. */
export function addHeat(police, amount) {
  police.stars = Math.min(5, police.stars + amount);
  police.heat = police.stars;
  police.quietTimer = 0;
  police.decayTimer = 0;
}

export function clearWanted(police) {
  police.stars = 0;
  police.heat = 0;
  police.bustProgress = 0;
  for (const car of police.cars) car.dead = true;
  police.cars = [];
}

/** Spawn one police car on a road some distance from the player. */
function spawnPoliceCar(police, player, random) {
  const angle = random() * Math.PI * 2;
  const px = player.x + Math.cos(angle) * POLICE.spawnDistance;
  const py = player.y + Math.sin(angle) * POLICE.spawnDistance;
  const road = nearestRoadPoint(
    Math.max(60, Math.min(WORLD.width - 60, px)),
    Math.max(60, Math.min(WORLD.height - 60, py)),
    random,
  );
  const car = makeCar(road.x, road.y, random() * Math.PI * 2, '#2f6df6', 'police');
  car.cruise = POLICE.speed;
  police.cars.push(car);
  return car;
}

/**
 * One step: keep the right number of police cars on the road, chase the player,
 * ram them, and bust them on foot. Returns events for the caller:
 * { rammedPlayer, busted }.
 */
export function updatePolice(police, dt, player, city, random) {
  const events = { rammedPlayer: false, busted: false };
  const stars = wantedStars(police);
  police.sirenPhase += dt;

  // Wanted decays after a quiet spell (no crime, no cop close by).
  let copNear = false;
  for (const car of police.cars) {
    if (!car.dead && Math.hypot(car.x - player.x, car.y - player.y) < 500) copNear = true;
  }
  if (stars > 0 && !copNear) {
    police.quietTimer += dt;
    if (police.quietTimer > POLICE.decayDelay) {
      police.decayTimer += dt;
      if (police.decayTimer >= POLICE.decayInterval) {
        police.decayTimer = 0;
        police.stars = Math.max(0, police.stars - 1);
      }
    }
  } else {
    police.quietTimer = 0;
    police.decayTimer = 0;
  }

  // Keep the fleet at the wanted level's size.
  const wanted = Math.min(POLICE.maxCars, stars);
  const alive = police.cars.filter((car) => !car.dead);
  if (alive.length < wanted) spawnPoliceCar(police, player, random);
  if (alive.length > wanted) {
    // Too many: retire the farthest one.
    alive.sort((a, b) => Math.hypot(b.x - player.x, b.y - player.y) - Math.hypot(a.x - player.x, a.y - player.y));
    alive[0].dead = true;
  }
  police.cars = police.cars.filter((car) => !car.dead);

  // Chase: steer toward the player, ram, and slide off buildings.
  for (const car of police.cars) {
    const dx = player.x - car.x;
    const dy = player.y - car.y;
    const dist = Math.hypot(dx, dy) || 1;
    const targetAngle = Math.atan2(dy, dx);
    let diff = targetAngle - car.angle;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    car.angle += Math.max(-2.4 * dt, Math.min(2.4 * dt, diff));
    const speed = dist > 120 ? POLICE.speed : POLICE.speed * 0.55;
    const nx = car.x + Math.cos(car.angle) * speed * dt;
    const ny = car.y + Math.sin(car.angle) * speed * dt;
    if (!city.carHitsBuilding(nx, ny, car.angle, CAR.length, CAR.width)) {
      car.x = nx;
      car.y = ny;
    } else {
      // Slide along the wall instead of stopping dead.
      car.angle += 0.9 * dt * (diff >= 0 ? 1 : -1);
    }
    car.speed = speed;

    // Ram the player's car, or bust the player on foot.
    if (dist < 52) {
      if (player.inCar) {
        const target = player.inCar;
        target.health -= POLICE.ramDamage * dt * 4;
        if (target.health <= 0 && !target.wrecked) {
          target.wrecked = true;
          target.health = 0;
        }
        events.rammedPlayer = true;
        addHeat(police, HEAT.copRam * dt);
      } else if (!player.dead) {
        police.bustProgress += dt;
        if (police.bustProgress >= POLICE.bustTime) {
          events.busted = true;
          police.bustProgress = 0;
        }
      }
    }
  }
  if (events.rammedPlayer === false && player.inCar === null) {
    // No cop touching the player on foot: the bust meter drains.
    police.bustProgress = Math.max(0, police.bustProgress - dt * 2);
  }
  return events;
}

/** The player is busted: fine, lose the wanted level, respawn at the station. */
export function applyBust(police, player, city) {
  clearWanted(police);
  if (player.inCar) {
    player.inCar.occupied = false;
    player.inCar = null;
  }
  player.x = city.landmarks.bar.x;
  player.y = city.landmarks.bar.y + 40;
  player.health = Math.max(30, player.health);
  player.bustTimer = 0;
}
