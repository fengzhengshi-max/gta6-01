// Boot and the one loop: input is read every frame, the world advances in fixed
// 1/60 s steps, and the renderer paints what is there. Screens: title, play,
// paused, wasted, busted and story-complete. ?seed=N fixes the city; ?shot=
// cover|chase|mission|onfoot (with &seed=N) stages that scene instead of
// running the loop, paints it twice and sets window.__shotReady.
import { CAR, HEAT, MONEY, STEP, TRAFFIC } from './config.js';
import { createRandom } from './random.js';
import { createCity, spawnPoint } from './world.js';
import {
  createBullets, createPedestrians, createTraffic, spawnTrafficCar, updateBullets,
  updatePedestrians, updateThugs, updateTraffic,
} from './entities.js';
import {
  createPlayer, createPlayerCar, enterCar, exitCar, healPlayer, hurtPlayer,
  nearestEnterableCar, playerPunch, playerReload, playerShoot, updateDriving,
  updateOnFoot,
} from './player.js';
import { addHeat, applyBust, createPolice, updatePolice, wantedStars } from './police.js';
import {
  createMissions, currentMission, maybeSpawnThugs, updateMissions,
} from './missions.js';
import { ACTION_CONFIRM, ACTION_INTERACT, ACTION_PAUSE, ACTION_PUNCH, ACTION_RELOAD, createInput } from './input.js';
import { createAudio } from './audio.js';
import { applySave, clearSave, readBestCash, readSave, writeBestCash, writeSave } from './save.js';
import { createRenderer, SCREEN_BUSTED, SCREEN_OVER, SCREEN_PAUSED, SCREEN_PLAY, SCREEN_TITLE, SCREEN_WIN } from './render.js';
import { stageShot } from './shots.js';

const MAX_FRAME = 0.25;
const AUTOSAVE_SECONDS = 20;

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : Math.floor(Math.random() * 4294967296);

/** Build a fresh game from a seed. */
export function createGame(gameSeed) {
  const random = createRandom(gameSeed);
  const city = createCity(random);
  const spawn = spawnPoint(city);
  const player = createPlayer(spawn);
  const playerCar = createPlayerCar(city);
  return {
    seed: gameSeed,
    random, city, player, playerCar,
    traffic: createTraffic(random),
    peds: createPedestrians(random, city),
    police: createPolice(),
    bullets: createBullets(),
    thugs: [],
    missions: createMissions(),
    money: MONEY.start,
    time: 0,
    events: [],
    scare: null,
    nearCar: null,
    autosaveTimer: AUTOSAVE_SECONDS,
    winShown: false,
  };
}

/** All the cars the player could drive or shoot, for bullet targets. */
function carTargets(game) {
  const list = game.traffic.slice();
  list.push(...game.police.cars);
  if (game.playerCar && !list.includes(game.playerCar)) list.push(game.playerCar);
  if (game.player.inCar && !list.includes(game.player.inCar)) list.push(game.player.inCar);
  return list;
}

/** Apply a combat hit: a pedestrian or thug hurt, a car damaged. */
function applyHit(game, hit, hooks) {
  const target = hit.target;
  if (hit.kind === 'ped') {
    if (target.dead) return;
    target.dead = true;
    target.downTimer = 30;
    game.scare = { x: target.x, y: target.y };
    if (hit.from === 'player') {
      addHeat(game.police, HEAT.killPed);
      hooks.sound('punch');
    }
  } else if (hit.kind === 'thug') {
    target.health -= hit.damage;
    if (target.health <= 0) {
      target.dead = true;
      if (hit.from === 'player') addHeat(game.police, HEAT.killPed);
    }
  } else if (hit.kind === 'car') {
    target.health -= hit.damage;
    if (target.health <= 0 && !target.wrecked) {
      target.wrecked = true;
      target.health = 0;
      if (target.kind === 'police') {
        target.dead = true;
        game.police.cars = game.police.cars.filter((c) => c !== target);
      }
    }
  } else if (hit.kind === 'player') {
    if (hurtPlayer(game.player, hit.damage)) {
      hooks.sound('hurt');
      game.events.push('wasted');
    }
  }
}

/** The player's car running over a pedestrian. */
function carVsPeds(game, hooks) {
  const car = game.player.inCar;
  if (!car || car.wrecked) return;
  const cos = Math.cos(car.angle);
  const sin = Math.sin(car.angle);
  for (const ped of game.peds) {
    if (ped.dead) continue;
    const lx = (ped.x - car.x) * cos + (ped.y - car.y) * sin;
    const ly = -(ped.x - car.x) * sin + (ped.y - car.y) * cos;
    if (Math.abs(lx) < CAR.length / 2 + 10 && Math.abs(ly) < CAR.width / 2 + 10) {
      ped.dead = true;
      ped.downTimer = 30;
      game.scare = { x: ped.x, y: ped.y };
      addHeat(game.police, HEAT.hitPedWithCar);
      hooks.sound('crash');
    }
  }
}

/** Traffic hitting the player on foot, and bumping the player's car. */
function trafficVsPlayer(game, hooks) {
  const player = game.player;
  for (const car of game.traffic) {
    if (car.wrecked || car.dead || car === player.inCar) continue;
    const dx = car.x - player.x;
    const dy = car.y - player.y;
    if (player.inCar) {
      const target = player.inCar;
      const cos = Math.cos(target.angle);
      const sin = Math.sin(target.angle);
      const lx = (car.x - target.x) * cos + (car.y - target.y) * sin;
      const ly = -(car.x - target.x) * sin + (car.y - target.y) * cos;
      if (Math.abs(lx) < CAR.length / 2 + CAR.length / 2 && Math.abs(ly) < CAR.width) {
        const impact = Math.abs(car.speed - target.speed);
        car.speed *= 0.4;
        target.speed *= 0.5;
        if (impact > 200) {
          target.health -= 6;
          hooks.sound('crash');
        }
      }
    } else if (!player.dead && player.hurtTimer <= 0) {
      if (dx * dx + dy * dy < 30 * 30) {
        if (hurtPlayer(player, 15)) game.events.push('wasted');
        player.x -= (dx / (Math.hypot(dx, dy) || 1)) * 30;
        player.y -= (dy / (Math.hypot(dx, dy) || 1)) * 30;
        hooks.sound('crash');
      }
    }
  }
}

/**
 * One fixed step. `ctrl` is the control state for this step:
 * { moveX, moveY, throttle, steer, brake, sprint, aimAngle, shoot, punch,
 *   interact, reload }. `hooks` is { sound(name), announce(msg) } or null
 * (shot mode runs silent). Returns nothing; game.events collects outcomes.
 */
export function stepGame(game, ctrl, dt, hooks) {
  const sound = hooks ? hooks.sound : () => {};
  const player = game.player;
  game.time += dt;
  game.events.length = 0;
  if (game.missions.banner) {
    game.missions.banner.timer -= dt;
    if (game.missions.banner.timer <= 0) game.missions.banner = null;
  }

  // --- Player ---
  if (!player.dead) {
    if (player.inCar) {
      const result = updateDriving(player, dt, game.city, ctrl.throttle, ctrl.steer, ctrl.brake);
      if (result.crashed) sound('crash');
      if (player.inCar.health <= 0 && !player.inCar.wrecked) {
        player.inCar.wrecked = true;
        player.inCar.health = 0;
      }
      if (player.inCar.wrecked) {
        exitCar(player);
        hurtPlayer(player, 10);
      }
    } else {
      updateOnFoot(player, dt, game.city, { x: ctrl.moveX, y: ctrl.moveY }, ctrl.sprint, ctrl.aimAngle);
      if (ctrl.shoot && playerShoot(player, game.bullets)) {
        addHeat(game.police, HEAT.shootGun);
        game.scare = { x: player.x, y: player.y };
        sound('gunshot');
      }
      if (ctrl.punch) {
        const hits = playerPunch(player, [...game.peds, ...game.thugs]);
        if (hits.length > 0) {
          sound('punch');
          for (const hit of hits) {
            if (hit.kind === 'ped' && !hit.target.dead) {
              hit.target.dead = true;
              hit.target.downTimer = 30;
              addHeat(game.police, HEAT.punchPed);
              game.scare = { x: hit.target.x, y: hit.target.y };
            } else if (hit.kind === 'thug') {
              hit.target.health -= hit.damage;
              if (hit.target.health <= 0) hit.target.dead = true;
            }
          }
        }
      }
      if (ctrl.reload) playerReload(player);
    }

    // Enter / exit a car, or use a mission interact prompt.
    if (ctrl.interact) {
      if (player.inCar) {
        exitCar(player);
        sound('click');
      } else if (game.missions.interactReady) {
        // Mission interact: handled below by updateMissions.
      } else {
        const car = nearestEnterableCar(player, carTargets(game));
        if (car) {
          const result = enterCar(player, car);
          if (result) {
            // A stolen car leaves the traffic flow: it is the player's now,
            // and traffic must not keep driving it or colliding with itself.
            const index = game.traffic.indexOf(car);
            if (index >= 0) game.traffic.splice(index, 1);
          }
          if (result === 'stole') {
            addHeat(game.police, HEAT.stealCar);
            game.scare = { x: player.x, y: player.y };
            sound('pickup');
          } else if (result) {
            sound('click');
          }
        }
      }
    }
    game.nearCar = !player.inCar ? nearestEnterableCar(player, carTargets(game)) : null;
  }

  // --- Missions ---
  maybeSpawnThugs(game.missions, game);
  const missionBefore = game.missions.index * 100 + game.missions.stage;
  updateMissions(game.missions, game, ctrl.interact && !player.inCar && game.missions.interactReady);
  if (game.missions.index * 100 + game.missions.stage !== missionBefore) {
    const mission = currentMission(game.missions);
    if (mission) sound('pickup');
    else sound('missionComplete');
    // Grabbing the bank cash (mission 5, stage 2) brings the heat at once.
    if (missionBefore === 401) addHeat(game.police, 2);
    writeSave(game);
  }

  // --- City life ---
  updateTraffic(game.traffic, dt);
  // Keep the streets full: a stolen car is replaced by a fresh one.
  while (game.traffic.length < TRAFFIC.count) game.traffic.push(spawnTrafficCar(game.random));
  updatePedestrians(game.peds, dt, game.city, game.scare, game.random);
  game.scare = null;
  updateThugs(game.thugs, dt, player, game.bullets, game.random);
  const targets = [...game.peds.filter((p) => !p.dead), ...game.thugs, ...carTargets(game)];
  if (!player.dead) targets.push(player);
  const hits = updateBullets(game.bullets, dt, game.city, targets);
  for (const hit of hits) applyHit(game, hit, hooks ?? { sound: () => {} });
  game.bullets = game.bullets.filter((b) => !b.dead);
  carVsPeds(game, hooks ?? { sound: () => {} });
  trafficVsPlayer(game, hooks ?? { sound: () => {} });

  // --- Police ---
  const policeEvents = updatePolice(game.police, dt, player, game.city, game.random);
  if (policeEvents.busted) game.events.push('busted');
  if (policeEvents.rammedPlayer) sound('crash');
  if (wantedStars(game.police) > 0 && Math.floor(game.time * 2) !== Math.floor((game.time - dt) * 2)) {
    sound('siren');
  }

  // --- Safehouse healing ---
  const safe = game.city.landmarks.safehouse;
  if (!player.inCar && Math.hypot(player.x - safe.x, player.y - safe.y) < 70) {
    healPlayer(player, 20 * dt);
  }

  // --- Autosave ---
  game.autosaveTimer -= dt;
  if (game.autosaveTimer <= 0) {
    game.autosaveTimer = AUTOSAVE_SECONDS;
    writeSave(game);
  }
  if (game.money > readBestCash()) writeBestCash(game.money);
}

const canvas = document.getElementById('game');
const status = document.getElementById('status');
const game = createGame(seed);
// Exposed for automated smoke tests (and curious players): read-only handle to the live state.
window.__neonGame = game;
const renderer = createRenderer(canvas);
const audio = createAudio();
const saveData = readSave();

function runShot(name) {
  const scene = stageShot(name, game, stepGame);
  let painted = 0;
  function paint() {
    renderer.draw(game, scene.screen, { time: game.time, saveExists: false, saveMoney: 0, saveMission: 0, fine: 0 });
    painted += 1;
    if (painted < 2) requestAnimationFrame(paint);
    else window.__shotReady = true;
  }
  requestAnimationFrame(paint);
}

function runGame() {
  const input = createInput(canvas);
  let screen = SCREEN_TITLE;
  let best = readBestCash();
  let accumulator = 0;
  let last = performance.now();
  let continueKey = false;

  window.addEventListener('keydown', (event) => {
    if (event.code === 'KeyC' && !event.repeat) continueKey = true;
    if (event.code === 'KeyM' && !event.repeat) audio.setMuted(!audio.isMuted());
  });

  function announce(message) {
    status.textContent = message;
  }

  const hooks = {
    sound: (name) => {
      if (name === 'gunshot') audio.gunshot();
      else if (name === 'punch') audio.punch();
      else if (name === 'crash') audio.crash();
      else if (name === 'siren') audio.siren();
      else if (name === 'pickup') audio.pickup();
      else if (name === 'missionComplete') audio.missionComplete();
      else if (name === 'busted') audio.busted();
      else if (name === 'click') audio.click();
      else if (name === 'hurt') audio.hurt();
    },
    announce,
  };

  function startFresh() {
    const fresh = createGame(Math.floor(Math.random() * 4294967296));
    Object.assign(game, fresh);
    clearSave();
    screen = SCREEN_PLAY;
    announce('Neon Palms. Mission 1: walk to The Flamingo bar.');
  }

  function startContinue() {
    const fresh = createGame(Math.floor(Math.random() * 4294967296));
    Object.assign(game, fresh);
    applySave(game, saveData);
    screen = SCREEN_PLAY;
    announce(`Continuing. Mission ${game.missions.index + 1}.`);
  }

  function buildCtrl(actions) {
    const move = input.move();
    const drive = input.drive();
    const mouse = input.mouse();
    const aim = renderer.aimPoint
      ? renderer.aimPoint(game, mouse.x, mouse.y)
      : { x: game.player.x + 1, y: game.player.y };
    return {
      moveX: move.x,
      moveY: move.y,
      throttle: drive.throttle,
      steer: drive.steer,
      brake: drive.brake,
      sprint: input.sprint(),
      aimAngle: Math.atan2(aim.y - game.player.y, aim.x - game.player.x),
      shoot: input.takeClick() || input.mouseDown(),
      punch: Boolean(actions & ACTION_PUNCH),
      interact: Boolean(actions & ACTION_INTERACT),
      reload: Boolean(actions & ACTION_RELOAD),
      pause: Boolean(actions & ACTION_PAUSE),
    };
  }

  function frame(now) {
    requestAnimationFrame(frame);
    accumulator += Math.min((now - last) / 1000, MAX_FRAME);
    last = now;
    // Actions are read once per frame, not per step.
    const actions = input.takeActions();
    const ctrl = buildCtrl(actions);
    handleActionsWith(actions);
    if (screen === SCREEN_PLAY) {
      while (accumulator >= STEP) {
        stepGame(game, ctrl, STEP, hooks);
        accumulator -= STEP;
        if (game.events.includes('wasted')) {
          screen = SCREEN_OVER;
          writeSave(game);
          announce(`Wasted. You had $${game.money}.`);
          break;
        }
        if (game.events.includes('busted')) {
          const fine = Math.min(game.money, MONEY.bustFine);
          game.money -= fine;
          applyBust(game.police, game.player, game.city);
          audio.busted();
          writeSave(game);
          screen = SCREEN_BUSTED;
          ui.fine = fine;
          announce(`Busted. Fined $${fine}.`);
          break;
        }
        if (game.missions.done && !game.winShown) {
          game.winShown = true;
          screen = SCREEN_WIN;
          announce('Story complete.');
          break;
        }
      }
    } else if (screen === SCREEN_TITLE) {
      // Attract mode: the city lives behind the title.
      while (accumulator >= STEP) {
        updateTraffic(game.traffic, STEP);
        updatePedestrians(game.peds, STEP, game.city, null, game.random);
        game.time += STEP;
        accumulator -= STEP;
      }
    } else {
      accumulator = 0;
    }
    audio.setEngine(game.player.inCar ? game.player.speed : 0, Boolean(game.player.inCar) && screen === SCREEN_PLAY);
    renderer.draw(game, screen, ui);
  }

  const ui = {
    get time() { return game.time; },
    saveExists: Boolean(saveData),
    saveMoney: saveData ? saveData.money : 0,
    saveMission: saveData ? saveData.missionIndex : 0,
    fine: 0,
  };

  // handleActions needs the actions taken this frame; wrap it so frame() can
  // pass them in without double-taking.
  function handleActionsWith(actions) {
    if (screen === SCREEN_TITLE) {
      if (continueKey && saveData) {
        continueKey = false;
        audio.unlock();
        startContinue();
      } else if (actions & ACTION_CONFIRM) {
        audio.unlock();
        if (saveData) startContinue();
        else startFresh();
      }
      return;
    }
    if (screen === SCREEN_OVER || screen === SCREEN_BUSTED) {
      if (actions & ACTION_CONFIRM) {
        audio.unlock();
        if (saveData) startContinue();
        else startFresh();
      }
      return;
    }
    if (screen === SCREEN_WIN) {
      if (actions & ACTION_CONFIRM) screen = SCREEN_PLAY;
      return;
    }
    if (actions & ACTION_PAUSE) {
      if (screen === SCREEN_PLAY) {
        screen = SCREEN_PAUSED;
        announce('Paused.');
      } else if (screen === SCREEN_PAUSED) {
        screen = SCREEN_PLAY;
        announce('Playing.');
      }
    }
  }

  document.addEventListener('visibilitychange', () => {
    if (document.hidden && screen === SCREEN_PLAY) {
      screen = SCREEN_PAUSED;
      announce('Paused.');
    }
  });

  announce('Neon Palms. Press Enter or click to start.');
  requestAnimationFrame(frame);
}

if (shot) runShot(shot);
else runGame();
