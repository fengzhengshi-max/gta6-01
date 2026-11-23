// Neon Palms: every tuning number and colour in one place.
// A sun-soaked 2D top-down open-world crime game. The playfield is a fixed
// 1280x720 logical view; the renderer scales it to the window, and the camera
// follows the player around a city roughly 2760x2000 world units wide.

/** The simulation's fixed step, in seconds: 60 updates a second. */
export const STEP = 1 / 60;

/** Logical view size the renderer scales to the window. */
export const VIEW = { width: 1280, height: 720 };

/** City layout: roads on a grid, blocks of buildings between them. */
export const CITY = {
  pitch: 380, // distance between neighbouring road centrelines
  roadWidth: 96,
  cols: 8, // vertical roads
  rows: 6, // horizontal roads
  sidewalk: 14,
};
// World bounds, derived from the road grid.
export const WORLD = {
  width: (CITY.cols - 1) * CITY.pitch + CITY.roadWidth,
  height: (CITY.rows - 1) * CITY.pitch + CITY.roadWidth,
};

/** Centreline of vertical road `i` / horizontal road `j`. */
export const roadX = (i) => i * CITY.pitch;
export const roadY = (j) => j * CITY.pitch;

export const PLAYER = {
  radius: 14,
  walkSpeed: 175,
  sprintSpeed: 265,
  health: 100,
  punchDamage: 25,
  punchRange: 48,
  punchArc: 1.1,
  punchCooldown: 0.38,
  gunDamage: 34,
  magSize: 12,
  reloadTime: 1.1,
  shootCooldown: 0.22,
  bulletSpeed: 900,
};

export const CAR = {
  length: 54,
  width: 28,
  accel: 420,
  reverseAccel: 260,
  brake: 620,
  maxSpeed: 520,
  maxReverse: 160,
  steer: 2.6,
  drag: 0.55,
  grip: 6.0,
  health: 100,
  // How close the player must be to climb in.
  enterRange: 64,
};

export const TRAFFIC = { count: 16, minSpeed: 95, maxSpeed: 165 };
export const PEDS = { count: 26, walkSpeed: 55, fleeSpeed: 170 };
export const POLICE = {
  maxCars: 5,
  speed: 470,
  spawnDistance: 720,
  ramDamage: 12,
  bustTime: 1.6, // seconds a cop must touch the player on foot to bust them
  decayDelay: 18, // quiet seconds before wanted starts to fall
  decayInterval: 9, // seconds per star lost while quiet
};

/** Wanted heat each crime adds, in stars (fractions allowed). */
export const HEAT = {
  stealCar: 1,
  punchPed: 1,
  killPed: 2,
  shootGun: 0.5,
  hitPedWithCar: 1,
  copRam: 0.5,
};

export const MONEY = {
  start: 120,
  missionReward: [400, 600, 900, 1200, 2500],
  bustFine: 300,
  carRepair: 150,
};

export const PALETTE = {
  // Sunset-neon art direction: dusk purple ground, warm asphalt, neon signs.
  ground: '#241a33',
  grass: '#1d5c3f',
  sand: '#c9a86a',
  sea: '#1b4d6e',
  sidewalk: '#3a3350',
  asphalt: '#2b2536',
  laneLine: '#d8c56a',
  curb: '#4a4260',
  buildingRoof: '#312a44',
  buildingEdge: '#4d4266',
  neonPink: '#ff4fd8',
  neonCyan: '#37e6ff',
  neonOrange: '#ff9a3d',
  neonLime: '#a8ff4f',
  neonYellow: '#ffe14f',
  player: '#ffe14f',
  playerCar: '#ff4fd8',
  trafficCar: '#8f9bb3',
  taxi: '#ffc93d',
  policeCar: '#2f6df6',
  policeLightRed: '#ff2d55',
  policeLightBlue: '#2f7bff',
  ped: '#e8e2d4',
  thug: '#ff5a4e',
  text: '#f4f1ff',
  muted: '#b9b3d0',
  panel: 'rgba(16, 12, 28, 0.82)',
  star: '#ffd94f',
  health: '#57e389',
  damage: '#ff5a4e',
};

export const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';

/** localStorage keys for the save slot and the best (highest) cash held. */
export const SAVE_KEY = 'neon-palms.save.v1';
export const BEST_KEY = 'neon-palms.best-cash';
