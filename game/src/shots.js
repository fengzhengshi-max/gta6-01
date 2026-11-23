// Neon Palms — deterministic screenshot staging for ?shot=<name>.
// Each shot puts the live game into a fixed, seeded scene and leaves it on
// the play screen so a headless browser can capture one frame of it.
import { CFG } from './config.js';
import { landmarkById, nearestRoadPoint } from './world.js';
import { makeCar } from './entities.js';
import { clamp } from './random.js';

function placeOnRoad(game, x, y) {
  const p = nearestRoadPoint(game.world, x, y);
  return p;
}
function giveCar(game, x, y, angle) {
  const car = makeCar('shotcar', x, y, angle, '#e8452c');
  car.speed = 180;
  game.cars.push(car);
  game.player.inCar = car;
  game.player.x = x; game.player.y = y;
  return car;
}
function centreCamera(game) {
  const p = game.player;
  game.camX = clamp(p.x - CFG.viewW / 2, 0, game.world.worldW - CFG.viewW);
  game.camY = clamp(p.y - CFG.viewH / 2, 0, game.world.worldH - CFG.viewH);
  game.input.setCamera(game.camX, game.camY);
}

export function stageShot(name, game) {
  game.screen = 'play';
  game.sound.muted = true;
  const bar = landmarkById(game.world, 'bar');
  const hotel = landmarkById(game.world, 'hotel');
  const bank = landmarkById(game.world, 'bank');
  const docks = landmarkById(game.world, 'docks');
  if (name === 'cover') {
    // Driving through the city centre, HUD and minimap visible.
    const p = placeOnRoad(game, 1200, 700);
    giveCar(game, p.x, p.y, 0);
    game.player.money = 1250; game.player.health = 100;
  } else if (name === 'chase') {
    // Three wanted stars, police cars closing in on the player's car.
    const p = placeOnRoad(game, 1500, 900);
    giveCar(game, p.x, p.y, 0);
    game.wanted = 3;
    game.player.money = 2400;
    for (let i = 0; i < 3; i++) {
      const cop = makeCar('shotcop' + i, p.x - 160 - i * 90, p.y + (i - 1) * 46, 0, '#1c3fae');
      cop.police = true; cop.speed = 240;
      game.police.push(cop); game.cars.push(cop);
    }
  } else if (name === 'mission') {
    // Mission 2 in progress: stolen car headed for the hotel beacon.
    game.missions.index = 1;
    const p = placeOnRoad(game, hotel.x - 320, hotel.y + 40);
    const car = giveCar(game, p.x, p.y, 0);
    car.stolen = true;
    game.player.money = 900;
    game.wanted = 1;
  } else if (name === 'onfoot') {
    // On foot on a busy street: pedestrians and traffic around the player.
    const p = placeOnRoad(game, bar.x + 130, bar.y + 130);
    game.player.x = p.x; game.player.y = p.y + 40;
    game.player.inCar = null;
    game.player.money = 400;
    // Cluster a few pedestrians near the player for a lively street.
    game.peds.slice(0, 6).forEach((ped, i) => {
      ped.x = p.x - 120 + i * 48; ped.y = p.y + 60 + (i % 2) * 26; ped.flee = 0;
    });
  } else {
    // Unknown shot name: plain street scene.
    const p = placeOnRoad(game, 1000, 600);
    game.player.x = p.x; game.player.y = p.y;
  }
  centreCamera(game);
  return { screen: 'play' };
}
