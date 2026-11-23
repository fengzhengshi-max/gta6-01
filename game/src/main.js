// Neon Palms — game orchestration: state, loop, combat, crime, camera.
import { CFG } from './config.js';
import { makeRng, pick, range, clamp, dist, angleTo, angleDiff } from './random.js';
import { buildWorld, landmarkById, hitsBuilding } from './world.js';
import { spawnTraffic, spawnPedestrians, updateTrafficCar, updatePed, makeBullet, updateBullets, makeCar } from './entities.js';
import { makePlayer, updateOnFoot, updateDriving, nearestCar, enterCar, exitCar } from './player.js';
import { addWanted, updateWanted, spawnPolice, updatePolice } from './police.js';
import { makeMissionState, updateMissions } from './missions.js';
import { drawWorld, drawEntities, drawHUD, drawMinimap, drawScreen } from './render.js';
import { Input } from './input.js';
import { SoundBank } from './audio.js';
import { saveGame, loadGame, hasSave, bestCash } from './save.js';
import { stageShot } from './shots.js';

export class Game {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.rng = makeRng(CFG.seed);
    this.world = buildWorld(CFG.seed);
    this.sound = new SoundBank();
    this.input = new Input(canvas);
    this.screen = 'title';
    this.time = 0; this.camX = 0; this.camY = 0;
    this.wanted = 0; this.quietTimer = 0; this.bustedTimer = 0;
    this.bullets = []; this.floaters = []; this.gang = [];
    this.autosaveTimer = 0; this.sirenTimer = 0;
    this.bestCash = bestCash();
    this.saveData = loadGame();
    this.hasSave = hasSave();
    this.resetWorld();
    this.last = performance.now();
    requestAnimationFrame((t) => this.loop(t));
  }
  resetWorld() {
    const safe = landmarkById(this.world, 'safehouse');
    this.player = makePlayer(this.world.roadsX[2] + 52, safe.y + 90);
    this.cars = spawnTraffic(this.world, this.rng, CFG.trafficCars, this.player);
    this.peds = spawnPedestrians(this.world, this.rng, CFG.pedestrians, this.player);
    // A few parked cars on the road beside the safehouse so the player can drive early.
    const roadX = this.world.roadsX[2];
    for (let i = 0; i < 3; i++) {
      const c = makeCar('park' + i, roadX, safe.y + 110 + i * 64, Math.PI / 2, pick(this.rng, ['#e8452c', '#2c7de8', '#e8c832']));
      this.cars.push(c);
    }
    this.police = [];
    this.missions = makeMissionState();
    this.wanted = 0; this.bustedTimer = 0;
  }
  newGame() {
    this.resetWorld();
    this.screen = 'play';
    this.sound.ensure();
  }
  continueGame() {
    const s = this.saveData;
    this.resetWorld();
    if (s) {
      this.player.money = s.money || 0; this.player.cash = this.player.money;
      this.player.health = s.health || 100;
      this.player.x = s.x || this.player.x; this.player.y = s.y || this.player.y;
      this.missions.index = Math.min(s.missionIndex || 0, 4);
      this.wanted = 0;
    }
    this.screen = 'play';
    this.sound.ensure();
  }
  addWanted(n, reason) { addWanted(this, n, reason); }
  saveNow() { this.bestCash = Math.max(this.bestCash, this.player.money); saveGame(this); }
  onCrash(speed) {
    if (speed < 60) return;
    this.sound.crash();
    if (this.player.inCar) this.player.inCar.health -= speed * 0.05;
    if (this.player.inCar && this.player.inCar.health <= 0) this.onCarWrecked();
  }
  onCarWrecked() {
    const car = this.player.inCar;
    if (car) { car.dead = true; this.cars = this.cars.filter((c) => c !== car); }
    this.player.inCar = null;
    this.player.health -= 25;
    this.sound.crash();
    if (this.player.health <= 0) this.onWasted();
  }
  onWasted() {
    this.player.health = 100;
    this.player.money = Math.max(0, this.player.money - 200);
    const safe = landmarkById(this.world, 'safehouse');
    this.player.x = safe.x; this.player.y = safe.y; this.player.inCar = null;
    this.wanted = 0; this.police.forEach((c) => { c.dead = true; });
    this.police = []; this.cars = this.cars.filter((c) => !c.police);
    this.screen = 'wasted';
    this.saveNow();
  }
  onBusted() {
    this.player.money = Math.max(0, this.player.money - 300);
    const st = landmarkById(this.world, 'station');
    this.player.x = st.x; this.player.y = st.y; this.player.inCar = null;
    this.wanted = 0; this.bustedTimer = 0;
    this.police.forEach((c) => { c.dead = true; });
    this.police = []; this.cars = this.cars.filter((c) => !c.police);
    this.sound.busted();
    this.screen = 'busted';
    this.saveNow();
  }
  spawnGang(x, y) {
    this.gang = [];
    for (let i = 0; i < 5; i++) {
      this.gang.push({ id: 'g' + i, x: x + range(this.rng, -90, 90), y: y + range(this.rng, -90, 90),
        angle: 0, speed: 60, shirt: '#8a1a1a', health: 70, dead: false, shootTimer: range(this.rng, 1, 2.5), walkPhase: 0 });
    }
    this.missions.gangLeft = 5;
  }
  tryPunch() {
    const p = this.player;
    if (p.punchCooldown > 0 || p.inCar) return;
    p.punchCooldown = 0.45;
    this.sound.punch();
    const hit = (t, r) => {
      if (t.dead) return false;
      const d = dist(p.x, p.y, t.x, t.y);
      if (d > CFG.punchRange + r) return false;
      if (Math.abs(angleDiff(p.aimAngle, angleTo(p.x, p.y, t.x, t.y))) > CFG.punchArc) return false;
      return true;
    };
    for (const g of this.gang) if (hit(g, 10)) this.damageGang(g, CFG.punchDamage);
    for (const ped of this.peds) {
      if (hit(ped, 10)) {
        ped.dead = true;
        this.addWanted(1, 'assault');
        this.floaters.push({ x: ped.x, y: ped.y - 20, text: 'ASSAULT +1★', life: 1.5, color: '#ff2e44' });
      }
    }
  }
  damageGang(g, dmg) {
    g.health -= dmg;
    if (g.health <= 0 && !g.dead) {
      g.dead = true; this.missions.gangLeft -= 1;
      this.addWanted(1, 'gang fight');
    }
  }
  tryShoot() {
    const p = this.player;
    if (p.inCar || p.shootCooldown > 0 || p.reloadTimer > 0) return;
    if (p.ammo <= 0) { this.sound.blip(140, 0.06, 'square', 0.1); return; }
    p.ammo -= 1; p.shootCooldown = 0.22;
    this.sound.gunshot();
    this.bullets.push(makeBullet(p.x + Math.cos(p.aimAngle) * 20, p.y + Math.sin(p.aimAngle) * 20, p.aimAngle, true));
    this.addWanted(1, 'shooting');
    for (const ped of this.peds) if (!ped.dead && dist(ped.x, ped.y, p.x, p.y) < 300) ped.flee = 2;
  }
  updateBullets(dt) {
    this.bullets = updateBullets(this.bullets, dt);
    for (const b of this.bullets) {
      for (const g of this.gang) {
        if (!g.dead && dist(b.x, b.y, g.x, g.y) < 14) { this.damageGang(g, CFG.pistolDamage); b.life = 0; }
      }
      for (const ped of this.peds) {
        if (!ped.dead && dist(b.x, b.y, ped.x, ped.y) < 12) {
          ped.dead = true; b.life = 0; this.addWanted(2, 'hit pedestrian');
        }
      }
      for (const c of this.cars) {
        if (!c.dead && Math.abs(b.x - c.x) < 26 && Math.abs(b.y - c.y) < 14) {
          c.health -= 12; b.life = 0;
          if (c.health <= 0) { c.dead = true; this.cars = this.cars.filter((x) => x !== c); }
        }
      }
    }
    this.bullets = this.bullets.filter((b) => b.life > 0);
  }
  updateGang(dt) {
    const p = this.player;
    for (const g of this.gang) {
      if (g.dead) continue;
      g.walkPhase += dt * 6;
      const d = dist(g.x, g.y, p.x, p.y);
      g.angle = angleTo(g.x, g.y, p.x, p.y);
      if (d > 130) { g.x += Math.cos(g.angle) * g.speed * dt; g.y += Math.sin(g.angle) * g.speed * dt; }
      g.shootTimer -= dt;
      if (g.shootTimer <= 0 && d < 420 && !p.inCar) {
        g.shootTimer = range(this.rng, 1.2, 2.4);
        this.bullets.push(makeBullet(g.x, g.y, g.angle + range(this.rng, -0.12, 0.12), false));
        this.sound.gunshot();
      }
    }
    // Enemy bullets hitting the player.
    for (const b of this.bullets) {
      if (!b.fromPlayer && dist(b.x, b.y, p.x, p.y) < 14 && !p.inCar) {
        b.life = 0; p.health -= 9;
        if (p.health <= 0) this.onWasted();
      }
    }
  }
  step(dt) {
    this.time += dt;
    const input = this.input, p = this.player;
    // Global keys.
    if (input.pressed('KeyP') && (this.screen === 'play' || this.screen === 'paused')) {
      this.screen = this.screen === 'play' ? 'paused' : 'play';
    }
    if (input.pressed('KeyM')) this.sound.muted = !this.sound.muted;
    if (this.screen === 'title') {
      if (input.pressed('Enter')) this.newGame();
      if (input.pressed('KeyC') && this.hasSave) this.continueGame();
      return;
    }
    if (this.screen === 'wasted' || this.screen === 'busted') {
      if (input.pressed('Enter')) this.screen = 'play';
      return;
    }
    if (this.screen === 'complete') {
      if (input.pressed('Enter')) this.screen = 'play';
      return;
    }
    if (this.screen === 'paused') return;
    // Car enter / exit.
    if (input.pressed('KeyE') && !p.inCar) {
      const car = nearestCar(this, 70);
      if (car) {
        enterCar(this, car);
        if (car.police === false && this.cars.includes(car)) {
          // Stealing a traffic car: driver flees, +1 star, car leaves traffic.
          this.addWanted(1, 'car theft');
          this.cars = this.cars.filter((c) => c !== car);
          this.cars.push(car);
          const repl = makeCar('repl' + Date.now() % 100000, car.x + 400, car.y, car.angle, pick(this.rng, ['#e8452c', '#2c7de8', '#e8c832']));
          this.cars.push(repl);
        }
      }
    } else if (input.pressed('KeyF') && p.inCar) {
      exitCar(this);
      this._justExited = true;
    }
    if (input.pressed('KeyF') && !p.inCar && !this._justExited) this.tryPunch();
    this._justExited = false;
    if (input.pressed('KeyR') && !p.inCar && p.reloadTimer <= 0 && p.ammo < CFG.pistolMag && p.reserve > 0) p.reloadTimer = 0.9;
    if (input.mouseDown || input.clicked) this.tryShoot();
    // Movement.
    if (p.inCar) updateDriving(this, dt, input);
    else updateOnFoot(this, dt, input);
    // Traffic + pedestrians.
    for (const c of [...this.cars]) if (!c.police && !c.dead && c !== p.inCar) updateTrafficCar(this.world, c, dt, this.cars, p.inCar);
    const danger = this.bullets.length ? { x: p.x, y: p.y } : null;
    for (const ped of this.peds) updatePed(this.world, ped, dt, danger);
    // Player car hitting pedestrians.
    if (p.inCar) {
      for (const ped of this.peds) {
        if (!ped.dead && dist(p.x, p.y, ped.x, ped.y) < 30 && Math.abs(p.inCar.speed) > 40) {
          ped.dead = true; this.addWanted(2, 'hit pedestrian'); this.sound.crash();
        }
      }
      // Bumping traffic cars damages both.
      for (const c of this.cars) {
        if (c !== p.inCar && !c.dead && dist(p.x, p.y, c.x, c.y) < 48) {
          c.health -= 20 * dt * 10; p.inCar.health -= 8 * dt * 10;
          if (c.health <= 0) { c.dead = true; }
          if (p.inCar.health <= 0) this.onCarWrecked();
        }
      }
    }
    this.updateBullets(dt);
    this.updateGang(dt);
    updateWanted(this, dt);
    spawnPolice(this, this.rng);
    updatePolice(this, dt);
    updateMissions(this, dt);
    // Siren wail while wanted.
    if (this.wanted > 0) {
      this.sirenTimer -= dt;
      if (this.sirenTimer <= 0) { this.sirenTimer = 0.55; this.sound.sirenTick(true); }
    }
    // Floaters + autosave.
    for (const f of this.floaters) { f.life -= dt; f.y -= 22 * dt; }
    this.floaters = this.floaters.filter((f) => f.life > 0);
    this.autosaveTimer += dt;
    if (this.autosaveTimer >= CFG.autosaveSecs) { this.autosaveTimer = 0; this.saveNow(); }
    // Camera follows the player, clamped to the world.
    this.camX = clamp(p.x - CFG.viewW / 2, 0, this.world.worldW - CFG.viewW);
    this.camY = clamp(p.y - CFG.viewH / 2, 0, this.world.worldH - CFG.viewH);
    this.input.setCamera(this.camX, this.camY);
  }
  loop(now) {
    const dt = Math.min(0.05, (now - this.last) / 1000 || 0.016);
    this.last = now;
    this.step(dt);
    const ctx = this.ctx;
    ctx.fillStyle = '#0a0a14'; ctx.fillRect(0, 0, CFG.viewW, CFG.viewH);
    if (this.screen === 'title') {
      // Title draws over a slow pan of the city.
      this.camX = (Math.sin(this.time * 0.05) * 0.5 + 0.5) * (this.world.worldW - CFG.viewW);
      this.camY = 200;
      ctx.save(); ctx.translate(-this.camX, -this.camY);
      drawWorld(ctx, this, this.camX); drawEntities(ctx, this);
      ctx.restore();
      drawScreen(ctx, this);
    } else {
      ctx.save(); ctx.translate(-this.camX, -this.camY);
      drawWorld(ctx, this, this.camX); drawEntities(ctx, this);
      ctx.restore();
      drawHUD(ctx, this);
      drawMinimap(ctx, this);
      if (this.screen !== 'play') drawScreen(ctx, this);
    }
    this.input.endFrame();
    requestAnimationFrame((t) => this.loop(t));
  }
}

const canvas = document.getElementById('game');
export const game = new Game(canvas);
window.__game = game;
// Deterministic screenshot staging (?shot=...). See shots.js.
const params = new URLSearchParams(location.search);
if (params.get('shot')) {
  stageShot(params.get('shot'), game);
  window.__shotReady = true;
}
