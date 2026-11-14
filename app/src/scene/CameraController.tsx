import React, { useEffect, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { useAppStore } from '../store/useAppStore';
import { PORTFOLIO_CONTENT } from '../data/content';

interface Keyframe {
  p: number;
  pos: THREE.Vector3;
  look: THREE.Vector3;
}

const KEYFRAMES: Keyframe[] = [
  { p: 0.0, pos: new THREE.Vector3(0, 70, 60), look: new THREE.Vector3(0, 60, -20) },      // High in sky
  { p: 0.1, pos: new THREE.Vector3(-26, 30, 45), look: new THREE.Vector3(-36, 15, 0) },    // Mid descent, avoiding trees
  { p: 0.2, pos: new THREE.Vector3(-52, 8.2, 28), look: new THREE.Vector3(-52, 8.2, -18) },// Approaching Building 1
  { p: 0.28, pos: new THREE.Vector3(-52, 6.2, 18), look: new THREE.Vector3(-52, 7.2, -19) },// Building 1 (-52)
  { p: 0.44, pos: new THREE.Vector3(-26, 6.2, 18), look: new THREE.Vector3(-26, 7.2, -19) },// Building 2 (-26)
  { p: 0.58, pos: new THREE.Vector3(0, 6.2, 18), look: new THREE.Vector3(0, 7.2, -19) },   // Building 3 (0)
  { p: 0.72, pos: new THREE.Vector3(26, 6.2, 18), look: new THREE.Vector3(26, 7.2, -19) },  // Building 4 (26)
  { p: 0.86, pos: new THREE.Vector3(52, 6.2, 18), look: new THREE.Vector3(52, 7.2, -19) },  // Building 5 (52)
  { p: 1.0, pos: new THREE.Vector3(4, 5.5, 36), look: new THREE.Vector3(-6, 3.5, 12) },     // Hub Overview
];

export const CameraController: React.FC = () => {
  const { camera } = useThree();
  const scrollProgress = useAppStore((s) => s.scrollProgress);
  const focusedBuildingIndex = useAppStore((s) => s.focusedBuildingIndex);
  const closeBuildingModal = useAppStore((s) => s.closeBuildingModal);

  const currentCamPos = useRef(new THREE.Vector3(0, 64, 30));
  const currentLookAt = useRef(new THREE.Vector3(0, 62, -30));
  const targetCamPos = useRef(new THREE.Vector3(0, 64, 30));
  const targetLookAt = useRef(new THREE.Vector3(0, 62, -30));

  const introCameraPanY = useRef(scrollProgress > 0 || focusedBuildingIndex !== null ? 0 : 80);
  const introCameraPanZ = useRef(scrollProgress > 0 || focusedBuildingIndex !== null ? 0 : 40);
  const mouseParallaxX = useRef(0);
  const mouseParallaxY = useRef(0);
  const lastFocusScrollProgress = useRef(0);

  // Mouse move listener for subtle parallax
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      mouseParallaxX.current = (e.clientX / window.innerWidth - 0.5) * 1.4;
      mouseParallaxY.current = (e.clientY / window.innerHeight - 0.5) * 0.8;
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

  // Interpolate camera keyframes
  const computeScrollCamera = (p: number) => {
    const clamped = Math.max(0, Math.min(1, p));
    for (let i = 0; i < KEYFRAMES.length - 1; i++) {
      const k1 = KEYFRAMES[i];
      const k2 = KEYFRAMES[i + 1];
      if (clamped >= k1.p && clamped <= k2.p) {
        const localT = (clamped - k1.p) / (k2.p - k1.p);
        const smoothT = localT * localT * (3 - 2 * localT); // Hermite smoothstep
        targetCamPos.current.lerpVectors(k1.pos, k2.pos, smoothT);
        targetLookAt.current.lerpVectors(k1.look, k2.look, smoothT);
        return;
      }
    }
  };

  useFrame(() => {
    if (focusedBuildingIndex !== null) {
      const b = PORTFOLIO_CONTENT.buildings[focusedBuildingIndex];
      const isMobile = window.innerWidth < 640;
      targetCamPos.current.set(b.xPos + (isMobile ? 0 : 5.5), 4.8, 7.2);
      targetLookAt.current.set(b.xPos + (isMobile ? 0 : 4.2), 4.6, -15);
    } else {
      computeScrollCamera(scrollProgress);
    }

    // Cinematic Intro Decay
    introCameraPanY.current *= 0.985;
    introCameraPanZ.current *= 0.985;

    const desiredPos = targetCamPos.current.clone();
    desiredPos.x += mouseParallaxX.current;
    desiredPos.y += -mouseParallaxY.current * 0.45 + introCameraPanY.current;
    desiredPos.z += introCameraPanZ.current;

    // Direct snap on deep-link / initial non-zero scroll progress, smooth lerp thereafter
    if (introCameraPanY.current === 0 && (scrollProgress > 0 || focusedBuildingIndex !== null)) {
      currentCamPos.current.lerp(desiredPos, 0.25);
      currentLookAt.current.lerp(targetLookAt.current, 0.25);
    } else {
      currentCamPos.current.lerp(desiredPos, 0.035);
      currentLookAt.current.lerp(targetLookAt.current, 0.04);
    }

    camera.position.copy(currentCamPos.current);
    camera.lookAt(currentLookAt.current);
  });

  return null;
};

