import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import * as THREE from 'three';
import { useAppStore } from '../store/useAppStore';
import { PORTFOLIO_CONTENT } from '../data/content';

interface Keyframe {
  p: number;
  pos: THREE.Vector3;
  look: THREE.Vector3;
  description?: string;
}

// Recomputed camera waypoints from Sketchfab city bounding boxes:
// North row facade is at Z = -16.0 (stoops to -13.5)
// South row facade is at Z = +16.0 (stoops to +13.5)
// Street center is at Z = 0.0 (distance to both facades >= 16m, well above 4m minimum)
// Eye height: 1.75m (~1.7m human eye level)
const KEYFRAMES: Keyframe[] = [
  // p = 0.0: Hero street-level view looking down Brownstone Ave in perspective
  { p: 0.0, pos: new THREE.Vector3(-56, 1.75, 1.5), look: new THREE.Vector3(-32, 2.0, -14.0), description: 'Hero Perspective' },
  // p = 0.14: Mid street approach aligning with Building 101
  { p: 0.14, pos: new THREE.Vector3(-54, 1.75, 0.5), look: new THREE.Vector3(-52, 2.0, -15.5), description: 'Approach 101' },
  // p = 0.28: Stop 1: Building 101 (About Me, X = -52) — facing entrance door
  { p: 0.28, pos: new THREE.Vector3(-52, 1.75, 0.0), look: new THREE.Vector3(-52, 2.0, -16.0), description: 'Building 101 (About Me)' },
  // p = 0.44: Stop 2: Building 103 (Skills, X = -26) — facing entrance door
  { p: 0.44, pos: new THREE.Vector3(-26, 1.75, 0.0), look: new THREE.Vector3(-26, 2.0, -16.0), description: 'Building 103 (Skills)' },
  // p = 0.58: Stop 3: Building 105 (Projects, X = 0) — facing entrance door
  { p: 0.58, pos: new THREE.Vector3(0, 1.75, 0.0), look: new THREE.Vector3(0, 2.0, -16.0), description: 'Building 105 (Projects)' },
  // p = 0.72: Stop 4: Building 107 (Resume, X = 26) — facing entrance door
  { p: 0.72, pos: new THREE.Vector3(26, 1.75, 0.0), look: new THREE.Vector3(26, 2.0, -16.0), description: 'Building 107 (Resume)' },
  // p = 0.86: Stop 5: Building 109 (Contact, X = 52) — facing entrance door (no wall clipping)
  { p: 0.86, pos: new THREE.Vector3(52, 1.75, 0.0), look: new THREE.Vector3(52, 2.0, -16.0), description: 'Building 109 (Contact)' },
  // p = 1.0: Avenue Overview / Finale looking back along the street
  { p: 1.0, pos: new THREE.Vector3(56, 2.0, 2.0), look: new THREE.Vector3(15, 2.0, -14.0), description: 'Avenue Finale' },
];

const TEMP_BOX = new THREE.Box3();

export const CameraController: React.FC = () => {
  const { camera, scene } = useThree();
  const scrollProgress = useAppStore((s) => s.scrollProgress);
  const focusedBuildingIndex = useAppStore((s) => s.focusedBuildingIndex);
  const closeBuildingModal = useAppStore((s) => s.closeBuildingModal);

  // Debug mode toggle: Press C
  const [debugMode, setDebugMode] = useState(false);
  const [closestDist, setClosestDist] = useState<number | null>(null);

  const currentCamPos = useRef(new THREE.Vector3(-56, 1.75, 1.5));
  const currentLookAt = useRef(new THREE.Vector3(-32, 2.0, -14.0));
  const targetCamPos = useRef(new THREE.Vector3(-56, 1.75, 1.5));
  const targetLookAt = useRef(new THREE.Vector3(-32, 2.0, -14.0));

  const mouseParallaxX = useRef(0);
  const mouseParallaxY = useRef(0);
  const lastFocusScrollProgress = useRef(0);
  const frameCount = useRef(0);

  // Press C to toggle Camera Path & Collision Debug Mode
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'c' || e.key === 'C') {
        setDebugMode((prev) => {
          const next = !prev;
          console.log(`[Camera Debug Mode] ${next ? 'ENABLED (Press C to disable)' : 'DISABLED'}`);
          return next;
        });
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, []);

  // Mouse move listener for subtle parallax
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      mouseParallaxX.current = (e.clientX / window.innerWidth - 0.5) * 0.8;
      mouseParallaxY.current = (e.clientY / window.innerHeight - 0.5) * 0.4;
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

  // Interpolate camera keyframes with smooth quintic easing
  const computeScrollCamera = (p: number) => {
    const clamped = Math.max(0, Math.min(1, p));
    for (let i = 0; i < KEYFRAMES.length - 1; i++) {
      const k1 = KEYFRAMES[i];
      const k2 = KEYFRAMES[i + 1];
      if (clamped >= k1.p && clamped <= k2.p) {
        const localT = (clamped - k1.p) / (k2.p - k1.p);
        // Quintic smootherstep easing (zero sudden acceleration cuts)
        const smoothT = localT * localT * localT * (localT * (localT * 6 - 15) + 10);
        targetCamPos.current.lerpVectors(k1.pos, k2.pos, smoothT);
        targetLookAt.current.lerpVectors(k1.look, k2.look, smoothT);
        return;
      }
    }
  };

  useFrame(() => {
    if (focusedBuildingIndex !== null) {
      // Focus mode: Eye level 1.75m, middle street Z=-5.0 (11m from facade), looking at door
      const b = PORTFOLIO_CONTENT.buildings[focusedBuildingIndex];
      targetCamPos.current.set(b.xPos, 1.75, -5.0);
      targetLookAt.current.set(b.xPos, 2.0, -16.0);
    } else {
      computeScrollCamera(scrollProgress);
    }

    const desiredPos = targetCamPos.current.clone();
    desiredPos.x += mouseParallaxX.current;
    desiredPos.y += -mouseParallaxY.current * 0.3;

    // Smooth camera position & lookAt tracking
    currentCamPos.current.lerp(desiredPos, 0.065);
    currentLookAt.current.lerp(targetLookAt.current, 0.08);

    camera.position.copy(currentCamPos.current);
    camera.lookAt(currentLookAt.current);

    // Minimum distance collision check (Debug mode or periodic safety)
    frameCount.current++;
    if (debugMode && frameCount.current % 12 === 0) {
      let minMeshDist = Infinity;
      let closestMeshName = '';

      scene.traverse((obj) => {
        if (obj instanceof THREE.Mesh && obj.visible && obj.geometry) {
          // Skip camera path debug objects
          if (obj.name.startsWith('cam-debug')) return;
          if (!obj.geometry.boundingBox) obj.geometry.computeBoundingBox();
          if (obj.geometry.boundingBox) {
            TEMP_BOX.copy(obj.geometry.boundingBox).applyMatrix4(obj.matrixWorld);
            const d = TEMP_BOX.distanceToPoint(camera.position);
            if (d < minMeshDist) {
              minMeshDist = d;
              closestMeshName = obj.name || obj.parent?.name || 'mesh';
            }
          }
        }
      });

      setClosestDist(minMeshDist);

      if (minMeshDist < 3.0) {
        console.warn(
          `[Camera Collision Warning] Camera is within ${minMeshDist.toFixed(2)}m of "${closestMeshName}"! Position:`,
          camera.position
        );
      }
    }
  });

  // Camera Path Visual Curve for Debug Mode
  const debugLineObj = useMemo(() => {
    const points = KEYFRAMES.map((k) => k.pos);
    const curve = new THREE.CatmullRomCurve3(points);
    const sampled = curve.getPoints(120);
    const geom = new THREE.BufferGeometry().setFromPoints(sampled);
    const mat = new THREE.LineBasicMaterial({ color: 0x00ffcc, linewidth: 3 });
    return new THREE.Line(geom, mat);
  }, []);

  return (
    <>
      {debugMode && (
        <group name="cam-debug-group">
          {/* Visual Camera Path Spline */}
          <primitive object={debugLineObj} />

          {/* Keyframe Position Spheres */}
          {KEYFRAMES.map((k, i) => (
            <mesh key={i} position={k.pos} name="cam-debug-sphere">
              <sphereGeometry args={[0.3, 16, 16]} />
              <meshBasicMaterial color="#ff0055" />
            </mesh>
          ))}

          {/* On-Screen Debug HUD */}
          <Html position={[0, 0, 0]}>
            <div className="fixed top-20 right-6 z-50 bg-slate-900/95 border border-cyan-500 rounded-xl p-3 text-xs font-mono text-cyan-300 shadow-2xl backdrop-blur-md">
              <div className="font-bold text-emerald-400 mb-1">📷 Camera Path Debug Mode (Press C)</div>
              <div>Pos: X={camera.position.x.toFixed(2)} Y={camera.position.y.toFixed(2)} Z={camera.position.z.toFixed(2)}</div>
              <div>Closest Mesh Dist: <span className={closestDist !== null && closestDist < 3.0 ? 'text-rose-400 font-bold' : 'text-amber-300'}>{closestDist !== null ? `${closestDist.toFixed(2)} m` : 'Scanning...'}</span></div>
              <div className="text-[10px] text-slate-400 mt-1">Min Safe Facade Clearance: 4.0 m | Warning Threshold: 3.0 m</div>
            </div>
          </Html>
        </group>
      )}
    </>
  );
};

