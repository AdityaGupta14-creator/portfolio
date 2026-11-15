import { PORTFOLIO_CONTENT } from './content';

/**
 * EXACT GEOMETRY BOUNDING BOXES (measured directly from city.glb / city.opt.glb meshes)
 * Scale: 0.25 (1 storey ~ 3.4m, door ~ 2.1m)
 */
export const RAW_BOUNDS = {
  scale: 0.25,
  pavementY: 0.16, // Pavement level (top of sidewalk mesh in StreetGround.tsx)
  northRowZ: -13.4, // Setback aligned with rear sidewalk property edge
  southRowZ: 13.4, // Setback aligned with front promenade property edge
  streetCenterZ: -0.8, // Center line of asphalt roadway
  variant1: {
    // Building 1_3 raw mesh
    minX: -1.58385,
    maxX: 75.58516,
    minY: -6.81494,
    maxY: 88.91968,
    minZ: -90.4502,
    maxZ: 4.22779,
  },
  variant2: {
    // Building 2_2 raw mesh
    minX: -100.50964,
    maxX: -23.80359,
    minY: -6.81494,
    maxY: 88.61968,
    minZ: -107.3482,
    maxZ: 5.92779,
  },
} as const;

export interface BuildingDimensions {
  width: number;
  height: number;
  depth: number;
}

export const BUILDING_DIMENSIONS: Record<1 | 2, BuildingDimensions> = {
  1: {
    width: (RAW_BOUNDS.variant1.maxX - RAW_BOUNDS.variant1.minX) * RAW_BOUNDS.scale, // 19.292m
    height: (RAW_BOUNDS.variant1.maxY - RAW_BOUNDS.variant1.minY) * RAW_BOUNDS.scale, // 23.934m
    depth: (RAW_BOUNDS.variant1.maxZ - RAW_BOUNDS.variant1.minZ) * RAW_BOUNDS.scale, // 23.669m
  },
  2: {
    width: (RAW_BOUNDS.variant2.maxX - RAW_BOUNDS.variant2.minX) * RAW_BOUNDS.scale, // 19.177m
    height: (RAW_BOUNDS.variant2.maxY - RAW_BOUNDS.variant2.minY) * RAW_BOUNDS.scale, // 23.859m
    depth: (RAW_BOUNDS.variant2.maxZ - RAW_BOUNDS.variant2.minZ) * RAW_BOUNDS.scale, // 28.319m
  },
};

/**
 * Local clone offsets so:
 * - Facade center X is at local x = 0
 * - Base Y is at local y = 0
 * - Front facade plane is at local z = 0 (depth extends backwards into z < 0)
 */
export const BUILDING_OFFSETS: Record<1 | 2, [number, number, number]> = {
  1: [
    -(RAW_BOUNDS.variant1.minX + RAW_BOUNDS.variant1.maxX) / 2, // -37.00065
    -RAW_BOUNDS.variant1.minY, // 6.81494
    -RAW_BOUNDS.variant1.maxZ, // -4.22779
  ],
  2: [
    -(RAW_BOUNDS.variant2.minX + RAW_BOUNDS.variant2.maxX) / 2, // 62.15662
    -RAW_BOUNDS.variant2.minY, // 6.81494
    -RAW_BOUNDS.variant2.maxZ, // -5.92779
  ],
};

export interface BuildingInstanceDef {
  id: string;
  proxyId?: number; // 0..4 for interactive 101-109
  number?: string;
  name?: string;
  variant: 1 | 2;
  row: 'north' | 'south';
  position: [number, number, number];
  rotationY: number;
  width: number;
  height: number;
  depth: number;
  boundsCenterZ: number;
  tintColor: string;
  proxy?: BuildingProxyDef;
}

export interface BuildingProxyDef {
  id: number;
  number: string;
  name: string;
  storefrontTitle: string;
  subtitle: string;
  trimColor: string;
  xPos: number;
  zPos: number;
  boxPos: [number, number, number]; // [x, y, z] center of click proxy box
  boxSize: [number, number, number]; // [width, height, depth] of click proxy box
  labelPos: [number, number, number]; // [x, y, z] for floating label above entrance door
  facadeVariant: 1 | 2;
}

// ── Bounding-Box Computed Continuous Row Layout ──────────────────────────────
// Building 105 (Variant 2) centered at X = 0.
// Abutting neighbours with 0m gap and 0m overlap (party wall construction):
// x_next = x_curr +/- (w_curr / 2 + w_next / 2)
const W1 = BUILDING_DIMENSIONS[1].width; // 19.29225
const W2 = BUILDING_DIMENSIONS[2].width; // 19.17651

const X_105 = 0;
const X_103 = X_105 - (W2 / 2 + W1 / 2); // -19.23438
const X_101 = X_103 - (W1 / 2 + W2 / 2); // -38.46876
const X_107 = X_105 + (W2 / 2 + W1 / 2); // +19.23438
const X_109 = X_107 + (W1 / 2 + W2 / 2); // +38.46876

// Filler positions extending the row continuously
const X_NL1 = X_101 - (W2 / 2 + W1 / 2); // -57.70314
const X_NL2 = X_NL1 - (W1 / 2 + W2 / 2); // -76.93752
const X_NL3 = X_NL2 - (W2 / 2 + W1 / 2); // -96.17190
const X_NL4 = X_NL3 - (W1 / 2 + W2 / 2); // -115.40628

const X_NR1 = X_109 + (W2 / 2 + W1 / 2); // +57.70314
const X_NR2 = X_NR1 + (W1 / 2 + W2 / 2); // +76.93752
const X_NR3 = X_NR2 + (W2 / 2 + W1 / 2); // +96.17190
const X_NR4 = X_NR3 + (W1 / 2 + W2 / 2); // +115.40628

/**
 * 5 Core Interactive Click Proxies for Buildings 101-109
 * Positioned exactly at entrance doors, flush with pavement level
 */
export const BUILDING_PROXIES: BuildingProxyDef[] = [
  {
    id: 0,
    number: '101',
    name: 'About Me',
    storefrontTitle: 'THE STUDIO',
    subtitle: '101 Brownstone Ave • Bio & Story',
    trimColor: '#f87171',
    xPos: Number(X_101.toFixed(3)),
    zPos: RAW_BOUNDS.northRowZ,
    boxPos: [Number(X_101.toFixed(3)), RAW_BOUNDS.pavementY + 3.75, RAW_BOUNDS.northRowZ + 1.6],
    boxSize: [12.0, 7.5, 3.2],
    labelPos: [Number(X_101.toFixed(3)), 7.8, RAW_BOUNDS.northRowZ + 1.5],
    facadeVariant: 2,
  },
  {
    id: 1,
    number: '103',
    name: 'Skills',
    storefrontTitle: 'TECH FOUNDRY',
    subtitle: '103 Brownstone Ave • Engineering Stack',
    trimColor: '#fbbf24',
    xPos: Number(X_103.toFixed(3)),
    zPos: RAW_BOUNDS.northRowZ,
    boxPos: [Number(X_103.toFixed(3)), RAW_BOUNDS.pavementY + 3.75, RAW_BOUNDS.northRowZ + 1.6],
    boxSize: [12.0, 7.5, 3.2],
    labelPos: [Number(X_103.toFixed(3)), 7.8, RAW_BOUNDS.northRowZ + 1.5],
    facadeVariant: 1,
  },
  {
    id: 2,
    number: '105',
    name: 'Projects',
    storefrontTitle: 'INNOVATION HUB',
    subtitle: '105 Brownstone Ave • Featured Builds',
    trimColor: '#34d399',
    xPos: Number(X_105.toFixed(3)),
    zPos: RAW_BOUNDS.northRowZ,
    boxPos: [Number(X_105.toFixed(3)), RAW_BOUNDS.pavementY + 3.75, RAW_BOUNDS.northRowZ + 1.6],
    boxSize: [12.0, 7.5, 3.2],
    labelPos: [Number(X_105.toFixed(3)), 7.8, RAW_BOUNDS.northRowZ + 1.5],
    facadeVariant: 2,
  },
  {
    id: 3,
    number: '107',
    name: 'Resume',
    storefrontTitle: 'CREDENTIAL ARCHIVE',
    subtitle: '107 Brownstone Ave • Career & Education',
    trimColor: '#60a5fa',
    xPos: Number(X_107.toFixed(3)),
    zPos: RAW_BOUNDS.northRowZ,
    boxPos: [Number(X_107.toFixed(3)), RAW_BOUNDS.pavementY + 3.75, RAW_BOUNDS.northRowZ + 1.6],
    boxSize: [12.0, 7.5, 3.2],
    labelPos: [Number(X_107.toFixed(3)), 7.8, RAW_BOUNDS.northRowZ + 1.5],
    facadeVariant: 1,
  },
  {
    id: 4,
    number: '109',
    name: 'Contact',
    storefrontTitle: 'COMMUNICATION POST',
    subtitle: '109 Brownstone Ave • Get in Touch',
    trimColor: '#c084fc',
    xPos: Number(X_109.toFixed(3)),
    zPos: RAW_BOUNDS.northRowZ,
    boxPos: [Number(X_109.toFixed(3)), RAW_BOUNDS.pavementY + 3.75, RAW_BOUNDS.northRowZ + 1.6],
    boxSize: [12.0, 7.5, 3.2],
    labelPos: [Number(X_109.toFixed(3)), 7.8, RAW_BOUNDS.northRowZ + 1.5],
    facadeVariant: 2,
  },
];

/**
 * ── NORTH ROW BUILDINGS (Main Avenue Facade, Z = -13.4, Facing Street at +Z) ─
 */
export const NORTH_ROW_BUILDINGS: BuildingInstanceDef[] = [
  // Left Filler Buildings
  {
    id: 'north-filler-l4',
    variant: 2,
    row: 'north',
    position: [Number(X_NL4.toFixed(3)), RAW_BOUNDS.pavementY, RAW_BOUNDS.northRowZ],
    rotationY: 0,
    width: W2,
    height: BUILDING_DIMENSIONS[2].height,
    depth: BUILDING_DIMENSIONS[2].depth,
    boundsCenterZ: RAW_BOUNDS.northRowZ - BUILDING_DIMENSIONS[2].depth / 2,
    tintColor: '#e8ded7',
  },
  {
    id: 'north-filler-l3',
    variant: 1,
    row: 'north',
    position: [Number(X_NL3.toFixed(3)), RAW_BOUNDS.pavementY, RAW_BOUNDS.northRowZ],
    rotationY: 0,
    width: W1,
    height: BUILDING_DIMENSIONS[1].height,
    depth: BUILDING_DIMENSIONS[1].depth,
    boundsCenterZ: RAW_BOUNDS.northRowZ - BUILDING_DIMENSIONS[1].depth / 2,
    tintColor: '#f2e7e0',
  },
  {
    id: 'north-filler-l2',
    variant: 2,
    row: 'north',
    position: [Number(X_NL2.toFixed(3)), RAW_BOUNDS.pavementY, RAW_BOUNDS.northRowZ],
    rotationY: 0,
    width: W2,
    height: BUILDING_DIMENSIONS[2].height,
    depth: BUILDING_DIMENSIONS[2].depth,
    boundsCenterZ: RAW_BOUNDS.northRowZ - BUILDING_DIMENSIONS[2].depth / 2,
    tintColor: '#ebe0d8',
  },
  {
    id: 'north-filler-l1',
    variant: 1,
    row: 'north',
    position: [Number(X_NL1.toFixed(3)), RAW_BOUNDS.pavementY, RAW_BOUNDS.northRowZ],
    rotationY: 0,
    width: W1,
    height: BUILDING_DIMENSIONS[1].height,
    depth: BUILDING_DIMENSIONS[1].depth,
    boundsCenterZ: RAW_BOUNDS.northRowZ - BUILDING_DIMENSIONS[1].depth / 2,
    tintColor: '#f5ece5',
  },

  // 5 Core Interactive Buildings (101 to 109)
  {
    id: 'interactive-101',
    proxyId: 0,
    number: '101',
    name: 'About Me',
    variant: 2,
    row: 'north',
    position: [BUILDING_PROXIES[0].xPos, RAW_BOUNDS.pavementY, RAW_BOUNDS.northRowZ],
    rotationY: 0,
    width: W2,
    height: BUILDING_DIMENSIONS[2].height,
    depth: BUILDING_DIMENSIONS[2].depth,
    boundsCenterZ: RAW_BOUNDS.northRowZ - BUILDING_DIMENSIONS[2].depth / 2,
    tintColor: '#ffffff',
    proxy: BUILDING_PROXIES[0],
  },
  {
    id: 'interactive-103',
    proxyId: 1,
    number: '103',
    name: 'Skills',
    variant: 1,
    row: 'north',
    position: [BUILDING_PROXIES[1].xPos, RAW_BOUNDS.pavementY, RAW_BOUNDS.northRowZ],
    rotationY: 0,
    width: W1,
    height: BUILDING_DIMENSIONS[1].height,
    depth: BUILDING_DIMENSIONS[1].depth,
    boundsCenterZ: RAW_BOUNDS.northRowZ - BUILDING_DIMENSIONS[1].depth / 2,
    tintColor: '#fdf5ee',
    proxy: BUILDING_PROXIES[1],
  },
  {
    id: 'interactive-105',
    proxyId: 2,
    number: '105',
    name: 'Projects',
    variant: 2,
    row: 'north',
    position: [BUILDING_PROXIES[2].xPos, RAW_BOUNDS.pavementY, RAW_BOUNDS.northRowZ],
    rotationY: 0,
    width: W2,
    height: BUILDING_DIMENSIONS[2].height,
    depth: BUILDING_DIMENSIONS[2].depth,
    boundsCenterZ: RAW_BOUNDS.northRowZ - BUILDING_DIMENSIONS[2].depth / 2,
    tintColor: '#f9eee8',
    proxy: BUILDING_PROXIES[2],
  },
  {
    id: 'interactive-107',
    proxyId: 3,
    number: '107',
    name: 'Resume',
    variant: 1,
    row: 'north',
    position: [BUILDING_PROXIES[3].xPos, RAW_BOUNDS.pavementY, RAW_BOUNDS.northRowZ],
    rotationY: 0,
    width: W1,
    height: BUILDING_DIMENSIONS[1].height,
    depth: BUILDING_DIMENSIONS[1].depth,
    boundsCenterZ: RAW_BOUNDS.northRowZ - BUILDING_DIMENSIONS[1].depth / 2,
    tintColor: '#f5ebe4',
    proxy: BUILDING_PROXIES[3],
  },
  {
    id: 'interactive-109',
    proxyId: 4,
    number: '109',
    name: 'Contact',
    variant: 2,
    row: 'north',
    position: [BUILDING_PROXIES[4].xPos, RAW_BOUNDS.pavementY, RAW_BOUNDS.northRowZ],
    rotationY: 0,
    width: W2,
    height: BUILDING_DIMENSIONS[2].height,
    depth: BUILDING_DIMENSIONS[2].depth,
    boundsCenterZ: RAW_BOUNDS.northRowZ - BUILDING_DIMENSIONS[2].depth / 2,
    tintColor: '#efe3dc',
    proxy: BUILDING_PROXIES[4],
  },

  // Right Filler Buildings
  {
    id: 'north-filler-r1',
    variant: 1,
    row: 'north',
    position: [Number(X_NR1.toFixed(3)), RAW_BOUNDS.pavementY, RAW_BOUNDS.northRowZ],
    rotationY: 0,
    width: W1,
    height: BUILDING_DIMENSIONS[1].height,
    depth: BUILDING_DIMENSIONS[1].depth,
    boundsCenterZ: RAW_BOUNDS.northRowZ - BUILDING_DIMENSIONS[1].depth / 2,
    tintColor: '#ede2db',
  },
  {
    id: 'north-filler-r2',
    variant: 2,
    row: 'north',
    position: [Number(X_NR2.toFixed(3)), RAW_BOUNDS.pavementY, RAW_BOUNDS.northRowZ],
    rotationY: 0,
    width: W2,
    height: BUILDING_DIMENSIONS[2].height,
    depth: BUILDING_DIMENSIONS[2].depth,
    boundsCenterZ: RAW_BOUNDS.northRowZ - BUILDING_DIMENSIONS[2].depth / 2,
    tintColor: '#e8ded6',
  },
  {
    id: 'north-filler-r3',
    variant: 1,
    row: 'north',
    position: [Number(X_NR3.toFixed(3)), RAW_BOUNDS.pavementY, RAW_BOUNDS.northRowZ],
    rotationY: 0,
    width: W1,
    height: BUILDING_DIMENSIONS[1].height,
    depth: BUILDING_DIMENSIONS[1].depth,
    boundsCenterZ: RAW_BOUNDS.northRowZ - BUILDING_DIMENSIONS[1].depth / 2,
    tintColor: '#f2e8e1',
  },
  {
    id: 'north-filler-r4',
    variant: 2,
    row: 'north',
    position: [Number(X_NR4.toFixed(3)), RAW_BOUNDS.pavementY, RAW_BOUNDS.northRowZ],
    rotationY: 0,
    width: W2,
    height: BUILDING_DIMENSIONS[2].height,
    depth: BUILDING_DIMENSIONS[2].depth,
    boundsCenterZ: RAW_BOUNDS.northRowZ - BUILDING_DIMENSIONS[2].depth / 2,
    tintColor: '#ebdcd3',
  },
];

/**
 * ── SOUTH ROW BUILDINGS (Facing Avenue Facades, Z = +13.4, Rotated 180° into street) ─
 * Bases at Y = 0.16 (pavement level), 0m gap, no overlaps, fronts face -Z (into street).
 */
export const SOUTH_ROW_BUILDINGS: BuildingInstanceDef[] = [
  {
    id: 'south-0',
    variant: 1,
    row: 'south',
    position: [Number(X_NL4.toFixed(3)), RAW_BOUNDS.pavementY, RAW_BOUNDS.southRowZ],
    rotationY: Math.PI,
    width: W1,
    height: BUILDING_DIMENSIONS[1].height,
    depth: BUILDING_DIMENSIONS[1].depth,
    boundsCenterZ: RAW_BOUNDS.southRowZ + BUILDING_DIMENSIONS[1].depth / 2,
    tintColor: '#ece1da',
  },
  {
    id: 'south-1',
    variant: 2,
    row: 'south',
    position: [Number(X_NL3.toFixed(3)), RAW_BOUNDS.pavementY, RAW_BOUNDS.southRowZ],
    rotationY: Math.PI,
    width: W2,
    height: BUILDING_DIMENSIONS[2].height,
    depth: BUILDING_DIMENSIONS[2].depth,
    boundsCenterZ: RAW_BOUNDS.southRowZ + BUILDING_DIMENSIONS[2].depth / 2,
    tintColor: '#f5eae3',
  },
  {
    id: 'south-2',
    variant: 1,
    row: 'south',
    position: [Number(X_NL2.toFixed(3)), RAW_BOUNDS.pavementY, RAW_BOUNDS.southRowZ],
    rotationY: Math.PI,
    width: W1,
    height: BUILDING_DIMENSIONS[1].height,
    depth: BUILDING_DIMENSIONS[1].depth,
    boundsCenterZ: RAW_BOUNDS.southRowZ + BUILDING_DIMENSIONS[1].depth / 2,
    tintColor: '#ede3dc',
  },
  {
    id: 'south-3',
    variant: 2,
    row: 'south',
    position: [Number(X_NL1.toFixed(3)), RAW_BOUNDS.pavementY, RAW_BOUNDS.southRowZ],
    rotationY: Math.PI,
    width: W2,
    height: BUILDING_DIMENSIONS[2].height,
    depth: BUILDING_DIMENSIONS[2].depth,
    boundsCenterZ: RAW_BOUNDS.southRowZ + BUILDING_DIMENSIONS[2].depth / 2,
    tintColor: '#f8eee7',
  },
  {
    id: 'south-4',
    variant: 1,
    row: 'south',
    position: [BUILDING_PROXIES[0].xPos, RAW_BOUNDS.pavementY, RAW_BOUNDS.southRowZ],
    rotationY: Math.PI,
    width: W1,
    height: BUILDING_DIMENSIONS[1].height,
    depth: BUILDING_DIMENSIONS[1].depth,
    boundsCenterZ: RAW_BOUNDS.southRowZ + BUILDING_DIMENSIONS[1].depth / 2,
    tintColor: '#ebe0d8',
  },
  {
    id: 'south-5',
    variant: 2,
    row: 'south',
    position: [BUILDING_PROXIES[1].xPos, RAW_BOUNDS.pavementY, RAW_BOUNDS.southRowZ],
    rotationY: Math.PI,
    width: W2,
    height: BUILDING_DIMENSIONS[2].height,
    depth: BUILDING_DIMENSIONS[2].depth,
    boundsCenterZ: RAW_BOUNDS.southRowZ + BUILDING_DIMENSIONS[2].depth / 2,
    tintColor: '#f3e8e1',
  },
  {
    id: 'south-6',
    variant: 1,
    row: 'south',
    position: [BUILDING_PROXIES[2].xPos, RAW_BOUNDS.pavementY, RAW_BOUNDS.southRowZ],
    rotationY: Math.PI,
    width: W1,
    height: BUILDING_DIMENSIONS[1].height,
    depth: BUILDING_DIMENSIONS[1].depth,
    boundsCenterZ: RAW_BOUNDS.southRowZ + BUILDING_DIMENSIONS[1].depth / 2,
    tintColor: '#eae0d8',
  },
  {
    id: 'south-7',
    variant: 2,
    row: 'south',
    position: [BUILDING_PROXIES[3].xPos, RAW_BOUNDS.pavementY, RAW_BOUNDS.southRowZ],
    rotationY: Math.PI,
    width: W2,
    height: BUILDING_DIMENSIONS[2].height,
    depth: BUILDING_DIMENSIONS[2].depth,
    boundsCenterZ: RAW_BOUNDS.southRowZ + BUILDING_DIMENSIONS[2].depth / 2,
    tintColor: '#f6ece5',
  },
  {
    id: 'south-8',
    variant: 1,
    row: 'south',
    position: [BUILDING_PROXIES[4].xPos, RAW_BOUNDS.pavementY, RAW_BOUNDS.southRowZ],
    rotationY: Math.PI,
    width: W1,
    height: BUILDING_DIMENSIONS[1].height,
    depth: BUILDING_DIMENSIONS[1].depth,
    boundsCenterZ: RAW_BOUNDS.southRowZ + BUILDING_DIMENSIONS[1].depth / 2,
    tintColor: '#ece2db',
  },
  {
    id: 'south-9',
    variant: 2,
    row: 'south',
    position: [Number(X_NR1.toFixed(3)), RAW_BOUNDS.pavementY, RAW_BOUNDS.southRowZ],
    rotationY: Math.PI,
    width: W2,
    height: BUILDING_DIMENSIONS[2].height,
    depth: BUILDING_DIMENSIONS[2].depth,
    boundsCenterZ: RAW_BOUNDS.southRowZ + BUILDING_DIMENSIONS[2].depth / 2,
    tintColor: '#f4e9e2',
  },
  {
    id: 'south-10',
    variant: 1,
    row: 'south',
    position: [Number(X_NR2.toFixed(3)), RAW_BOUNDS.pavementY, RAW_BOUNDS.southRowZ],
    rotationY: Math.PI,
    width: W1,
    height: BUILDING_DIMENSIONS[1].height,
    depth: BUILDING_DIMENSIONS[1].depth,
    boundsCenterZ: RAW_BOUNDS.southRowZ + BUILDING_DIMENSIONS[1].depth / 2,
    tintColor: '#ece1da',
  },
  {
    id: 'south-11',
    variant: 2,
    row: 'south',
    position: [Number(X_NR3.toFixed(3)), RAW_BOUNDS.pavementY, RAW_BOUNDS.southRowZ],
    rotationY: Math.PI,
    width: W2,
    height: BUILDING_DIMENSIONS[2].height,
    depth: BUILDING_DIMENSIONS[2].depth,
    boundsCenterZ: RAW_BOUNDS.southRowZ + BUILDING_DIMENSIONS[2].depth / 2,
    tintColor: '#f7ede6',
  },
  {
    id: 'south-12',
    variant: 1,
    row: 'south',
    position: [Number(X_NR4.toFixed(3)), RAW_BOUNDS.pavementY, RAW_BOUNDS.southRowZ],
    rotationY: Math.PI,
    width: W1,
    height: BUILDING_DIMENSIONS[1].height,
    depth: BUILDING_DIMENSIONS[1].depth,
    boundsCenterZ: RAW_BOUNDS.southRowZ + BUILDING_DIMENSIONS[1].depth / 2,
    tintColor: '#ede2db',
  },
];

export { PORTFOLIO_CONTENT };
