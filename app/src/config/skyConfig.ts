import * as THREE from 'three';

export interface SkyAtmosphereTheme {
  skyHorizon: THREE.Color;
  skyZenith: THREE.Color;
  fog: THREE.Color;
  hemiSky: THREE.Color;
  hemiGround: THREE.Color;
  ambient: THREE.Color;
  sun: THREE.Color;
  sunIntensity: number;
  sunPosition: [number, number, number];
  windowGlow: number;
  cloudTint: THREE.Color;
}

export const SKY_CONFIG = {
  // Day atmosphere: warm peach at horizon, soft blue at zenith, soft sun glow
  day: {
    skyHorizon: new THREE.Color(0xf5c6a0),   // Warm peach near horizon
    skyZenith: new THREE.Color(0x7bb5df),    // Soft serene blue at zenith
    fog: new THREE.Color(0xf0cdb0),          // Seamless match to horizon warmth
    hemiSky: new THREE.Color(0xf3f8ff),
    hemiGround: new THREE.Color(0x4a5568),
    ambient: new THREE.Color(0xfff5e6),
    sun: new THREE.Color(0xfff1d6),
    sunIntensity: 1.35,
    sunPosition: [60, 80, 40] as [number, number, number],
    windowGlow: 0.0,
    cloudTint: new THREE.Color(0xfff8f2),    // Off-white with faint warm peach highlight
  },
  // Evening atmosphere
  goldenEvening: {
    skyHorizon: new THREE.Color(0x4a2040),   // Dusky mauve
    skyZenith: new THREE.Color(0x0d0a1a),    // Deep night indigo
    fog: new THREE.Color(0x3a1830),          // Match evening horizon
    hemiSky: new THREE.Color(0x3a334f),
    hemiGround: new THREE.Color(0xff9e6d),
    ambient: new THREE.Color(0xff9e6d),
    sun: new THREE.Color(0xff8345),
    sunIntensity: 1.05,
    sunPosition: [40, 45, 30] as [number, number, number],
    windowGlow: 1.0,
    cloudTint: new THREE.Color(0xfce5d4),    // Soft warm peach-cream
  },
  // Cloud layers & sprite counts
  clouds: {
    desktopCount: 48,                        // ~48 sprites total on desktop
    mobileCount: 18,                         // 18 sprites on mobile / low quality
    nearLayer: { yRange: [48, 64] as [number, number], zRange: [15, 60] as [number, number], scaleRange: [22, 34] as [number, number] },
    midLayer:  { yRange: [36, 48] as [number, number], zRange: [-15, 25] as [number, number], scaleRange: [16, 26] as [number, number] },
    farLayer:  { yRange: [26, 38] as [number, number], zRange: [-75, -20] as [number, number], scaleRange: [12, 20] as [number, number] },
    cullAltitude: 14.0,                      // Completely disable clouds when camera Y < 14
    driftSpeedRange: [0.015, 0.035] as [number, number],
  },
  // Camera descent settings
  descent: {
    startFov: 45,
    maxFov: 50,                              // Widens slightly during cloud plunge
    streetFov: 45,
    mistCloudMinY: 28,                       // Mist builds between Y=28 and Y=56
    mistCloudMaxY: 56,
  },
};
