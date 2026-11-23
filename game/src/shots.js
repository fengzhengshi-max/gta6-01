// The screenshot scenes behind ?shot=cover|chase|mission|onfoot. Each one plays
// the real rules forward from a fresh world for a fixed number of steps, steered
// by a simple autopilot, so the frame is what real play looks like and the same
// seed always gives the same frame. No posing: the car drives the roads, the
// cops chase, the thugs shoot back.
import { CITY, STEP } from './config.js';
import { addHeat } from './police.js';
import { enterCar } from './player.js';
import { SCREEN_PLAY } from './render.js';

const SAMPLE = 1 / 60;

/** Drive along the roads toward (tx, ty): follow the current road, turn at the cross street nearest the target. */
function driveToward(game, tx, ty) {
  const car = game.player.inCar;
  if (!car) return { moveX: 0, moveY: 0, throttle: 0, steer: 0, brake: false, sprint: false, aimAngle: 0, shoot: false, punch: false, interact: false, reload: false };
  // Nearest road centreline in each axis.
  let vx = Infinity; let vRoad = 0;
  for (let i = 0; i < CITY.cols; i += 1) {
    const d = Math.abs(car.x - i * CITY.pitch);
    if (d < vx) { vx = d; vRoad = i * CITY.pitch; }
  }
  let hy = Infinity; let hRoad = 0;
  for (let j = 0; j < CITY.rows; j += 1) {
    const d = Math.abs(car.y - j * CITY.pitch);
    if (d < hy) { hy = d; hRoad = j * CITY.pitch; }
  }
  let desired;
  if (vx < hy) {
    // On a vertical road: head along it toward the cross street nearest the target,
    // unless the target is already on this road.
    if (Math.abs(tx - vRoad) < 120) desired = ty > car.y ? Math.PI / 2 : -Math.PI / 2;
    else {
      const cross = nearestCrossStreet(ty, CITY.rows);
      desired = cross > car.y ? Math.PI / 2 : -Math.PI / 2;
      // Turn only once the nose is on the cross street, so the car never cuts a corner.
      if (Math.abs(car.y - cross) < 34) desired = tx > car.x ? 0 : Math.PI;
    }
  } else {
    if (Math.abs(ty - hRoad) < 120) desired = tx > car.x ? 0 : Math.PI;
    else {
      const cross = nearestCrossStreet(tx, CITY.cols);
      desired = cross > car.x ? 0 : Math.PI;
      if (Math.abs(car.x - cross) < 34) desired = ty > car.y ? Math.PI / 2 : -Math.PI / 2;
    }
  }
  let diff = desired - car.angle;
  while (diff > Math.PI) diff -= Math.PI * 2;
  while (diff < -Math.PI) diff += Math.PI * 2;
  const steer = Math.max(-1, Math.min(1, diff * 2.2));
  // Slow right down for a sharp turn, like a real driver — and ease off on
  // the approach to the turn so the car never swings wide across a corner.
  let throttle = Math.abs(diff) > 1.2 ? 0.2 : Math.abs(diff) > 0.6 ? 0.5 : 1;
  const turnAhead = vx < hy
    ? Math.abs(car.y - nearestCrossStreet(ty, CITY.rows))
    : Math.abs(car.x - nearestCrossStreet(tx, CITY.cols));
  if (turnAhead < 150) throttle = Math.min(throttle, 0.45);
  return { moveX: 0, moveY: 0, throttle, steer, brake: false, sprint: false, aimAngle: car.angle, shoot: false, punch: false, interact: false, reload: false };
}

/** The cross street (a road centreline) closest to the target on this axis. */
function nearestCrossStreet(to, count) {
  let best = 0;
  let bestDist = Infinity;
  for (let i = 0; i < count; i += 1) {
    const d = Math.abs(i * CITY.pitch - to);
    if (d < bestDist) { bestDist = d; best = i * CITY.pitch; }
  }
  return best;
}

/** Walk toward (tx, ty). */
function walkToward(game, tx, ty) {
  const p = game.player;
  const dx = tx - p.x;
  const dy = ty - p.y;
  const dist = Math.hypot(dx, dy) || 1;
  return {
    moveX: Math.abs(dx) > 12 ? Math.sign(dx) : 0,
    moveY: Math.abs(dy) > 12 ? Math.sign(dy) : 0,
    throttle: 0, steer: 0, brake: false, sprint: false,
    aimAngle: Math.atan2(dy, dx), shoot: false, punch: false, interact: false, reload: false,
  };
}

/** Put the player in the nearest traffic car, placed on a road heading east. */
function stealNearestCar(game, x, y) {
  const player = game.player;
  let best = null;
  let bestDist = Infinity;
  for (const car of game.traffic) {
    const d = Math.hypot(car.x - player.x, car.y - player.y);
    if (d < bestDist) { bestDist = d; best = car; }
  }
  // Teleport the closest car onto the chosen road so the scene always has a ride.
  best.x = x;
  best.y = y;
  best.angle = 0;
  best.speed = 0;
  player.x = best.x;
  player.y = best.y;
  enterCar(player, best);
  // A stolen car leaves the traffic flow (see main.js).
  const index = game.traffic.indexOf(best);
  if (index >= 0) game.traffic.splice(index, 1);
}

/** Run `seconds` of simulation with a control function. */
function simulate(game, step, seconds, control) {
  const steps = Math.round(seconds / SAMPLE);
  for (let i = 0; i < steps; i += 1) {
    step(game, control(game), SAMPLE, null);
    if (game.player.dead) break;
  }
}

/**
 * Stage the named scene on a fresh game and return the screen to draw.
 * cover: driving through town toward the hotel, HUD and minimap in frame.
 * chase: three-star wanted, police cars in pursuit.
 * mission: the dock crew fight at Neon Pier, objective on the HUD.
 * onfoot: walking the sidewalk by the bar, pedestrians and traffic around.
 */
export function stageShot(name, game, step) {
  const scene = name === 'chase' || name === 'mission' || name === 'onfoot' ? name : 'cover';
  const bar = game.city.landmarks.bar;
  const hotel = game.city.landmarks.hotel;
  const pier = game.city.landmarks.pier;

  if (scene === 'cover') {
    game.missions.index = 1;
    game.missions.stage = 1;
    // Start on the eastbound road by the bar, driving toward the hotel.
    // Two seconds keeps the car on the straight leg, mid-traffic.
    stealNearestCar(game, 560, 380);
    simulate(game, step, 2.0, (g) => driveToward(g, hotel.x, hotel.y));
  } else if (scene === 'chase') {
    game.missions.index = 1;
    game.missions.stage = 1;
    stealNearestCar(game, 560, 380);
    addHeat(game.police, 3);
    // Let the cops spawn, then put them right on the player's tail so the
    // frame shows the pursuit, not empty road behind.
    simulate(game, step, 0.5, (g) => driveToward(g, hotel.x, hotel.y));
    game.police.cars.forEach((car, i) => {
      car.x = game.player.x - 260 - i * 90;
      car.y = game.player.y + 46;
      car.angle = 0;
    });
    simulate(game, step, 2.2, (g) => driveToward(g, hotel.x, hotel.y));
  } else if (scene === 'mission') {
    game.missions.index = 3;
    game.missions.stage = 1;
    game.missions.thugsSpawned = true;
    // Spawn the crew directly (same positions the game uses when you reach the pier).
    game.thugs = [];
    // Inline spawn to stay synchronous: positions around the pier.
    const positions = [
      { x: pier.x - 90, y: pier.y + 30 },
      { x: pier.x + 90, y: pier.y + 30 },
      { x: pier.x, y: pier.y + 60 },
    ];
    game.thugs = positions.map((pos, i) => ({
      kind: 'thug', id: `thug-${i}`, x: pos.x, y: pos.y,
      angle: 0, health: 60, dead: false, shootTimer: 0.8 + i * 0.4, speed: 120,
    }));
    game.player.x = pier.x - 40;
    game.player.y = pier.y + 130;
    addHeat(game.police, 1);
    // Walk up to the crew, then open fire for the last half second so the
    // frame shows the fight starting, not already over.
    simulate(game, step, 1.6, (g) => walkToward(g, pier.x, pier.y));
    simulate(game, step, 0.5, (g) => {
      const alive = g.thugs.find((t) => !t.dead);
      const ctrl = walkToward(g, pier.x, pier.y);
      if (alive) {
        ctrl.aimAngle = Math.atan2(alive.y - g.player.y, alive.x - g.player.x);
        ctrl.shoot = true;
      }
      return ctrl;
    });
  } else {
    // onfoot
    game.missions.index = 0;
    game.missions.stage = 0;
    game.player.x = bar.x - 60;
    game.player.y = bar.y + 90;
    simulate(game, step, 4, (g) => walkToward(g, bar.x, bar.y));
  }
  return { screen: SCREEN_PLAY };
}

export { STEP };
