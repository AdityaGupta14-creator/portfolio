import React, { useEffect, useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { useAppStore } from '../store/useAppStore';
import { PORTFOLIO_CONTENT } from '../data/content';
import { BUILDING_PROXIES, RAW_BOUNDS } from '../data/buildings';

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
  // Start with hero view in street looking down the avenue
  const frames: Keyframe[] = [
    {
      p: 0.0,
      pos: new THREE.Vector3(p101.xPos - 12.0, EYE_HEIGHT, 1.2),
      look: new THREE.Vector3(p101.xPos + 18.0, 1.95, RAW_BOUNDS.northRowZ),
      name: 'Hero Street View',
    },
    {
      p: 0.14,
      pos: new THREE.Vector3(p101.xPos - 4.0, EYE_HEIGHT, 0.5),
      look: new THREE.Vector3(p101.xPos, 2.0, RAW_BOUNDS.northRowZ),
      name: 'Approach Building 101',
    },
  ];

  // Tour stops: computed dynamically from building proxies & bounding boxes
  const stopProgress = [0.28, 0.44, 0.58, 0.72, 0.86];
  BUILDING_PROXIES.forEach((proxy, idx) => {
    // Street corridor is at Z = -0.8. Safe distance from facade at -13.4 is 12.6m (> 4m safe clearance)
    const camZ = -0.8;
    frames.push({
      p: stopProgress[idx],
      pos: new THREE.Vector3(proxy.xPos, EYE_HEIGHT, camZ),
      look: new THREE.Vector3(proxy.xPos, EYE_HEIGHT + 0.35, proxy.zPos),
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
  const { camera, scene } = useThree();
  const scrollProgress = useAppStore((s) => s.scrollProgress);
  const focusedBuildingIndex = useAppStore((s) => s.focusedBuildingIndex);
  const closeBuildingModal = useAppStore((s) => s.closeBuildingModal);
  const isTopDownDebug = useAppStore((s) => s.isTopDownDebug);

  const keyframes = useMemo(() => STATIC_KEYFRAMES, []);

  const currentCamPos = useRef(new THREE.Vector3(-56.0, EYE_HEIGHT, 1.2));
  const currentLookAt = useRef(new THREE.Vector3(-25.0, 1.95, -14.0));
  const targetCamPos = useRef(new THREE.Vector3(-56.0, EYE_HEIGHT, 1.2));
  const targetLookAt = useRef(new THREE.Vector3(-25.0, 1.95, -14.0));

  const mouseParallaxX = useRef(0);
  const mouseParallaxY = useRef(0);
  const lastFocusScrollProgress = useRef(0);
  const isFirstCamFrame = useRef(true);

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

  useFrame(() => {
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
    } else {
      camera.up.set(0, 1, 0);
    }

    if (focusedBuildingIndex !== null) {
      const b = PORTFOLIO_CONTENT.buildings[focusedBuildingIndex];
      const isMobile = window.innerWidth < 640;
      // Focus mode stays safely in street corridor (Z = -0.8, >= 12.6m from facade)
      targetCamPos.current.set(b.xPos + (isMobile ? 0 : 3.5), EYE_HEIGHT + 0.2, RAW_BOUNDS.streetCenterZ);
      targetLookAt.current.set(b.xPos, EYE_HEIGHT + 0.35, RAW_BOUNDS.northRowZ);
    } else {
      computeScrollCamera(scrollProgress);
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
      currentCamPos.current.lerp(desiredPos, 0.06);
      currentLookAt.current.lerp(targetLookAt.current, 0.06);
    }

    camera.position.copy(currentCamPos.current);
    camera.lookAt(currentLookAt.current);

    // ── 5. Proximity Collision Scanner (Dev-only warning if camera within 3m of any mesh) ─
    scanCounter.current++;
    if (scanCounter.current % 20 === 0) {
      let closestDist = Infinity;
      let closestMeshName = '';

      scene.traverse((obj) => {
        if ((obj as THREE.Mesh).isMesh && obj.visible) {
          const mesh = obj as THREE.Mesh;
          // Ignore camera line helpers, sky, and infinite ground
          if (mesh.name === 'cam-debug' || mesh.name === 'sky' || mesh.name === 'ground-infinite') return;
          if (!mesh.geometry) return;

          tempBox.current.setFromObject(mesh);
          if (!tempBox.current.isEmpty()) {
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

