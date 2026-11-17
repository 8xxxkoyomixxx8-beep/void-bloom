// VOID BLOOM's simulation: the Warden, its cannon, the blight kinds and their habits, waves and
// bosses, spores and hearts, particles and score. Pure stepping — no DOM, no audio, no drawing:
// step(dt, control) advances everything and leaves named sounds in state.sounds for main.js.

import { BOSS, COLORS, ENEMIES, FIELD, FINAL_WAVE, GUN, PLAYER, UPGRADES, XP_CURVE } from './config.js';
import { makeRandom, range } from './random.js';

/** Event bits step() returns so main.js can react (level-up choices, the run ending). */
export const EVENT_LEVELUP = 1;
export const EVENT_OVER = 2;
export const EVENT_WON = 4;

/** Clamp a value into [min, max]. */
function clamp(value, min, max) {
  return value < min ? min : value > max ? max : value;
}

/** The wave's spawn mix: kinds unlock as waves rise, counts grow, bosses close waves 5 and 10. */
function wavePlan(wave) {
  const plan = [];
  const add = (kind, count) => { for (let i = 0; i < count; i += 1) plan.push(kind); };
  add('husk', 5 + wave * 2);
  if (wave >= 2) add('dart', 2 + wave);
  if (wave >= 3) add('bloom', Math.floor(wave * 0.9));
  if (wave >= 4) add('spitter', Math.floor(wave * 0.7));
  if (wave >= 7) add('dart', 3);
  return plan;
}

/** Make a world from a seed. The same seed and the same controls always play the same run. */
export function createWorld(seed) {
  const next = makeRandom(seed);
  const state = {
    time: 0,
    score: 0,
    kills: 0,
    wave: 0,
    wavePhase: 'idle', // idle | announce | active | cleared
    phaseTimer: 0,
    spawnQueue: [],
    spawnTimer: 0,
    bossSpawned: false,
    boss: null,
    level: 1,
    xp: 0,
    xpNeed: XP_CURVE[0],
    pendingLevels: 0,
    over: false,
    won: false,
    shake: 0,
    sounds: [],
    player: null,
    bullets: [],
    enemyBullets: [],
    enemies: [],
    particles: [],
    pickups: [],
    floaters: [],
    stacks: {},
  };

  /** The Warden's effective stats: the base numbers with every upgrade stack applied. */
  function stats() {
    const s = state.stacks;
    return {
      damage: GUN.damage * Math.pow(1.25, s.damage || 0),
      fireRate: GUN.fireRate * Math.pow(1.18, s.firerate || 0),
      projectiles: 1 + (s.multishot || 0),
      speed: PLAYER.speed * Math.pow(1.12, s.speed || 0),
      maxHp: PLAYER.maxHp + 25 * (s.vitality || 0),
      dashCooldown: PLAYER.dashCooldown * Math.pow(0.75, s.dash || 0),
      magnet: 46 + 40 * (s.magnet || 0),
      regen: s.regen || 0,
    };
  }

  /** Put the run back at its start: a fresh Warden, wave 1 about to be announced. */
  function reset() {
    state.time = 0;
    state.score = 0;
    state.kills = 0;
    state.wave = 0;
    state.wavePhase = 'idle';
    state.phaseTimer = 0;
    state.spawnQueue = [];
    state.bossSpawned = false;
    state.boss = null;
    state.level = 1;
    state.xp = 0;
    state.xpNeed = XP_CURVE[0];
    state.pendingLevels = 0;
    state.over = false;
    state.won = false;
    state.shake = 0;
    state.sounds = [];
    state.bullets = [];
    state.enemyBullets = [];
    state.enemies = [];
    state.particles = [];
    state.pickups = [];
    state.floaters = [];
    state.stacks = {};
    state.player = {
      x: FIELD.width / 2, y: FIELD.height / 2, hp: PLAYER.maxHp, angle: -Math.PI / 2,
      fireTimer: 0, dashTimer: 0, dashCooldown: 0, touchTimer: 0, regenTimer: 0, hurtFlash: 0,
    };
  }

  /** Begin the next wave: fill the spawn queue, or the boss on every fifth wave. */
  function startWave() {
    state.wave += 1;
    state.wavePhase = 'announce';
    state.phaseTimer = 2.2;
    state.bossSpawned = false;
    state.spawnQueue = wavePlan(state.wave);
    // Shuffle the mix so kinds arrive interleaved, not in blocks.
    for (let i = state.spawnQueue.length - 1; i > 0; i -= 1) {
      const j = Math.floor(next() * (i + 1));
      const tmp = state.spawnQueue[i];
      state.spawnQueue[i] = state.spawnQueue[j];
      state.spawnQueue[j] = tmp;
    }
    state.sounds.push('wave');
  }

  /** A rim point at least 260px from the Warden, where new blight pushes in. */
  function spawnPoint() {
    const p = state.player;
    for (let tries = 0; tries < 12; tries += 1) {
      const side = Math.floor(next() * 4);
      const x = side === 0 ? FIELD.wall + 24 : side === 1 ? FIELD.width - FIELD.wall - 24 : range(next, FIELD.wall + 24, FIELD.width - FIELD.wall - 24);
      const y = side === 2 ? FIELD.wall + 24 : side === 3 ? FIELD.height - FIELD.wall - 24 : range(next, FIELD.wall + 24, FIELD.height - FIELD.wall - 24);
      if (Math.hypot(x - p.x, y - p.y) > 260) return { x, y };
    }
    return { x: FIELD.wall + 30, y: FIELD.wall + 30 };
  }

  /** Add one enemy of a kind at a point, scaled to the current wave. */
  function spawnEnemy(kind, x, y) {
    const base = ENEMIES[kind];
    const hpScale = 1 + (state.wave - 1) * 0.16;
    const enemy = {
      kind, x, y, hp: base.hp * hpScale, maxHp: base.hp * hpScale,
      radius: base.radius, speed: base.speed * (1 + (state.wave - 1) * 0.03),
      damage: base.damage, score: base.score, spores: base.spores, color: base.color,
      t: range(next, 0, 10), mode: 'chase', modeTimer: 0, shootTimer: range(next, 1.2, 2.4),
      vx: 0, vy: 0, flash: 0, boss: false,
    };
    state.enemies.push(enemy);
    burst(x, y, base.color, 6, 120);
    return enemy;
  }

  /** Add the Heartbloom: the boss of waves 5 and 10 (bigger and harder on the last wave). */
  function spawnBoss() {
    const final = state.wave >= FINAL_WAVE;
    const hp = BOSS.hp * (final ? 1.7 : 1) * (1 + (state.wave - 5) * 0.05);
    const boss = {
      kind: 'heartbloom', x: FIELD.width / 2, y: FIELD.wall + 110, hp, maxHp: hp,
      radius: BOSS.radius * (final ? 1.2 : 1), speed: BOSS.speed, damage: BOSS.damage,
      score: BOSS.score, spores: 0, color: BOSS.color, t: 0, mode: 'chase', modeTimer: 0,
      shootTimer: 3.2, summonTimer: 5.5, vx: 0, vy: 0, flash: 0, boss: true,
    };
    state.enemies.push(boss);
    state.boss = boss;
    state.bossSpawned = true;
    state.sounds.push('boss');
    state.shake = Math.max(state.shake, 8);
  }

  /** A burst of particles: on hits, deaths, pickups and dashes. */
  function burst(x, y, color, count, speed) {
    for (let i = 0; i < count; i += 1) {
      if (state.particles.length > 420) return;
      const angle = next() * Math.PI * 2;
      const v = range(next, speed * 0.3, speed);
      state.particles.push({
        x, y, vx: Math.cos(angle) * v, vy: Math.sin(angle) * v,
        life: range(next, 0.25, 0.6), maxLife: 0.6, size: range(next, 1.5, 3.5), color,
      });
    }
  }

  /** A rising text note (score gains, level news) at a point. */
  function floater(x, y, text, color) {
    state.floaters.push({ x, y, text, color, life: 0.9 });
  }

  /** Drop what a dead enemy leaves: spores for level-ups, sometimes a heart. */
  function dropLoot(enemy) {
    for (let i = 0; i < enemy.spores; i += 1) {
      state.pickups.push({
        kind: 'spore', x: enemy.x + range(next, -14, 14), y: enemy.y + range(next, -14, 14),
        vx: range(next, -40, 40), vy: range(next, -40, 40), t: 0, life: 16,
      });
    }
    if (!enemy.boss && next() < 0.07) {
      state.pickups.push({ kind: 'heart', x: enemy.x, y: enemy.y, vx: 0, vy: 0, t: 0, life: 14 });
    }
    if (enemy.boss) {
      for (let i = 0; i < 10; i += 1) {
        state.pickups.push({
          kind: 'spore', x: enemy.x + range(next, -50, 50), y: enemy.y + range(next, -50, 50),
          vx: range(next, -60, 60), vy: range(next, -60, 60), t: 0, life: 18,
        });
      }
      state.pickups.push({ kind: 'heart', x: enemy.x, y: enemy.y, vx: 0, vy: 0, t: 0, life: 16 });
    }
  }

  /** Kill an enemy: score, loot, particles, and the bloom's mites or the boss's fall. */
  function killEnemy(enemy) {
    enemy.dead = true;
    state.kills += 1;
    state.score += enemy.score;
    floater(enemy.x, enemy.y - enemy.radius, `+${enemy.score}`, COLORS.text);
    burst(enemy.x, enemy.y, enemy.color, enemy.boss ? 60 : 14, enemy.boss ? 320 : 200);
    state.sounds.push(enemy.boss ? 'kill' : 'kill');
    if (enemy.kind === 'bloom') {
      state.sounds.push('splitter');
      for (let i = 0; i < 3; i += 1) {
        const mite = spawnEnemy('mite', enemy.x + range(next, -16, 16), enemy.y + range(next, -16, 16));
        mite.hp = mite.maxHp;
      }
    }
    if (enemy.boss) {
      state.boss = null;
      state.shake = Math.max(state.shake, 14);
    }
    dropLoot(enemy);
  }

  /** Give the Warden experience; returns true when a level was gained. */
  function gainXp(amount) {
    state.xp += amount;
    let gained = false;
    while (state.xp >= state.xpNeed) {
      state.xp -= state.xpNeed;
      state.level += 1;
      state.pendingLevels += 1;
      state.xpNeed = XP_CURVE[state.level - 1] ?? 92 + (state.level - XP_CURVE.length) * 14;
      gained = true;
    }
    if (gained) state.sounds.push('levelup');
    return gained;
  }

  /** Three upgrade choices for a pending level: distinct, and not already maxed. */
  function rollUpgrades() {
    const open = UPGRADES.filter((u) => (state.stacks[u.id] || 0) < u.max);
    const choices = [];
    const pool = [...open];
    while (choices.length < 3 && pool.length > 0) {
      const index = Math.floor(next() * pool.length);
      choices.push(pool.splice(index, 1)[0]);
    }
    return choices;
  }

  /** Apply one chosen upgrade id; vitality also heals, as its text promises. */
  function applyUpgrade(id) {
    state.stacks[id] = (state.stacks[id] || 0) + 1;
    if (id === 'vitality') {
      state.player.hp = Math.min(stats().maxHp, state.player.hp + 25);
    }
    state.pendingLevels = Math.max(0, state.pendingLevels - 1);
    state.sounds.push('pick');
  }

  /** Fire the cannon toward the aim point: a volley of one or more light bolts. */
  function fireVolley(st) {
    const p = state.player;
    const base = Math.atan2(state.aimY - p.y, state.aimX - p.x);
    const n = st.projectiles;
    for (let i = 0; i < n; i += 1) {
      const offset = (i - (n - 1) / 2) * 0.085 + range(next, -GUN.spread, GUN.spread);
      const angle = base + offset;
      state.bullets.push({
        x: p.x + Math.cos(base) * (PLAYER.radius + 6), y: p.y + Math.sin(base) * (PLAYER.radius + 6),
        vx: Math.cos(angle) * GUN.bulletSpeed, vy: Math.sin(angle) * GUN.bulletSpeed,
        life: GUN.bulletLife, damage: st.damage,
      });
    }
    state.sounds.push('shoot');
  }

  /** One enemy's movement and habits for this tick. */
  function stepEnemy(enemy, dt) {
    const p = state.player;
    const dx = p.x - enemy.x;
    const dy = p.y - enemy.y;
    const dist = Math.hypot(dx, dy) || 1;
    const ux = dx / dist;
    const uy = dy / dist;
    enemy.t += dt;
    let vx = 0;
    let vy = 0;

    if (enemy.boss) {
      const enraged = enemy.hp < enemy.maxHp * 0.5;
      const speed = enemy.speed * (enraged ? 1.45 : 1);
      vx = ux * speed;
      vy = uy * speed;
      enemy.shootTimer -= dt;
      if (enemy.shootTimer <= 0) {
        enemy.shootTimer = enraged ? 3.6 : 5.2;
        const shots = 12;
        for (let i = 0; i < shots; i += 1) {
          const angle = (i / shots) * Math.PI * 2 + enemy.t;
          state.enemyBullets.push({ x: enemy.x, y: enemy.y, vx: Math.cos(angle) * 225, vy: Math.sin(angle) * 225, life: 3.4, damage: 12 });
        }
        state.sounds.push('bosshit');
      }
      enemy.summonTimer -= dt;
      if (enemy.summonTimer <= 0) {
        enemy.summonTimer = 8;
        for (let i = 0; i < 4; i += 1) {
          const angle = next() * Math.PI * 2;
          spawnEnemy(next() < 0.6 ? 'husk' : 'dart', enemy.x + Math.cos(angle) * 90, enemy.y + Math.sin(angle) * 90);
        }
      }
    } else if (enemy.kind === 'dart') {
      if (enemy.mode === 'chase') {
        vx = ux * enemy.speed;
        vy = uy * enemy.speed;
        if (dist < 270 && enemy.modeTimer <= 0) { enemy.mode = 'windup'; enemy.modeTimer = 0.38; }
      } else if (enemy.mode === 'windup') {
        enemy.modeTimer -= dt;
        if (enemy.modeTimer <= 0) {
          enemy.mode = 'charge';
          enemy.modeTimer = 0.42;
          enemy.vx = ux * enemy.speed * 3.3;
          enemy.vy = uy * enemy.speed * 3.3;
        }
      } else if (enemy.mode === 'charge') {
        vx = enemy.vx;
        vy = enemy.vy;
        enemy.modeTimer -= dt;
        if (enemy.modeTimer <= 0) { enemy.mode = 'chase'; enemy.modeTimer = 1.5; }
      }
      enemy.modeTimer = Math.max(0, enemy.modeTimer - (enemy.mode === 'chase' ? dt : 0));
    } else if (enemy.kind === 'spitter') {
      const want = 300;
      const radial = dist > want + 30 ? 1 : dist < want - 30 ? -1 : 0;
      const strafe = Math.sin(enemy.t * 0.9) * 0.6;
      vx = (ux * radial - uy * strafe) * enemy.speed;
      vy = (uy * radial + ux * strafe) * enemy.speed;
      enemy.shootTimer -= dt;
      if (enemy.shootTimer <= 0 && dist < 560) {
        enemy.shootTimer = 2.4;
        state.enemyBullets.push({ x: enemy.x, y: enemy.y, vx: ux * 250, vy: uy * 250, life: 2.6, damage: enemy.damage });
        state.sounds.push('bosshit');
      }
    } else {
      const wobble = enemy.kind === 'mite' ? 0.55 : 0.3;
      const side = Math.sin(enemy.t * 2.1) * wobble;
      vx = (ux - uy * side) * enemy.speed;
      vy = (uy + ux * side) * enemy.speed;
    }

    enemy.x += vx * dt;
    enemy.y += vy * dt;
    enemy.x = clamp(enemy.x, FIELD.wall + enemy.radius * 0.5, FIELD.width - FIELD.wall - enemy.radius * 0.5);
    enemy.y = clamp(enemy.y, FIELD.wall + enemy.radius * 0.5, FIELD.height - FIELD.wall - enemy.radius * 0.5);
    enemy.flash = Math.max(0, enemy.flash - dt * 6);
  }

  /**
   * Advance the whole world by dt. control: {moveX, moveY, aimX, aimY, firing, dash}.
   * Returns the EVENT_* bits that fired this tick.
   */
  function step(dt, control) {
    let events = 0;
    state.time += dt;
    state.aimX = control.aimX;
    state.aimY = control.aimY;
    const p = state.player;
    const st = stats();

    // Waves: announce, spawn, clear, and the boss gate.
    if (state.wavePhase === 'idle' && !state.over && !state.won) startWave();
    if (state.wavePhase === 'announce') {
      state.phaseTimer -= dt;
      if (state.phaseTimer <= 0) state.wavePhase = 'active';
    } else if (state.wavePhase === 'active') {
      state.spawnTimer -= dt;
      if (state.spawnQueue.length > 0 && state.spawnTimer <= 0 && state.enemies.length < 90) {
        state.spawnTimer = Math.max(0.18, 0.62 - state.wave * 0.03);
        spawnEnemy(state.spawnQueue.shift(), ...Object.values(spawnPoint()));
      }
      const bossWave = state.wave % 5 === 0;
      if (bossWave && !state.bossSpawned && state.spawnQueue.length === 0 && state.enemies.length === 0) spawnBoss();
      if (state.spawnQueue.length === 0 && state.enemies.length === 0 && (!bossWave || state.bossSpawned)) {
        state.wavePhase = 'cleared';
        state.phaseTimer = 1.6;
        state.score += 100 * state.wave;
        floater(p.x, p.y - 40, `Wave ${state.wave} clear  +${100 * state.wave}`, COLORS.xp);
        if (state.wave >= FINAL_WAVE) {
          state.won = true;
          state.sounds.push('win');
          events |= EVENT_WON;
        }
      }
    } else if (state.wavePhase === 'cleared') {
      state.phaseTimer -= dt;
      if (state.phaseTimer <= 0 && !state.won) { state.wavePhase = 'idle'; }
    }

    // The Warden: dash, move, aim, fire, mend.
    const dashing = p.dashTimer > 0;
    if (control.dash && p.dashCooldown <= 0 && !dashing) {
      p.dashTimer = PLAYER.dashTime;
      p.dashCooldown = st.dashCooldown;
      const dx = control.moveX || Math.cos(p.angle);
      const dy = control.moveY || Math.sin(p.angle);
      const len = Math.hypot(dx, dy) || 1;
      p.dashVx = (dx / len) * PLAYER.dashSpeed;
      p.dashVy = (dy / len) * PLAYER.dashSpeed;
      state.sounds.push('dash');
    }
    p.dashTimer = Math.max(0, p.dashTimer - dt);
    p.dashCooldown = Math.max(0, p.dashCooldown - dt);
    p.touchTimer = Math.max(0, p.touchTimer - dt);
    p.hurtFlash = Math.max(0, p.hurtFlash - dt * 4);
    let vx = control.moveX * st.speed;
    let vy = control.moveY * st.speed;
    if (p.dashTimer > 0) { vx = p.dashVx; vy = p.dashVy; burst(p.x, p.y, COLORS.player, 1, 40); }
    p.x = clamp(p.x + vx * dt, FIELD.wall + PLAYER.radius, FIELD.width - FIELD.wall - PLAYER.radius);
    p.y = clamp(p.y + vy * dt, FIELD.wall + PLAYER.radius, FIELD.height - FIELD.wall - PLAYER.radius);
    p.angle = Math.atan2(control.aimY - p.y, control.aimX - p.x);
    p.fireTimer -= dt;
    if (control.firing && p.fireTimer <= 0 && !state.over && !state.won) {
      p.fireTimer = 1 / st.fireRate;
      fireVolley(st);
    }
    if (st.regen > 0) {
      p.regenTimer += dt;
      const healEvery = 2 / st.regen;
      if (p.regenTimer >= healEvery) { p.regenTimer = 0; p.hp = Math.min(st.maxHp, p.hp + 1); }
    }

    // Enemies act, then keep a little distance from one another.
    for (const enemy of state.enemies) stepEnemy(enemy, dt);
    for (let i = 0; i < state.enemies.length; i += 1) {
      for (let j = i + 1; j < state.enemies.length; j += 1) {
        const a = state.enemies[i];
        const b = state.enemies[j];
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const d2 = dx * dx + dy * dy;
        const min = (a.radius + b.radius) * 0.9;
        if (d2 > 0.01 && d2 < min * min) {
          const d = Math.sqrt(d2);
          const push = ((min - d) / d) * 0.5 * dt * 60 * 0.16;
          a.x -= dx * push; a.y -= dy * push;
          b.x += dx * push; b.y += dy * push;
        }
      }
    }

    // Bullets fly and strike.
    for (const bullet of state.bullets) {
      bullet.x += bullet.vx * dt;
      bullet.y += bullet.vy * dt;
      bullet.life -= dt;
      if (bullet.x < FIELD.wall || bullet.x > FIELD.width - FIELD.wall || bullet.y < FIELD.wall || bullet.y > FIELD.height - FIELD.wall) bullet.life = 0;
      if (bullet.life <= 0) continue;
      for (const enemy of state.enemies) {
        if (enemy.dead) continue;
        const dx = enemy.x - bullet.x;
        const dy = enemy.y - bullet.y;
        const r = enemy.radius + GUN.bulletRadius;
        if (dx * dx + dy * dy < r * r) {
          bullet.life = 0;
          enemy.hp -= bullet.damage;
          enemy.flash = 1;
          burst(bullet.x, bullet.y, enemy.color, 3, 140);
          state.sounds.push('hit');
          if (enemy.hp <= 0) killEnemy(enemy);
          break;
        }
      }
    }
    state.bullets = state.bullets.filter((b) => b.life > 0);

    // Enemy bolts fly and strike the Warden (never while it dashes through them).
    for (const bolt of state.enemyBullets) {
      bolt.x += bolt.vx * dt;
      bolt.y += bolt.vy * dt;
      bolt.life -= dt;
      const dx = p.x - bolt.x;
      const dy = p.y - bolt.y;
      if (p.dashTimer <= 0 && dx * dx + dy * dy < (PLAYER.radius + 5) * (PLAYER.radius + 5)) {
        bolt.life = 0;
        hurtPlayer(bolt.damage);
      }
    }
    state.enemyBullets = state.enemyBullets.filter((b) => b.life > 0);

    // Touch: the blight burns on contact, with a short grace between burns.
    if (p.touchTimer <= 0 && p.dashTimer <= 0) {
      for (const enemy of state.enemies) {
        if (enemy.dead) continue;
        const dx = p.x - enemy.x;
        const dy = p.y - enemy.y;
        const r = PLAYER.radius + enemy.radius * 0.85;
        if (dx * dx + dy * dy < r * r) {
          hurtPlayer(enemy.damage);
          p.touchTimer = PLAYER.touchDamageCooldown;
          const len = Math.hypot(dx, dy) || 1;
          p.x += (dx / len) * 14;
          p.y += (dy / len) * 14;
          break;
        }
      }
    }

    // Pickups drift to the Warden inside its scent, and feed it on contact.
    for (const pickup of state.pickups) {
      pickup.t += dt;
      pickup.life -= dt;
      pickup.x += pickup.vx * dt;
      pickup.y += pickup.vy * dt;
      pickup.vx *= 0.9;
      pickup.vy *= 0.9;
      const dx = p.x - pickup.x;
      const dy = p.y - pickup.y;
      const dist = Math.hypot(dx, dy);
      if (dist < st.magnet && dist > 1) {
        const pull = 340 * dt;
        pickup.x += (dx / dist) * pull;
        pickup.y += (dy / dist) * pull;
      }
      if (dist < PLAYER.radius + 11 && pickup.life > 0) {
        pickup.life = 0;
        pickup.taken = true;
        if (pickup.kind === 'spore') {
          state.sounds.push('spore');
          burst(pickup.x, pickup.y, COLORS.spore, 3, 90);
          if (gainXp(1)) events |= EVENT_LEVELUP;
        } else {
          state.sounds.push('heart');
          p.hp = Math.min(st.maxHp, p.hp + 20);
          floater(p.x, p.y - 26, '+20', COLORS.heart);
        }
      }
    }
    state.pickups = state.pickups.filter((k) => k.life > 0);

    // Particles and floaters fade.
    for (const particle of state.particles) {
      particle.x += particle.vx * dt;
      particle.y += particle.vy * dt;
      particle.vx *= 0.92;
      particle.vy *= 0.92;
      particle.life -= dt;
    }
    state.particles = state.particles.filter((k) => k.life > 0);
    for (const f of state.floaters) { f.y -= 34 * dt; f.life -= dt; }
    state.floaters = state.floaters.filter((k) => k.life > 0);
    state.enemies = state.enemies.filter((e) => !e.dead);
    state.shake = Math.max(0, state.shake - dt * 26);
    return events;
  }

  /** Hurt the Warden: flash, shake, sound, and the end of the run at zero health. */
  function hurtPlayer(amount) {
    const p = state.player;
    if (state.over || state.won) return;
    p.hp -= amount;
    p.hurtFlash = 1;
    state.shake = Math.max(state.shake, 6);
    state.sounds.push('hurt');
    burst(p.x, p.y, COLORS.hpLow, 10, 200);
    if (p.hp <= 0) {
      p.hp = 0;
      state.over = true;
      state.shake = 16;
      burst(p.x, p.y, COLORS.player, 46, 300);
      state.sounds.push('lose');
    }
  }

  /**
   * Stage the wave-5 boss fight directly (the screenshot scenes use it): a Warden with a few
   * gifts already held, the Heartbloom in the arena, and a small escort around it.
   */
  function stageBoss() {
    reset();
    state.wave = 5;
    state.wavePhase = 'active';
    state.phaseTimer = 0;
    state.spawnQueue = [];
    state.level = 4;
    state.xpNeed = XP_CURVE[3];
    state.stacks = { damage: 1, multishot: 1, speed: 1 };
    state.player.hp = stats().maxHp;
    spawnBoss();
    spawnEnemy('husk', FIELD.width / 2 - 190, FIELD.wall + 150);
    spawnEnemy('husk', FIELD.width / 2 + 190, FIELD.wall + 150);
    spawnEnemy('dart', FIELD.width / 2 + 260, FIELD.wall + 260);
    state.score = 4250;
    state.kills = 61;
    state.time = 214;
  }

  reset();
  return { state, reset, step, rollUpgrades, applyUpgrade, stats, stageBoss };
}
