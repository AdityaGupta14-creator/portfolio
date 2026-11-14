import React, { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame, useThree } from '@react-three/fiber';
import { useGLTF } from '@react-three/drei';
import * as SkeletonUtils from 'three/examples/jsm/utils/SkeletonUtils.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import { useAppStore } from '../../store/useAppStore';
import { PORTFOLIO_CONTENT } from '../../data/content';
import { textures } from '../../utils/proceduralTextures';
import { SpeechBubble } from './SpeechBubble';

// Pre-configure MeshoptDecoder for GLTF loading
useGLTF.preload('/models/characters.opt.glb', true, true, (loader) => {
  loader.setMeshoptDecoder(MeshoptDecoder);
});

// Reusable math vectors to avoid heap allocation in useFrame
const AXIS_X = new THREE.Vector3(1, 0, 0);
const AXIS_Y = new THREE.Vector3(0, 1, 0);
const AXIS_Z = new THREE.Vector3(0, 0, 1);
const TEMP_Q = new THREE.Quaternion();
const TEMP_Q2 = new THREE.Quaternion();

interface AvatarRigProps {
  walkBlendRef: React.MutableRefObject<number>;
  manualWaveBoostRef: React.MutableRefObject<number>;
  isWaving: boolean;
  onWaveClick: () => void;
}

const ProceduralAvatar: React.FC<AvatarRigProps> = ({
  walkBlendRef,
  manualWaveBoostRef,
  isWaving,
  onWaveClick,
}) => {
  const leftLegHipRef = useRef<THREE.Group>(null);
  const rightLegHipRef = useRef<THREE.Group>(null);
  const leftLegKneeRef = useRef<THREE.Group>(null);
  const rightLegKneeRef = useRef<THREE.Group>(null);
  const leftArmShoulderRef = useRef<THREE.Group>(null);
  const leftArmElbowRef = useRef<THREE.Group>(null);
  const rightArmShoulderRef = useRef<THREE.Group>(null);
  const rightArmElbowRef = useRef<THREE.Group>(null);
  const rightArmWristRef = useRef<THREE.Group>(null);
  const hipsRef = useRef<THREE.Group>(null);
  const torsoRef = useRef<THREE.Group>(null);
  const neckRef = useRef<THREE.Group>(null);
  const groundRingRef = useRef<THREE.Mesh>(null);

  // Reusable Materials
  const skinMat = useMemo(
    () => new THREE.MeshStandardMaterial({ color: 0xe5ad8c, roughness: 0.58, metalness: 0.04 }),
    []
  );
  const jacketMat = useMemo(
    () => new THREE.MeshStandardMaterial({ map: textures.denimJacket, roughness: 0.72, metalness: 0.08 }),
    []
  );
  const shirtMat = useMemo(
    () => new THREE.MeshStandardMaterial({ map: textures.coralShirt, roughness: 0.78 }),
    []
  );
  const jeansMat = useMemo(
    () => new THREE.MeshStandardMaterial({ map: textures.jeans, roughness: 0.82 }),
    []
  );
  const bootMat = useMemo(
    () => new THREE.MeshStandardMaterial({ color: 0x1c1e21, roughness: 0.5, metalness: 0.15 }),
    []
  );
  const hairMat = useMemo(
    () => new THREE.MeshStandardMaterial({ color: 0x18181b, roughness: 0.65 }),
    []
  );
  const buttonMat = useMemo(
    () => new THREE.MeshStandardMaterial({ color: 0xe2e8f0, roughness: 0.25, metalness: 0.85 }),
    []
  );

  useFrame(({ clock }) => {
    const elapsed = clock.getElapsedTime();
    const walkBlend = walkBlendRef.current;
    const gaitPhase = elapsed * 8.5;

    // Pulse ground ring
    if (groundRingRef.current) {
      groundRingRef.current.scale.setScalar(1 + Math.sin(elapsed * 3.2) * 0.08);
    }

    const legSwing = Math.sin(gaitPhase) * 0.55 * walkBlend;
    const oppLegSwing = Math.sin(gaitPhase + Math.PI) * 0.55 * walkBlend;

    // Legs animation
    if (leftLegHipRef.current) leftLegHipRef.current.rotation.x = legSwing;
    if (rightLegHipRef.current) rightLegHipRef.current.rotation.x = oppLegSwing;
    if (leftLegKneeRef.current)
      leftLegKneeRef.current.rotation.x = Math.max(0, -Math.cos(gaitPhase) * 0.52 * walkBlend);
    if (rightLegKneeRef.current)
      rightLegKneeRef.current.rotation.x = Math.max(0, -Math.cos(gaitPhase + Math.PI) * 0.52 * walkBlend);

    // Hips vertical bob + breathing
    if (hipsRef.current) {
      hipsRef.current.position.y =
        1.02 + Math.abs(Math.sin(gaitPhase)) * 0.045 * walkBlend + Math.sin(elapsed * 2.2) * 0.008;
    }
    if (torsoRef.current) {
      torsoRef.current.rotation.y = Math.sin(gaitPhase) * 0.08 * walkBlend;
    }

    // Left arm walking swing
    if (leftArmShoulderRef.current) {
      leftArmShoulderRef.current.rotation.x = oppLegSwing * 0.75;
      leftArmShoulderRef.current.rotation.z = 0.09;
    }
    if (leftArmElbowRef.current) {
      leftArmElbowRef.current.rotation.x = -0.18 - Math.max(0, oppLegSwing) * 0.35;
    }

    // Right arm waving vs walking
    const shouldWave = isWaving || manualWaveBoostRef.current > 0;
    if (rightArmShoulderRef.current && rightArmElbowRef.current && rightArmWristRef.current) {
      if (shouldWave && walkBlend < 0.35) {
        const waveOsc = Math.sin(elapsed * 6.8) * 0.32;
        rightArmShoulderRef.current.rotation.x = THREE.MathUtils.lerp(
          rightArmShoulderRef.current.rotation.x,
          -0.55,
          0.12
        );
        rightArmShoulderRef.current.rotation.z = THREE.MathUtils.lerp(
          rightArmShoulderRef.current.rotation.z,
          -2.15 + waveOsc,
          0.15
        );
        rightArmElbowRef.current.rotation.x = THREE.MathUtils.lerp(
          rightArmElbowRef.current.rotation.x,
          -0.95,
          0.14
        );
        rightArmWristRef.current.rotation.z = Math.sin(elapsed * 13.5) * 0.25;
      } else {
        rightArmShoulderRef.current.rotation.x = THREE.MathUtils.lerp(
          rightArmShoulderRef.current.rotation.x,
          legSwing * 0.75,
          0.12
        );
        rightArmShoulderRef.current.rotation.z = THREE.MathUtils.lerp(
          rightArmShoulderRef.current.rotation.z,
          -0.09,
          0.12
        );
        rightArmElbowRef.current.rotation.x = THREE.MathUtils.lerp(
          rightArmElbowRef.current.rotation.x,
          -0.18 - Math.max(0, legSwing) * 0.35,
          0.12
        );
        rightArmWristRef.current.rotation.z = 0;
      }
    }

    if (neckRef.current) {
      neckRef.current.rotation.y = Math.sin(elapsed * 1.3) * 0.12 * (1 - walkBlend);
      neckRef.current.rotation.x = Math.sin(elapsed * 2.4) * 0.04;
    }
  });

  return (
    <group
      onClick={(e) => {
        e.stopPropagation();
        onWaveClick();
      }}
      onPointerOver={(e) => {
        e.stopPropagation();
        document.body.style.cursor = 'pointer';
      }}
      onPointerOut={() => {
        document.body.style.cursor = 'default';
      }}
    >
      {/* Ground Contact Glow Ring */}
      <mesh ref={groundRingRef} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.03, 0]}>
        <ringGeometry args={[0.62, 0.78, 32]} />
        <meshBasicMaterial color={0xfbbf24} side={THREE.DoubleSide} transparent opacity={0.55} />
      </mesh>

      {/* Pelvis & Hips */}
      <group ref={hipsRef} position={[0, 1.02, 0]}>
        <mesh material={jeansMat} castShadow>
          <boxGeometry args={[0.46, 0.2, 0.27]} />
        </mesh>
        <mesh position={[0, 0.04, 0.14]} rotation={[Math.PI / 2, 0, 0]} material={buttonMat}>
          <cylinderGeometry args={[0.022, 0.022, 0.02, 10]} />
        </mesh>

        {/* Torso & Denim Jacket */}
        <group ref={torsoRef} position={[0, 0.1, 0]}>
          <mesh position={[0, 0.34, 0]} material={shirtMat} castShadow>
            <boxGeometry args={[0.42, 0.66, 0.24]} />
          </mesh>
          <mesh position={[0, 0.35, -0.07]} material={jacketMat} castShadow>
            <boxGeometry args={[0.5, 0.68, 0.14]} />
          </mesh>
          <mesh position={[0.16, 0.35, 0.01]} material={jacketMat} castShadow>
            <boxGeometry args={[0.18, 0.68, 0.28]} />
          </mesh>
          <mesh position={[-0.16, 0.35, 0.01]} material={jacketMat} castShadow>
            <boxGeometry args={[0.18, 0.68, 0.28]} />
          </mesh>
          <mesh position={[0, 0.65, 0]} material={jacketMat} castShadow>
            <boxGeometry args={[0.54, 0.12, 0.29]} />
          </mesh>

          {/* Neck & Head */}
          <group ref={neckRef} position={[0, 0.72, 0]}>
            <mesh position={[0, 0.05, 0]} material={skinMat}>
              <cylinderGeometry args={[0.075, 0.085, 0.14, 14]} />
            </mesh>
            <mesh position={[0, 0.24, 0]} scale={[0.92, 1.08, 0.95]} material={skinMat} castShadow>
              <sphereGeometry args={[0.195, 24, 24]} />
            </mesh>
            <mesh
              position={[0, 0.26, -0.01]}
              scale={[0.94, 1.08, 0.98]}
              rotation={[-0.12, 0, 0]}
              material={hairMat}
            >
              <sphereGeometry args={[0.205, 20, 18, 0, Math.PI * 2, 0, Math.PI * 0.58]} />
            </mesh>
            <mesh position={[0.01, 0.42, 0.09]} rotation={[-0.22, 0, -0.06]} material={hairMat}>
              <boxGeometry args={[0.27, 0.09, 0.16]} />
            </mesh>
          </group>

          {/* Left Articulated Arm */}
          <group ref={leftArmShoulderRef} position={[0.31, 0.62, 0]}>
            <mesh position={[0, -0.17, 0]} material={jacketMat} castShadow>
              <cylinderGeometry args={[0.075, 0.066, 0.34, 12]} />
            </mesh>
            <group ref={leftArmElbowRef} position={[0, -0.34, 0]}>
              <mesh position={[0, -0.15, 0]} material={jacketMat} castShadow>
                <cylinderGeometry args={[0.064, 0.054, 0.3, 12]} />
              </mesh>
              <mesh position={[0, -0.36, 0]} material={skinMat}>
                <boxGeometry args={[0.065, 0.095, 0.035]} />
              </mesh>
            </group>
          </group>

          {/* Right Articulated Arm */}
          <group ref={rightArmShoulderRef} position={[-0.31, 0.62, 0]}>
            <mesh position={[0, -0.17, 0]} material={jacketMat} castShadow>
              <cylinderGeometry args={[0.075, 0.066, 0.34, 12]} />
            </mesh>
            <group ref={rightArmElbowRef} position={[0, -0.34, 0]}>
              <mesh position={[0, -0.15, 0]} material={jacketMat} castShadow>
                <cylinderGeometry args={[0.064, 0.054, 0.3, 12]} />
              </mesh>
              <group ref={rightArmWristRef} position={[0, -0.33, 0]}>
                <mesh position={[0, -0.03, 0]} material={skinMat}>
                  <boxGeometry args={[0.065, 0.095, 0.035]} />
                </mesh>
              </group>
            </group>
          </group>
        </group>

        {/* Articulated Legs */}
        <group ref={leftLegHipRef} position={[0.135, -0.04, 0]}>
          <mesh position={[0, -0.23, 0]} material={jeansMat} castShadow>
            <cylinderGeometry args={[0.098, 0.082, 0.46, 14]} />
          </mesh>
          <group ref={leftLegKneeRef} position={[0, -0.46, 0]}>
            <mesh position={[0, -0.22, 0]} material={jeansMat} castShadow>
              <cylinderGeometry args={[0.08, 0.07, 0.44, 14]} />
            </mesh>
            <mesh position={[0, -0.43, 0.035]} material={bootMat} castShadow>
              <boxGeometry args={[0.135, 0.13, 0.24]} />
            </mesh>
          </group>
        </group>

        <group ref={rightLegHipRef} position={[-0.135, -0.04, 0]}>
          <mesh position={[0, -0.23, 0]} material={jeansMat} castShadow>
            <cylinderGeometry args={[0.098, 0.082, 0.46, 14]} />
          </mesh>
          <group ref={rightLegKneeRef} position={[0, -0.46, 0]}>
            <mesh position={[0, -0.22, 0]} material={jeansMat} castShadow>
              <cylinderGeometry args={[0.08, 0.07, 0.44, 14]} />
            </mesh>
            <mesh position={[0, -0.43, 0.035]} material={bootMat} castShadow>
              <boxGeometry args={[0.135, 0.13, 0.24]} />
            </mesh>
          </group>
        </group>
      </group>
    </group>
  );
};

interface HostRigBones {
  thighL: THREE.Bone | null;
  thighR: THREE.Bone | null;
  shinL: THREE.Bone | null;
  shinR: THREE.Bone | null;
  footL: THREE.Bone | null;
  footR: THREE.Bone | null;
  upperArmL: THREE.Bone | null;
  upperArmR: THREE.Bone | null;
  forearmL: THREE.Bone | null;
  forearmR: THREE.Bone | null;
  handR: THREE.Bone | null;
  spine: THREE.Bone | null;
  spineUpper: THREE.Bone | null;
}

interface HostRestQuats {
  thighL: THREE.Quaternion;
  thighR: THREE.Quaternion;
  shinL: THREE.Quaternion;
  shinR: THREE.Quaternion;
  footL: THREE.Quaternion;
  footR: THREE.Quaternion;
  upperArmL: THREE.Quaternion;
  upperArmR: THREE.Quaternion;
  forearmL: THREE.Quaternion;
  forearmR: THREE.Quaternion;
  handR: THREE.Quaternion;
  spine: THREE.Quaternion;
  spineUpper: THREE.Quaternion;
}

interface SketchfabHostAvatarProps {
  walkBlend: number;
  manualWaveBoost: number;
  isWaving: boolean;
  onWaveClick: () => void;
}

const SketchfabHostAvatar: React.FC<SketchfabHostAvatarProps> = ({
  walkBlend,
  manualWaveBoost,
  isWaving,
  onWaveClick,
}) => {
  const gltf = useGLTF('/models/characters.opt.glb', true, true, (loader) => {
    loader.setMeshoptDecoder(MeshoptDecoder);
  });

  const rootGroupRef = useRef<THREE.Group>(null);
  const gaitPhaseRef = useRef(0);

  // Isolate Rig 0: Business man (Host character)
  const { characterObj, bones, restQuats } = useMemo(() => {
    const fullClone = SkeletonUtils.clone(gltf.scene);

    // Keep only metarig.009_38 (Business man / Host)
    const otherRigs: THREE.Object3D[] = [];
    fullClone.traverse((obj) => {
      if (obj.name.startsWith('metarig') && !obj.name.includes('009')) {
        otherRigs.push(obj);
      }
    });
    otherRigs.forEach((rig) => rig.parent?.remove(rig));

    // Compute bounding box for human stature scaling
    const rawBox = new THREE.Box3().setFromObject(fullClone);
    const rawCenter = new THREE.Vector3();
    rawBox.getCenter(rawCenter);
    const rawHeight = rawBox.max.y - rawBox.min.y;

    // Scale precisely to 1.75 units tall (human scale)
    const targetHeight = 1.75;
    const scaleFactor = targetHeight / (rawHeight || 1.75);

    // Re-center X and Z at 0, feet exactly on the pavement Y=0
    fullClone.position.set(-rawCenter.x, -rawBox.min.y, -rawCenter.z);

    // Create container group with uniform scale
    const container = new THREE.Group();
    container.scale.set(scaleFactor, scaleFactor, scaleFactor);
    container.add(fullClone);

    // Locate the 38-bone Rigify skeletal joints
    const b: HostRigBones = {
      thighL: null,
      thighR: null,
      shinL: null,
      shinR: null,
      footL: null,
      footR: null,
      upperArmL: null,
      upperArmR: null,
      forearmL: null,
      forearmR: null,
      handR: null,
      spine: null,
      spineUpper: null,
    };

    fullClone.traverse((o) => {
      if ((o as THREE.Bone).isBone) {
        const n = o.name.toLowerCase().replace(/[^a-z0-9]/g, '');
        if (n.includes('thighl') && !b.thighL) b.thighL = o as THREE.Bone;
        if (n.includes('thighr') && !b.thighR) b.thighR = o as THREE.Bone;
        if (n.includes('shinl') && !b.shinL) b.shinL = o as THREE.Bone;
        if (n.includes('shinr') && !b.shinR) b.shinR = o as THREE.Bone;
        if (n.includes('footl') && !b.footL) b.footL = o as THREE.Bone;
        if (n.includes('footr') && !b.footR) b.footR = o as THREE.Bone;
        if (n.includes('upperarml') && !b.upperArmL) b.upperArmL = o as THREE.Bone;
        if (n.includes('upperarmr') && !b.upperArmR) b.upperArmR = o as THREE.Bone;
        if (n.includes('forearml') && !b.forearmL) b.forearmL = o as THREE.Bone;
        if (n.includes('forearmr') && !b.forearmR) b.forearmR = o as THREE.Bone;
        if (n.includes('handr') && !b.handR) b.handR = o as THREE.Bone;
        if (n === 'spine' || n.includes('spine001')) {
          if (!b.spine) b.spine = o as THREE.Bone;
        }
        if (n.includes('spine002') || n.includes('chest')) {
          if (!b.spineUpper) b.spineUpper = o as THREE.Bone;
        }
      }
    });

    const rq: HostRestQuats = {
      thighL: b.thighL ? b.thighL.quaternion.clone() : new THREE.Quaternion(),
      thighR: b.thighR ? b.thighR.quaternion.clone() : new THREE.Quaternion(),
      shinL: b.shinL ? b.shinL.quaternion.clone() : new THREE.Quaternion(),
      shinR: b.shinR ? b.shinR.quaternion.clone() : new THREE.Quaternion(),
      footL: b.footL ? b.footL.quaternion.clone() : new THREE.Quaternion(),
      footR: b.footR ? b.footR.quaternion.clone() : new THREE.Quaternion(),
      upperArmL: b.upperArmL ? b.upperArmL.quaternion.clone() : new THREE.Quaternion(),
      upperArmR: b.upperArmR ? b.upperArmR.quaternion.clone() : new THREE.Quaternion(),
      forearmL: b.forearmL ? b.forearmL.quaternion.clone() : new THREE.Quaternion(),
      forearmR: b.forearmR ? b.forearmR.quaternion.clone() : new THREE.Quaternion(),
      handR: b.handR ? b.handR.quaternion.clone() : new THREE.Quaternion(),
      spine: b.spine ? b.spine.quaternion.clone() : new THREE.Quaternion(),
      spineUpper: b.spineUpper ? b.spineUpper.quaternion.clone() : new THREE.Quaternion(),
    };

    return { characterObj: container, bones: b, restQuats: rq };
  }, [gltf]);

  // Procedural walk, idle, and waving animation
  useFrame(({ clock }, delta) => {
    const elapsed = clock.getElapsedTime();
    const clampedDelta = Math.min(delta, 0.05);

    if (walkBlend > 0.05) {
      gaitPhaseRef.current += clampedDelta * 6.2 * (0.35 + 0.65 * walkBlend);
    }
    const phase = gaitPhaseRef.current;
    const sinCycle = Math.sin(phase);
    const cosCycle = Math.cos(phase);

    // 1. Thigh swing
    const thighAngle = sinCycle * 0.42 * walkBlend;
    if (bones.thighL) {
      TEMP_Q.setFromAxisAngle(AXIS_X, thighAngle);
      bones.thighL.quaternion.copy(restQuats.thighL).multiply(TEMP_Q);
    }
    if (bones.thighR) {
      TEMP_Q.setFromAxisAngle(AXIS_X, -thighAngle);
      bones.thighR.quaternion.copy(restQuats.thighR).multiply(TEMP_Q);
    }

    // 2. Knee bend (shin clamped backward flexion)
    if (bones.shinL) {
      const kneeBend = Math.max(0, -sinCycle) * (0.55 * walkBlend);
      TEMP_Q.setFromAxisAngle(AXIS_X, kneeBend);
      bones.shinL.quaternion.copy(restQuats.shinL).multiply(TEMP_Q);
    }
    if (bones.shinR) {
      const kneeBend = Math.max(0, sinCycle) * (0.55 * walkBlend);
      TEMP_Q.setFromAxisAngle(AXIS_X, kneeBend);
      bones.shinR.quaternion.copy(restQuats.shinR).multiply(TEMP_Q);
    }

    // 3. Foot / Ankle compensation
    if (bones.footL) {
      const footTilt = sinCycle * (0.18 * walkBlend);
      TEMP_Q.setFromAxisAngle(AXIS_X, -footTilt);
      bones.footL.quaternion.copy(restQuats.footL).multiply(TEMP_Q);
    }
    if (bones.footR) {
      const footTilt = -sinCycle * (0.18 * walkBlend);
      TEMP_Q.setFromAxisAngle(AXIS_X, -footTilt);
      bones.footR.quaternion.copy(restQuats.footR).multiply(TEMP_Q);
    }

    // 4. Left Arm walking swing
    const armAngleL = sinCycle * (0.35 * walkBlend);
    if (bones.upperArmL) {
      TEMP_Q.setFromAxisAngle(AXIS_X, armAngleL);
      bones.upperArmL.quaternion.copy(restQuats.upperArmL).multiply(TEMP_Q);
    }
    if (bones.forearmL) {
      const elbowBend = 0.12 + Math.max(0, armAngleL) * 0.4;
      TEMP_Q.setFromAxisAngle(AXIS_X, elbowBend);
      bones.forearmL.quaternion.copy(restQuats.forearmL).multiply(TEMP_Q);
    }

    // 5. Right Arm: Waving gesture vs. Walk swing
    const shouldWave = (isWaving || manualWaveBoost > 0) && walkBlend < 0.35;
    if (shouldWave) {
      const waveOsc = Math.sin(elapsed * 7.5) * 0.22;
      if (bones.upperArmR) {
        TEMP_Q.setFromAxisAngle(AXIS_X, -0.65);
        TEMP_Q2.setFromAxisAngle(AXIS_Z, -1.35 + waveOsc);
        TEMP_Q.multiply(TEMP_Q2);
        bones.upperArmR.quaternion.copy(restQuats.upperArmR).multiply(TEMP_Q);
      }
      if (bones.forearmR) {
        TEMP_Q.setFromAxisAngle(AXIS_X, -0.85);
        bones.forearmR.quaternion.copy(restQuats.forearmR).multiply(TEMP_Q);
      }
      if (bones.handR) {
        const flutter = Math.sin(elapsed * 15.0) * 0.35;
        TEMP_Q.setFromAxisAngle(AXIS_Z, flutter);
        bones.handR.quaternion.copy(restQuats.handR).multiply(TEMP_Q);
      }
    } else {
      const armAngleR = -sinCycle * (0.35 * walkBlend);
      if (bones.upperArmR) {
        TEMP_Q.setFromAxisAngle(AXIS_X, armAngleR);
        bones.upperArmR.quaternion.copy(restQuats.upperArmR).multiply(TEMP_Q);
      }
      if (bones.forearmR) {
        const elbowBend = 0.12 + Math.max(0, armAngleR) * 0.4;
        TEMP_Q.setFromAxisAngle(AXIS_X, elbowBend);
        bones.forearmR.quaternion.copy(restQuats.forearmR).multiply(TEMP_Q);
      }
      if (bones.handR) {
        bones.handR.quaternion.copy(restQuats.handR);
      }
    }

    // 6. Spine twist & idle breathing
    if (bones.spine) {
      const twist = -sinCycle * 0.04 * walkBlend;
      const breath = Math.sin(elapsed * 2.0) * 0.015 * (1 - walkBlend);
      TEMP_Q.setFromAxisAngle(AXIS_Y, twist);
      TEMP_Q2.setFromAxisAngle(AXIS_X, breath);
      TEMP_Q.multiply(TEMP_Q2);
      bones.spine.quaternion.copy(restQuats.spine).multiply(TEMP_Q);
    }

    // 7. Pelvis vertical bob
    if (rootGroupRef.current) {
      const bob = Math.abs(cosCycle) * 0.032 * walkBlend + Math.sin(elapsed * 0.9) * 0.006 * (1 - walkBlend);
      rootGroupRef.current.position.y = bob;
    }
  });

  return (
    <group
      ref={rootGroupRef}
      onClick={(e) => {
        e.stopPropagation();
        onWaveClick();
      }}
      onPointerOver={(e) => {
        e.stopPropagation();
        document.body.style.cursor = 'pointer';
      }}
      onPointerOut={() => {
        document.body.style.cursor = 'default';
      }}
    >
      <primitive object={characterObj} />

      {/* Ground Contact Glow Ring */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]}>
        <ringGeometry args={[0.55, 0.72, 32]} />
        <meshBasicMaterial color={0xfbbf24} side={THREE.DoubleSide} transparent opacity={0.55} />
      </mesh>

      {/* Soft Contact Shadow Disc */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.01, 0]}>
        <ringGeometry args={[0.05, 0.55, 32]} />
        <meshBasicMaterial color="#000000" transparent opacity={0.35} depthWrite={false} />
      </mesh>
    </group>
  );
};

export const HostCharacter: React.FC = () => {
  const rootRef = useRef<THREE.Group>(null);
  const scrollProgress = useAppStore((s) => s.scrollProgress);
  const focusedBuildingIndex = useAppStore((s) => s.focusedBuildingIndex);
  const useOldCity = useAppStore((s) => s.useOldCity);
  const showToast = useAppStore((s) => s.showToast);
  const { camera } = useThree();

  const isFirstFrame = useRef(true);
  const currentPos = useRef(new THREE.Vector3(-48, 0.10, 7.8));
  const targetPos = useRef(new THREE.Vector3(-48, 0.10, 7.8));
  const currentRotY = useRef(0);
  const manualWaveBoost = useRef(0);
  const walkBlendRef = useRef(0);

  const handleWave = () => {
    manualWaveBoost.current = 2.6;
    showToast("Aditya waves hi! 👋 Pick any of the 5 buildings to explore together!");
  };

  useFrame(() => {
    // 1. Escort Pathfinding Logic
    if (focusedBuildingIndex !== null) {
      const b = PORTFOLIO_CONTENT.buildings[focusedBuildingIndex];
      targetPos.current.set(b.xPos - 2.4, 0.16, useOldCity ? -7.8 : -11.5);
    } else if (scrollProgress > 0.88) {
      targetPos.current.set(45, 0.10, 7.8);
    } else if (scrollProgress < 0.16) {
      targetPos.current.set(-48, 0.10, 7.8);
    } else {
      // Guide visitor along the street promenade in view of current building
      const tourT = Math.max(0, Math.min(1, (scrollProgress - 0.2) / 0.66));
      const guideX = -50 + tourT * 102;
      targetPos.current.set(guideX, 0.10, 7.8);
    }

    // Direct snap on initial frame or deep link
    if (isFirstFrame.current) {
      currentPos.current.copy(targetPos.current);
      isFirstFrame.current = false;
    }

    // Velocity & Stride
    const dx = targetPos.current.x - currentPos.current.x;
    const dz = targetPos.current.z - currentPos.current.z;
    const dist = Math.hypot(dx, dz);
    const moveLerp = focusedBuildingIndex !== null ? 0.085 : 0.095;
    currentPos.current.lerp(targetPos.current, moveLerp);

    if (rootRef.current) {
      rootRef.current.position.copy(currentPos.current);
    }

    const walkBlend = Math.min(1, dist * 0.65);
    walkBlendRef.current = walkBlend;

    // Smooth rotation facing movement or camera
    let desiredYaw = 0;
    if (walkBlend > 0.18) {
      desiredYaw = Math.atan2(dx, dz);
    } else {
      const camDx = camera.position.x - currentPos.current.x;
      const camDz = camera.position.z - currentPos.current.z;
      desiredYaw = Math.atan2(camDx, camDz);
    }

    let angleDiff = desiredYaw - currentRotY.current;
    while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
    while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;
    currentRotY.current += angleDiff * 0.14;

    if (rootRef.current) {
      rootRef.current.rotation.y = currentRotY.current;
    }

    // Decay manual wave boost
    if (manualWaveBoost.current > 0) {
      manualWaveBoost.current = Math.max(0, manualWaveBoost.current - 0.025);
    }
  });

  const isWaving =
    focusedBuildingIndex !== null || scrollProgress > 0.88 || scrollProgress < 0.18;

  return (
    <>
      <group ref={rootRef} position={[-48, 0.10, 7.8]} scale={useOldCity ? 1.38 : 1.0}>
        {useOldCity ? (
          <ProceduralAvatar
            walkBlendRef={walkBlendRef}
            manualWaveBoostRef={manualWaveBoost}
            isWaving={isWaving}
            onWaveClick={handleWave}
          />
        ) : (
          <SketchfabHostAvatar
            walkBlend={walkBlendRef.current}
            manualWaveBoost={manualWaveBoost.current}
            isWaving={isWaving}
            onWaveClick={handleWave}
          />
        )}
      </group>

      {/* Floating 3D Speech Bubble above Aditya's avatar */}
      <SpeechBubble
        position={[currentPos.current.x, currentPos.current.y, currentPos.current.z]}
        onWaveClick={handleWave}
      />
    </>
  );
};
