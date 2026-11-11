import React, { useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { useAppStore } from '../../store/useAppStore';
import { materials } from '../../utils/proceduralTextures';

// Theme configuration matching vanilla implementation exactly
const THEME_PRESETS = {
  day: {
    bg: new THREE.Color(0xdbe3ea),
    fog: new THREE.Color(0xdbe3ea),
    hemiSky: new THREE.Color(0xf3f8ff),
    hemiGround: new THREE.Color(0x4a5568),
    ambient: new THREE.Color(0xfff5e6),
    sun: new THREE.Color(0xfff1d6),
    sunIntensity: 1.35,
    windowGlow: 0.0,
  },
  goldenEvening: {
    bg: new THREE.Color(0x231d33),
    fog: new THREE.Color(0x231d33),
    hemiSky: new THREE.Color(0x3a334f),
    hemiGround: new THREE.Color(0xff9e6d),
    ambient: new THREE.Color(0xff9e6d),
    sun: new THREE.Color(0xff8345),
    sunIntensity: 1.05,
    windowGlow: 1.0,
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

  // Generate 24 clouds matching vanilla distribution
  const clouds = useMemo<CloudInstance[]>(() => {
    // Seeded-style pseudo-random distribution
    let seed = 42;
    const rnd = () => {
      seed = (seed * 9301 + 49297) % 233280;
      return seed / 233280;
    };

    const cloudData: CloudInstance[] = [];
    for (let i = 0; i < 24; i++) {
      let cx = -120 + rnd() * 240;
      if (Math.abs(cx) < 45) cx += Math.sign(cx) * 45;
      let cy = 35 + rnd() * 50;
      if (cy > 55 && cy < 75) cy += 20;
      const cz = -38 + (rnd() - 0.5) * 60;
      const scale = 0.85 + rnd() * 1.25;

      const puffs = [];
      for (let j = 0; j < 6; j++) {
        puffs.push({
          pos: [
            (rnd() - 0.5) * 3.5,
            (rnd() - 0.5) * 1.5,
            (rnd() - 0.5) * 2.5,
          ] as [number, number, number],
          scale: [
            1.5 + rnd() * 2.5,
            (1.5 + rnd() * 2.5) * 0.6,
            1.5 + rnd() * 2.5,
          ] as [number, number, number],
        });
      }

      cloudData.push({
        id: i,
        initialPos: [cx, cy, cz],
        scale,
        speed: 0.015 + rnd() * 0.02,
        puffs,
      });
    }
    return cloudData;
  }, []);

  const puffGeom = useMemo(() => new THREE.SphereGeometry(1, 16, 16), []);
  const cloudMat = useMemo(
    () => new THREE.MeshLambertMaterial({ color: 0xffffff, transparent: true, opacity: 0.85 }),
    []
  );

  // Animation frame loop: Smooth theme interpolation and cloud drifting
  useFrame(({ clock }) => {
    const elapsed = clock.getElapsedTime();
    const target = isGoldenEvening ? THEME_PRESETS.goldenEvening : THEME_PRESETS.day;

    // Smooth lerp scene background & fog (rate: 0.015)
    if (scene.background instanceof THREE.Color) {
      scene.background.lerp(target.bg, 0.015);
    }
    if (scene.fog) {
      scene.fog.color.lerp(target.fog, 0.015);
    }

    // Smooth lerp hemisphere light
    if (hemiRef.current) {
      hemiRef.current.color.lerp(target.hemiSky, 0.015);
      hemiRef.current.groundColor.lerp(target.hemiGround, 0.015);
    }

    // Smooth lerp ambient light
    if (ambientRef.current) {
      ambientRef.current.color.lerp(target.ambient, 0.015);
    }

    // Smooth lerp directional sun light
    if (sunLightRef.current) {
      sunLightRef.current.color.lerp(target.sun, 0.015);
      sunLightRef.current.intensity += (target.sunIntensity - sunLightRef.current.intensity) * 0.015;
    }

    // Smooth lerp window emissive glow
    materials.upperWindow.emissiveIntensity +=
      (target.windowGlow - materials.upperWindow.emissiveIntensity) * 0.015;
    materials.storefrontWindow.emissiveIntensity +=
      (target.windowGlow - materials.storefrontWindow.emissiveIntensity) * 0.015;

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
      {/* Background color and depth fog */}
      <color attach="background" args={[0xdbe3ea]} />
      <fog attach="fog" args={[0xdbe3ea, 20, 180]} />

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

