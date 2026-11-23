// Neon Palms — tuning constants. One place for every number the game balances on.
export const CFG = {
  worldW: 3400, worldH: 2600,
  viewW: 1280, viewH: 720,
  seed: 20261124,
  walkSpeed: 165, runSpeed: 285,
  carAccel: 340, carBrake: 520, carMax: 460, carReverseMax: 170,
  carTurn: 2.6, carDrag: 0.55, carGrip: 6.5,
  pistolMag: 12, pistolDamage: 34, bulletSpeed: 900,
  punchDamage: 22, punchRange: 46, punchArc: 1.1,
  wantedDecayQuiet: 18, bustedHold: 1.6,
  trafficCars: 16, pedestrians: 26, maxPolice: 5,
  autosaveSecs: 20,
  colors: {
    asphalt: '#23232e', roadLine: '#c9c96a', sidewalk: '#3a3a48',
    grass: '#14351f', sand: '#c2a878', water: '#0e3a5c',
    buildingA: '#2b2b4d', buildingB: '#3d2b4d', buildingC: '#1f3a4d',
    neonPink: '#ff2e88', neonCyan: '#22e6ff', neonLime: '#a6ff3d', neonAmber: '#ffb02e',
  },
};
export const MISSION_REWARDS = [400, 900, 1200, 1800, 2500];
export const LANDMARKS = [
  { id: 'bar', name: "Mara's Bar", kind: 'bar' },
  { id: 'hotel', name: 'Palms Hotel', kind: 'hotel' },
  { id: 'bank', name: 'Neon Bank', kind: 'bank' },
  { id: 'warehouse', name: 'Dock Warehouse', kind: 'warehouse' },
  { id: 'safehouse', name: 'Safehouse', kind: 'safehouse' },
  { id: 'docks', name: 'The Docks', kind: 'docks' },
  { id: 'station', name: 'Police Station', kind: 'station' },
  { id: 'park', name: 'Palm Park', kind: 'park' },
  { id: 'beach', name: 'Neon Beach', kind: 'beach' },
];
