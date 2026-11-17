// VOID BLOOM's bootstrap and conductor: it owns the canvas, the fixed-step loop, the screen
// state machine (title, play, level-up, pause, game over, victory), the sound the world asks
// for, and the screenshot mode behind ?shot=. The world simulates; this file conducts.

import { FIELD, STEP } from './config.js';
import { makeAudio } from './audio.js';
import { makeInput } from './input.js';
import { createWorld } from './world.js';
import {
  SCREEN_LEVELUP, SCREEN_OVER, SCREEN_PAUSE, SCREEN_PLAY, SCREEN_TITLE, SCREEN_WON,
  choiceRects, drawGame,
} from './render.js';
import { botControl, stageShot } from './shots.js';

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const status = document.getElementById('status');
const params = new URLSearchParams(window.location.search);
const shotName = params.get('shot');
const seed = Number(params.get('seed') || 1) >>> 0;

/** Map client pixels to field coordinates: the canvas is the field, stretched to the window. */
function toField(clientX, clientY) {
  const rect = canvas.getBoundingClientRect();
  return {
    x: ((clientX - rect.left) / rect.width) * FIELD.width,
    y: ((clientY - rect.top) / rect.height) * FIELD.height,
  };
}

const input = makeInput(canvas, toField);
const audio = makeAudio();
const world = createWorld(shotName ? seed : (Date.now() % 2147483647) + 1);
const menuWorld = createWorld(7);

let screen = SCREEN_TITLE;
let choices = [];
let best = 0;
try {
  best = Number(window.localStorage.getItem('void-bloom-best') || 0) || 0;
} catch {
  best = 0;
}
let uiTime = 0;
let accumulator = 0;
let lastStamp = performance.now();

if (shotName) {
  const staged = stageShot(shotName, world);
  screen = staged.screen;
  best = Math.max(best, staged.best);
  if (screen === SCREEN_PLAY && world.state.pendingLevels > 0) choices = world.rollUpgrades();
}

/** Remember the best score across visits, when the browser lets us. */
function saveBest() {
  best = Math.max(best, world.state.score);
  try {
    window.localStorage.setItem('void-bloom-best', String(best));
  } catch {
    // A browser that refuses storage simply forgets; the run itself is unaffected.
  }
}

/** Start a fresh run: reset the world, open the play screen, start the music. */
function startRun() {
  world.reset();
  choices = [];
  screen = SCREEN_PLAY;
  audio.unlock();
  audio.setMusic(true);
}

/** Play and clear the sounds the world queued during its last steps. */
function drainSounds(target) {
  for (const name of target.state.sounds) audio.play(name);
  target.state.sounds = [];
}

/** The control the player's hands describe this tick. */
function playerControl() {
  const axis = input.moveAxis();
  const len = Math.hypot(axis.x, axis.y);
  return {
    moveX: len > 1 ? axis.x / len : axis.x,
    moveY: len > 1 ? axis.y / len : axis.y,
    aimX: input.aim.x,
    aimY: input.aim.y,
    firing: input.firing,
    dash: input.dashHeld(),
  };
}

/** Which upgrade card, if any, the aim point is over. */
function hoveredChoice() {
  if (screen !== SCREEN_LEVELUP) return -1;
  const rects = choiceRects();
  for (let i = 0; i < choices.length; i += 1) {
    const r = rects[i];
    if (input.aim.x >= r.x && input.aim.x <= r.x + r.w && input.aim.y >= r.y && input.aim.y <= r.y + r.h) return i;
  }
  return -1;
}

/** Choose the upgrade at an index, then open the next choice or return to play. */
function choose(index) {
  if (index < 0 || index >= choices.length) return;
  world.applyUpgrade(choices[index].id);
  drainSounds(world);
  choices = world.state.pendingLevels > 0 ? world.rollUpgrades() : [];
  if (world.state.pendingLevels === 0) screen = SCREEN_PLAY;
}

/** Handle the one-shot keys and clicks for the current screen, once a frame. */
function handlePresses() {
  if (input.take('KeyM')) audio.toggleMute();

  if (screen === SCREEN_TITLE) {
    if (input.take('Enter') || input.take('Mouse0')) startRun();
    return;
  }
  if (screen === SCREEN_PLAY) {
    if (input.take('KeyP') || input.take('Escape')) screen = SCREEN_PAUSE;
    return;
  }
  if (screen === SCREEN_PAUSE) {
    if (input.take('KeyP') || input.take('Escape')) screen = SCREEN_PLAY;
    return;
  }
  if (screen === SCREEN_LEVELUP) {
    if (input.take('Digit1')) choose(0);
    else if (input.take('Digit2')) choose(1);
    else if (input.take('Digit3')) choose(2);
    else if (input.take('Mouse0')) choose(hoveredChoice());
    return;
  }
  if (screen === SCREEN_OVER || screen === SCREEN_WON) {
    if (input.take('KeyR') || input.take('Mouse0')) startRun();
  }
}

/** Advance the title's backdrop garden under its pilot, so the menu sits over a living game. */
function stepMenu(dt) {
  accumulator += dt;
  let guard = 0;
  while (accumulator >= STEP && guard < 12) {
    menuWorld.step(STEP, botControl(menuWorld.state));
    if (menuWorld.state.over) menuWorld.reset();
    while (menuWorld.state.pendingLevels > 0) {
      const rolled = menuWorld.rollUpgrades();
      if (rolled.length === 0) break;
      menuWorld.applyUpgrade(rolled[0].id);
    }
    accumulator -= STEP;
    guard += 1;
  }
  menuWorld.state.sounds = [];
}

/** Advance the run: fixed steps of STEP, sounds drained, screens changed by what happened. */
function stepRun(dt) {
  accumulator += dt;
  let guard = 0;
  while (accumulator >= STEP && guard < 16) {
    world.step(STEP, playerControl());
    accumulator -= STEP;
    guard += 1;
    if (world.state.pendingLevels > 0 && screen === SCREEN_PLAY) {
      choices = world.rollUpgrades();
      screen = SCREEN_LEVELUP;
    }
    if (world.state.over && screen === SCREEN_PLAY) {
      screen = SCREEN_OVER;
      saveBest();
      audio.setMusic(false);
    }
    if (world.state.won && screen === SCREEN_PLAY) {
      screen = SCREEN_WON;
      saveBest();
    }
    if (screen !== SCREEN_PLAY) { accumulator = 0; break; }
  }
  drainSounds(world);
}

/** Advance the end screens' backdrop a little, so particles settle and the blight mills about. */
function stepBackdrop(dt) {
  accumulator += dt;
  let guard = 0;
  const idle = { moveX: 0, moveY: 0, aimX: world.state.player.x + 1, aimY: world.state.player.y, firing: false, dash: false };
  while (accumulator >= STEP && guard < 8) {
    world.step(STEP, idle);
    accumulator -= STEP;
    guard += 1;
  }
  world.state.sounds = [];
}

/** The screen-reader line: says where the player is, as the visible screens change. */
function announce() {
  const text = {
    [SCREEN_TITLE]: 'Void Bloom. Title screen. Press Enter or click to play.',
    [SCREEN_PLAY]: `Playing. Wave ${world.state.wave}. Score ${world.state.score}.`,
    [SCREEN_LEVELUP]: `Level ${world.state.level}. Choose one of three gifts with keys 1 to 3 or a click.`,
    [SCREEN_PAUSE]: 'Paused.',
    [SCREEN_OVER]: `Game over. Final score ${world.state.score}. Press R to try again.`,
    [SCREEN_WON]: `Victory. Final score ${world.state.score}. Press R to play again.`,
  }[screen];
  if (status && status.textContent !== text) status.textContent = text;
}

let lastScreen = '';

/** One animation frame: advance what the screen calls for, then draw it with its shake. */
function frame(stamp) {
  const dt = Math.min(0.1, (stamp - lastStamp) / 1000);
  lastStamp = stamp;
  uiTime += dt;

  if (!shotName) {
    handlePresses();
    if (screen === SCREEN_TITLE) stepMenu(dt);
    else if (screen === SCREEN_PLAY) stepRun(dt);
    else if (screen === SCREEN_OVER || screen === SCREEN_WON) stepBackdrop(dt);
    else accumulator = 0;
  }

  const active = screen === SCREEN_TITLE ? menuWorld : world;
  const st = active.stats();
  active.state.maxHpNow = st.maxHp;
  active.state.dashMax = st.dashCooldown;

  ctx.save();
  if (active.state.shake > 0.2) {
    const s = active.state.shake;
    ctx.translate((Math.random() - 0.5) * s, (Math.random() - 0.5) * s);
  }
  drawGame(ctx, active.state, {
    screen,
    choices,
    hoverChoice: hoveredChoice(),
    muted: audio.isMuted(),
    best,
    time: uiTime,
  });
  ctx.restore();

  if (screen !== lastScreen) {
    announce();
    lastScreen = screen;
  }
  requestAnimationFrame(frame);
}

window.addEventListener('pointerdown', () => audio.unlock(), { once: false });
window.addEventListener('keydown', () => audio.unlock(), { once: false });

// A small handle for local play-testing: the live world, its screen, and a way in.
window.VOIDBLOOM = { world, menuWorld, screen: () => screen, start: startRun };
requestAnimationFrame(frame);
