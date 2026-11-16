import React, { useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { useFrame, useThree } from '@react-three/fiber';
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader.js';
import { useAppStore } from '../../store/useAppStore';
import { BUILDING_PROXIES, RAW_BOUNDS } from '../../data/buildings';
import { SpeechBubble } from './SpeechBubble';
import { attachFaceAccessories } from './AvatarAccessories';

// ── Waypoint & Stop Constants ────────────────────────────────────────────────
// 5 Hero Building Stops along the North Sidewalk (in front of each building entrance)
// North row facades are at Z = -13.4. Sidewalk runs along Z = -10.0 at pavement height Y = 0.16.
// Offset X by -1.8m so the host stands beside the entrance door, keeping the door & sign visible.
const HOST_BUILDING_STOPS: THREE.Vector3[] = [
  new THREE.Vector3(BUILDING_PROXIES[0].xPos - 1.8, RAW_BOUNDS.pavementY, -10.0), // 101 About:  (-40.27, 0.16, -10.0)
  new THREE.Vector3(BUILDING_PROXIES[1].xPos - 1.8, RAW_BOUNDS.pavementY, -10.0), // 103 Skills: (-21.03, 0.16, -10.0)
  new THREE.Vector3(BUILDING_PROXIES[2].xPos - 1.8, RAW_BOUNDS.pavementY, -10.0), // 105 Projects: (-1.80, 0.16, -10.0)
  new THREE.Vector3(BUILDING_PROXIES[3].xPos - 1.8, RAW_BOUNDS.pavementY, -10.0), // 107 Resume:  (+17.43, 0.16, -10.0)
  new THREE.Vector3(BUILDING_PROXIES[4].xPos - 1.8, RAW_BOUNDS.pavementY, -10.0), // 109 Contact: (+36.67, 0.16, -10.0)
];

// Final Hub Overview Stop (framed in front of the camera at (43.5, 1.70, 2.2) on south pavement)
const HOST_HUB_STOP = new THREE.Vector3(38.8, 0.10, 4.6);

// Sidewalk Crosswalk Corner Waypoint for transitioning between north sidewalk and south pavement
const CROSSWALK_NORTH_CORNER = new THREE.Vector3(38.0, RAW_BOUNDS.pavementY, -10.0);

// Calibrated Stride & Speed Physics for zero foot sliding:
// Raw FBX height = 179.27 cm, stride = 177.86 cm, duration = 1.033 s.
// At 1.75m scaled height, stride is 1.7362m -> natural walking speed = 1.68 m/s.
const BASE_WALK_SPEED = 1.68; // meters / second
const STOP_DISTANCE_THRESHOLD = 0.22; // meters to consider stop reached
const CROSSFADE_DURATION = 0.3; // seconds

type HostState = 'WALKING' | 'WAVING' | 'STANDING';

/**
 * Computes the target waypoint from scroll progress or focused building
 */
function getActiveTarget(
  scrollProgress: number,
  focusedBuildingIndex: number | null
): THREE.Vector3 {
  if (focusedBuildingIndex !== null && focusedBuildingIndex >= 0 && focusedBuildingIndex < HOST_BUILDING_STOPS.length) {
    return HOST_BUILDING_STOPS[focusedBuildingIndex];
  }
  if (scrollProgress >= 0.92) {
    return HOST_HUB_STOP;
  }
  if (scrollProgress < 0.36) {
    return HOST_BUILDING_STOPS[0];
  } else if (scrollProgress < 0.51) {
    return HOST_BUILDING_STOPS[1];
  } else if (scrollProgress < 0.65) {
    return HOST_BUILDING_STOPS[2];
  } else if (scrollProgress < 0.79) {
    return HOST_BUILDING_STOPS[3];
  } else {
    return HOST_BUILDING_STOPS[4];
  }
}

/**
 * Assigns tailored materials with proper lighting and shadow responses to avatar meshes
 */
function applyAvatarMaterials(avatar: THREE.Group) {
  avatar.traverse((child) => {
    if ((child as THREE.Mesh).isMesh) {
      child.castShadow = true;
      child.receiveShadow = true;
      const mesh = child as THREE.Mesh;
      const name = mesh.name.toLowerCase();

      let color = 0x27303f; // Default tailored navy suit
      let roughness = 0.68;
      let metalness = 0.08;

      if (name.includes('body') || name.includes('skin') || name.includes('face') || name.includes('head')) {
        color = 0xdfab8c;
        roughness = 0.58;
        metalness = 0.02;
      } else if (name.includes('suit') || name.includes('coat') || name.includes('jacket')) {
        color = 0x27303f;
        roughness = 0.65;
        metalness = 0.05;
      } else if (name.includes('pants') || name.includes('trousers')) {
        color = 0x27303f;
        roughness = 0.7;
        metalness = 0.05;
      } else if (name.includes('shirt')) {
        color = 0xf8fafc;
        roughness = 0.78;
        metalness = 0.02;
      } else if (name.includes('shoe') || name.includes('boot')) {
        color = 0x11141c;
        roughness = 0.35;
        metalness = 0.22;
      } else if (name.includes('eyelash') || name.includes('lash')) {
        mesh.visible = false;
        return;
      } else if (name.includes('hair')) {
        mesh.material = new THREE.MeshStandardMaterial({
          color: 0x18181b,
          roughness: 0.85,
          side: THREE.FrontSide,
        });
        return;
      } else if (name.includes('belt')) {
        color = 0x09090b;
        roughness = 0.4;
        metalness = 0.35;
      }

      mesh.material = new THREE.MeshStandardMaterial({
        color,
        roughness,
        metalness,
        side: THREE.DoubleSide,
      });
    }
  });
}

export const HostCharacter: React.FC = () => {
  const rootRef = useRef<THREE.Group>(null);
  const scrollProgress = useAppStore((s) => s.scrollProgress);
  const focusedBuildingIndex = useAppStore((s) => s.focusedBuildingIndex);
  const showToast = useAppStore((s) => s.showToast);
  const { camera } = useThree();

  const [avatarGroup, setAvatarGroup] = useState<THREE.Group | null>(null);
  const [loadError, setLoadError] = useState<boolean>(false);

  // Animation & state refs
  const mixerRef = useRef<THREE.AnimationMixer | null>(null);
  const actionsRef = useRef<{
    walk?: THREE.AnimationAction;
    wave?: THREE.AnimationAction;
    idle?: THREE.AnimationAction;
  }>({});
  const hostStateRef = useRef<HostState>('WAVING');
  const currentActionRef = useRef<THREE.AnimationAction | null>(null);

  // Position & orientation tracking
  const initialPos = useMemo(() => getActiveTarget(scrollProgress, focusedBuildingIndex), []);
  const currentPos = useRef<THREE.Vector3>(initialPos.clone());
  const activeWaypointTarget = useRef<THREE.Vector3>(initialPos.clone());
  const finalStopTarget = useRef<THREE.Vector3>(initialPos.clone());
  const currentYaw = useRef<number>(0);
  const isFirstFrame = useRef<boolean>(true);
  const waveTimerRef = useRef<number>(0);

  // Helper to crossfade between actions
  const crossfadeToAction = (toAction?: THREE.AnimationAction, duration = CROSSFADE_DURATION) => {
    if (!toAction) return;
    const fromAction = currentActionRef.current;
    if (fromAction === toAction && toAction.isRunning()) return;

    toAction.reset();
    toAction.enabled = true;
    toAction.setEffectiveWeight(1);

    if (fromAction && fromAction.isRunning()) {
      fromAction.crossFadeTo(toAction, duration, true);
    } else {
      toAction.fadeIn(duration);
    }

    toAction.play();
    currentActionRef.current = toAction;
  };

  // Play wave once, then transition to standing pose
  const playWaveOnce = () => {
    const waveAction = actionsRef.current.wave;
    if (!waveAction) return;

    hostStateRef.current = 'WAVING';
    waveAction.reset();
    waveAction.setLoop(THREE.LoopOnce, 1);
    waveAction.clampWhenFinished = true;
    waveAction.paused = false;
    waveTimerRef.current = 0;
    crossfadeToAction(waveAction, CROSSFADE_DURATION);
  };

  const handleWaveClick = () => {
    playWaveOnce();
    showToast("Aditya waves hi! 👋 Pick any of the 5 buildings to explore together!");
  };

  // ── Load FBX Avatar & Animations in Parallel ───────────────────────────────
  useEffect(() => {
    let isMounted = true;
    const manager = new THREE.LoadingManager();

    // Fast loading modifier: skip heavy embedded texture decompression
    const transparentPixel =
      'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
    manager.setURLModifier((url) => {
      if (
        url.startsWith('blob:') ||
        url.match(/\.(png|jpg|jpeg|tga|bmp|tif|tiff)(\?.*)?$/i) ||
        url.includes('.fbm')
      ) {
        return transparentPixel;
      }
      return url;
    });

    const loader = new FBXLoader(manager);

    const loadFBXPromise = (url: string): Promise<THREE.Group> => {
      return new Promise((resolve, reject) => {
        loader.load(url, resolve, undefined, reject);
      });
    };

    // Parallel load of Walking.fbx, Waving.fbx, and optional Idle.fbx
    Promise.all([
      loadFBXPromise('/animations/Walking.fbx'),
      loadFBXPromise('/animations/Waving.fbx'),
      loadFBXPromise('/animations/Idle.fbx').catch(() => null),
    ])
      .then(([walkingFbx, wavingFbx, idleFbx]) => {
        if (!isMounted) return;

        // Measure raw model height & scale precisely to 1.75m tall
        const rawBox = new THREE.Box3().setFromObject(walkingFbx);
        const rawHeight = rawBox.max.y - rawBox.min.y;
        const targetHeight = 1.75;
        const scaleFactor = targetHeight / (rawHeight || 179.27);
        walkingFbx.scale.setScalar(scaleFactor);

        // Center X & Z, and place feet exactly at local Y = 0
        const scaledBox = new THREE.Box3().setFromObject(walkingFbx);
        const scaledCenter = new THREE.Vector3();
        scaledBox.getCenter(scaledCenter);
        walkingFbx.position.set(-scaledCenter.x, -scaledBox.min.y, -scaledCenter.z);

        // Apply clean tailored materials and shadow casting
        applyAvatarMaterials(walkingFbx);

        // Attach realistic eyeballs and glasses to the host avatar
        attachFaceAccessories(walkingFbx, { glasses: 'sunglasses', addEyeballs: true });
        if (typeof window !== 'undefined') {
          (window as any).__HOST_AVATAR__ = walkingFbx;
        }

        // 1. Prepare Walking animation clip: remove X/Z forward root motion so it walks in place
        const walkClipRaw = walkingFbx.animations[0];
        const walkClip = walkClipRaw ? walkClipRaw.clone() : new THREE.AnimationClip('Walk', 0, []);
        walkClip.name = 'Walk';

        walkClip.tracks.forEach((track) => {
          if (track.name.toLowerCase().endsWith('hips.position')) {
            const vals = track.values;
            const x0 = vals[0];
            const z0 = vals[2];
            for (let i = 0; i < vals.length; i += 3) {
              vals[i] = x0;
              vals[i + 2] = z0;
            }
          }
        });

        // 2. Prepare Waving clip
        const waveClipRaw = wavingFbx.animations[0];
        const waveClip = waveClipRaw ? waveClipRaw.clone() : new THREE.AnimationClip('Wave', 0, []);
        waveClip.name = 'Wave';

        // Initialize Animation Mixer on the avatar
        const mixer = new THREE.AnimationMixer(walkingFbx);

        const walkAction = mixer.clipAction(walkClip);
        walkAction.setLoop(THREE.LoopRepeat, Infinity);
        walkAction.setEffectiveTimeScale(1);

        const waveAction = mixer.clipAction(waveClip);
        waveAction.setLoop(THREE.LoopOnce, 1);
        waveAction.clampWhenFinished = true;

        actionsRef.current.walk = walkAction;
        actionsRef.current.wave = waveAction;

        // 3. Optional Idle clip if present
        if (idleFbx && idleFbx.animations[0]) {
          const idleClip = idleFbx.animations[0].clone();
          idleClip.name = 'Idle';
          const idleAction = mixer.clipAction(idleClip);
          idleAction.setLoop(THREE.LoopRepeat, Infinity);
          actionsRef.current.idle = idleAction;
        }

        // Listen for wave completion: transition to holding standing pose
        mixer.addEventListener('finished', (e: any) => {
          if (e.action === actionsRef.current.wave) {
            hostStateRef.current = 'STANDING';
            if (actionsRef.current.idle) {
              crossfadeToAction(actionsRef.current.idle, CROSSFADE_DURATION);
            } else if (actionsRef.current.wave) {
              actionsRef.current.wave.paused = true;
            }
          }
        });

        // Start playing Wave immediately so avatar never renders in T-pose
        hostStateRef.current = 'WAVING';
        currentActionRef.current = waveAction;
        waveAction.play();

        // Advance mixer 1 frame to immediately evaluate bind-to-pose deformation
        mixer.update(0.016);

        mixerRef.current = mixer;
        setAvatarGroup(walkingFbx);
      })
      .catch((err) => {
        console.warn('[HostCharacter] Failed to load animation files, site will continue without host:', err);
        if (isMounted) setLoadError(true);
      });

    return () => {
      isMounted = false;
      if (mixerRef.current) {
        mixerRef.current.stopAllAction();
      }
    };
  }, []);

  // ── Frame Loop: Waypoint Navigation, Stride Physics & State Transitions ────
  useFrame((_, delta) => {
    const clampedDelta = Math.min(delta, 0.05);

    if (mixerRef.current) {
      mixerRef.current.update(clampedDelta);
    }

    if (typeof window !== 'undefined') {
      let headWorldPos: number[] | null = null;
      if (rootRef.current) {
        const headBone = rootRef.current.getObjectByName('mixamorigHead');
        if (headBone) {
          const wp = new THREE.Vector3();
          headBone.getWorldPosition(wp);
          headWorldPos = wp.toArray();
        }
      }

      (window as any).__HOST_DEBUG__ = {
        hasAvatar: !!avatarGroup,
        hasMixer: !!mixerRef.current,
        hasWalkAction: !!actionsRef.current.walk,
        hasWaveAction: !!actionsRef.current.wave,
        walkRunning: actionsRef.current.walk ? actionsRef.current.walk.isRunning() : false,
        waveRunning: actionsRef.current.wave ? actionsRef.current.wave.isRunning() : false,
        state: hostStateRef.current,
        currentPos: currentPos.current.toArray(),
        activeTarget: activeWaypointTarget.current.toArray(),
        headWorldPos,
        currentYaw: currentYaw.current,
        scrollProgress,
        focusedBuildingIndex,
      };
    }

    if (!avatarGroup || !rootRef.current) return;

    // 1. Determine destination stop
    const targetStop = getActiveTarget(scrollProgress, focusedBuildingIndex);

    // Initial load frame snap
    if (isFirstFrame.current) {
      currentPos.current.copy(targetStop);
      activeWaypointTarget.current.copy(targetStop);
      finalStopTarget.current.copy(targetStop);
      rootRef.current.position.copy(currentPos.current);
      isFirstFrame.current = false;
      return;
    }

    // Instant Skip Handling: if jumping straight to Hub overview, snap to Hub
    if (scrollProgress > 0.95 && currentPos.current.distanceTo(HOST_HUB_STOP) > 20.0) {
      currentPos.current.copy(HOST_HUB_STOP);
      activeWaypointTarget.current.copy(HOST_HUB_STOP);
      finalStopTarget.current.copy(HOST_HUB_STOP);
      rootRef.current.position.copy(currentPos.current);
      playWaveOnce();
      return;
    }

    // 2. Compute Sidewalk Waypoint Path
    // If moving between North Sidewalk (Z ~ -10) and South Pavement Hub (Z ~ 4.6),
    // route through the crosswalk corner waypoint at X = 38.0, Z = -10.0
    finalStopTarget.current.copy(targetStop);
    const isGoingToHub = targetStop.z > 0;
    const isCurrentlyOnNorthSidewalk = currentPos.current.z < -2.0;

    if (isGoingToHub && isCurrentlyOnNorthSidewalk) {
      const distToCorner = Math.hypot(
        CROSSWALK_NORTH_CORNER.x - currentPos.current.x,
        CROSSWALK_NORTH_CORNER.z - currentPos.current.z
      );
      if (distToCorner > 1.2) {
        activeWaypointTarget.current.copy(CROSSWALK_NORTH_CORNER);
      } else {
        activeWaypointTarget.current.copy(HOST_HUB_STOP);
      }
    } else {
      activeWaypointTarget.current.copy(targetStop);
    }

    // 3. Distance & Speed Calculations
    const dx = activeWaypointTarget.current.x - currentPos.current.x;
    const dz = activeWaypointTarget.current.z - currentPos.current.z;
    const distToActive = Math.hypot(dx, dz);

    const finalDx = finalStopTarget.current.x - currentPos.current.x;
    const finalDz = finalStopTarget.current.z - currentPos.current.z;
    const distToFinal = Math.hypot(finalDx, finalDz);

    const hasReachedStop = distToFinal <= STOP_DISTANCE_THRESHOLD;

    // 4. State Machine: WALKING vs. WAVING vs. STANDING
    if (!hasReachedStop) {
      // Target changed or not at destination: Host is WALKING
      if (hostStateRef.current !== 'WALKING') {
        hostStateRef.current = 'WALKING';
        crossfadeToAction(actionsRef.current.walk, CROSSFADE_DURATION);
      }

      // Dynamic Speed Regulation:
      // Base speed 1.68 m/s; smoothly accelerates if camera scrolls fast, eases near stop
      let moveSpeed = BASE_WALK_SPEED;
      if (distToActive < 1.0) {
        moveSpeed = BASE_WALK_SPEED * Math.max(0.35, distToActive / 1.0);
      } else if (distToActive > 4.5) {
        moveSpeed = BASE_WALK_SPEED * Math.min(2.2, 1.0 + (distToActive - 4.5) * 0.12);
      }

      // Zero-Slip Stride Matching:
      // Modulation of animation timeScale ensures foot plant speed exactly equals ground speed
      if (actionsRef.current.walk) {
        actionsRef.current.walk.setEffectiveTimeScale(moveSpeed / BASE_WALK_SPEED);
      }

      // Advance position along waypoint vector
      const stepDist = Math.min(distToActive, moveSpeed * clampedDelta);
      currentPos.current.x += (dx / distToActive) * stepDist;
      currentPos.current.z += (dz / distToActive) * stepDist;
      currentPos.current.y = THREE.MathUtils.lerp(currentPos.current.y, activeWaypointTarget.current.y, 0.12);

      // Smoothly rotate to face direction of movement
      const moveYaw = Math.atan2(dx, dz);
      let angleDiff = moveYaw - currentYaw.current;
      while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
      while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;
      currentYaw.current += angleDiff * Math.min(1.0, 10.0 * clampedDelta);
    } else {
      // Host has reached the stop!
      if (hostStateRef.current === 'WALKING') {
        playWaveOnce();
      }

      // Height alignment with pavement
      currentPos.current.y = THREE.MathUtils.lerp(currentPos.current.y, finalStopTarget.current.y, 0.2);

      // Smoothly turn to face the user camera
      const camDx = camera.position.x - currentPos.current.x;
      const camDz = camera.position.z - currentPos.current.z;
      const camYaw = Math.atan2(camDx, camDz);

      let angleDiff = camYaw - currentYaw.current;
      while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
      while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;
      currentYaw.current += angleDiff * Math.min(1.0, 6.0 * clampedDelta);

      // Fallback timer in case finished event was delayed
      if (hostStateRef.current === 'WAVING') {
        waveTimerRef.current += clampedDelta;
        if (waveTimerRef.current > 4.8) {
          hostStateRef.current = 'STANDING';
          if (actionsRef.current.idle) {
            crossfadeToAction(actionsRef.current.idle, CROSSFADE_DURATION);
          } else if (actionsRef.current.wave) {
            actionsRef.current.wave.paused = true;
          }
        }
      }
    }

    // Apply transformed position and rotation to group
    rootRef.current.position.copy(currentPos.current);
    rootRef.current.rotation.y = currentYaw.current;
  });

  if (loadError) {
    return null;
  }

  return (
    <group ref={rootRef} position={[initialPos.x, initialPos.y, initialPos.z]}>
      {avatarGroup && (
        <group
          onClick={(e) => {
            e.stopPropagation();
            handleWaveClick();
          }}
          onPointerOver={(e) => {
            e.stopPropagation();
            document.body.style.cursor = 'pointer';
          }}
          onPointerOut={() => {
            document.body.style.cursor = 'default';
          }}
        >
          {/* Scaled FBX Mesh Object */}
          <primitive object={avatarGroup} />

          {/* Interactive Ground Contact Glow Ring */}
          <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]}>
            <ringGeometry args={[0.55, 0.72, 32]} />
            <meshBasicMaterial color={0xfbbf24} side={THREE.DoubleSide} transparent opacity={0.55} />
          </mesh>

          {/* Soft Ground Contact Shadow Disc */}
          <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.01, 0]}>
            <ringGeometry args={[0.02, 0.48, 32]} />
            <meshBasicMaterial color="#000000" transparent opacity={0.35} depthWrite={false} />
          </mesh>
        </group>
      )}

      {/* 3D Speech Bubble anchored directly above host's head (head height ~ 1.75m) */}
      <SpeechBubble position={[0, 2.05, 0]} onWaveClick={handleWaveClick} />
    </group>
  );
};
