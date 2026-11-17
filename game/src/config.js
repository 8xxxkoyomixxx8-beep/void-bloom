// VOID BLOOM configuration: the arena, the Warden, the blight kinds, the wave table and the
// upgrade pool. Everything tunable lives here so world.js and render.js stay free of magic numbers.

/** The play field and the fixed internal resolution the game renders at. */
export const FIELD = { width: 1280, height: 800, wall: 26 };

/** The fixed simulation step, in seconds: the world advances in these ticks only. */
export const STEP = 1 / 120;

/** The Warden (the player's orb): size, speed, health and its dash. */
export const PLAYER = {
  radius: 15,
  speed: 265,
  maxHp: 100,
  dashSpeed: 880,
  dashTime: 0.16,
  dashCooldown: 1.6,
  touchDamageCooldown: 0.55,
};

/** The Warden's bloom-cannon: the base shot before upgrades. */
export const GUN = {
  damage: 12,
  fireRate: 5.2, // shots a second
  bulletSpeed: 640,
  bulletRadius: 4,
  bulletLife: 0.85,
  spread: 0.045,
};

/** Enemy kinds, by key. hp/speed/damage scale with the wave in world.js. */
export const ENEMIES = {
  husk: { radius: 15, hp: 22, speed: 92, damage: 10, score: 20, spores: 1, color: '#ff5d7a' },
  dart: { radius: 11, hp: 12, speed: 168, damage: 8, score: 35, spores: 1, color: '#ffb84d' },
  bloom: { radius: 21, hp: 46, speed: 58, damage: 12, score: 45, spores: 2, color: '#c792ff' },
  mite: { radius: 8, hp: 7, speed: 205, damage: 5, score: 10, spores: 0, color: '#ff8fab' },
  spitter: { radius: 16, hp: 30, speed: 74, damage: 9, score: 60, spores: 2, color: '#6ee7a0' },
};

/** The boss that closes every fifth wave, and the final one on wave 10. */
export const BOSS = { radius: 52, hp: 1150, speed: 46, damage: 18, score: 1500, color: '#ff3d68' };

/** The last wave: clear it (and its boss) and the run is won. */
export const FINAL_WAVE = 10;

/** Spores needed to level up, by current level: level n needs XP_CURVE[n - 1]. */
export const XP_CURVE = [4, 7, 11, 16, 22, 29, 37, 46, 56, 67, 79, 92];

/** The upgrade pool the level-up screen draws three choices from. max stacks per run. */
export const UPGRADES = [
  { id: 'damage', name: 'Sharper Light', text: '+25% shot damage', max: 6 },
  { id: 'firerate', name: 'Rapid Bloom', text: '+18% fire rate', max: 5 },
  { id: 'multishot', name: 'Twin Petals', text: '+1 shot per volley', max: 3 },
  { id: 'speed', name: 'Swift Roots', text: '+12% move speed', max: 4 },
  { id: 'vitality', name: 'Deep Heartwood', text: '+25 max health and heal 25', max: 5 },
  { id: 'dash', name: 'Quick Thorns', text: 'Dash recharges 25% faster', max: 3 },
  { id: 'magnet', name: 'Spore Scent', text: '+60% spore pickup reach', max: 3 },
  { id: 'regen', name: 'Morning Dew', text: 'Regain 1 health every 2 seconds', max: 3 },
];

/** The palette: deep indigo night, cyan light, warm blight. One direction, used everywhere. */
export const COLORS = {
  bg: '#0b0e1d',
  bgGlow: '#161c3a',
  wall: '#2b3565',
  grid: 'rgba(90, 110, 200, 0.07)',
  player: '#53e9ff',
  playerCore: '#e8fdff',
  bullet: '#aef4ff',
  spore: '#ffd94d',
  heart: '#ff7d9c',
  text: '#e9edff',
  dim: '#8b94c4',
  hp: '#5df2a6',
  hpLow: '#ff5d7a',
  xp: '#ffd94d',
  panel: 'rgba(13, 17, 38, 0.88)',
  panelEdge: '#3d4a8f',
};
