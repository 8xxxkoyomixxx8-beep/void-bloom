// VOID BLOOM's drawing: the arena, the Warden, every blight kind, the HUD, and the screens
// (title, level-up choices, pause, game over, victory). Canvas 2D only, one palette, no images:
// every shape is drawn in code so the scene reads the same at any size.

import { BOSS, COLORS, FIELD, PLAYER } from './config.js';

/** The screens main.js can ask for. */
export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';
export const SCREEN_LEVELUP = 'levelup';
export const SCREEN_PAUSE = 'pause';
export const SCREEN_OVER = 'over';
export const SCREEN_WON = 'won';

/** Format a second count as m:ss for the HUD and the results screens. */
export function formatTime(seconds) {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}

/** A rounded rectangle path (panels, cards, bars). */
function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/** A horizontal bar with a filled share: health, experience, the boss's health, dash charge. */
function bar(ctx, x, y, w, h, share, color, back) {
  ctx.fillStyle = back || 'rgba(255, 255, 255, 0.10)';
  roundRect(ctx, x, y, w, h, h / 2);
  ctx.fill();
  if (share > 0) {
    ctx.fillStyle = color;
    roundRect(ctx, x, y, Math.max(h, w * Math.min(1, share)), h, h / 2);
    ctx.fill();
  }
}

/** The arena: night ground, a soft glow at the centre, a faint grid, and the thorn wall. */
function drawArena(ctx, state) {
  ctx.fillStyle = COLORS.bg;
  ctx.fillRect(0, 0, FIELD.width, FIELD.height);
  const glow = ctx.createRadialGradient(FIELD.width / 2, FIELD.height / 2, 60, FIELD.width / 2, FIELD.height / 2, 560);
  glow.addColorStop(0, COLORS.bgGlow);
  glow.addColorStop(1, 'rgba(11, 14, 29, 0)');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, FIELD.width, FIELD.height);
  ctx.strokeStyle = COLORS.grid;
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let x = FIELD.wall + 40; x < FIELD.width - FIELD.wall; x += 40) { ctx.moveTo(x, FIELD.wall); ctx.lineTo(x, FIELD.height - FIELD.wall); }
  for (let y = FIELD.wall + 40; y < FIELD.height - FIELD.wall; y += 40) { ctx.moveTo(FIELD.wall, y); ctx.lineTo(FIELD.width - FIELD.wall, y); }
  ctx.stroke();
  ctx.strokeStyle = COLORS.wall;
  ctx.lineWidth = 3;
  roundRect(ctx, FIELD.wall - 6, FIELD.wall - 6, FIELD.width - FIELD.wall * 2 + 12, FIELD.height - FIELD.wall * 2 + 12, 18);
  ctx.stroke();
  // Thorn ticks along the wall, breathing slowly with the run's clock.
  ctx.strokeStyle = 'rgba(120, 140, 255, 0.35)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  const breathe = 3 + Math.sin(state.time * 1.4) * 1.2;
  for (let x = FIELD.wall + 22; x < FIELD.width - FIELD.wall - 10; x += 34) {
    ctx.moveTo(x, FIELD.wall - 6); ctx.lineTo(x + 6, FIELD.wall - 6 - breathe);
    ctx.moveTo(x, FIELD.height - FIELD.wall + 6); ctx.lineTo(x + 6, FIELD.height - FIELD.wall + 6 + breathe);
  }
  ctx.stroke();
}

/** A spore (a turning gold diamond) or a heart (a pink heart) waiting to be gathered. */
function drawPickup(ctx, pickup) {
  const pulse = 1 + Math.sin(pickup.t * 5) * 0.15;
  const blink = pickup.life < 3 ? (Math.sin(pickup.t * 16) > 0 ? 1 : 0.25) : 1;
  ctx.save();
  ctx.globalAlpha = blink;
  ctx.translate(pickup.x, pickup.y);
  if (pickup.kind === 'spore') {
    ctx.rotate(pickup.t * 2.4);
    ctx.fillStyle = COLORS.spore;
    const r = 6.5 * pulse;
    ctx.beginPath();
    ctx.moveTo(0, -r); ctx.lineTo(r, 0); ctx.lineTo(0, r); ctx.lineTo(-r, 0);
    ctx.closePath();
    ctx.fill();
  } else {
    ctx.scale(pulse, pulse);
    ctx.fillStyle = COLORS.heart;
    ctx.beginPath();
    ctx.moveTo(0, 8);
    ctx.bezierCurveTo(-11, -2, -7, -10, 0, -5);
    ctx.bezierCurveTo(7, -10, 11, -2, 0, 8);
    ctx.fill();
  }
  ctx.restore();
}

/** One enemy, drawn by its kind: husk spikes, a dart's arrow, a bloom's petals, and the rest. */
function drawEnemy(ctx, enemy, player) {
  const angle = Math.atan2(player.y - enemy.y, player.x - enemy.x);
  ctx.save();
  ctx.translate(enemy.x, enemy.y);
  ctx.fillStyle = enemy.color;
  ctx.strokeStyle = enemy.color;
  const r = enemy.radius;

  if (enemy.boss) {
    const spin = enemy.t * 0.7;
    for (let i = 0; i < 8; i += 1) {
      const a = spin + (i / 8) * Math.PI * 2;
      ctx.save();
      ctx.rotate(a);
      ctx.beginPath();
      ctx.ellipse(r * 0.78, 0, r * 0.52, r * 0.26, 0, 0, Math.PI * 2);
      ctx.globalAlpha = 0.75;
      ctx.fill();
      ctx.restore();
    }
    ctx.globalAlpha = 1;
    ctx.beginPath();
    ctx.arc(0, 0, r * 0.72, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#2b0a18';
    ctx.beginPath();
    ctx.arc(0, 0, r * 0.34, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#ffd94d';
    ctx.beginPath();
    ctx.arc(Math.cos(angle) * 4, Math.sin(angle) * 4, r * 0.13, 0, Math.PI * 2);
    ctx.fill();
  } else if (enemy.kind === 'husk') {
    const spikes = 8;
    ctx.beginPath();
    for (let i = 0; i < spikes * 2; i += 1) {
      const a = enemy.t * 0.8 + (i / (spikes * 2)) * Math.PI * 2;
      const rad = i % 2 === 0 ? r * 1.18 : r * 0.82;
      const px = Math.cos(a) * rad;
      const py = Math.sin(a) * rad;
      if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = 'rgba(20, 4, 12, 0.55)';
    ctx.beginPath();
    ctx.arc(0, 0, r * 0.45, 0, Math.PI * 2);
    ctx.fill();
  } else if (enemy.kind === 'dart') {
    ctx.rotate(angle);
    if (enemy.mode === 'windup') ctx.translate(Math.sin(enemy.t * 60) * 1.6, 0);
    ctx.beginPath();
    ctx.moveTo(r * 1.5, 0);
    ctx.lineTo(-r, r * 0.85);
    ctx.lineTo(-r * 0.45, 0);
    ctx.lineTo(-r, -r * 0.85);
    ctx.closePath();
    ctx.fill();
    if (enemy.mode === 'windup') {
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2;
      ctx.stroke();
    }
  } else if (enemy.kind === 'bloom') {
    for (let i = 0; i < 6; i += 1) {
      const a = enemy.t * 0.5 + (i / 6) * Math.PI * 2;
      ctx.beginPath();
      ctx.arc(Math.cos(a) * r * 0.55, Math.sin(a) * r * 0.55, r * 0.42, 0, Math.PI * 2);
      ctx.globalAlpha = 0.8;
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    ctx.beginPath();
    ctx.arc(0, 0, r * 0.5, 0, Math.PI * 2);
    ctx.fill();
  } else if (enemy.kind === 'mite') {
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (let i = 0; i < 6; i += 1) {
      const a = (i / 6) * Math.PI * 2 + enemy.t * 3;
      ctx.moveTo(Math.cos(a) * r * 0.6, Math.sin(a) * r * 0.6);
      ctx.lineTo(Math.cos(a) * r * 1.25, Math.sin(a) * r * 1.25);
    }
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.fill();
  } else if (enemy.kind === 'spitter') {
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#0d2b1a';
    ctx.beginPath();
    ctx.arc(Math.cos(angle) * r * 0.3, Math.sin(angle) * r * 0.3, r * 0.42, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#baffd9';
    ctx.beginPath();
    ctx.arc(Math.cos(angle) * r * 0.3, Math.sin(angle) * r * 0.3, r * 0.16, 0, Math.PI * 2);
    ctx.fill();
  }

  if (enemy.flash > 0) {
    ctx.globalAlpha = Math.min(0.85, enemy.flash);
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
  }
  ctx.restore();

  // A thin health sliver over anything hurt but not dead (the boss gets the big bar instead).
  if (!enemy.boss && enemy.hp < enemy.maxHp) {
    bar(ctx, enemy.x - r, enemy.y - r - 11, r * 2, 4, enemy.hp / enemy.maxHp, enemy.color, 'rgba(0,0,0,0.4)');
  }
}

/** The Warden: a glowing orb, its cannon toward the aim, a dash-charge ring, a hurt flash. */
function drawPlayer(ctx, state) {
  const p = state.player;
  ctx.save();
  ctx.translate(p.x, p.y);
  const glow = ctx.createRadialGradient(0, 0, 2, 0, 0, PLAYER.radius * 2.6);
  glow.addColorStop(0, 'rgba(83, 233, 255, 0.5)');
  glow.addColorStop(1, 'rgba(83, 233, 255, 0)');
  ctx.fillStyle = glow;
  ctx.fillRect(-PLAYER.radius * 2.6, -PLAYER.radius * 2.6, PLAYER.radius * 5.2, PLAYER.radius * 5.2);
  // Cannon.
  ctx.rotate(p.angle);
  ctx.fillStyle = COLORS.player;
  ctx.beginPath();
  ctx.moveTo(PLAYER.radius + 10, 0);
  ctx.lineTo(PLAYER.radius - 4, 6);
  ctx.lineTo(PLAYER.radius - 4, -6);
  ctx.closePath();
  ctx.fill();
  ctx.rotate(-p.angle);
  // Body and core.
  ctx.beginPath();
  ctx.arc(0, 0, PLAYER.radius, 0, Math.PI * 2);
  ctx.fillStyle = COLORS.player;
  ctx.fill();
  ctx.beginPath();
  ctx.arc(0, 0, PLAYER.radius * 0.55, 0, Math.PI * 2);
  ctx.fillStyle = COLORS.playerCore;
  ctx.fill();
  if (p.hurtFlash > 0) {
    ctx.globalAlpha = p.hurtFlash * 0.8;
    ctx.strokeStyle = COLORS.hpLow;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(0, 0, PLAYER.radius + 5, 0, Math.PI * 2);
    ctx.stroke();
    ctx.globalAlpha = 1;
  }
  ctx.restore();

  // Dash charge ring under the Warden.
  const charge = 1 - p.dashCooldown / (state.dashMax || 1.6);
  if (charge < 1) {
    ctx.strokeStyle = 'rgba(83, 233, 255, 0.55)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(p.x, p.y, PLAYER.radius + 9, -Math.PI / 2, -Math.PI / 2 + charge * Math.PI * 2);
    ctx.stroke();
  }
}

/** The heads-up display: health, level and spores, wave and time, score, the boss's health. */
function drawHud(ctx, state, ui) {
  const p = state.player;
  const maxHp = state.maxHpNow || PLAYER.maxHp;
  ctx.save();
  ctx.textBaseline = 'middle';

  // Health, top left.
  ctx.fillStyle = COLORS.dim;
  ctx.font = '600 12px system-ui, sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText('WARDEN', 24, 24);
  bar(ctx, 24, 34, 230, 15, p.hp / maxHp, p.hp / maxHp < 0.3 ? COLORS.hpLow : COLORS.hp, 'rgba(0,0,0,0.45)');
  ctx.fillStyle = COLORS.text;
  ctx.font = '700 12px system-ui, sans-serif';
  ctx.fillText(`${Math.ceil(p.hp)} / ${maxHp}`, 30, 42);

  // Level and spore progress, under health.
  ctx.fillStyle = COLORS.dim;
  ctx.font = '600 12px system-ui, sans-serif';
  ctx.fillText(`LEVEL ${state.level}`, 24, 66);
  bar(ctx, 96, 60, 158, 10, state.xp / state.xpNeed, COLORS.xp, 'rgba(0,0,0,0.45)');

  // Wave and time, top centre.
  ctx.textAlign = 'center';
  ctx.fillStyle = COLORS.text;
  ctx.font = '800 22px system-ui, sans-serif';
  ctx.fillText(state.wave > 0 ? `WAVE ${state.wave} / 10` : 'VOID BLOOM', FIELD.width / 2, 32);
  ctx.fillStyle = COLORS.dim;
  ctx.font = '600 13px system-ui, sans-serif';
  const left = state.spawnQueue.length + state.enemies.length;
  ctx.fillText(state.wavePhase === 'active' ? `${left} blight left · ${formatTime(state.time)}` : formatTime(state.time), FIELD.width / 2, 56);

  // Score, top right.
  ctx.textAlign = 'right';
  ctx.fillStyle = COLORS.dim;
  ctx.font = '600 12px system-ui, sans-serif';
  ctx.fillText('SCORE', FIELD.width - 24, 24);
  ctx.fillStyle = COLORS.text;
  ctx.font = '800 24px system-ui, sans-serif';
  ctx.fillText(String(state.score), FIELD.width - 24, 48);
  ctx.fillStyle = COLORS.dim;
  ctx.font = '600 12px system-ui, sans-serif';
  ctx.fillText(`BEST ${Math.max(ui.best || 0, state.score)}`, FIELD.width - 24, 72);

  // The boss's health, a wide bar under the wave line.
  if (state.boss) {
    ctx.textAlign = 'center';
    ctx.fillStyle = BOSS.color;
    ctx.font = '700 13px system-ui, sans-serif';
    ctx.fillText(state.wave >= 10 ? 'THE HEARTBLOOM, LAST OF ITS KIND' : 'THE HEARTBLOOM', FIELD.width / 2, 84);
    bar(ctx, FIELD.width / 2 - 240, 94, 480, 12, state.boss.hp / state.boss.maxHp, BOSS.color, 'rgba(0,0,0,0.5)');
  }

  // Hints, bottom corners.
  ctx.textAlign = 'left';
  ctx.fillStyle = 'rgba(139, 148, 196, 0.8)';
  ctx.font = '500 12px system-ui, sans-serif';
  ctx.fillText('WASD move · mouse aim · click / Space fire · Shift dash · P pause · M sound', 24, FIELD.height - 20);
  ctx.textAlign = 'right';
  ctx.fillText(ui.muted ? 'SOUND OFF (M)' : 'SOUND ON (M)', FIELD.width - 24, FIELD.height - 20);
  ctx.restore();

  // The wave banner, while a wave announces itself.
  if (state.wavePhase === 'announce' && state.wave > 0) {
    const alpha = Math.min(1, state.phaseTimer / 0.8);
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.textAlign = 'center';
    ctx.fillStyle = COLORS.text;
    ctx.font = '800 54px system-ui, sans-serif';
    ctx.fillText(state.wave % 5 === 0 ? `WAVE ${state.wave} — SOMETHING BIG STIRS` : `WAVE ${state.wave}`, FIELD.width / 2, FIELD.height / 2 - 90);
    ctx.restore();
  }
}

/** A dim veil over the scene for the menu screens. */
function veil(ctx, alpha) {
  ctx.fillStyle = `rgba(5, 7, 18, ${alpha})`;
  ctx.fillRect(0, 0, FIELD.width, FIELD.height);
}

/** The centred panel the menu screens share. */
function panel(ctx, w, h) {
  const x = (FIELD.width - w) / 2;
  const y = (FIELD.height - h) / 2;
  ctx.fillStyle = COLORS.panel;
  roundRect(ctx, x, y, w, h, 16);
  ctx.fill();
  ctx.strokeStyle = COLORS.panelEdge;
  ctx.lineWidth = 2;
  roundRect(ctx, x, y, w, h, 16);
  ctx.stroke();
  return { x, y, w, h };
}

/** The title screen: the game's name, its promise, how to play, and the way in. */
function drawTitle(ctx, state, ui) {
  veil(ctx, 0.45);
  ctx.save();
  ctx.textAlign = 'center';
  ctx.fillStyle = COLORS.player;
  ctx.font = '800 92px system-ui, sans-serif';
  ctx.fillText('VOID BLOOM', FIELD.width / 2, 218);
  ctx.fillStyle = COLORS.text;
  ctx.font = '500 21px system-ui, sans-serif';
  ctx.fillText('The garden at the end of the world is overrun. You are its Warden.', FIELD.width / 2, 268);
  ctx.fillStyle = COLORS.dim;
  ctx.font = '500 17px system-ui, sans-serif';
  ctx.fillText('Survive 10 waves of the blight. Gather spores, grow stronger, and cut out the Heartbloom.', FIELD.width / 2, 298);

  const box = panel(ctx, 560, 196);
  ctx.fillStyle = COLORS.text;
  ctx.font = '600 17px system-ui, sans-serif';
  const lines = [
    'WASD or arrow keys — move',
    'Mouse — aim · click or hold Space — fire',
    'Shift — dash through danger (it cannot hurt you mid-dash)',
    'Gold spores level you up: choose 1 of 3 gifts each level',
    'Clear wave 10 and its Heartbloom to cleanse the garden',
  ];
  lines.forEach((line, i) => ctx.fillText(line, FIELD.width / 2, box.y + 42 + i * 32));

  const pulse = 0.65 + Math.sin((ui.time ?? state.time) * 3.2) * 0.35;
  ctx.globalAlpha = pulse;
  ctx.fillStyle = COLORS.spore;
  ctx.font = '800 24px system-ui, sans-serif';
  ctx.fillText('CLICK OR PRESS ENTER TO PLAY', FIELD.width / 2, 606);
  ctx.globalAlpha = 1;
  if (ui.best > 0) {
    ctx.fillStyle = COLORS.dim;
    ctx.font = '600 15px system-ui, sans-serif';
    ctx.fillText(`Best score so far: ${ui.best}`, FIELD.width / 2, 646);
  }
  ctx.restore();
}

/** The three upgrade cards' rectangles, shared by drawing and by main.js's click handling. */
export function choiceRects() {
  const w = 300;
  const h = 210;
  const gap = 28;
  const total = w * 3 + gap * 2;
  const x0 = (FIELD.width - total) / 2;
  const y = 300;
  return [0, 1, 2].map((i) => ({ x: x0 + i * (w + gap), y, w, h }));
}

/** The level-up screen: three gifts, one to choose by key or click. */
function drawLevelup(ctx, state, ui) {
  veil(ctx, 0.55);
  ctx.save();
  ctx.textAlign = 'center';
  ctx.fillStyle = COLORS.spore;
  ctx.font = '800 40px system-ui, sans-serif';
  ctx.fillText('THE BLOOM GROWS', FIELD.width / 2, 196);
  ctx.fillStyle = COLORS.text;
  ctx.font = '500 18px system-ui, sans-serif';
  ctx.fillText(`Level ${state.level} — choose one gift`, FIELD.width / 2, 234);
  const rects = choiceRects();
  (ui.choices || []).forEach((choice, i) => {
    const r = rects[i];
    const hover = ui.hoverChoice === i;
    ctx.fillStyle = hover ? 'rgba(38, 48, 102, 0.95)' : COLORS.panel;
    roundRect(ctx, r.x, r.y, r.w, r.h, 14);
    ctx.fill();
    ctx.strokeStyle = hover ? COLORS.spore : COLORS.panelEdge;
    ctx.lineWidth = hover ? 3 : 2;
    roundRect(ctx, r.x, r.y, r.w, r.h, 14);
    ctx.stroke();
    ctx.fillStyle = COLORS.spore;
    ctx.font = '800 30px system-ui, sans-serif';
    ctx.fillText(String(i + 1), r.x + r.w / 2, r.y + 46);
    ctx.fillStyle = COLORS.text;
    ctx.font = '700 22px system-ui, sans-serif';
    ctx.fillText(choice.name, r.x + r.w / 2, r.y + 96);
    ctx.fillStyle = COLORS.dim;
    ctx.font = '500 16px system-ui, sans-serif';
    ctx.fillText(choice.text, r.x + r.w / 2, r.y + 128);
    const owned = state.stacks[choice.id] || 0;
    if (owned > 0) {
      ctx.fillStyle = COLORS.dim;
      ctx.font = '600 13px system-ui, sans-serif';
      ctx.fillText(`already held ×${owned}`, r.x + r.w / 2, r.y + 168);
    }
  });
  ctx.restore();
}

/** The pause screen. */
function drawPause(ctx) {
  veil(ctx, 0.6);
  ctx.save();
  ctx.textAlign = 'center';
  ctx.fillStyle = COLORS.text;
  ctx.font = '800 52px system-ui, sans-serif';
  ctx.fillText('PAUSED', FIELD.width / 2, 360);
  ctx.fillStyle = COLORS.dim;
  ctx.font = '500 18px system-ui, sans-serif';
  ctx.fillText('P or Esc — resume · M — sound on/off', FIELD.width / 2, 410);
  ctx.restore();
}

/** The results block both end screens share: score, wave, kills, time, best. */
function drawResults(ctx, state, ui, y) {
  ctx.font = '600 20px system-ui, sans-serif';
  ctx.fillStyle = COLORS.text;
  const rows = [
    ['Final score', String(state.score)],
    ['Wave reached', `${state.wave} of 10`],
    ['Blight cut down', String(state.kills)],
    ['Time in the garden', formatTime(state.time)],
    ['Best score', String(Math.max(ui.best || 0, state.score))],
  ];
  rows.forEach((row, i) => {
    ctx.textAlign = 'right';
    ctx.fillStyle = COLORS.dim;
    ctx.fillText(row[0], FIELD.width / 2 - 16, y + i * 34);
    ctx.textAlign = 'left';
    ctx.fillStyle = COLORS.text;
    ctx.fillText(row[1], FIELD.width / 2 + 16, y + i * 34);
  });
  ctx.textAlign = 'center';
}

/** The game-over screen: the run's results and the way back in. */
function drawOver(ctx, state, ui) {
  veil(ctx, 0.62);
  ctx.save();
  ctx.textAlign = 'center';
  ctx.fillStyle = COLORS.hpLow;
  ctx.font = '800 58px system-ui, sans-serif';
  ctx.fillText('THE LIGHT GOES OUT', FIELD.width / 2, 218);
  ctx.fillStyle = COLORS.dim;
  ctx.font = '500 18px system-ui, sans-serif';
  ctx.fillText(`The blight overruns the garden on wave ${state.wave}.`, FIELD.width / 2, 258);
  drawResults(ctx, state, ui, 330);
  const pulse = 0.65 + Math.sin((ui.time ?? state.time) * 3.2) * 0.35;
  ctx.globalAlpha = pulse;
  ctx.fillStyle = COLORS.spore;
  ctx.font = '800 23px system-ui, sans-serif';
  ctx.fillText('PRESS R OR CLICK TO TRY AGAIN', FIELD.width / 2, 580);
  ctx.globalAlpha = 1;
  ctx.restore();
}

/** The victory screen: the garden cleansed, the run's results, the way back in. */
function drawWon(ctx, state, ui) {
  veil(ctx, 0.55);
  ctx.save();
  ctx.textAlign = 'center';
  ctx.fillStyle = COLORS.hp;
  ctx.font = '800 58px system-ui, sans-serif';
  ctx.fillText('THE GARDEN IS CLEANSED', FIELD.width / 2, 218);
  ctx.fillStyle = COLORS.dim;
  ctx.font = '500 18px system-ui, sans-serif';
  ctx.fillText('The last Heartbloom falls. Light returns to the rows.', FIELD.width / 2, 258);
  drawResults(ctx, state, ui, 330);
  const pulse = 0.65 + Math.sin((ui.time ?? state.time) * 3.2) * 0.35;
  ctx.globalAlpha = pulse;
  ctx.fillStyle = COLORS.spore;
  ctx.font = '800 23px system-ui, sans-serif';
  ctx.fillText('PRESS R OR CLICK TO PLAY AGAIN', FIELD.width / 2, 580);
  ctx.globalAlpha = 1;
  ctx.restore();
}

/**
 * Draw one frame. ui: {screen, choices, hoverChoice, muted, best}. The world is drawn for every
 * screen; the menus veil it, so the title and the results sit over the garden they describe.
 */
export function drawGame(ctx, state, ui) {
  drawArena(ctx, state);
  for (const pickup of state.pickups) drawPickup(ctx, pickup);
  for (const bolt of state.enemyBullets) {
    ctx.fillStyle = '#ff6ee0';
    ctx.beginPath();
    ctx.arc(bolt.x, bolt.y, 5, 0, Math.PI * 2);
    ctx.fill();
  }
  for (const bullet of state.bullets) {
    ctx.strokeStyle = COLORS.bullet;
    ctx.lineWidth = 4;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(bullet.x - bullet.vx * 0.016, bullet.y - bullet.vy * 0.016);
    ctx.lineTo(bullet.x, bullet.y);
    ctx.stroke();
  }
  for (const enemy of state.enemies) drawEnemy(ctx, enemy, state.player);
  if (!state.over) drawPlayer(ctx, state);
  for (const particle of state.particles) {
    ctx.globalAlpha = Math.max(0, particle.life / particle.maxLife);
    ctx.fillStyle = particle.color;
    ctx.fillRect(particle.x - particle.size / 2, particle.y - particle.size / 2, particle.size, particle.size);
  }
  ctx.globalAlpha = 1;
  for (const f of state.floaters) {
    ctx.globalAlpha = Math.max(0, Math.min(1, f.life));
    ctx.fillStyle = f.color;
    ctx.font = '700 15px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(f.text, f.x, f.y);
  }
  ctx.globalAlpha = 1;

  if (ui.screen === SCREEN_PLAY || ui.screen === SCREEN_LEVELUP || ui.screen === SCREEN_PAUSE) drawHud(ctx, state, ui);
  if (ui.screen === SCREEN_TITLE) drawTitle(ctx, state, ui);
  else if (ui.screen === SCREEN_LEVELUP) drawLevelup(ctx, state, ui);
  else if (ui.screen === SCREEN_PAUSE) drawPause(ctx);
  else if (ui.screen === SCREEN_OVER) drawOver(ctx, state, ui);
  else if (ui.screen === SCREEN_WON) drawWon(ctx, state, ui);
}
