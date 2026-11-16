import * as THREE from 'three';

export type SkyMode = 'morning' | 'evening' | 'night';

export interface SkyModePalette {
  name: string;
  // Sky Gradient (Zenith, Mid-Dome, Horizon)
  skyTop: THREE.Color;
  skyMiddle: THREE.Color;
  skyHorizon: THREE.Color;
  // Fog
  fogColor: THREE.Color;
  fogNear: number;
  fogFar: number;
  // Cloud Material Tweens
  cloudTint: THREE.Color;
  cloudOpacity: number;
  cloudEmissive: THREE.Color;
  cloudEmissiveIntensity: number;
  // Primary Directional Light (Sun or Moon)
  lightColor: THREE.Color;
  lightIntensity: number;
  lightPosition: [number, number, number];
  // Ambient & Hemisphere Lighting
  hemiSky: THREE.Color;
  hemiGround: THREE.Color;
  hemiIntensity: number;
  ambientColor: THREE.Color;
  ambientIntensity: number;
  // Renderer Exposure & Night Elements
  exposure: number;
  moonOpacity: number;
  starsOpacity: number;
  windowGlow: number;
}

export const SKY_MODEL_CONFIG = {
  modelPath: '/models/cartoon_night_sky.glb',
  cloudPlaneNames: ['Plane_9', 'Plane.001_10', 'Plane.002_11', 'Plane.003_12'],
  moonMeshNames: ['Cube_2', 'Cube001_3', 'Cube002_4', 'Cube003_5'],
  cloudMaterialName: 'nuven',
  moonMaterialName: 'moon',
  desktopInstances: 60, // ~15 per cloud shape
  lowInstances: 20,     // ~5 per cloud shape
  starsDesktopCount: 800,
  starsLowCount: 250,
  transitionDurationSec: 1.5,
};

export const SKY_MODE_PALETTES: Record<SkyMode, SkyModePalette> = {
  morning: {
    name: 'Morning',
    skyTop: new THREE.Color(0x629edb),        // Soft clear blue at zenith
    skyMiddle: new THREE.Color(0xa6d2f5),     // Light atmospheric blue
    skyHorizon: new THREE.Color(0xf8c8a8),    // Warm peach glow at horizon
    fogColor: new THREE.Color(0xf6cdb2),      // Matches horizon warmth seamlessly
    fogNear: 20,
    fogFar: 180,
    cloudTint: new THREE.Color(0xfffdf7),     // Crisp off-white with faint warm highlight
    cloudOpacity: 0.82,
    cloudEmissive: new THREE.Color(0xffe8d4),
    cloudEmissiveIntensity: 0.85,
    lightColor: new THREE.Color(0xfff3db),    // Warm golden morning sun
    lightIntensity: 1.35,
    lightPosition: [60, 80, 40],
    hemiSky: new THREE.Color(0xf3f8ff),
    hemiGround: new THREE.Color(0x526071),
    hemiIntensity: 0.65,
    ambientColor: new THREE.Color(0xfff6ea),
    ambientIntensity: 0.45,
    exposure: 1.05,
    moonOpacity: 0.0,
    starsOpacity: 0.0,
    windowGlow: 0.0,
  },
  evening: {
    name: 'Evening',
    skyTop: new THREE.Color(0x2c2048),        // Deep dusky violet
    skyMiddle: new THREE.Color(0xa84860),     // Warm coral / magenta
    skyHorizon: new THREE.Color(0xe87834),    // Glowing peach / orange sunset
    fogColor: new THREE.Color(0xc46332),      // Warm dusk fog matching horizon
    fogNear: 20,
    fogFar: 170,
    cloudTint: new THREE.Color(0xffc89c),     // Warm peach / apricot clouds
    cloudOpacity: 0.88,
    cloudEmissive: new THREE.Color(0xff7826),
    cloudEmissiveIntensity: 1.15,
    lightColor: new THREE.Color(0xff7a30),    // Low golden-hour directional light
    lightIntensity: 1.15,
    lightPosition: [50, 45, 30],
    hemiSky: new THREE.Color(0x4a3a60),
    hemiGround: new THREE.Color(0xff8a45),
    hemiIntensity: 0.70,
    ambientColor: new THREE.Color(0xff9655),
    ambientIntensity: 0.50,
    exposure: 1.0,
    moonOpacity: 0.0,
    starsOpacity: 0.0,
    windowGlow: 0.85,
  },
  night: {
    name: 'Night',
    skyTop: new THREE.Color(0x040713),        // Deep midnight navy
    skyMiddle: new THREE.Color(0x0c162c),     // Dark indigo blue
    skyHorizon: new THREE.Color(0x192744),    // Twilight navy horizon
    fogColor: new THREE.Color(0x131e33),      // Deep cool night mist
    fogNear: 15,
    fogFar: 155,
    cloudTint: new THREE.Color(0x8ca6c8),     // Stylized cool blue-grey clouds
    cloudOpacity: 0.70,
    cloudEmissive: new THREE.Color(0x304870), // Crisp cool moonlit cloud glow
    cloudEmissiveIntensity: 0.85,
    lightColor: new THREE.Color(0xb8d4f8),    // Cool luminous moonlight
    lightIntensity: 0.85,                     // Illuminates street and building facades
    lightPosition: [40, 80, 45],              // In front & high, lighting facades directly
    hemiSky: new THREE.Color(0x3d5a82),
    hemiGround: new THREE.Color(0x1f2e42),
    hemiIntensity: 0.65,
    ambientColor: new THREE.Color(0x48648c),
    ambientIntensity: 0.65,                   // Luminous night ambient
    exposure: 1.15,
    moonOpacity: 1.0,
    starsOpacity: 1.0,
    windowGlow: 1.0,
  },
};

/**
 * Returns default mode based on visitor's local hour:
 * - 06:00 - 17:00: Morning
 * - 17:00 - 20:30: Evening
 * - 20:30 - 06:00: Night
 */
export function getLocalTimeDefaultMode(): SkyMode {
  if (typeof window === 'undefined') return 'morning';
  const now = new Date();
  const timeVal = now.getHours() + now.getMinutes() / 60;
  if (timeVal >= 6.0 && timeVal < 17.0) {
    return 'morning';
  } else if (timeVal >= 17.0 && timeVal < 20.5) {
    return 'evening';
  } else {
    return 'night';
  }
}
