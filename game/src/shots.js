// The screenshot scenes behind ?shot=title|play|boss|end, and the simple pilot that flies them.
// Each scene runs the real simulation forward from a fresh world with a fixed seed, steered by
// the pilot below, so a shot is a frame a real game reaches — never a staged arrangement — and
// the same seed always gives the same frame.

import { FIELD } from './config.js';
import { SCREEN_OVER, SCREEN_PLAY, SCREEN_TITLE } from './render.js';

const TITLE_SECONDS = 7;
const PLAY_SECONDS = 34;
const BOSS_SECONDS = 7;
const END_PLAY_SECONDS = 40;
const END_LIMIT_SECONDS = 240;
const STEP = 1 / 120;

/** The nearest living enemy to a point, and how far it is. */
function nearestEnemy(state, x, y) {
  let best = null;
  let bestDist = Infinity;
  for (const enemy of state.enemies) {
    const d = Math.hypot(enemy.x - x, enemy.y - y);
    if (d < bestDist) { bestDist = d; best = enemy; }
  }
  return { enemy: best, dist: bestDist };
}

/**
 * The pilot's control for one tick: aim at the nearest blight and fire, keep a respectful
 * distance from it, otherwise drift to the nearest spore or back toward the centre, and dash
 * when something gets inside striking distance.
 */
export function botControl(state) {
  const p = state.player;
  const { enemy, dist } = nearestEnemy(state, p.x, p.y);
  const control = { moveX: 0, moveY: 0, aimX: p.x + 1, aimY: p.y, firing: false, dash: false };
  if (enemy) {
    control.aimX = enemy.x;
    control.aimY = enemy.y;
    control.firing = true;
    if (dist < 150) {
      control.moveX = (p.x - enemy.x) / (dist || 1);
      control.moveY = (p.y - enemy.y) / (dist || 1);
    }
    if (dist < 74) control.dash = true;
  }
  if (control.moveX === 0 && control.moveY === 0) {
    let target = null;
    let targetDist = Infinity;
    for (const pickup of state.pickups) {
      if (pickup.kind !== 'spore') continue;
      const d = Math.hypot(pickup.x - p.x, pickup.y - p.y);
      if (d < targetDist) { targetDist = d; target = pickup; }
    }
    const tx = target ? target.x : FIELD.width / 2;
    const ty = target ? target.y : FIELD.height / 2;
    const d = Math.hypot(tx - p.x, ty - p.y);
    if (d > 12) { control.moveX = (tx - p.x) / d; control.moveY = (ty - p.y) / d; }
  }
  return control;
}

/** Step a world forward under the pilot, taking the first gift whenever a level is gained. */
function playForward(world, seconds) {
  const steps = Math.floor(seconds / STEP);
  for (let i = 0; i < steps; i += 1) {
    world.step(STEP, botControl(world.state));
    while (world.state.pendingLevels > 0) {
      const choices = world.rollUpgrades();
      if (choices.length === 0) break;
      world.applyUpgrade(choices[0].id);
    }
    if (world.state.over || world.state.won) break;
  }
  world.state.sounds = [];
}

/**
 * Set `world` to the named scene (title, play, boss or end; any other name is title) and
 * return the screen to draw over it and the best score to show beside its own.
 */
export function stageShot(name, world) {
  if (name === 'play') {
    world.reset();
    playForward(world, PLAY_SECONDS);
    return { screen: SCREEN_PLAY, best: 0 };
  }
  if (name === 'boss') {
    world.stageBoss();
    playForward(world, BOSS_SECONDS);
    return { screen: SCREEN_PLAY, best: 0 };
  }
  if (name === 'end') {
    // A real run first: the pilot plays and scores, then — nearly spent — stops answering,
    // and the blight finishes what it started. The results are the run's own.
    world.reset();
    playForward(world, END_PLAY_SECONDS);
    world.state.player.hp = Math.min(world.state.player.hp, 25);
    const idle = { moveX: 0, moveY: 0, aimX: FIELD.width / 2, aimY: 120, firing: false, dash: false };
    const limit = Math.floor(END_LIMIT_SECONDS / STEP);
    for (let i = 0; i < limit && !world.state.over; i += 1) world.step(STEP, idle);
    world.state.sounds = [];
    return { screen: SCREEN_OVER, best: world.state.score };
  }
  world.reset();
  playForward(world, TITLE_SECONDS);
  return { screen: SCREEN_TITLE, best: 0 };
}
