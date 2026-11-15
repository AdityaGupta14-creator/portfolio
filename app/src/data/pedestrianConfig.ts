import { RAW_BOUNDS } from './buildings';

/**
 * Mixamo Walking.fbx Animation & Physical Stride Measurements
 *
 * Measured directly from /public/animations/Walking.fbx:
 * - Raw avatar bounding box height: 179.27 cm
 * - Target avatar stature in world units: 1.75 m (scaleFactor = 1.75 / 179.27 = 0.00976156)
 * - Raw Hips translation per walk cycle: 177.86 cm (dz = 177.86, dx ~ 0)
 * - Scaled world stride distance: 1.7362 m
 * - Walk animation cycle duration: 1.033333 s (31 keyframes @ 30 fps)
 * - Natural walking speed of the clip: 1.7362 m / 1.033333 s = 1.6802 m/s
 *
 * World walking speed target (specified by user):
 * - Base world walking speed: ~1.40 m/s
 * - Individual variation: +-10% (1.26 m/s to 1.54 m/s)
 * - Synchronized animation tempo:
 *     action.timeScale = walkSpeed / (clipNaturalSpeed * heightScale)
 *   This ensures exact stride-matching with zero foot sliding on the pavement.
 */
export const PEDESTRIAN_STRIDE = {
  rawHeightCm: 179.27,
  targetHeightM: 1.75,
  rawStrideCm: 177.86,
  clipDurationS: 1.0333333,
  worldStrideM: 1.73619,
  clipNaturalSpeed: 1.68018, // m/s
  baseWorldWalkSpeed: 1.40, // m/s
  speedVariationRatio: 0.10, // +-10%
} as const;

/**
 * Calculates the exact AnimationAction timeScale so foot translation speed
 * matches ground movement speed without any sliding.
 */
export function calculateWalkTimeScale(walkSpeed: number, heightScale = 1.0): number {
  const scaledNaturalSpeed = PEDESTRIAN_STRIDE.clipNaturalSpeed * heightScale;
  if (scaledNaturalSpeed <= 0.001) return 1.0;
  return walkSpeed / scaledNaturalSpeed;
}

/**
 * Kinematic Avoidance & Movement Parameters
 * - Radius: 0.35 m (diameter 0.70 m)
 * - Look-ahead: 2.5 m
 * - Avoidance trigger: 1.2 m
 * - Max lateral steering offset: 0.6 m
 * - Max acceleration/deceleration: 2.0 m/s^2 (smooth speed changes, no instant stops)
 * - Turn rate: 3.5 rad/s (smooth turning, no snapping)
 */
export const AVOIDANCE_CONFIG = {
  pedestrianRadius: 0.35,      // world meters
  lookAheadDistance: 2.50,     // world meters
  avoidTriggerDistance: 1.20,  // world meters
  maxLateralOffset: 0.60,      // world meters
  lateralSteerRate: 1.60,      // m/s lateral transition speed
  maxAcceleration: 2.00,       // m/s^2 acceleration/deceleration
  turnRate: 3.50,              // rad/s angular turning rate
  minSafeDistance: 0.85,       // min distance before braking
} as const;

/**
 * Pavement Lane Definitions
 *
 * Street Layout (from RAW_BOUNDS and StreetGround.tsx):
 * - North Sidewalk (Brownstones frontage):
 *   Building facades at Z = -13.4, Curb at Z = -6.2, Pavement Y = 0.16.
 *   - Lane Near Building (Z = -10.8): Direction = -1 (Westbound).
 *     Walking on the right side of the sidewalk when facing West -> towards building (-Z).
 *   - Lane Near Kerb (Z = -8.6): Direction = +1 (Eastbound).
 *     Walking on the right side of the sidewalk when facing East -> towards kerb (+Z).
 *
 * - South Sidewalk (Park Promenade):
 *   Curb at Z = 5.1, Park boundary at Z = 13.3, Pavement Y = 0.10.
 *   - Lane Near Kerb (Z = 7.6): Direction = -1 (Westbound).
 *     Walking on the right side of the promenade when facing West -> towards kerb (-Z).
 *   - Lane Near Park (Z = 9.8): Direction = +1 (Eastbound).
 *     Walking on the right side of the promenade when facing East -> towards park (+Z).
 *
 * When two people travel in opposite directions, they naturally occupy separate
 * lanes separated by ~2.2 m, passing each other smoothly on the right.
 */
export interface SidewalkLaneDef {
  id: string;
  name: string;
  side: 'north' | 'south';
  subLane: 'near-building' | 'near-kerb' | 'near-park';
  zCenter: number;
  pavementY: number;
  direction: 1 | -1; // 1 = +X (Eastbound), -1 = -X (Westbound)
  minZ: number;      // safe sidewalk boundary
  maxZ: number;      // safe sidewalk boundary
  xMin: number;
  xMax: number;
}

export const SIDEWALK_LANES: Record<string, SidewalkLaneDef> = {
  'north-building': {
    id: 'north-building',
    name: 'North (Near Building)',
    side: 'north',
    subLane: 'near-building',
    zCenter: -10.8,
    pavementY: RAW_BOUNDS.pavementY,
    direction: -1,
    minZ: -11.6,
    maxZ: -9.8,
    xMin: -56.0,
    xMax: 56.0,
  },
  'north-kerb': {
    id: 'north-kerb',
    name: 'North (Near Kerb)',
    side: 'north',
    subLane: 'near-kerb',
    zCenter: -8.6,
    pavementY: RAW_BOUNDS.pavementY,
    direction: 1,
    minZ: -9.6,
    maxZ: -7.6,
    xMin: -56.0,
    xMax: 56.0,
  },
  'south-kerb': {
    id: 'south-kerb',
    name: 'South (Near Kerb)',
    side: 'south',
    subLane: 'near-kerb',
    zCenter: 7.6,
    pavementY: 0.10,
    direction: -1,
    minZ: 6.6,
    maxZ: 8.6,
    xMin: -56.0,
    xMax: 56.0,
  },
  'south-park': {
    id: 'south-park',
    name: 'South (Near Park)',
    side: 'south',
    subLane: 'near-park',
    zCenter: 9.8,
    pavementY: 0.10,
    direction: 1,
    minZ: 8.8,
    maxZ: 10.8,
    xMin: -56.0,
    xMax: 56.0,
  },
};

/**
 * Natural Clothing Colour Palettes
 */
export const SUIT_PALETTE = [
  0x1e293b, // Navy
  0x27272a, // Charcoal
  0x334155, // Slate
  0x36453b, // Olive Earth
  0x7c5e42, // Warm Camel
  0x2d2421, // Deep Espresso
  0x4a1c24, // Muted Burgundy
  0x3f4756, // Steel
];

export const PANTS_PALETTE = [
  0x27272a, // Charcoal
  0x1e2430, // Classic Navy
  0x635343, // Khaki Chino
  0x2f3542, // Slate Dark
  0x26201d, // Dark Brown
  0x495057, // Stone Grey
  0x1b263b, // Dark Denim
  0x1f2229, // Anthracite
];

export const SHIRT_PALETTE = [
  0xf8fafc, // Crisp White
  0xdbeafe, // Soft Sky Blue
  0xfef9c3, // Pale Cream
  0xe2e8f0, // Heather Grey
  0xe0f2fe, // Heather Ice
  0xdcfce7, // Soft Sage
  0xf5f0eb, // Natural Linen
  0xfce7f3, // Soft Blush
];

export const SKIN_PALETTE = [
  0xf5d0b5, // Fair
  0xe0ac8b, // Medium Warm
  0xc6865c, // Tan
  0x8d5534, // Warm Bronze
  0xf7dcc4, // Peach
  0xd4a87c, // Golden Tan
  0x6e4327, // Deep Bronze
];

export const HAIR_PALETTE = [
  0x18181b, // Soft Black
  0x2d221e, // Dark Brown
  0x4a3022, // Chestnut
  0x5c4738, // Warm Ash
  0x785b45, // Sandy Brown
  0x27272a, // Charcoal
];

export const SHOE_PALETTE = [
  0x131418, // Black Leather
  0x241b18, // Espresso Leather
  0x31191c, // Cordovan / Oxblood
  0x3b2b23, // Brown Leather
];

/**
 * 8 Pedestrians Configurations
 * - 4 on North Sidewalk (2 Eastbound on Kerb lane, 2 Westbound on Building lane)
 * - 4 on South Promenade (2 Eastbound on Park lane, 2 Westbound on Kerb lane)
 */
export interface PedestrianInitConfig {
  id: number;
  laneKey: keyof typeof SIDEWALK_LANES;
  initialX: number;
  cruiseSpeed: number; // m/s (~1.4 m/s +- 10%)
  heightMult: number;  // 0.95 - 1.05
  suitColor: number;
  pantsColor: number;
  shirtColor: number;
  skinColor: number;
  hairColor: number;
  shoeColor: number;
}

export const PEDESTRIAN_CONFIGS: PedestrianInitConfig[] = [
  // North Sidewalk: Near Building lane (Westbound, dir = -1)
  {
    id: 0,
    laneKey: 'north-building',
    initialX: 20.0,
    cruiseSpeed: 1.42,
    heightMult: 1.02,
    suitColor: SUIT_PALETTE[0], // Navy
    pantsColor: PANTS_PALETTE[0], // Charcoal
    shirtColor: SHIRT_PALETTE[0], // White
    skinColor: SKIN_PALETTE[1],
    hairColor: HAIR_PALETTE[0],
    shoeColor: SHOE_PALETTE[0],
  },
  {
    id: 1,
    laneKey: 'north-building',
    initialX: 42.0,
    cruiseSpeed: 1.35,
    heightMult: 0.97,
    suitColor: SUIT_PALETTE[4], // Warm Camel
    pantsColor: PANTS_PALETTE[1], // Classic Navy
    shirtColor: SHIRT_PALETTE[1], // Sky Blue
    skinColor: SKIN_PALETTE[0],
    hairColor: HAIR_PALETTE[2],
    shoeColor: SHOE_PALETTE[1],
  },

  // North Sidewalk: Near Kerb lane (Eastbound, dir = +1)
  {
    id: 2,
    laneKey: 'north-kerb',
    initialX: 7.0,
    cruiseSpeed: 1.45,
    heightMult: 1.04,
    suitColor: SUIT_PALETTE[2], // Slate
    pantsColor: PANTS_PALETTE[3], // Slate Dark
    shirtColor: SHIRT_PALETTE[3], // Heather Grey
    skinColor: SKIN_PALETTE[2],
    hairColor: HAIR_PALETTE[1],
    shoeColor: SHOE_PALETTE[0],
  },
  {
    id: 3,
    laneKey: 'north-kerb',
    initialX: -12.0,
    cruiseSpeed: 1.38,
    heightMult: 0.98,
    suitColor: SUIT_PALETTE[3], // Olive Earth
    pantsColor: PANTS_PALETTE[2], // Khaki Chino
    shirtColor: SHIRT_PALETTE[2], // Cream
    skinColor: SKIN_PALETTE[3],
    hairColor: HAIR_PALETTE[0],
    shoeColor: SHOE_PALETTE[3],
  },

  // South Promenade: Near Kerb lane (Westbound, dir = -1)
  {
    id: 4,
    laneKey: 'south-kerb',
    initialX: 20.0,
    cruiseSpeed: 1.40,
    heightMult: 1.01,
    suitColor: SUIT_PALETTE[1], // Charcoal
    pantsColor: PANTS_PALETTE[0], // Charcoal
    shirtColor: SHIRT_PALETTE[0], // White
    skinColor: SKIN_PALETTE[5],
    hairColor: HAIR_PALETTE[1],
    shoeColor: SHOE_PALETTE[0],
  },
  {
    id: 5,
    laneKey: 'south-kerb',
    initialX: 12.0,
    cruiseSpeed: 1.48,
    heightMult: 0.96,
    suitColor: SUIT_PALETTE[6], // Burgundy
    pantsColor: PANTS_PALETTE[6], // Dark Denim
    shirtColor: SHIRT_PALETTE[6], // Linen
    skinColor: SKIN_PALETTE[4],
    hairColor: HAIR_PALETTE[4],
    shoeColor: SHOE_PALETTE[2],
  },

  // South Promenade: Near Park lane (Eastbound, dir = +1)
  {
    id: 6,
    laneKey: 'south-park',
    initialX: -26.0,
    cruiseSpeed: 1.44,
    heightMult: 1.03,
    suitColor: SUIT_PALETTE[7], // Steel
    pantsColor: PANTS_PALETTE[5], // Stone
    shirtColor: SHIRT_PALETTE[5], // Sage
    skinColor: SKIN_PALETTE[6],
    hairColor: HAIR_PALETTE[0],
    shoeColor: SHOE_PALETTE[1],
  },
  {
    id: 7,
    laneKey: 'south-park',
    initialX: -2.0,
    cruiseSpeed: 1.34,
    heightMult: 0.99,
    suitColor: SUIT_PALETTE[5], // Espresso
    pantsColor: PANTS_PALETTE[4], // Dark Brown
    shirtColor: SHIRT_PALETTE[4], // Ice
    skinColor: SKIN_PALETTE[1],
    hairColor: HAIR_PALETTE[3],
    shoeColor: SHOE_PALETTE[0],
  },
];
