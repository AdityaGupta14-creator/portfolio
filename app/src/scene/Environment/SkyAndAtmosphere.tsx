import React, { useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { useAppStore } from '../../store/useAppStore';
import { materials } from '../../utils/proceduralTextures';

// ── Sky gradient shader: vertical blend from horizon to zenith ──────────
const skyVertexShader = /* glsl */ `
  varying vec3 vWorldPosition;
  void main() {
    vec4 worldPos = modelMatrix * vec4(position, 1.0);
    vWorldPosition = worldPos.xyz;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const skyFragmentShader = /* glsl */ `
  uniform vec3 uHorizon;
  uniform vec3 uZenith;
  uniform float uExponent;
  varying vec3 vWorldPosition;
  void main() {
    // Normalize height: 0 at horizon, 1 at top of dome
    float h = normalize(vWorldPosition).y;
    // Remap: below horizon → 0, above → 0..1 with exponent curve
    float t = pow(max(h, 0.0), uExponent);
    vec3 color = mix(uHorizon, uZenith, t);
    gl_FragColor = vec4(color, 1.0);
  }
`;

// Theme configuration — soft peach-lilac fog and warm moderate orange-peach lighting
const THEME_PRESETS = {
  day: {
    skyHorizon: new THREE.Color(0xf5d9c2),   // warm soft peach
    skyZenith: new THREE.Color(0x7ebbdb),     // soft blue
    fog: new THREE.Color(0xdfc9d8),           // soft peach-lilac fog
    hemiSky: new THREE.Color(0xf3f8ff),
    hemiGround: new THREE.Color(0x6e6863),
    ambient: new THREE.Color(0xfff6ec),
    sun: new THREE.Color(0xfff1d6),
    sunIntensity: 1.4,
    windowGlow: 0.0,
    cloudTint: new THREE.Color(0xfff8f2),     // soft off-white clouds
  },
  goldenEvening: {
    skyHorizon: new THREE.Color(0xe8c8be),    // warm soft peach-lilac horizon
    skyZenith: new THREE.Color(0x384a68),     // soft twilight blue
    fog: new THREE.Color(0xdfc9d8),           // soft peach-lilac fog (no maroon)
    hemiSky: new THREE.Color(0x88a2bf),       // soft dusk sky fill
    hemiGround: new THREE.Color(0x6c645e),    // neutral warm ground reflection
    ambient: new THREE.Color(0xffeccd),       // warm peach-cream ambient (not red)
    sun: new THREE.Color(0xffd5ad),           // warm moderate orange-peach sun (not red)
    sunIntensity: 1.35,
    windowGlow: 1.0,
    cloudTint: new THREE.Color(0xffebd8),     // soft warm peach clouds (no red)
  },
};

// Procedural cloud cluster with 6 spherical puffs
interface CloudInstance {
  id: number;
  initialPos: [number, number, number];
  scale: number;
  speed: number;
  puffs: Array<{
    pos: [number, number, number];
    scale: [number, number, number];
  }>;
}

export const SkyAndAtmosphere: React.FC = () => {
  const isGoldenEvening = useAppStore((s) => s.isGoldenEvening);
  const { scene } = useThree();

  const hemiRef = useRef<THREE.HemisphereLight>(null);
  const ambientRef = useRef<THREE.AmbientLight>(null);
  const sunLightRef = useRef<THREE.DirectionalLight>(null);
  const haloRef = useRef<THREE.Mesh>(null);
  const cloudGroupRefs = useRef<(THREE.Group | null)[]>([]);

  // Sky dome shader material — lerped each frame
  const skyUniforms = useRef({
    uHorizon: { value: THEME_PRESETS.day.skyHorizon.clone() },
    uZenith: { value: THEME_PRESETS.day.skyZenith.clone() },
    uExponent: { value: 0.45 },
  });

  const skyMat = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: skyVertexShader,
        fragmentShader: skyFragmentShader,
        uniforms: skyUniforms.current,
        side: THREE.BackSide,
        depthWrite: false,
      }),
    []
  );

  // Generate 24 clouds matching vanilla distribution
  const clouds = useMemo<CloudInstance[]>(() => {
    // Seeded-style pseudo-random distribution
    let seed = 42;
    const rnd = () => {
      seed = (seed * 9301 + 49297) % 233280;
      return seed / 233280;
    };

    const cloudData: CloudInstance[] = [];
    for (let i = 0; i < 14; i++) {
      let cx = -130 + rnd() * 260;
      if (Math.abs(cx) < 35) cx += Math.sign(cx || 1) * 45;
      const cy = 48 + rnd() * 42;
      const cz = -45 + (rnd() - 0.5) * 50;
      const scale = 1.0 + rnd() * 1.4;

      const puffs = [];
      for (let j = 0; j < 5; j++) {
        const spreadX = (rnd() - 0.5) * 5.0;
        const spreadY = (rnd() - 0.5) * 0.8;
        const spreadZ = (rnd() - 0.5) * 2.0;
        const baseRadius = 2.0 + rnd() * 2.2;
        puffs.push({
          pos: [spreadX, spreadY, spreadZ] as [number, number, number],
          scale: [baseRadius * 1.3, baseRadius * 0.35, baseRadius * 0.75] as [number, number, number],
        });
      }

      cloudData.push({
        id: i,
        initialPos: [cx, cy, cz],
        scale,
        speed: 0.012 + rnd() * 0.018,
        puffs,
      });
    }
    return cloudData;
  }, []);

  const puffGeom = useMemo(() => new THREE.SphereGeometry(1, 16, 16), []);
  const cloudMat = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: 0xfff8f2,
        roughness: 0.95,
        metalness: 0.0,
        transparent: true,
        opacity: 0.55,
        depthWrite: false,
      }),
    []
  );

  // Animation frame loop: Smooth theme interpolation and cloud drifting
  useFrame(({ clock }) => {
    const elapsed = clock.getElapsedTime();
    const target = isGoldenEvening ? THEME_PRESETS.goldenEvening : THEME_PRESETS.day;
    const rate = 0.015;

    // Smooth lerp sky gradient uniforms
    skyUniforms.current.uHorizon.value.lerp(target.skyHorizon, rate);
    skyUniforms.current.uZenith.value.lerp(target.skyZenith, rate);

    // Disable scene.background so the sky dome is visible
    scene.background = null;

    // Smooth lerp fog to match horizon
    if (scene.fog) {
      scene.fog.color.lerp(target.fog, rate);
    }

    // Smooth lerp hemisphere light
    if (hemiRef.current) {
      hemiRef.current.color.lerp(target.hemiSky, rate);
      hemiRef.current.groundColor.lerp(target.hemiGround, rate);
    }

    // Smooth lerp ambient light
    if (ambientRef.current) {
      ambientRef.current.color.lerp(target.ambient, rate);
    }

    // Smooth lerp directional sun light
    if (sunLightRef.current) {
      sunLightRef.current.color.lerp(target.sun, rate);
      sunLightRef.current.intensity += (target.sunIntensity - sunLightRef.current.intensity) * rate;
    }

    // Smooth lerp window emissive glow
    materials.upperWindow.emissiveIntensity +=
      (target.windowGlow - materials.upperWindow.emissiveIntensity) * rate;
    materials.storefrontWindow.emissiveIntensity +=
      (target.windowGlow - materials.storefrontWindow.emissiveIntensity) * rate;

    // Lerp cloud tint
    cloudMat.color.lerp(target.cloudTint, rate);

    // Pulse sun halo breathing animation
    if (haloRef.current) {
      haloRef.current.scale.setScalar(1 + Math.sin(elapsed * 2) * 0.05);
    }

    // Move clouds and wrap around boundaries (-125 to 125)
    cloudGroupRefs.current.forEach((ref, idx) => {
      if (ref) {
        ref.position.x += clouds[idx].speed;
        if (ref.position.x > 125) {
          ref.position.x = -125;
        }
      }
    });
  });

  return (
    <>
      {/* Fog — soft peach-lilac matching horizon warmth */}
      <fog attach="fog" args={[0xdfc9d8, 25, 200]} />

      {/* Sky Dome — large inverted sphere with vertical gradient shader */}
      <mesh material={skyMat} renderOrder={-1000}>
        <sphereGeometry args={[400, 32, 32]} />
      </mesh>

      {/* Hemispherical & Ambient Fill Lighting */}
      <hemisphereLight ref={hemiRef} args={[0xf3f8ff, 0x5a5560, 0.75]} />
      <ambientLight ref={ambientRef} color={0xffeccd} intensity={0.55} />

      {/* Directional Sun with Soft Shadows */}
      <directionalLight
        ref={sunLightRef}
        position={[60, 80, 40]}
        intensity={1.35}
        color={0xfff1d6}
        castShadow
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
        shadow-camera-near={10}
        shadow-camera-far={250}
        shadow-camera-left={-120}
        shadow-camera-right={120}
        shadow-camera-top={120}
        shadow-camera-bottom={-120}
        shadow-bias={-0.0005}
      />

      {/* Balanced Fill Directional Light: Ensures even street lighting across both facing rows */}
      <directionalLight
        position={[-60, 50, -45]}
        intensity={0.65}
        color={0xffeedb}
      />

      {/* Sun Mesh & Additive Corona Halo */}
      <group position={[120, 110, -180]}>
        <mesh>
          <sphereGeometry args={[12, 32, 32]} />
          <meshBasicMaterial color={0xfff4d9} />
        </mesh>
        <mesh ref={haloRef}>
          <sphereGeometry args={[18, 32, 32]} />
          <meshBasicMaterial
            color={0xffe8aa}
            transparent
            opacity={0.15}
            blending={THREE.AdditiveBlending}
          />
        </mesh>
      </group>

      {/* Procedural Clouds */}
      {clouds.map((c, i) => (
        <group
          key={c.id}
          ref={(el) => {
            cloudGroupRefs.current[i] = el;
          }}
          position={c.initialPos}
          scale={c.scale}
        >
          {c.puffs.map((p, pIdx) => (
            <mesh
              key={pIdx}
              geometry={puffGeom}
              material={cloudMat}
              position={p.pos}
              scale={p.scale}
            />
          ))}
        </group>
      ))}
    </>
  );
};

