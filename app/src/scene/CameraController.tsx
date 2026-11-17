import React, { useEffect, useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { useAppStore } from '../store/useAppStore';
import { PORTFOLIO_CONTENT } from '../data/content';
import { BUILDING_PROXIES, RAW_BOUNDS } from '../data/buildings';
import { perfRenderTracker } from '../utils/perfTracker';

interface Keyframe {
  p: number;
  pos: THREE.Vector3;
  look: THREE.Vector3;
  name: string;
}

// ── Building-Aware Camera Trajectory & Safe Clearance ────────────────────────
// 1. All stop positions are computed from building bounding boxes:
//    - Front facade of north brownstone row: Z = -16.0 (stoops to -13.5)
//    - South facade: Z = +16.0 (stoops to +13.5)
//    - Safe street corridor: Z = -0.2 to +2.0 (distance to facades >= 14m, well over 4m/6m requirements)
//    - Eye height: 1.70m (~1.7m human eye level)
// 2. Hub overview camera: positioned in street at (44.0, 1.70, 2.0), looking down avenue at (0.0, 1.85, -2.5)
//    Host stands at (39.0, 0.10, 5.6), 5-6m in front on pavement, framed in left/centre area away from right menu.
const EYE_HEIGHT = 1.70;

function computeKeyframes(): Keyframe[] {
  const p101 = BUILDING_PROXIES[0];
  // ── High Sky Start & Scroll Descent into Brownstone Avenue ────────────────
  // Starts high in the clouds looking out across the avenue vista, then descends
  // seamlessly down the street corridor directly to Building 101 stop (p = 0.28).
  // Distance to facades is >= 8.4m throughout the entire descent (> 4m requirement).
  const frames: Keyframe[] = [
    {
      p: 0.0,
      pos: new THREE.Vector3(0.0, 78.0, 68.0),
      look: new THREE.Vector3(0.0, 74.0, -30.0),
      name: 'Sky Hero & Clouds Start',
    },
    {
      p: 0.10,
      pos: new THREE.Vector3(-16.0, 36.0, 18.0),
      look: new THREE.Vector3(-26.0, 22.0, -12.0),
      name: 'Cloud Descent',
    },
    {
      p: 0.20,
      pos: new THREE.Vector3(-34.0, 5.5, 1.0),
      look: new THREE.Vector3(p101.xPos, 2.0, RAW_BOUNDS.northRowZ),
      name: 'Avenue Approach 101',
    },
  ];

  // Tour stops: computed dynamically from building proxies & bounding boxes
  // Stop camera is framed closer (Z = -4.8, distance to facade is 8.6m, well over safe clearance)
  // framing the host (at X = proxy.xPos - 1.8, Z = -10.0) and building entrance together
  const stopProgress = [0.28, 0.44, 0.58, 0.72, 0.86];
  BUILDING_PROXIES.forEach((proxy, idx) => {
    const camZ = -4.8;
    frames.push({
      p: stopProgress[idx],
      pos: new THREE.Vector3(proxy.xPos - 0.6, EYE_HEIGHT, camZ),
      look: new THREE.Vector3(proxy.xPos - 0.8, EYE_HEIGHT + 0.15, -12.0),
      name: `Building ${proxy.number} (${proxy.name})`,
    });
  });

  // Final Hub camera position:
  // In the middle of the street, eye height 1.7m, >= 6m from facades, looking down the street
  frames.push({
    p: 1.0,
    pos: new THREE.Vector3(43.5, EYE_HEIGHT, 2.2),
    look: new THREE.Vector3(0.0, 1.75, 2.6),
    name: 'Destination Hub Overview',
  });

  return frames;
}

const STATIC_KEYFRAMES = computeKeyframes();

function getCurrentStopName(p: number, focusedIndex: number | null): string {
  if (focusedIndex !== null) {
    return `Building ${PORTFOLIO_CONTENT.buildings[focusedIndex].number} (Focus Mode)`;
  }
  for (let i = STATIC_KEYFRAMES.length - 1; i >= 0; i--) {
    if (p >= STATIC_KEYFRAMES[i].p - 0.05) {
      return STATIC_KEYFRAMES[i].name;
    }
  }
  return 'In Transit';
}

export const CameraController: React.FC = () => {
  perfRenderTracker.mark('CameraController');
  const { camera, scene } = useThree();
  const scrollProgress = useAppStore((s) => s.scrollProgress);
  const focusedBuildingIndex = useAppStore((s) => s.focusedBuildingIndex);
  const closeBuildingModal = useAppStore((s) => s.closeBuildingModal);
  const isTopDownDebug = useAppStore((s) => s.isTopDownDebug);
  const navJumpTimestamp = useAppStore((s) => s.navJumpTimestamp);
  const skipAnimation = useAppStore((s) => s.skipAnimation);

  const keyframes = useMemo(() => STATIC_KEYFRAMES, []);

  const currentCamPos = useRef(new THREE.Vector3(0.0, 72.0, 60.0));
  const currentLookAt = useRef(new THREE.Vector3(0.0, 62.0, -20.0));
  const targetCamPos = useRef(new THREE.Vector3(0.0, 72.0, 60.0));
  const targetLookAt = useRef(new THREE.Vector3(0.0, 62.0, -20.0));

  const mouseParallaxX = useRef(0);
  const mouseParallaxY = useRef(0);
  const lastFocusScrollProgress = useRef(0);
  const isFirstCamFrame = useRef(true);
  const quickEaseEndTime = useRef<number>(0);
  const lastNavJump = useRef(navJumpTimestamp);

  // Monitor quick nav jump triggers to apply quick ease (~0.6s)
  useEffect(() => {
    if (navJumpTimestamp !== lastNavJump.current) {
      lastNavJump.current = navJumpTimestamp;
      quickEaseEndTime.current = performance.now() + 650;
    }
  }, [navJumpTimestamp]);

  // Proximity warning state (dev-only: warns if camera within 3m of any mesh)
  const lastProximityWarnTime = useRef(0);
  const scanCounter = useRef(0);
  const tempBox = useRef(new THREE.Box3());

  // Mouse move listener for subtle parallax
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      mouseParallaxX.current = (e.clientX / window.innerWidth - 0.5) * 1.0;
      mouseParallaxY.current = (e.clientY / window.innerHeight - 0.5) * 0.5;
    };
    window.addEventListener('mousemove', handleMouseMove, { passive: true });
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, []);

  // Track scroll change while in focus mode to auto-dismiss modal
  useEffect(() => {
    if (focusedBuildingIndex !== null) {
      lastFocusScrollProgress.current = scrollProgress;
    }
  }, [focusedBuildingIndex]);

  useEffect(() => {
    if (
      focusedBuildingIndex !== null &&
      Math.abs(scrollProgress - lastFocusScrollProgress.current) > 0.04
    ) {
      closeBuildingModal(false);
    }
  }, [scrollProgress, focusedBuildingIndex, closeBuildingModal]);

  // Interpolate camera keyframes using smooth quintic easing
  const computeScrollCamera = (p: number) => {
    const clamped = Math.max(0, Math.min(1, p));
    for (let i = 0; i < keyframes.length - 1; i++) {
      const k1 = keyframes[i];
      const k2 = keyframes[i + 1];
      if (clamped >= k1.p && clamped <= k2.p) {
        const localT = (clamped - k1.p) / (k2.p - k1.p);
        // Quintic smootherstep easing for natural camera movement without harsh cuts
        const smoothT = localT * localT * localT * (localT * (localT * 6 - 15) + 10);
        targetCamPos.current.lerpVectors(k1.pos, k2.pos, smoothT);
        targetLookAt.current.lerpVectors(k1.look, k2.look, smoothT);
        return;
      }
    }
  };

  const isSignsOverview = useMemo(() => {
    if (typeof window === 'undefined') return false;
    const p = new URLSearchParams(window.location.search);
    return p.has('signs') || p.get('view') === 'all-signs';
  }, []);

  const isCrosswalkOverview = useMemo(() => {
    if (typeof window === 'undefined') return false;
    const p = new URLSearchParams(window.location.search);
    return p.has('cw') || p.get('view') === 'crosswalk';
  }, []);

  const isGreetOverview = useMemo(() => {
    if (typeof window === 'undefined') return false;
    const p = new URLSearchParams(window.location.search);
    return p.has('greet') || p.get('view') === 'greet';
  }, []);

  useFrame((_, delta) => {
    if (isTopDownDebug) {
      // Dev-only top-down debug view (Press B)
      camera.position.set(0, 115, RAW_BOUNDS.streetCenterZ);
      camera.up.set(0, 0, -1); // Street runs along X (horizontal), North is UP (-Z), South is DOWN (+Z)
      camera.lookAt(0, 0, RAW_BOUNDS.streetCenterZ);
      return;
    } else if (isSignsOverview) {
      // Perspective down the brownstone promenade showing all 5 storefront signs in sequence
      camera.position.set(-52.0, 3.8, -2.5);
      camera.up.set(0, 1, 0);
      camera.lookAt(12.0, 4.35, -13.40);
      return;
    } else if (isCrosswalkOverview) {
      // Dev-only street-level crosswalk framing (Crosswalk 2 at X = 13.0)
      // Positioned on south promenade looking across both road lanes at north kerb waiting point
      camera.position.set(6.5, 2.2, 5.8);
      camera.up.set(0, 1, 0);
      camera.lookAt(13.0, 1.2, -5.5);
      return;
    } else if (isGreetOverview) {
      // Dev-only perspective framing pedestrians greeting on south promenade
      camera.position.set(1.2, 1.85, 4.5);
      camera.up.set(0, 1, 0);
      camera.lookAt(4.8, 1.35, 8.7);
      return;
    } else {
      camera.up.set(0, 1, 0);
    }

    if (focusedBuildingIndex !== null) {
      const b = PORTFOLIO_CONTENT.buildings[focusedBuildingIndex];
      const isMobile = window.innerWidth < 640;
      // Closer framing: frames host (at X = b.xPos - 1.8) and building together
      targetCamPos.current.set(b.xPos - (isMobile ? 0.6 : 0.8), EYE_HEIGHT, -4.8);
      targetLookAt.current.set(b.xPos - (isMobile ? 0.8 : 1.2), EYE_HEIGHT + 0.15, -12.0);
    } else {
      computeScrollCamera(scrollProgress);

      // Gentle follow camera between stops:
      // When host is in the street tour (0.24 <= scrollProgress <= 0.88),
      // keep the host in frame (about 6-8 m behind and slightly to the side)
      if (scrollProgress >= 0.24 && scrollProgress <= 0.88) {
        const hostDebug = typeof window !== 'undefined' ? (window as any).__HOST_DEBUG__ : null;
        if (hostDebug && hostDebug.currentPos && hostDebug.activeTarget) {
          const hX = hostDebug.currentPos[0];
          const tX = hostDebug.activeTarget[0];
          const isWalking = hostDebug.state === 'WALKING';
          const dx = tX - hX;

          if (isWalking || Math.abs(dx) > 0.8) {
            // Host is walking along the north sidewalk (Z ~ -10.0)
            // Camera positioned 6-8m behind along movement direction and to the side (Z = -4.8)
            const behindOffsetX = dx >= 0 ? -4.5 : 4.5;
            const followX = hX + behindOffsetX;
            const lookAheadX = hX + (dx >= 0 ? 1.2 : -1.2);

            targetCamPos.current.set(followX, EYE_HEIGHT, -4.8);
            targetLookAt.current.set(lookAheadX, EYE_HEIGHT + 0.12, -9.8);
          }
        }
      }
    }

    const desiredPos = targetCamPos.current.clone();
    desiredPos.x += mouseParallaxX.current;
    desiredPos.y += -mouseParallaxY.current * 0.35;

    // Direct snap on initial frame or deep link, smooth position and target interpolation thereafter
    if (isFirstCamFrame.current) {
      currentCamPos.current.copy(desiredPos);
      currentLookAt.current.copy(targetLookAt.current);
      isFirstCamFrame.current = false;
    } else {
      const dt = Math.min(delta, 0.1);
      const isQuickEase = performance.now() < quickEaseEndTime.current;
      const lerpRate = isQuickEase ? 12.0 : skipAnimation ? 18.0 : 8.0;
      const alpha = 1.0 - Math.exp(-lerpRate * dt);
      currentCamPos.current.lerp(desiredPos, alpha);
      currentLookAt.current.lerp(targetLookAt.current, alpha);
    }

    // Debug Camera Override (allows automated tooling or debugging scripts to frame targets)
    if (typeof window !== 'undefined' && (window as any).__CAM_OVERRIDE__) {
      const o = (window as any).__CAM_OVERRIDE__;
      camera.position.set(o.pos[0], o.pos[1], o.pos[2]);
      camera.lookAt(o.look[0], o.look[1], o.look[2]);
      return;
    }

    camera.position.copy(currentCamPos.current);
    camera.lookAt(currentLookAt.current);

    if (typeof window !== 'undefined') {
      (window as any).__DEBUG_CAMERA__ = camera;
    }

    // Dynamic FOV: widens slightly (from 45 to 50 deg) during rapid cloud descent, easing back to 45 at street level
    if ((camera as THREE.PerspectiveCamera).isPerspectiveCamera) {
      const pCam = camera as THREE.PerspectiveCamera;
      let targetFov = 45;
      if (focusedBuildingIndex === null && scrollProgress < 0.22) {
        // Peaks midway through descent (p ~ 0.10)
        const descentProgress = THREE.MathUtils.clamp(scrollProgress / 0.20, 0.0, 1.0);
        const fovBump = Math.sin(descentProgress * Math.PI) * 5.0;
        targetFov = 45 + fovBump;
      }
      if (Math.abs(pCam.fov - targetFov) > 0.05) {
        pCam.fov += (targetFov - pCam.fov) * 0.1;
        pCam.updateProjectionMatrix();
      }
    }

    // ── 5. Proximity Collision Scanner (Dev-only warning if camera within 3m of any mesh) ─
    scanCounter.current++;
    if (scanCounter.current % 20 === 0) {
      let closestDist = Infinity;
      let closestMeshName = '';

      scene.traverse((obj) => {
        if ((obj as THREE.Mesh).isMesh && obj.visible) {
          const mesh = obj as THREE.Mesh;
          // Ignore camera line helpers, sky, infinite ground, and ground/road surfaces below eye level
          if (mesh.name === 'cam-debug' || mesh.name === 'sky' || mesh.name === 'ground-infinite') return;
          if (!mesh.geometry) return;

          if (!mesh.geometry.boundingBox) mesh.geometry.computeBoundingBox();
          if (mesh.geometry.boundingBox) {
            tempBox.current.copy(mesh.geometry.boundingBox).applyMatrix4(mesh.matrixWorld);
            if (tempBox.current.max.y <= 0.25) return; // Ignore roadway asphalt and ground plane beneath camera
            const dist = tempBox.current.distanceToPoint(camera.position);
            if (dist < closestDist) {
              closestDist = dist;
              closestMeshName = mesh.name || mesh.parent?.name || 'scene-mesh';
            }
          }
        }
      });

      if (closestDist < 3.0) {
        const now = performance.now();
        if (now - lastProximityWarnTime.current > 2500) {
          lastProximityWarnTime.current = now;
          const stopName = getCurrentStopName(scrollProgress, focusedBuildingIndex);
          console.warn(
            `[Camera Proximity Warning] Camera is within ${closestDist.toFixed(2)}m (< 3.0m) of "${closestMeshName}" at stop "${stopName}"! Camera pos: (${camera.position.x.toFixed(1)}, ${camera.position.y.toFixed(1)}, ${camera.position.z.toFixed(1)})`
          );
        }
      }
    }
  });

  return null;
};

