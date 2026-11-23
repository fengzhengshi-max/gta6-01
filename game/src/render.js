// Drawing only: the game state and the current screen in, pixels out. The
// 1280x720 logical view is scaled to fit the window; the camera follows the
// player. Flat shapes, neon outlines and canvas text — no images, no fonts
// to fetch. HUD, minimap, mission banner and all menu panels live here.
import { CAR, CITY, FONT, PALETTE, PLAYER, VIEW, WORLD, roadX, roadY } from './config.js';
import { objectiveText, stageTarget } from './missions.js';

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';
export const SCREEN_PAUSED = 'paused';
export const SCREEN_OVER = 'over';
export const SCREEN_BUSTED = 'busted';
export const SCREEN_WIN = 'win';

const PANEL = { width: 640, line: 32 };
const MINIMAP = { size: 190, margin: 16 };
const STAR = '★';

export function createRenderer(canvas) {
  const context = canvas.getContext('2d');
  const view = { scale: 1, x: 0, y: 0 };
  const fonts = new Map();

  function resize() {
    const ratio = window.devicePixelRatio || 1;
    const width = Math.round(window.innerWidth * ratio);
    const height = Math.round(window.innerHeight * ratio);
    canvas.width = width;
    canvas.height = height;
    view.scale = Math.min(width / VIEW.width, height / VIEW.height);
    view.x = (width - VIEW.width * view.scale) / 2;
    view.y = (height - VIEW.height * view.scale) / 2;
  }

  function text(value, x, y, size, color, align = 'left', baseline = 'alphabetic') {
    const key = `${size}`;
    if (!fonts.has(key)) fonts.set(key, `bold ${size}px ${FONT}`);
    context.font = fonts.get(key);
    context.fillStyle = color;
    context.textAlign = align;
    context.textBaseline = baseline;
    context.fillText(value, x, y);
  }

  function camera(game) {
    const p = game.player;
    let cx = p.x;
    let cy = p.y;
    const halfW = VIEW.width / 2;
    const halfH = VIEW.height / 2;
    cx = Math.max(halfW, Math.min(WORLD.width - halfW, cx));
    cy = Math.max(halfH, Math.min(WORLD.height - halfH, cy));
    // When the world is smaller than the view in a dimension, centre it.
    if (WORLD.width < VIEW.width) cx = WORLD.width / 2;
    if (WORLD.height < VIEW.height) cy = WORLD.height / 2;
    return { x: cx, y: cy };
  }

  function drawRoads() {
    // Asphalt strips.
    context.fillStyle = PALETTE.asphalt;
    for (let i = 0; i < CITY.cols; i += 1) {
      context.fillRect(roadX(i) - CITY.roadWidth / 2, 0, CITY.roadWidth, WORLD.height);
    }
    for (let j = 0; j < CITY.rows; j += 1) {
      context.fillRect(0, roadY(j) - CITY.roadWidth / 2, WORLD.width, CITY.roadWidth);
    }
    // Sidewalk edging around each road.
    context.fillStyle = PALETTE.sidewalk;
    for (let i = 0; i < CITY.cols; i += 1) {
      context.fillRect(roadX(i) - CITY.roadWidth / 2, 0, CITY.sidewalk, WORLD.height);
      context.fillRect(roadX(i) + CITY.roadWidth / 2 - CITY.sidewalk, 0, CITY.sidewalk, WORLD.height);
    }
    for (let j = 0; j < CITY.rows; j += 1) {
      context.fillRect(0, roadY(j) - CITY.roadWidth / 2, WORLD.width, CITY.sidewalk);
      context.fillRect(0, roadY(j) + CITY.roadWidth / 2 - CITY.sidewalk, WORLD.width, CITY.sidewalk);
    }
    // Dashed centre lines.
    context.fillStyle = PALETTE.laneLine;
    context.setLineDash([26, 30]);
    context.strokeStyle = PALETTE.laneLine;
    context.lineWidth = 3;
    for (let i = 0; i < CITY.cols; i += 1) {
      context.beginPath();
      context.moveTo(roadX(i), 0);
      context.lineTo(roadX(i), WORLD.height);
      context.stroke();
    }
    for (let j = 0; j < CITY.rows; j += 1) {
      context.beginPath();
      context.moveTo(0, roadY(j));
      context.lineTo(WORLD.width, roadY(j));
      context.stroke();
    }
    context.setLineDash([]);
  }

  function drawGround(game) {
    const city = game.city;
    context.fillStyle = PALETTE.ground;
    context.fillRect(-80, -80, WORLD.width + 160, WORLD.height + 160);
    // Beach sand along the bottom edge, with a thin sea strip at the very bottom.
    context.fillStyle = PALETTE.sand;
    context.fillRect(0, city.beachTop, WORLD.width, WORLD.height - city.beachTop);
    context.fillStyle = PALETTE.sea;
    context.fillRect(0, WORLD.height - 14, WORLD.width, 14);
    context.fillStyle = 'rgba(255,255,255,0.3)';
    for (let x = 0; x < WORLD.width; x += 90) {
      context.fillRect(x, WORLD.height - 16, 46, 2);
    }
    // Parks.
    for (const park of city.parks) {
      context.fillStyle = PALETTE.grass;
      context.fillRect(park.x, park.y, park.w, park.h);
    }
    drawRoads();
    // Buildings: roof, neon edge glow, landmark name.
    for (const b of city.buildings) {
      context.fillStyle = b.roof;
      context.fillRect(b.x, b.y, b.w, b.h);
      context.strokeStyle = b.neon;
      context.globalAlpha = 0.9;
      context.lineWidth = 3;
      context.shadowColor = b.neon;
      context.shadowBlur = 14;
      context.strokeRect(b.x, b.y, b.w, b.h);
      context.shadowBlur = 0;
      context.globalAlpha = 1;
      // Rooftop detail: a darker inner rectangle.
      context.fillStyle = 'rgba(0,0,0,0.25)';
      context.fillRect(b.x + 12, b.y + 12, b.w - 24, b.h - 24);
      if (b.landmark) {
        const mark = city.landmarks[b.landmark];
        text(mark.name, b.x + b.w / 2, b.y + b.h / 2 - 4, 15, '#ffffff', 'center', 'middle');
        text(mark.name, b.x + b.w / 2, b.y + b.h / 2 - 4, 15, mark.color, 'center', 'middle');
      }
    }
    // Palm trees: trunk line and a green crown.
    for (const palm of city.palms) {
      context.strokeStyle = '#7a5a3a';
      context.lineWidth = 4;
      context.beginPath();
      context.moveTo(palm.x, palm.y);
      context.lineTo(palm.x + palm.lean * 14, palm.y - 16);
      context.stroke();
      context.fillStyle = '#2f9e5f';
      context.beginPath();
      context.arc(palm.x + palm.lean * 14, palm.y - 18, 11, 0, Math.PI * 2);
      context.fill();
    }
  }

  function drawCarShape(car, isPlayerCar) {
    context.save();
    context.translate(car.x, car.y);
    context.rotate(car.angle);
    const wrecked = car.wrecked;
    context.fillStyle = wrecked ? '#3a3a44' : car.color;
    if (isPlayerCar) {
      context.shadowColor = PALETTE.neonPink;
      context.shadowBlur = 18;
    }
    // Body with a rounded nose.
    context.beginPath();
    context.roundRect(-CAR.length / 2, -CAR.width / 2, CAR.length, CAR.width, 8);
    context.fill();
    context.shadowBlur = 0;
    // Windshield and rear window.
    context.fillStyle = wrecked ? '#22222a' : '#1c2436';
    context.fillRect(4, -CAR.width / 2 + 4, 12, CAR.width - 8);
    context.fillRect(-CAR.length / 2 + 6, -CAR.width / 2 + 4, 8, CAR.width - 8);
    // Headlights.
    context.fillStyle = '#ffe9a8';
    context.fillRect(CAR.length / 2 - 3, -CAR.width / 2 + 3, 3, 6);
    context.fillRect(CAR.length / 2 - 3, CAR.width / 2 - 9, 3, 6);
    // Brake lights.
    if (car.brakeLight) {
      context.fillStyle = '#ff2d55';
      context.fillRect(-CAR.length / 2, -CAR.width / 2 + 3, 3, 6);
      context.fillRect(-CAR.length / 2, CAR.width / 2 - 9, 3, 6);
    }
    if (wrecked) {
      context.strokeStyle = '#ff5a4e';
      context.lineWidth = 3;
      context.beginPath();
      context.moveTo(-10, -8);
      context.lineTo(10, 8);
      context.moveTo(10, -8);
      context.lineTo(-10, 8);
      context.stroke();
    }
    context.restore();
  }

  function drawPoliceLights(car, phase) {
    const on = Math.floor(phase * 4) % 2 === 0;
    context.save();
    context.translate(car.x, car.y);
    context.rotate(car.angle);
    context.fillStyle = on ? PALETTE.policeLightRed : PALETTE.policeLightBlue;
    context.shadowColor = on ? PALETTE.policeLightRed : PALETTE.policeLightBlue;
    context.shadowBlur = 16;
    context.beginPath();
    context.arc(0, -6, 6, 0, Math.PI * 2);
    context.fill();
    context.fillStyle = on ? PALETTE.policeLightBlue : PALETTE.policeLightRed;
    context.shadowColor = on ? PALETTE.policeLightBlue : PALETTE.policeLightRed;
    context.beginPath();
    context.arc(0, 6, 6, 0, Math.PI * 2);
    context.fill();
    context.restore();
  }

  function drawPed(ped) {
    if (ped.dead) {
      context.fillStyle = '#6a6a72';
      context.beginPath();
      context.ellipse(ped.x, ped.y, 14, 7, ped.angle, 0, Math.PI * 2);
      context.fill();
      return;
    }
    context.fillStyle = ped.shirt;
    context.beginPath();
    context.arc(ped.x, ped.y, 10, 0, Math.PI * 2);
    context.fill();
    context.fillStyle = '#2b2118';
    context.beginPath();
    context.arc(ped.x + Math.cos(ped.angle) * 4, ped.y + Math.sin(ped.angle) * 4, 4, 0, Math.PI * 2);
    context.fill();
    if (ped.panic > 0) {
      text('!', ped.x, ped.y - 16, 16, PALETTE.neonYellow, 'center');
    }
  }

  function drawThug(thug) {
    if (thug.dead) {
      context.fillStyle = '#5a2a2a';
      context.beginPath();
      context.ellipse(thug.x, thug.y, 14, 7, thug.angle, 0, Math.PI * 2);
      context.fill();
      return;
    }
    context.fillStyle = PALETTE.thug;
    context.beginPath();
    context.arc(thug.x, thug.y, 12, 0, Math.PI * 2);
    context.fill();
    context.strokeStyle = '#1c1c22';
    context.lineWidth = 4;
    context.beginPath();
    context.moveTo(thug.x, thug.y);
    context.lineTo(thug.x + Math.cos(thug.angle) * 22, thug.y + Math.sin(thug.angle) * 22);
    context.stroke();
    // Health bar.
    context.fillStyle = 'rgba(0,0,0,0.5)';
    context.fillRect(thug.x - 14, thug.y - 22, 28, 5);
    context.fillStyle = PALETTE.damage;
    context.fillRect(thug.x - 14, thug.y - 22, 28 * Math.max(0, thug.health / 60), 5);
  }

  function drawPlayer(game) {
    const player = game.player;
    if (player.dead || player.inCar) return;
    // Hurt blink.
    if (player.hurtTimer > 0 && Math.floor(player.hurtTimer * 12) % 2 === 0) return;
    context.fillStyle = PALETTE.player;
    context.shadowColor = PALETTE.neonYellow;
    context.shadowBlur = 12;
    context.beginPath();
    context.arc(player.x, player.y, PLAYER.radius, 0, Math.PI * 2);
    context.fill();
    context.shadowBlur = 0;
    // Facing: gun barrel toward the aim.
    context.strokeStyle = '#2b2118';
    context.lineWidth = 5;
    context.beginPath();
    context.moveTo(player.x, player.y);
    context.lineTo(player.x + Math.cos(player.aimAngle) * 26, player.y + Math.sin(player.aimAngle) * 26);
    context.stroke();
    // Punch flash.
    if (player.punchFlash > 0) {
      context.strokeStyle = 'rgba(255,225,79,0.9)';
      context.lineWidth = 6;
      context.beginPath();
      context.arc(player.x, player.y, 34, player.aimAngle - 0.7, player.aimAngle + 0.7);
      context.stroke();
    }
  }

  function drawBullets(game) {
    context.strokeStyle = PALETTE.neonYellow;
    context.lineWidth = 3;
    for (const b of game.bullets) {
      if (b.dead) continue;
      context.beginPath();
      context.moveTo(b.x, b.y);
      context.lineTo(b.x - b.vx * 0.02, b.y - b.vy * 0.02);
      context.stroke();
    }
  }

  function drawMissionMarker(game, time) {
    const target = stageTarget(game.missions, game.city);
    if (!target) return;
    const pulse = 1 + Math.sin(time * 5) * 0.15;
    const dist = Math.round(Math.hypot(game.player.x - target.x, game.player.y - target.y));
    // Ground beacon.
    context.strokeStyle = PALETTE.neonYellow;
    context.lineWidth = 3;
    context.beginPath();
    context.arc(target.x, target.y, 26 * pulse, 0, Math.PI * 2);
    context.stroke();
    context.fillStyle = PALETTE.neonYellow;
    context.beginPath();
    context.moveTo(target.x, target.y - 34 * pulse);
    context.lineTo(target.x + 12, target.y - 12);
    context.lineTo(target.x - 12, target.y - 12);
    context.closePath();
    context.fill();
    text(`${dist}m`, target.x, target.y + 48, 15, PALETTE.neonYellow, 'center');
    // Edge arrow when the target is off-screen.
    const cam = camera(game);
    const dx = target.x - cam.x;
    const dy = target.y - cam.y;
    if (Math.abs(dx) > VIEW.width / 2 - 40 || Math.abs(dy) > VIEW.height / 2 - 40) {
      const angle = Math.atan2(dy, dx);
      const ax = cam.x + Math.cos(angle) * (VIEW.width / 2 - 60);
      const ay = cam.y + Math.sin(angle) * (VIEW.height / 2 - 60);
      context.save();
      context.translate(ax, ay);
      context.rotate(angle);
      context.fillStyle = PALETTE.neonYellow;
      context.beginPath();
      context.moveTo(18, 0);
      context.lineTo(-10, -12);
      context.lineTo(-10, 12);
      context.closePath();
      context.fill();
      context.restore();
    }
  }

  function drawWorld(game, time) {
    const cam = camera(game);
    context.setTransform(view.scale, 0, 0, view.scale, view.x, view.y);
    context.translate(VIEW.width / 2 - cam.x, VIEW.height / 2 - cam.y);
    drawGround(game);
    drawMissionMarker(game, time);
    for (const car of game.traffic) {
      if (!car.dead) drawCarShape(car, false);
    }
    for (const car of game.police.cars) drawCarShape(car, false);
    for (const car of game.police.cars) drawPoliceLights(car, game.police.sirenPhase);
    if (game.playerCar && !game.playerCar.dead && game.player.inCar !== game.playerCar) {
      drawCarShape(game.playerCar, false);
    }
    if (game.player.inCar) drawCarShape(game.player.inCar, true);
    for (const ped of game.peds) drawPed(ped);
    for (const thug of game.thugs) drawThug(thug);
    drawPlayer(game);
    drawBullets(game);
  }

  function drawMinimap(game) {
    const x0 = MINIMAP.margin;
    const y0 = VIEW.height - MINIMAP.size - MINIMAP.margin;
    const sx = MINIMAP.size / WORLD.width;
    const sy = MINIMAP.size / WORLD.height;
    context.fillStyle = PALETTE.panel;
    context.fillRect(x0 - 6, y0 - 6, MINIMAP.size + 12, MINIMAP.size + 12);
    context.strokeStyle = PALETTE.neonCyan;
    context.lineWidth = 2;
    context.strokeRect(x0 - 6, y0 - 6, MINIMAP.size + 12, MINIMAP.size + 12);
    context.save();
    context.beginPath();
    context.rect(x0, y0, MINIMAP.size, MINIMAP.size);
    context.clip();
    context.fillStyle = '#1c1530';
    context.fillRect(x0, y0, MINIMAP.size, MINIMAP.size);
    // Roads.
    context.fillStyle = '#4a4260';
    for (let i = 0; i < CITY.cols; i += 1) {
      context.fillRect(x0 + roadX(i) * sx - 2, y0, 4, MINIMAP.size);
    }
    for (let j = 0; j < CITY.rows; j += 1) {
      context.fillRect(x0, y0 + roadY(j) * sy - 2, MINIMAP.size, 4);
    }
    // Buildings.
    context.fillStyle = '#6a5f8f';
    for (const b of game.city.buildings) {
      context.fillRect(x0 + b.x * sx, y0 + b.y * sy, Math.max(2, b.w * sx), Math.max(2, b.h * sy));
    }
    // Mission target.
    const target = stageTarget(game.missions, game.city);
    if (target) {
      context.fillStyle = PALETTE.neonYellow;
      context.beginPath();
      context.arc(x0 + target.x * sx, y0 + target.y * sy, 5, 0, Math.PI * 2);
      context.fill();
    }
    // Police.
    context.fillStyle = PALETTE.policeLightBlue;
    for (const car of game.police.cars) {
      context.beginPath();
      context.arc(x0 + car.x * sx, y0 + car.y * sy, 3, 0, Math.PI * 2);
      context.fill();
    }
    // Player arrow.
    const px = x0 + game.player.x * sx;
    const py = y0 + game.player.y * sy;
    context.save();
    context.translate(px, py);
    context.rotate(game.player.angle);
    context.fillStyle = PALETTE.player;
    context.beginPath();
    context.moveTo(8, 0);
    context.lineTo(-5, -5);
    context.lineTo(-5, 5);
    context.closePath();
    context.fill();
    context.restore();
    context.restore();
    text('NEON PALMS', x0, y0 - 10, 12, PALETTE.muted, 'left');
  }

  function drawHud(game) {
    context.setTransform(view.scale, 0, 0, view.scale, view.x, view.y);
    // Top-left: cash and health.
    text(`$${game.money}`, 24, 40, 30, PALETTE.neonYellow, 'left');
    context.fillStyle = 'rgba(0,0,0,0.55)';
    context.fillRect(24, 52, 220, 16);
    context.fillStyle = game.player.health > 30 ? PALETTE.health : PALETTE.damage;
    context.fillRect(24, 52, 220 * Math.max(0, game.player.health / 100), 16);
    context.strokeStyle = PALETTE.text;
    context.lineWidth = 2;
    context.strokeRect(24, 52, 220, 16);
    text('HP', 250, 66, 14, PALETTE.text, 'left');
    // Top-right: wanted stars (filled; empty ones are dim so the world behind
    // never shows through a hollow glyph).
    const stars = Math.max(0, Math.min(5, Math.ceil(game.police.stars - 0.001)));
    context.fillStyle = 'rgba(0,0,0,0.45)';
    context.fillRect(VIEW.width - 24 - 5 * 30, 12, 5 * 30, 40);
    for (let i = 0; i < 5; i += 1) {
      text(STAR, VIEW.width - 30 - i * 30, 44, 30, i < stars ? PALETTE.star : '#4a4260', 'right');
    }
    if (stars > 0) {
      text('WANTED', VIEW.width - 24, 72, 14, PALETTE.damage, 'right');
    }
    // Top-centre: mission objective.
    const objective = objectiveText(game.missions);
    context.font = `bold 17px ${FONT}`;
    const width = context.measureText(objective).width;
    context.fillStyle = PALETTE.panel;
    context.fillRect(VIEW.width / 2 - width / 2 - 180, 12, width + 360, 34);
    text(objective, VIEW.width / 2, 36, 17, PALETTE.text, 'center');
    // Bottom-right: ammo and car health.
    if (game.player.inCar) {
      text(`CAR ${Math.max(0, Math.round(game.player.inCar.health))}%`, VIEW.width - 24, VIEW.height - 64, 20, PALETTE.text, 'right');
      text('W/S drive  A/D steer  Space brake  E exit', VIEW.width - 24, VIEW.height - 36, 15, PALETTE.muted, 'right');
    } else {
      const ammo = game.player.reloading > 0 ? 'RELOADING…' : `${game.player.ammo} / ${PLAYER.magSize}`;
      text(`AMMO ${ammo}`, VIEW.width - 24, VIEW.height - 64, 20, PALETTE.text, 'right');
      text('WASD move  Mouse aim  Click shoot  F punch  E enter car', VIEW.width - 24, VIEW.height - 36, 15, PALETTE.muted, 'right');
    }
    drawMinimap(game);
    // Interact prompt.
    if (game.missions.interactReady) {
      text('Press E', VIEW.width / 2, VIEW.height - 130, 24, PALETTE.neonYellow, 'center');
    } else if (!game.player.inCar && game.nearCar) {
      text('Press E to enter car', VIEW.width / 2, VIEW.height - 130, 24, PALETTE.text, 'center');
    }
    // Mission banner.
    const banner = game.missions.banner;
    if (banner && banner.timer > 0) {
      context.fillStyle = 'rgba(16,12,28,0.85)';
      context.fillRect(0, VIEW.height / 2 - 110, VIEW.width, 56);
      text(banner.text, VIEW.width / 2, VIEW.height / 2 - 72, 22, PALETTE.neonYellow, 'center');
    }
    // Hurt vignette.
    if (game.player.hurtTimer > 0) {
      context.fillStyle = `rgba(255,45,85,${0.18 * game.player.hurtTimer})`;
      context.fillRect(0, 0, VIEW.width, VIEW.height);
    }
    // Bust progress ring while a cop holds the player.
    if (game.police.bustProgress > 0) {
      text('BUSTED?', VIEW.width / 2, 100, 26, PALETTE.damage, 'center');
    }
  }

  function drawPanel(title, lines, prompt, accent) {
    // Panels live in screen space: reset the camera transform drawWorld left behind.
    context.setTransform(view.scale, 0, 0, view.scale, view.x, view.y);
    const height = 150 + lines.length * PANEL.line + 70;
    const x = (VIEW.width - PANEL.width) / 2;
    const y = (VIEW.height - height) / 2;
    context.fillStyle = PALETTE.panel;
    context.fillRect(x, y, PANEL.width, height);
    context.strokeStyle = accent || PALETTE.neonPink;
    context.lineWidth = 3;
    context.shadowColor = accent || PALETTE.neonPink;
    context.shadowBlur = 16;
    context.strokeRect(x, y, PANEL.width, height);
    context.shadowBlur = 0;
    text(title, VIEW.width / 2, y + 74, 46, accent || PALETTE.neonPink, 'center');
    for (let index = 0; index < lines.length; index += 1) {
      text(lines[index], VIEW.width / 2, y + 128 + index * PANEL.line, 20, PALETTE.muted, 'center');
    }
    text(prompt, VIEW.width / 2, y + height - 36, 22, PALETTE.neonYellow, 'center');
  }

  const TITLE_LINES = [
    'A sun-soaked city. A fixer named Mara. Five jobs',
    'between you and the big score at Sunset Bank.',
    '',
    'WASD walk · Mouse aim · Click shoot · F punch',
    'E enter / steal a car · W/S drive · Space brake',
    'P pause · M mute · The cops remember everything.',
  ];

  /** Paint one frame: the world, then the HUD or a panel for the screen. */
  function draw(game, screen, ui) {
    context.setTransform(1, 0, 0, 1, 0, 0);
    context.fillStyle = '#120d1e';
    context.fillRect(0, 0, canvas.width, canvas.height);
    drawWorld(game, ui.time);
    if (screen === SCREEN_TITLE) {
      const lines = TITLE_LINES.slice();
      if (ui.saveExists) lines.push(`Saved game found — press C to continue ($${ui.saveMoney}, mission ${ui.saveMission + 1})`);
      else lines.push('No saved game yet — your progress autosaves as you play.');
      drawPanel('NEON PALMS', lines, ui.saveExists ? 'Enter: new game   ·   C: continue   ·   Click: play' : 'Press Enter or click to start', PALETTE.neonPink);
      return;
    }
    drawHud(game);
    if (screen === SCREEN_PAUSED) {
      drawPanel('PAUSED', ['The city waits. Your wanted level does not fade while paused.', 'M mute sound'], 'Press P or Enter to resume', PALETTE.neonCyan);
    } else if (screen === SCREEN_OVER) {
      drawPanel('WASTED', [`You went down in Neon Palms with $${game.money}.`, `Missions finished: ${game.missions.completedCount} of 5.`], 'Press Enter to start over from your save', PALETTE.damage);
    } else if (screen === SCREEN_BUSTED) {
      drawPanel('BUSTED', [`The Palm Police took $${ui.fine} and your ride.`, 'Mara is not impressed.'], 'Press Enter to walk out of the station', PALETTE.policeLightBlue);
    } else if (screen === SCREEN_WIN) {
      drawPanel('STORY COMPLETE', ['The Big Score is yours. Neon Palms belongs to you now.', `Final cash: $${game.money}. Free roam continues.`], 'Press Enter to keep playing', PALETTE.neonYellow);
    }
  }

  /** Convert a mouse position (CSS pixels over the canvas) to a world point, for aiming. */
  function aimPoint(game, mouseX, mouseY) {
    const ratio = window.devicePixelRatio || 1;
    const logicalX = (mouseX * ratio - view.x) / view.scale;
    const logicalY = (mouseY * ratio - view.y) / view.scale;
    const cam = camera(game);
    return {
      x: cam.x + (logicalX - VIEW.width / 2),
      y: cam.y + (logicalY - VIEW.height / 2),
    };
  }

  resize();
  window.addEventListener('resize', resize);
  return { draw, view, aimPoint };
}

export { MINIMAP };
