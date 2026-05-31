// KARTOPIA - game data (characters, karts, tracks)
// Everything is data-driven so we can add more content easily.

// ---------------------------------------------------------------------------
// CHARACTERS  (original, Wii/Mii-inspired rounded buddies)
// stats are 0..10 and lightly affect handling/feel
// ---------------------------------------------------------------------------
export const CHARACTERS = [
  { id: 'pip',    name: 'Pip',    skin: 0xffd9a8, shirt: 0xff5a5f, cap: 0xffffff, speed: 5, accel: 7, handling: 8 },
  { id: 'bubba',  name: 'Bubba',  skin: 0xe8b07a, shirt: 0x3d8bff, cap: 0x1b3a6b, speed: 8, accel: 4, handling: 5 },
  { id: 'lola',   name: 'Lola',   skin: 0xffcf9e, shirt: 0xff7ad1, cap: 0xfff04d, speed: 6, accel: 6, handling: 7 },
  { id: 'gizmo',  name: 'Gizmo',  skin: 0xbfe3c9, shirt: 0x33d6a6, cap: 0x0e8f6e, speed: 6, accel: 8, handling: 6 },
  { id: 'mochi',  name: 'Mochi',  skin: 0xfff2e0, shirt: 0xc77dff, cap: 0x7a3ff2, speed: 5, accel: 6, handling: 9 },
  { id: 'tank',   name: 'Tank',   skin: 0xd9a066, shirt: 0xff9f1c, cap: 0x9c3b00, speed: 9, accel: 3, handling: 4 },
  { id: 'zazu',   name: 'Zazu',   skin: 0xffd9a8, shirt: 0x2ec4b6, cap: 0x086375, speed: 7, accel: 6, handling: 6 },
  { id: 'nimbus', name: 'Nimbus', skin: 0xeaf2ff, shirt: 0x9bb8ff, cap: 0x5b7cff, speed: 6, accel: 7, handling: 7 },
];

// ---------------------------------------------------------------------------
// KARTS  (the rides). Stat modifiers stack with the character.
// ---------------------------------------------------------------------------
export const KARTS = [
  { id: 'beep',    name: 'Beep Buggy',      color: 0xff5a5f, accent: 0xffffff, dSpeed: 0,  dAccel: 1,  dHandling: 1 },
  { id: 'tot',     name: 'Turbo Tot',       color: 0xffd23f, accent: 0xff8c00, dSpeed: 1,  dAccel: 1,  dHandling: 0 },
  { id: 'chunky',  name: 'Chunky Cruiser',  color: 0x3d8bff, accent: 0x1b3a6b, dSpeed: 2,  dAccel: -1, dHandling: -1 },
  { id: 'drift',   name: 'Drift King',      color: 0x9b5de5, accent: 0x2b0a4a, dSpeed: 1,  dAccel: 0,  dHandling: 2 },
  { id: 'cloud',   name: 'Cloud Rider',     color: 0x90e0ef, accent: 0xffffff, dSpeed: 0,  dAccel: 2,  dHandling: 1 },
  { id: 'bolt',    name: 'Bolt',            color: 0x2ec4b6, accent: 0x0b5d56, dSpeed: 2,  dAccel: 1,  dHandling: -1 },
];

// ---------------------------------------------------------------------------
// TRACKS
// Each track is generated from a smooth closed loop (parametric harmonics),
// then smoothed by a Catmull-Rom curve at runtime. This guarantees flowing,
// non-self-intersecting circuits and lets us scale to many tracks easily.
// ---------------------------------------------------------------------------

// Build a closed loop of control points [x, z] from harmonic params.
export function makeLoop({ radius, harmonics = [], points = 16, rotate = 0, squashX = 1, squashZ = 1 }) {
  const pts = [];
  for (let i = 0; i < points; i++) {
    const a = (i / points) * Math.PI * 2 + rotate;
    let r = radius;
    for (const h of harmonics) r += h.amp * Math.sin(h.k * a + (h.phase || 0));
    pts.push([Math.cos(a) * r * squashX, Math.sin(a) * r * squashZ]);
  }
  return pts;
}

export const TRACKS = [
  {
    id: 'sunny',
    name: 'Sunny Circuit',
    difficulty: 1,
    width: 18,
    laps: 3,
    theme: { ground: 0x7ec850, road: 0x4a4e57, curb: 0xff5a5f, sky: 0x8fd3ff, fog: 0xbfe8ff, deco: 'tree', decoColor: 0x2e9e4f },
    loop: { radius: 95, points: 14, harmonics: [{ k: 2, amp: 18 }, { k: 3, amp: 10, phase: 1.2 }], squashX: 1.15 },
  },
  {
    id: 'lagoon',
    name: 'Loop Lagoon',
    difficulty: 2,
    width: 17,
    laps: 3,
    theme: { ground: 0x39c5bb, road: 0x3a4150, curb: 0xfff04d, sky: 0x6fe3ff, fog: 0xbff6ff, deco: 'palm', decoColor: 0x1f8a70 },
    loop: { radius: 90, points: 16, harmonics: [{ k: 3, amp: 22, phase: 0.5 }, { k: 5, amp: 8 }], squashZ: 1.2 },
  },
  {
    id: 'skygarden',
    name: 'Sky Garden',
    difficulty: 2,
    width: 16,
    laps: 3,
    theme: { ground: 0xa0e9a0, road: 0x6b5b8a, curb: 0xff7ad1, sky: 0xc8e8ff, fog: 0xe6f3ff, deco: 'bush', decoColor: 0x4fb06a },
    loop: { radius: 88, points: 18, harmonics: [{ k: 2, amp: 14 }, { k: 4, amp: 16, phase: 0.8 }, { k: 6, amp: 6 }] },
  },
  {
    id: 'frosty',
    name: 'Frosty Bends',
    difficulty: 3,
    width: 16,
    laps: 3,
    theme: { ground: 0xeaf6ff, road: 0x9fb4c7, curb: 0x3d8bff, sky: 0xcfeaff, fog: 0xeaf6ff, deco: 'pine', decoColor: 0x2f7d5b },
    loop: { radius: 92, points: 18, harmonics: [{ k: 4, amp: 20, phase: 0.3 }, { k: 7, amp: 9, phase: 1.1 }], squashX: 1.1 },
  },
  {
    id: 'canyon',
    name: 'Canyon Dash',
    difficulty: 3,
    width: 17,
    laps: 3,
    theme: { ground: 0xe2a14b, road: 0x5a4632, curb: 0xffd23f, sky: 0xffcf8f, fog: 0xffe0b0, deco: 'rock', decoColor: 0x9c5a2b },
    loop: { radius: 100, points: 16, harmonics: [{ k: 2, amp: 26, phase: 0.6 }, { k: 5, amp: 10 }], squashZ: 1.15 },
  },
  {
    id: 'neon',
    name: 'Neon Night',
    difficulty: 4,
    width: 15,
    laps: 3,
    theme: { ground: 0x141225, road: 0x2a2740, curb: 0x00f5d4, sky: 0x1a1730, fog: 0x241f3a, deco: 'pylon', decoColor: 0xff2e97 },
    loop: { radius: 90, points: 20, harmonics: [{ k: 3, amp: 18 }, { k: 6, amp: 12, phase: 0.9 }, { k: 9, amp: 5 }] },
  },
  {
    id: 'volcano',
    name: 'Lava Loop',
    difficulty: 4,
    width: 16,
    laps: 3,
    theme: { ground: 0x3a1f1f, road: 0x4d3b3b, curb: 0xff7b00, sky: 0x6b2b1b, fog: 0x5a2418, deco: 'rock', decoColor: 0x7a2d1a },
    loop: { radius: 96, points: 18, harmonics: [{ k: 2, amp: 22, phase: 1.0 }, { k: 4, amp: 14 }, { k: 7, amp: 6, phase: 0.4 }], squashX: 1.1 },
  },
  {
    id: 'rainbow',
    name: 'Rainbow Rush',
    difficulty: 5,
    width: 14,
    laps: 3,
    theme: { ground: 0x0a0a1f, road: 0x3b2b5a, curb: 0xffffff, sky: 0x120a2a, fog: 0x1a1030, deco: 'star', decoColor: 0xfff04d },
    loop: { radius: 102, points: 22, harmonics: [{ k: 3, amp: 20, phase: 0.2 }, { k: 5, amp: 11, phase: 1.3 }, { k: 8, amp: 5 }], squashZ: 1.1 },
  },
  {
    id: 'meadow',
    name: 'Meadow Sprint',
    difficulty: 1,
    width: 19,
    laps: 3,
    theme: { ground: 0x9bdc5a, road: 0x55606b, curb: 0xff9f1c, sky: 0x9be3ff, fog: 0xd6f2ff, deco: 'tree', decoColor: 0x3aa84f },
    loop: { radius: 98, points: 12, harmonics: [{ k: 2, amp: 14, phase: 0.4 }], squashX: 1.2 },
  },
  {
    id: 'harbor',
    name: 'Storm Harbor',
    difficulty: 4,
    width: 16,
    laps: 3,
    theme: { ground: 0x2b4a63, road: 0x3a4452, curb: 0x00b4d8, sky: 0x5b7089, fog: 0x49617a, deco: 'pylon', decoColor: 0xffd23f },
    loop: { radius: 94, points: 18, harmonics: [{ k: 3, amp: 20, phase: 0.7 }, { k: 5, amp: 12 }, { k: 8, amp: 5, phase: 1.0 }], squashZ: 1.12 },
  },
];

export const getCharacter = (id) => CHARACTERS.find((c) => c.id === id) || CHARACTERS[0];
export const getKart = (id) => KARTS.find((k) => k.id === id) || KARTS[0];
export const getTrack = (id) => TRACKS.find((t) => t.id === id) || TRACKS[0];
