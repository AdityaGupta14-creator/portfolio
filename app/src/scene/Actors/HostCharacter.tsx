import React, { useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { useFrame, useThree } from '@react-three/fiber';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import * as SkeletonUtils from 'three/examples/jsm/utils/SkeletonUtils.js';
import { useAppStore } from '../../store/useAppStore';
import { PORTFOLIO_CONTENT } from '../../data/content';
import { textures } from '../../utils/proceduralTextures';
import { SpeechBubble } from './SpeechBubble';

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

export const HostCharacter: React.FC = () => {
  const rootRef = useRef<THREE.Group>(null);
  const scrollProgress = useAppStore((s) => s.scrollProgress);
  const focusedBuildingIndex = useAppStore((s) => s.focusedBuildingIndex);
  const showToast = useAppStore((s) => s.showToast);
  const { camera } = useThree();

  const currentPos = useRef(new THREE.Vector3(-46, 0.14, 8.2));
  const targetPos = useRef(new THREE.Vector3(-46, 0.14, 8.2));
  const currentRotY = useRef(0);
  const manualWaveBoost = useRef(0);
  const walkBlendRef = useRef(0);

  // GLTF Models & Mixer State
  const [gltfModel, setGltfModel] = useState<THREE.Group | null>(null);
  const mixerRef = useRef<THREE.AnimationMixer | null>(null);
  const idleActionRef = useRef<THREE.AnimationAction | null>(null);
  const walkActionRef = useRef<THREE.AnimationAction | null>(null);
  const [useFallback, setUseFallback] = useState(false);

  // Attempt to load GLTF models from /models/ (host.glb, walk.glb, idle.glb)
  useEffect(() => {
    let isCancelled = false;
    const loader = new GLTFLoader();

    Promise.all([
      new Promise<THREE.Group>((resolve, reject) =>
        loader.load('/models/host.glb', (gltf) => resolve(gltf.scene), undefined, reject)
      ),
      new Promise<THREE.AnimationClip[]>((resolve, reject) =>
        loader.load('/models/walk.glb', (gltf) => resolve(gltf.animations), undefined, reject)
      ),
      new Promise<THREE.AnimationClip[]>((resolve, reject) =>
        loader.load('/models/idle.glb', (gltf) => resolve(gltf.animations), undefined, reject)
      ),
    ])
      .then(([hostScene, walkAnims, idleAnims]) => {
        if (isCancelled) return;
        const cloned = SkeletonUtils.clone(hostScene) as THREE.Group;
        const mixer = new THREE.AnimationMixer(cloned);

        if (idleAnims.length > 0) {
          const idleAction = mixer.clipAction(idleAnims[0]);
          idleAction.play();
          idleActionRef.current = idleAction;
        }
        if (walkAnims.length > 0) {
          const walkAction = mixer.clipAction(walkAnims[0]);
          walkAction.setEffectiveWeight(0);
          walkAction.play();
          walkActionRef.current = walkAction;
        }

        mixerRef.current = mixer;
        setGltfModel(cloned);
      })
      .catch(() => {
        // Safe fallback if files fail or are not yet uploaded
        if (!isCancelled) {
          setUseFallback(true);
        }
      });

    return () => {
      isCancelled = true;
    };
  }, []);

  const handleWave = () => {
    manualWaveBoost.current = 2.6;
    showToast("Aditya waves hi! 👋 Pick any of the 5 buildings to explore together!");
  };

  useFrame((_, delta) => {
    // 1. Escort Pathfinding Logic
    if (focusedBuildingIndex !== null) {
      const b = PORTFOLIO_CONTENT.buildings[focusedBuildingIndex];
      targetPos.current.set(b.xPos - 2.3, 0.16, -7.8);
    } else if (scrollProgress > 0.88) {
      targetPos.current.set(-7, 0.16, 22.5);
    } else if (scrollProgress < 0.16) {
      targetPos.current.set(-48, 0.14, 7.8);
    } else {
      const tourT = (scrollProgress - 0.16) / (0.88 - 0.16);
      const guideX = -52 + tourT * 104;
      targetPos.current.set(guideX, 0.14, 7.8);
    }

    // Velocity & Stride
    const dx = targetPos.current.x - currentPos.current.x;
    const dz = targetPos.current.z - currentPos.current.z;
    const dist = Math.hypot(dx, dz);
    const moveLerp = focusedBuildingIndex !== null ? 0.065 : 0.085;
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
    currentRotY.current += angleDiff * 0.12;

    if (rootRef.current) {
      rootRef.current.rotation.y = currentRotY.current;
    }

    // Decay manual wave boost
    if (manualWaveBoost.current > 0) {
      manualWaveBoost.current = Math.max(0, manualWaveBoost.current - 0.025);
    }

    // 2. AnimationMixer Update (for GLTF model)
    if (mixerRef.current) {
      mixerRef.current.update(delta);
      if (idleActionRef.current && walkActionRef.current) {
        walkActionRef.current.setEffectiveWeight(walkBlend);
        idleActionRef.current.setEffectiveWeight(1 - walkBlend);
      }
    }
  });

  const isWaving =
    focusedBuildingIndex !== null || scrollProgress > 0.88 || scrollProgress < 0.18;

  return (
    <>
      <group ref={rootRef} position={[-46, 0.14, 8.2]} scale={1.38}>
        {!useFallback && gltfModel ? (
          <primitive
            object={gltfModel}
            onClick={(e: { stopPropagation: () => void }) => {
              e.stopPropagation();
              handleWave();
            }}
          />
        ) : (
          <ProceduralAvatar
            walkBlendRef={walkBlendRef}
            manualWaveBoostRef={manualWaveBoost}
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
