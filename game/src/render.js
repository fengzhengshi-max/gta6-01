// Neon Palms — all drawing: city, cars, people, HUD, minimap and menus.
import { CFG } from './config.js';
import { ROAD_W } from './world.js';
import { missionTarget, missionText, MISSION_DEFS } from './missions.js';
import { dist, clamp } from './random.js';

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
}

export function drawWorld(ctx, game, cam) {
  const w = game.world, C = CFG.colors;
  // Ground: grass base, sand beach on the east edge, water beyond it.
  ctx.fillStyle = C.grass; ctx.fillRect(0, 0, w.worldW, w.worldH);
  ctx.fillStyle = C.sand; ctx.fillRect(w.worldW - 210, 0, 210, w.worldH);
  ctx.fillStyle = C.water; ctx.fillRect(w.worldW - 60, 0, 60, w.worldH);
  // Park block: darker green lawn with palm dots.
  const park = w.landmarks.find((l) => l.id === 'park');
  ctx.fillStyle = '#0f2c18'; ctx.fillRect(park.x - 90, park.y - 70, 300, 260);
  ctx.fillStyle = '#1d5c33';
  for (let i = 0; i < 9; i++) {
    const px = park.x - 60 + (i % 3) * 110, py = park.y - 40 + Math.floor(i / 3) * 90;
    ctx.beginPath(); ctx.arc(px, py, 16, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#2f7a44'; ctx.lineWidth = 4;
    ctx.beginPath(); ctx.moveTo(px, py); ctx.lineTo(px + 8, py - 22); ctx.stroke();
  }
  // Roads.
  ctx.fillStyle = C.asphalt;
  for (const rx of w.roadsX) ctx.fillRect(rx - ROAD_W / 2, 0, ROAD_W, w.worldH);
  for (const ry of w.roadsY) ctx.fillRect(0, ry - ROAD_W / 2, w.worldW, ROAD_W);
  // Sidewalks.
  ctx.fillStyle = C.sidewalk;
  for (const rx of w.roadsX) { ctx.fillRect(rx - ROAD_W / 2 - 10, 0, 10, w.worldH); ctx.fillRect(rx + ROAD_W / 2, 0, 10, w.worldH); }
  for (const ry of w.roadsY) { ctx.fillRect(0, ry - ROAD_W / 2 - 10, w.worldW, 10); ctx.fillRect(0, ry + ROAD_W / 2, w.worldW, 10); }
  // Lane dashes.
  ctx.fillStyle = C.roadLine;
  for (const rx of w.roadsX) for (let y = 0; y < w.worldH; y += 56) ctx.fillRect(rx - 2, y, 4, 28);
  for (const ry of w.roadsY) for (let x = 0; x < w.worldW; x += 56) ctx.fillRect(x, ry - 2, 28, 4);
  // Buildings with neon trim and lit windows.
  for (const b of w.buildings) {
    ctx.fillStyle = b.color; ctx.fillRect(b.x, b.y, b.w, b.h);
    ctx.fillStyle = 'rgba(255,255,255,0.08)';
    for (let i = 0; i < b.windows; i++) {
      const wx = b.x + 8 + (i * 37) % (b.w - 16), wy = b.y + 8 + (Math.floor(i * 37 / (b.w - 16)) * 22) % (b.h - 16);
      ctx.fillRect(wx, wy, 10, 12);
    }
    ctx.strokeStyle = b.neon; ctx.lineWidth = 3; ctx.globalAlpha = 0.85;
    ctx.strokeRect(b.x + 1, b.y + 1, b.w - 2, b.h - 2); ctx.globalAlpha = 1;
    if (b.landmark) {
      ctx.fillStyle = '#fff'; ctx.font = 'bold 13px monospace'; ctx.textAlign = 'center';
      ctx.fillText(b.landmark.toUpperCase(), b.x + b.w / 2, b.y + b.h / 2);
    }
  }
  // Landmark labels.
  ctx.font = 'bold 12px monospace'; ctx.textAlign = 'left';
  for (const lm of w.landmarks) {
    ctx.fillStyle = '#ffd7ef';
    ctx.fillText(lm.name, lm.x - 40, lm.y - 58);
  }
  // Mission beacon: pulsing ring + column of light.
  const tgt = missionTarget(game);
  if (tgt && !game.missions.done && game.screen === 'play') {
    const t = game.time * 2;
    const pulse = 26 + Math.sin(t) * 8;
    ctx.strokeStyle = '#ff2e88'; ctx.lineWidth = 4;
    ctx.beginPath(); ctx.arc(tgt.x, tgt.y, pulse, 0, Math.PI * 2); ctx.stroke();
    ctx.fillStyle = 'rgba(255,46,136,0.18)';
    ctx.beginPath(); ctx.arc(tgt.x, tgt.y, pulse + 14, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#ff2e88';
    ctx.beginPath(); ctx.moveTo(tgt.x, tgt.y - 44); ctx.lineTo(tgt.x - 10, tgt.y - 22); ctx.lineTo(tgt.x + 10, tgt.y - 22); ctx.closePath(); ctx.fill();
  }
}

function drawCar(ctx, car) {
  ctx.save(); ctx.translate(car.x, car.y); ctx.rotate(car.angle);
  ctx.fillStyle = 'rgba(0,0,0,0.35)'; roundRect(ctx, -24, -12, 50, 26, 6); ctx.fill();
  ctx.fillStyle = car.police ? '#1c3fae' : car.color; roundRect(ctx, -26, -13, 52, 26, 7); ctx.fill();
  ctx.fillStyle = '#0d1526'; roundRect(ctx, -8, -11, 18, 22, 4); ctx.fill();
  ctx.fillStyle = car.police ? '#ff2e88' : '#dfe8ff'; ctx.fillRect(2, -11, 4, 22);
  if (car.police) {
    ctx.fillStyle = '#ff2e44'; ctx.fillRect(-22, -13, 8, 5);
    ctx.fillStyle = '#22e6ff'; ctx.fillRect(-22, 8, 8, 5);
  }
  ctx.fillStyle = '#111';
  ctx.fillRect(-20, -15, 8, 4); ctx.fillRect(-20, 11, 8, 4); ctx.fillRect(12, -15, 8, 4); ctx.fillRect(12, 11, 8, 4);
  if (car.health < 40) { ctx.fillStyle = 'rgba(120,120,120,0.7)'; ctx.beginPath(); ctx.arc(-14, 0, 7 + Math.sin(Date.now() / 90) * 2, 0, Math.PI * 2); ctx.fill(); }
  ctx.restore();
}

function drawPerson(ctx, x, y, angle, shirt, phase, fleeing) {
  ctx.save(); ctx.translate(x, y); ctx.rotate(angle);
  const bob = Math.sin(phase) * 2;
  ctx.fillStyle = '#1a1a22'; ctx.fillRect(-5, -4 + bob, 10, 8);
  ctx.fillStyle = shirt; ctx.beginPath(); ctx.arc(0, 0, 7, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#f0c8a0'; ctx.beginPath(); ctx.arc(9, 0, 5, 0, Math.PI * 2); ctx.fill();
  if (fleeing) { ctx.fillStyle = '#fff'; ctx.font = 'bold 11px monospace'; ctx.fillText('!', 12, -10); }
  ctx.restore();
}

export function drawEntities(ctx, game) {
  for (const ped of game.peds) if (!ped.dead) drawPerson(ctx, ped.x, ped.y, ped.angle, ped.shirt, ped.walkPhase, ped.flee > 0);
  for (const g of game.gang) if (!g.dead) drawPerson(ctx, g.x, g.y, g.angle, '#8a1a1a', g.walkPhase || 0, false);
  for (const car of game.cars) if (!car.dead) drawCar(ctx, car);
  // Bullets as bright tracers.
  ctx.strokeStyle = '#ffe66a'; ctx.lineWidth = 3;
  for (const b of game.bullets) {
    ctx.beginPath(); ctx.moveTo(b.x - b.vx * 0.02, b.y - b.vy * 0.02); ctx.lineTo(b.x, b.y); ctx.stroke();
  }
  // Player.
  const p = game.player;
  if (!p.inCar) {
    drawPerson(ctx, p.x, p.y, p.angle, '#22e6ff', p.walkPhase, false);
    // Aim line + pistol.
    ctx.strokeStyle = 'rgba(255,255,255,0.5)'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(p.x + Math.cos(p.aimAngle) * 34, p.y + Math.sin(p.aimAngle) * 34); ctx.stroke();
  }
  // Floaters (+$ rewards).
  ctx.font = 'bold 15px monospace'; ctx.textAlign = 'center';
  for (const f of game.floaters) { ctx.fillStyle = f.color; ctx.globalAlpha = clamp(f.life, 0, 1); ctx.fillText(f.text, f.x, f.y); }
  ctx.globalAlpha = 1;
}

export function drawHUD(ctx, game) {
  const p = game.player;
  ctx.textAlign = 'left';
  // Top-left: money + health bar.
  ctx.fillStyle = 'rgba(0,0,0,0.55)'; roundRect(ctx, 12, 12, 252, 64, 8); ctx.fill();
  ctx.fillStyle = '#a6ff3d'; ctx.font = 'bold 22px monospace';
  ctx.fillText('$' + p.money.toLocaleString('en-US'), 24, 40);
  ctx.fillStyle = '#333'; ctx.fillRect(24, 50, 180, 12);
  ctx.fillStyle = p.health > 30 ? '#38c96a' : '#e8452c';
  ctx.fillRect(24, 50, 180 * clamp(p.health / 100, 0, 1), 12);
  ctx.fillStyle = '#fff'; ctx.font = '12px monospace'; ctx.fillText('HP ' + Math.ceil(p.health), 210, 61);
  // Top-right: wanted stars.
  ctx.fillStyle = 'rgba(0,0,0,0.55)'; roundRect(ctx, CFG.viewW - 212, 12, 200, 44, 8); ctx.fill();
  ctx.font = '26px monospace';
  for (let i = 0; i < 5; i++) {
    ctx.fillStyle = i < game.wanted ? '#ffd23d' : 'rgba(255,255,255,0.25)';
    ctx.fillText('★', CFG.viewW - 196 + i * 36, 44);
  }
  // Top-center: objective.
  const txt = game.missions.done ? 'STORY COMPLETE — Neon Palms is yours!' : missionText(game);
  ctx.font = 'bold 14px monospace';
  const tw = ctx.measureText(txt).width;
  ctx.fillStyle = 'rgba(0,0,0,0.55)'; roundRect(ctx, CFG.viewW / 2 - tw / 2 - 14, 12, tw + 28, 34, 8); ctx.fill();
  ctx.fillStyle = '#ffd7ef'; ctx.textAlign = 'center'; ctx.fillText(txt, CFG.viewW / 2, 35); ctx.textAlign = 'left';
  const tgt = missionTarget(game);
  if (tgt && !game.missions.done) {
    const d = Math.round(dist(p.x, p.y, tgt.x, tgt.y));
    ctx.fillStyle = '#22e6ff'; ctx.font = '13px monospace'; ctx.textAlign = 'center';
    ctx.fillText('◉ ' + d + 'm  •  ' + MISSION_DEFS[game.missions.index].hint, CFG.viewW / 2, 64);
    ctx.textAlign = 'left';
  }
  // Bottom-right: ammo / car condition.
  ctx.fillStyle = 'rgba(0,0,0,0.55)'; roundRect(ctx, CFG.viewW - 212, CFG.viewH - 64, 200, 52, 8); ctx.fill();
  ctx.fillStyle = '#fff'; ctx.font = 'bold 16px monospace';
  if (p.inCar) {
    ctx.fillText('CAR ' + Math.max(0, Math.ceil(p.inCar.health)) + '%', CFG.viewW - 196, CFG.viewH - 40);
    ctx.fillStyle = '#22e6ff'; ctx.font = '12px monospace'; ctx.fillText('F exit  •  W/S drive', CFG.viewW - 196, CFG.viewH - 22);
  } else {
    ctx.fillText(p.reloadTimer > 0 ? 'RELOADING…' : 'AMMO ' + p.ammo + ' / ' + p.reserve, CFG.viewW - 196, CFG.viewH - 40);
    ctx.fillStyle = '#22e6ff'; ctx.font = '12px monospace'; ctx.fillText('F punch  •  click shoot  •  R reload', CFG.viewW - 196, CFG.viewH - 22);
  }
  // Busted warning.
  if (game.bustedTimer > 0.2 && !p.inCar) {
    ctx.fillStyle = '#ff2e44'; ctx.font = 'bold 20px monospace'; ctx.textAlign = 'center';
    ctx.fillText('POLICE ARE GRABBING YOU…', CFG.viewW / 2, CFG.viewH - 90); ctx.textAlign = 'left';
  }
}

export function drawMinimap(ctx, game) {
  const S = 168, X = 12, Y = CFG.viewH - S - 12;
  const sx = S / game.world.worldW, sy = S / game.world.worldH;
  ctx.fillStyle = 'rgba(0,0,0,0.6)'; roundRect(ctx, X - 4, Y - 4, S + 8, S + 8, 8); ctx.fill();
  ctx.save(); ctx.beginPath(); ctx.rect(X, Y, S, S); ctx.clip();
  ctx.fillStyle = '#0d2c18'; ctx.fillRect(X, Y, S, S);
  ctx.fillStyle = '#23232e';
  for (const rx of game.world.roadsX) ctx.fillRect(X + rx * sx - 1, Y, 2, S);
  for (const ry of game.world.roadsY) ctx.fillRect(X, Y + ry * sy, S, 2);
  ctx.fillStyle = '#3d3d5c';
  for (const b of game.world.buildings) ctx.fillRect(X + b.x * sx, Y + b.y * sy, Math.max(1, b.w * sx), Math.max(1, b.h * sy));
  const tgt = missionTarget(game);
  if (tgt && !game.missions.done) {
    ctx.fillStyle = '#ff2e88'; ctx.beginPath(); ctx.arc(X + tgt.x * sx, Y + tgt.y * sy, 5, 0, Math.PI * 2); ctx.fill();
  }
  ctx.fillStyle = '#2c7de8';
  for (const c of game.police) { ctx.beginPath(); ctx.arc(X + c.x * sx, Y + c.y * sy, 3, 0, Math.PI * 2); ctx.fill(); }
  const p = game.player;
  ctx.fillStyle = '#fff';
  ctx.save(); ctx.translate(X + p.x * sx, Y + p.y * sy); ctx.rotate(p.angle);
  ctx.beginPath(); ctx.moveTo(6, 0); ctx.lineTo(-4, -4); ctx.lineTo(-4, 4); ctx.closePath(); ctx.fill(); ctx.restore();
  ctx.restore();
  ctx.fillStyle = '#fff'; ctx.font = '11px monospace'; ctx.fillText('NEON PALMS', X + 2, Y - 8);
}

function menuBox(ctx, title, lines, accent) {
  ctx.fillStyle = 'rgba(8,8,20,0.72)'; ctx.fillRect(0, 0, CFG.viewW, CFG.viewH);
  ctx.textAlign = 'center';
  ctx.fillStyle = accent || '#ff2e88'; ctx.font = 'bold 64px monospace';
  ctx.fillText(title, CFG.viewW / 2, 210);
  ctx.fillStyle = '#22e6ff'; ctx.font = '20px monospace';
  ctx.fillText('— a neon open-world crime story —', CFG.viewW / 2, 248);
  ctx.fillStyle = '#fff'; ctx.font = '17px monospace';
  lines.forEach((l, i) => ctx.fillText(l, CFG.viewW / 2, 310 + i * 32));
  ctx.textAlign = 'left';
}

export function drawScreen(ctx, game) {
  if (game.screen === 'title') {
    menuBox(ctx, 'NEON PALMS', [
      'WASD walk • Shift run • E steal / enter car • F punch',
      'Mouse aim • Click shoot • R reload • P pause',
      game.hasSave ? 'C — CONTINUE your story ($' + (game.saveData ? game.saveData.money : 0) + ', mission ' + ((game.saveData ? game.saveData.missionIndex : 0) + 1) + ')' : 'No save yet — your story starts fresh.',
      'ENTER — NEW GAME',
      'Best cash ever: $' + (game.bestCash || 0).toLocaleString('en-US'),
    ]);
  } else if (game.screen === 'paused') {
    menuBox(ctx, 'PAUSED', ['P — resume', 'Your progress autosaves.', 'M — mute sound']);
  } else if (game.screen === 'wasted') {
    menuBox(ctx, 'WASTED', ['You ran out of health.', 'ENTER — try again from the safehouse', 'Fine: you keep your cash, minus $200 hospital bill.'], '#e8452c');
  } else if (game.screen === 'busted') {
    menuBox(ctx, 'BUSTED', ['The police caught you.', 'Fine: $300. You wake up at the police station.', 'ENTER — walk free'], '#2c7de8');
  } else if (game.screen === 'complete') {
    menuBox(ctx, 'STORY COMPLETE', [
      'Mara’s crew owns Neon Palms now — and so do you.',
      'Final cash: $' + game.player.money.toLocaleString('en-US'),
      'Best cash ever: $' + (game.bestCash || 0).toLocaleString('en-US'),
      'ENTER — keep exploring the city',
    ], '#a6ff3d');
  }
}
