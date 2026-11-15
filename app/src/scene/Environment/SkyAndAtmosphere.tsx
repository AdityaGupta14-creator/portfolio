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

// Theme configuration — now includes gradient sky colors
const THEME_PRESETS = {
  day: {
    skyHorizon: new THREE.Color(0xf5c6a0),   // warm peach
    skyZenith: new THREE.Color(0x87ceeb),     // soft blue
    fog: new THREE.Color(0xf0cdb0),           // match horizon warmth
    hemiSky: new THREE.Color(0xf3f8ff),
    hemiGround: new THREE.Color(0x4a5568),
    ambient: new THREE.Color(0xfff5e6),
    sun: new THREE.Color(0xfff1d6),
    sunIntensity: 1.35,
    windowGlow: 0.0,
    cloudTint: new THREE.Color(0xfff5ea),     // soft warm off-white / peach tint
  },
  goldenEvening: {
    skyHorizon: new THREE.Color(0x4a2040),    // dusky mauve
    skyZenith: new THREE.Color(0x0d0a1a),     // deep night
    fog: new THREE.Color(0x3a1830),           // match evening horizon
    hemiSky: new THREE.Color(0x3a334f),
    hemiGround: new THREE.Color(0xff9e6d),
    ambient: new THREE.Color(0xff9e6d),
    sun: new THREE.Color(0xff8345),
    sunIntensity: 1.05,
    windowGlow: 1.0,
    cloudTint: new THREE.Color(0xfce5d4),     // soft warm peach-cream (NOT red)
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

  // Generate 26 clouds distributed naturally across the upper sky
  const clouds = useMemo<CloudInstance[]>(() => {
    // Seeded-style pseudo-random distribution
    let seed = 42;
    const rnd = () => {
      seed = (seed * 9301 + 49297) % 233280;
      return seed / 233280;
    };

    const cloudData: CloudInstance[] = [];
    for (let i = 0; i < 26; i++) {
      const cx = -140 + rnd() * 280;
      const cy = 36 + rnd() * 44;
      const cz = -35 + (rnd() - 0.5) * 80;
      const scale = 0.95 + rnd() * 1.35;

      const puffs = [];
      for (let j = 0; j < 6; j++) {
        puffs.push({
          pos: [
            (rnd() - 0.5) * 4.0,
            (rnd() - 0.5) * 1.8,
            (rnd() - 0.5) * 3.0,
          ] as [number, number, number],
          scale: [
            1.6 + rnd() * 2.6,
            (1.6 + rnd() * 2.6) * 0.65,
            1.6 + rnd() * 2.6,
          ] as [number, number, number],
        });
      }

      cloudData.push({
        id: i,
        initialPos: [cx, cy, cz],
        scale,
        speed: 0.012 + rnd() * 0.02,
        puffs,
      });
    }
    return cloudData;
  }, []);

  const puffGeom = useMemo(() => new THREE.SphereGeometry(1, 16, 16), []);
  const cloudMat = useMemo(
    () =>
      new THREE.MeshLambertMaterial({
        color: 0xfff5ea,
        transparent: true,
        opacity: 0.85,
        depthWrite: false,
      }),
    []
  );

  // Animation frame loop: Smooth theme interpolation, cloud fading & drifting
  useFrame(({ clock, camera }) => {
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

    // Lerp cloud tint (soft warm off-white in day, soft warm peach-cream in evening)
    cloudMat.color.lerp(target.cloudTint, rate);

    // ── Fade clouds as camera descends from sky through clouds to street level ──
    const camY = camera.position.y;
    // When camY >= 48: full opacity 0.85
    // As camY drops from 48 down to 14: smoothly fade opacity to 0
    const cloudFade = THREE.MathUtils.clamp((camY - 14) / 34, 0.0, 1.0);
    cloudMat.opacity = 0.85 * cloudFade;
    cloudMat.visible = cloudFade > 0.01;

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
      {/* Fog — near color matches horizon for seamless blend */}
      <fog attach="fog" args={[0xf0cdb0, 20, 180]} />

      {/* Sky Dome — large inverted sphere with vertical gradient shader */}
      <mesh material={skyMat} renderOrder={-1000}>
        <sphereGeometry args={[400, 32, 32]} />
      </mesh>

      {/* Hemispherical & Ambient Fill Lighting */}
      <hemisphereLight ref={hemiRef} args={[0xf3f8ff, 0x4a5568, 0.65]} />
      <ambientLight ref={ambientRef} color={0xfff5e6} intensity={0.45} />

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

