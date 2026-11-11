import React, { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame, useThree } from '@react-three/fiber';
import { useAppStore } from '../../store/useAppStore';

// ─── Colour palettes ────────────────────────────────────────────────────────
const SKIN_TONES = [0xf5d0b5, 0xe0ac8b, 0xc6865c, 0x8d5534, 0xf7dcc4, 0xd4a87c];
const COAT_COLORS = [
  0x1e293b, 0x991b1b, 0x0f766e, 0xd97706, 0x3730a3,
  0x4b5563, 0xbe185d, 0x166534, 0x2563eb, 0x7c2d12,
  0x6d28d9, 0x0e7490, 0xb45309,
];
const PANTS_COLORS = [0x1e242b, 0x2b394a, 0x4b3f35, 0x334155, 0x18181b, 0x292524];
const HAIR_COLORS = [0x1a1615, 0x4a3222, 0x8c5a32, 0xd4a359, 0x2c221e, 0x78350f];
const ACCESSORY_COLORS = [0x27272a, 0x7f1d1d, 0x1e3a5f, 0x3f6212, 0x581c87];

// ─── Sidewalk lane definitions (Z-coordinate bands) ─────────────────────────
//  Back sidewalk  (behind buildings): z ≈ -8.0 to -10.0
//  Front promenade (camera side):     z ≈  7.0 to  10.0
interface LaneDef {
  zCenter: number;
  zSpread: number;     // ± random offset within lane
  xMin: number;
  xMax: number;
  faceDir: 1 | -1;    // base walking direction along X
}

const SIDEWALK_LANES: LaneDef[] = [
  // Back sidewalk — two sub-lanes
  { zCenter: -8.3, zSpread: 0.6, xMin: -90, xMax: 90, faceDir: 1 },
  { zCenter: -9.6, zSpread: 0.5, xMin: -90, xMax: 90, faceDir: -1 },
  // Front promenade — two sub-lanes
  { zCenter: 7.8, zSpread: 0.5, xMin: -88, xMax: 88, faceDir: -1 },
  { zCenter: 9.2, zSpread: 0.6, xMin: -88, xMax: 88, faceDir: 1 },
];

// ─── Pedestrian behaviour states ────────────────────────────────────────────
type PedState = 'walking' | 'pausing' | 'turning';

interface PedRuntime {
  // Position & orientation
  x: number;
  z: number;
  yaw: number;          // current facing angle (radians, around Y)
  targetYaw: number;    // where we want to face

  // Movement
  dir: 1 | -1;          // +1 = positive-X, -1 = negative-X
  speed: number;        // world-units per frame (~60 fps)
  speedMult: number;    // personal speed multiplier (0.8–1.2)

  // Lane assignment
  lane: LaneDef;

  // Appearance
  skin: number;
  coat: number;
  pants: number;
  hair: number;
  accessoryColor: number;
  hasBackpack: boolean;
  hasHat: boolean;
  scale: number;        // height variation (0.88–1.12)

  // Walk-cycle animation
  animPhase: number;    // current accumulated phase
  animSpeed: number;    // walk cycle radians-per-second (matched to speed)

  // Behaviour state machine
  state: PedState;
  stateTimer: number;   // countdown in seconds

  // Pair-walking
  pairPartner: number | null;   // index of partner pedestrian, or null
  pairOffset: number;            // lateral Z offset from partner

  // LOD
  visible: boolean;
}

// ─── Deterministic seeded PRNG (simple mulberry32) ──────────────────────────
function mulberry32(a: number): () => number {
  return () => {
    let t = (a += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ─── Minimum spacing between any two pedestrians ────────────────────────────
const MIN_SPACING = 2.8;          // world units
const HOST_CLEARANCE = 3.2;       // avoid Aditya's avatar

// ─── Create initial pedestrian state ────────────────────────────────────────
function createPedestrians(count: number): PedRuntime[] {
  const rng = mulberry32(42);
  const peds: PedRuntime[] = [];

  for (let i = 0; i < count; i++) {
    const lane = SIDEWALK_LANES[i % SIDEWALK_LANES.length];
    const speedMult = 0.8 + rng() * 0.4;                   // 0.8x – 1.2x
    const baseSpeed = 0.035;                                 // tuned walk
    const speed = baseSpeed * speedMult;

    // Walk-cycle angular speed: one full cycle ≈ 2 steps ≈ ~1.4 world units
    // so animSpeed = speed * (2π / strideLength)
    const strideLength = 1.4;
    const animSpeed = speed * (2 * Math.PI / strideLength) * 60; // per-second

    const dir = (i % 2 === 0 ? lane.faceDir : (-lane.faceDir as 1 | -1)) as 1 | -1;
    const x = lane.xMin + rng() * (lane.xMax - lane.xMin);
    const z = lane.zCenter + (rng() - 0.5) * 2 * lane.zSpread;

    const shouldPause = rng() < 0.18;                       // ~18 % start pausing

    peds.push({
      x,
      z,
      yaw: dir > 0 ? Math.PI / 2 : -Math.PI / 2,
      targetYaw: dir > 0 ? Math.PI / 2 : -Math.PI / 2,
      dir,
      speed,
      speedMult,
      lane,
      skin: SKIN_TONES[Math.floor(rng() * SKIN_TONES.length)],
      coat: COAT_COLORS[Math.floor(rng() * COAT_COLORS.length)],
      pants: PANTS_COLORS[Math.floor(rng() * PANTS_COLORS.length)],
      hair: HAIR_COLORS[Math.floor(rng() * HAIR_COLORS.length)],
      accessoryColor: ACCESSORY_COLORS[Math.floor(rng() * ACCESSORY_COLORS.length)],
      hasBackpack: rng() < 0.3,
      hasHat: rng() < 0.2,
      scale: 0.88 + rng() * 0.24,
      animPhase: rng() * Math.PI * 2,                       // random start offset
      animSpeed,
      state: shouldPause ? 'pausing' : 'walking',
      stateTimer: shouldPause ? 2 + rng() * 2 : 8 + rng() * 12,
      pairPartner: null,
      pairOffset: 0,
      visible: true,
    });
  }

  // ─── Assign pairs (some walk side-by-side) ────────────────────────────
  const pairChance = 0.22;
  for (let i = 0; i < peds.length - 1; i += 2) {
    if (rng() < pairChance && peds[i].lane === peds[i + 1].lane) {
      // Only pair people on the same lane
      peds[i].pairPartner = i + 1;
      peds[i + 1].pairPartner = i;
      peds[i + 1].pairOffset = 0.55;
      peds[i].pairOffset = -0.55;
      // Sync direction and speed
      peds[i + 1].dir = peds[i].dir;
      peds[i + 1].speed = peds[i].speed;
      peds[i + 1].speedMult = peds[i].speedMult;
      peds[i + 1].animSpeed = peds[i].animSpeed;
      peds[i + 1].x = peds[i].x;
      peds[i + 1].targetYaw = peds[i].targetYaw;
      peds[i + 1].yaw = peds[i].yaw;
    }
  }

  return peds;
}

// ─── Shared geometries (created once) ───────────────────────────────────────
const GEO = {
  torso: new THREE.BoxGeometry(0.5, 0.72, 0.3),
  head: new THREE.SphereGeometry(0.19, 16, 16),
  hair: new THREE.SphereGeometry(0.2, 16, 14, 0, Math.PI * 2, 0, Math.PI * 0.6),
  hat: new THREE.CylinderGeometry(0.22, 0.24, 0.12, 12),
  hatBrim: new THREE.CylinderGeometry(0.32, 0.32, 0.025, 12),
  upperArm: new THREE.CylinderGeometry(0.08, 0.07, 0.36, 8),
  forearm: new THREE.CylinderGeometry(0.07, 0.06, 0.32, 8),
  hand: new THREE.SphereGeometry(0.06, 8, 8),
  upperLeg: new THREE.CylinderGeometry(0.1, 0.085, 0.42, 10),
  lowerLeg: new THREE.CylinderGeometry(0.085, 0.075, 0.38, 10),
  shoe: new THREE.BoxGeometry(0.16, 0.1, 0.28),
  backpack: new THREE.BoxGeometry(0.34, 0.44, 0.18),
  shadow: new THREE.PlaneGeometry(0.7, 0.7),
};

// ─── Contact-shadow material (shared, transparent disc) ─────────────────────
const shadowMat = new THREE.MeshBasicMaterial({
  color: 0x000000,
  transparent: true,
  opacity: 0.18,
  depthWrite: false,
});

// ═════════════════════════════════════════════════════════════════════════════
//  COMPONENT
// ═════════════════════════════════════════════════════════════════════════════

const TOTAL_PEDESTRIANS = 20;

export const PedestrianGroup: React.FC = () => {
  const { camera } = useThree();
  const scrollProgress = useAppStore((s) => s.scrollProgress);
  const isLowPerformanceMode = useAppStore((s) => s.isLowPerformanceMode);

  // ─── Refs for every pedestrian body part ────────────────────────────
  const rootRefs = useRef<(THREE.Group | null)[]>([]);
  const leftUpperArmRefs = useRef<(THREE.Group | null)[]>([]);
  const rightUpperArmRefs = useRef<(THREE.Group | null)[]>([]);
  const leftForearmRefs = useRef<(THREE.Group | null)[]>([]);
  const rightForearmRefs = useRef<(THREE.Group | null)[]>([]);
  const leftUpperLegRefs = useRef<(THREE.Group | null)[]>([]);
  const rightUpperLegRefs = useRef<(THREE.Group | null)[]>([]);
  const leftLowerLegRefs = useRef<(THREE.Group | null)[]>([]);
  const rightLowerLegRefs = useRef<(THREE.Group | null)[]>([]);
  const headRefs = useRef<(THREE.Group | null)[]>([]);
  const torsoRefs = useRef<(THREE.Mesh | null)[]>([]);
  const hipRefs = useRef<(THREE.Group | null)[]>([]);
  const shadowRefs = useRef<(THREE.Mesh | null)[]>([]);

  // ─── Pedestrian mutable runtime state ───────────────────────────────
  const pedsRef = useRef<PedRuntime[]>(createPedestrians(TOTAL_PEDESTRIANS));

  // ─── Pre-build materials per pedestrian (stable, no allocations per frame)
  const materials = useMemo(() => {
    return pedsRef.current.map((p) => ({
      skin: new THREE.MeshStandardMaterial({ color: p.skin, roughness: 0.62 }),
      coat: new THREE.MeshStandardMaterial({ color: p.coat, roughness: 0.72 }),
      pants: new THREE.MeshStandardMaterial({ color: p.pants, roughness: 0.78 }),
      hair: new THREE.MeshStandardMaterial({ color: p.hair, roughness: 0.68 }),
      shoe: new THREE.MeshStandardMaterial({ color: 0x1c1917, roughness: 0.55 }),
      accessory: new THREE.MeshStandardMaterial({ color: p.accessoryColor, roughness: 0.7 }),
    }));
  }, []);

  // ─── Host character position for collision avoidance ────────────────
  const hostPosRef = useRef<THREE.Vector3>(new THREE.Vector3(-46, 0, 8.2));

  // ═══ ANIMATION FRAME ══════════════════════════════════════════════════
  useFrame((_, delta) => {
    const peds = pedsRef.current;
    const clampedDelta = Math.min(delta, 0.05); // cap delta to prevent jumps

    // ─── Determine LOD: how many pedestrians to show ──────────────
    const maxVisible = isLowPerformanceMode
      ? 6
      : scrollProgress < 0.12
        ? 4                // camera is far up in the sky
        : TOTAL_PEDESTRIANS;

    // ─── Estimate host character position from scroll progress ────
    if (scrollProgress > 0.88) {
      hostPosRef.current.set(-7, 0.14, 22.5);
    } else if (scrollProgress < 0.16) {
      hostPosRef.current.set(-48, 0.14, 7.8);
    } else {
      const t = (scrollProgress - 0.16) / 0.72;
      hostPosRef.current.set(-52 + t * 104, 0.14, 7.8);
    }

    for (let idx = 0; idx < peds.length; idx++) {
      const p = peds[idx];
      const root = rootRefs.current[idx];
      if (!root) continue;

      // ─── LOD visibility ───────────────────────────────────────
      p.visible = idx < maxVisible;
      root.visible = p.visible;
      if (!p.visible) continue;

      // ─── State machine ────────────────────────────────────────
      p.stateTimer -= clampedDelta;

      if (p.state === 'pausing') {
        // Idle: very gentle breathing sway, no leg/arm swing
        if (p.stateTimer <= 0) {
          p.state = 'walking';
          p.stateTimer = 8 + Math.random() * 14;
        }
      } else if (p.state === 'turning') {
        // Smoothly rotate to targetYaw
        let diff = p.targetYaw - p.yaw;
        while (diff > Math.PI) diff -= Math.PI * 2;
        while (diff < -Math.PI) diff += Math.PI * 2;
        p.yaw += diff * 4.0 * clampedDelta;

        if (Math.abs(diff) < 0.08) {
          p.yaw = p.targetYaw;
          p.state = 'walking';
          p.stateTimer = 8 + Math.random() * 14;
        }
      } else {
        // ─── WALKING ───────────────────────────────────────────
        const moveX = p.speed * p.dir * 60 * clampedDelta;
        p.x += moveX;

        // Advance animation phase, matched to movement speed
        p.animPhase += p.animSpeed * clampedDelta;

        // ─── Boundary: smooth turn at lane ends ─────────────────
        const nearEnd =
          (p.dir > 0 && p.x > p.lane.xMax - 2) ||
          (p.dir < 0 && p.x < p.lane.xMin + 2);

        if (nearEnd) {
          p.dir = (p.dir * -1) as 1 | -1;
          p.targetYaw = p.dir > 0 ? Math.PI / 2 : -Math.PI / 2;
          p.state = 'turning';
          p.stateTimer = 0;

          // Sync paired partner
          if (p.pairPartner !== null) {
            const partner = peds[p.pairPartner];
            partner.dir = p.dir;
            partner.targetYaw = p.targetYaw;
            partner.state = 'turning';
            partner.stateTimer = 0;
          }
        }

        // ─── Random pause chance ──────────────────────────────
        if (p.stateTimer <= 0 && Math.random() < 0.005) {
          p.state = 'pausing';
          p.stateTimer = 2 + Math.random() * 2.5;

          // Paired partner also pauses
          if (p.pairPartner !== null) {
            const partner = peds[p.pairPartner];
            partner.state = 'pausing';
            partner.stateTimer = p.stateTimer;
          }
        }
      }

      // ─── Smooth yaw interpolation (always, for all states) ──
      {
        let diff = p.targetYaw - p.yaw;
        while (diff > Math.PI) diff -= Math.PI * 2;
        while (diff < -Math.PI) diff += Math.PI * 2;
        p.yaw += diff * 3.5 * clampedDelta;
      }

      // ─── Pair offset ──────────────────────────────────────────
      let zFinal = p.z;
      if (p.pairPartner !== null) {
        zFinal = p.z + p.pairOffset;
      }

      // ─── Collision avoidance (simple pairwise spacing) ────────
      for (let j = 0; j < peds.length; j++) {
        if (j === idx || !peds[j].visible) continue;
        if (j === p.pairPartner) continue; // don't avoid your partner
        const dx = p.x - peds[j].x;
        const dz = zFinal - peds[j].z;
        const dist = Math.sqrt(dx * dx + dz * dz);
        if (dist < MIN_SPACING && dist > 0.01) {
          // Push apart along x primarily
          const pushStrength = (MIN_SPACING - dist) * 0.3 * clampedDelta * 60;
          p.x += (dx / dist) * pushStrength;
        }
      }

      // ─── Avoid host character ──────────────────────────────────
      {
        const dx = p.x - hostPosRef.current.x;
        const dz = zFinal - hostPosRef.current.z;
        const dist = Math.sqrt(dx * dx + dz * dz);
        if (dist < HOST_CLEARANCE && dist > 0.01) {
          const pushStrength = (HOST_CLEARANCE - dist) * 0.5 * clampedDelta * 60;
          p.x += (dx / dist) * pushStrength;
        }
      }

      // ─── Clamp to lane bounds ─────────────────────────────────
      p.x = Math.max(p.lane.xMin, Math.min(p.lane.xMax, p.x));

      // ─── Apply root position & rotation ────────────────────────
      const walkBlend = p.state === 'walking' ? 1.0 : (p.state === 'turning' ? 0.3 : 0.0);
      const phase = p.animPhase;

      // Vertical bounce (only while walking)
      const bounce = Math.abs(Math.sin(phase)) * 0.04 * walkBlend;
      root.position.set(p.x, 0.06 + bounce, zFinal);
      root.rotation.y = p.yaw;

      // ─── Body part animations ─────────────────────────────────

      // Hip group — slight bob and yaw
      const hipG = hipRefs.current[idx];
      if (hipG) {
        hipG.position.y = 1.02 + Math.abs(Math.sin(phase)) * 0.035 * walkBlend;
        hipG.rotation.y = Math.sin(phase) * 0.06 * walkBlend;
      }

      // Head — gentle look-around when paused, forward when walking
      const headG = headRefs.current[idx];
      if (headG) {
        const headIdle = p.state === 'pausing' ? Math.sin(p.animPhase * 0.3 + idx) * 0.35 : 0;
        headG.rotation.y = headIdle;
        headG.rotation.x = Math.sin(p.animPhase * 0.5 + idx * 2) * 0.04;
      }

      // Leg swing amplitude
      const legAmp = 0.52 * walkBlend;
      const legSwing = Math.sin(phase) * legAmp;
      const oppLegSwing = Math.sin(phase + Math.PI) * legAmp;

      // Upper legs
      const luL = leftUpperLegRefs.current[idx];
      const ruL = rightUpperLegRefs.current[idx];
      if (luL) luL.rotation.x = legSwing;
      if (ruL) ruL.rotation.x = oppLegSwing;

      // Lower legs (knee bend — only bends backward on contact)
      const llL = leftLowerLegRefs.current[idx];
      const rlL = rightLowerLegRefs.current[idx];
      if (llL) llL.rotation.x = Math.max(0, -Math.cos(phase) * 0.5 * walkBlend);
      if (rlL) rlL.rotation.x = Math.max(0, -Math.cos(phase + Math.PI) * 0.5 * walkBlend);

      // Arms — opposite to legs
      const luA = leftUpperArmRefs.current[idx];
      const ruA = rightUpperArmRefs.current[idx];
      if (luA) {
        luA.rotation.x = oppLegSwing * 0.85;
        luA.rotation.z = 0.06;
      }
      if (ruA) {
        ruA.rotation.x = legSwing * 0.85;
        ruA.rotation.z = -0.06;
      }

      // Forearms — slight bend that increases on backswing
      const lfA = leftForearmRefs.current[idx];
      const rfA = rightForearmRefs.current[idx];
      if (lfA) lfA.rotation.x = -0.15 - Math.max(0, Math.sin(phase + Math.PI)) * 0.3 * walkBlend;
      if (rfA) rfA.rotation.x = -0.15 - Math.max(0, Math.sin(phase)) * 0.3 * walkBlend;

      // Contact shadow — scale with distance from camera for subtle LOD
      const shd = shadowRefs.current[idx];
      if (shd) {
        const camDist = camera.position.distanceTo(root.position);
        shd.visible = camDist < 60;
      }
    }
  });

  // ═══ RENDER ════════════════════════════════════════════════════════════
  return (
    <group>
      {pedsRef.current.map((p, idx) => {
        const mat = materials[idx];
        return (
          <group
            key={idx}
            ref={(el) => { rootRefs.current[idx] = el; }}
            position={[p.x, 0.06, p.z]}
            scale={p.scale}
          >
            {/* ── Contact shadow disc ───────────────────────────── */}
            <mesh
              ref={(el) => { shadowRefs.current[idx] = el; }}
              rotation={[-Math.PI / 2, 0, 0]}
              position={[0, 0.015, 0]}
              material={shadowMat}
              geometry={GEO.shadow}
              renderOrder={-1}
            />

            {/* ── Hip / pelvis pivot ───────────────────────────── */}
            <group ref={(el) => { hipRefs.current[idx] = el; }} position={[0, 1.02, 0]}>

              {/* Torso */}
              <mesh
                ref={(el) => { torsoRefs.current[idx] = el; }}
                position={[0, 0.1, 0]}
                material={mat.coat}
                geometry={GEO.torso}
                castShadow
              />

              {/* Head group */}
              <group ref={(el) => { headRefs.current[idx] = el; }} position={[0, 0.62, 0]}>
                <mesh material={mat.skin} geometry={GEO.head} castShadow />
                <mesh position={[0, 0.04, 0]} material={mat.hair} geometry={GEO.hair} />
                {p.hasHat && (
                  <>
                    <mesh position={[0, 0.16, 0]} material={mat.accessory} geometry={GEO.hat} />
                    <mesh position={[0, 0.1, 0]} material={mat.accessory} geometry={GEO.hatBrim} />
                  </>
                )}
              </group>

              {/* Backpack */}
              {p.hasBackpack && (
                <mesh position={[0, 0.12, -0.2]} material={mat.accessory} geometry={GEO.backpack} />
              )}

              {/* ── Left arm ──────────────────────────────────── */}
              <group
                ref={(el) => { leftUpperArmRefs.current[idx] = el; }}
                position={[0.32, 0.38, 0]}
              >
                <mesh position={[0, -0.18, 0]} material={mat.coat} geometry={GEO.upperArm} castShadow />
                <group
                  ref={(el) => { leftForearmRefs.current[idx] = el; }}
                  position={[0, -0.36, 0]}
                >
                  <mesh position={[0, -0.16, 0]} material={mat.coat} geometry={GEO.forearm} />
                  <mesh position={[0, -0.34, 0]} material={mat.skin} geometry={GEO.hand} />
                </group>
              </group>

              {/* ── Right arm ─────────────────────────────────── */}
              <group
                ref={(el) => { rightUpperArmRefs.current[idx] = el; }}
                position={[-0.32, 0.38, 0]}
              >
                <mesh position={[0, -0.18, 0]} material={mat.coat} geometry={GEO.upperArm} castShadow />
                <group
                  ref={(el) => { rightForearmRefs.current[idx] = el; }}
                  position={[0, -0.36, 0]}
                >
                  <mesh position={[0, -0.16, 0]} material={mat.coat} geometry={GEO.forearm} />
                  <mesh position={[0, -0.34, 0]} material={mat.skin} geometry={GEO.hand} />
                </group>
              </group>
            </group>

            {/* ── Left leg ──────────────────────────────────────── */}
            <group
              ref={(el) => { leftUpperLegRefs.current[idx] = el; }}
              position={[0.13, 0.78, 0]}
            >
              <mesh position={[0, -0.21, 0]} material={mat.pants} geometry={GEO.upperLeg} castShadow />
              <group
                ref={(el) => { leftLowerLegRefs.current[idx] = el; }}
                position={[0, -0.42, 0]}
              >
                <mesh position={[0, -0.19, 0]} material={mat.pants} geometry={GEO.lowerLeg} />
                <mesh position={[0, -0.4, 0.03]} material={mat.shoe} geometry={GEO.shoe} />
              </group>
            </group>

            {/* ── Right leg ─────────────────────────────────────── */}
            <group
              ref={(el) => { rightUpperLegRefs.current[idx] = el; }}
              position={[-0.13, 0.78, 0]}
            >
              <mesh position={[0, -0.21, 0]} material={mat.pants} geometry={GEO.upperLeg} castShadow />
              <group
                ref={(el) => { rightLowerLegRefs.current[idx] = el; }}
                position={[0, -0.42, 0]}
              >
                <mesh position={[0, -0.19, 0]} material={mat.pants} geometry={GEO.lowerLeg} />
                <mesh position={[0, -0.4, 0.03]} material={mat.shoe} geometry={GEO.shoe} />
              </group>
            </group>
          </group>
        );
      })}
    </group>
  );
};
