import React, { useRef, useEffect } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { useAppStore } from '../store/useAppStore';

export const PerformanceManager: React.FC = () => {
  const { gl } = useThree();
  const dpr = useAppStore((s) => s.dpr);
  const shadowsEnabled = useAppStore((s) => s.shadowsEnabled);
  const isLowPerformanceMode = useAppStore((s) => s.isLowPerformanceMode);
  const activateLowPerformanceMode = useAppStore((s) => s.activateLowPerformanceMode);
  const scrollProgress = useAppStore((s) => s.scrollProgress);

  const frameCount = useRef(0);
  const lastTime = useRef(performance.now());
  const startTime = useRef(performance.now());
  const lowFpsSamples = useRef(0);

  // Keep renderer DPR & shadow map in sync with store
  useEffect(() => {
    gl.setPixelRatio(dpr);
    gl.shadowMap.enabled = shadowsEnabled;
  }, [dpr, shadowsEnabled, gl]);

  // Monitor framerate in useFrame
  useFrame(() => {
    if (isLowPerformanceMode) return;

    const now = performance.now();

    // Warm-up grace period (3.5 seconds) to allow shader compilation
    if (now - startTime.current < 3500) {
      lastTime.current = now;
      frameCount.current = 0;
      return;
    }

    frameCount.current++;
    const elapsed = now - lastTime.current;

    if (elapsed >= 1000) {
      const fps = (frameCount.current * 1000) / elapsed;
      frameCount.current = 0;
      lastTime.current = now;

      // Auto-scale if FPS drops below 40 for 2 consecutive seconds while actively scrolling
      if (fps < 40 && scrollProgress > 0.08) {
        lowFpsSamples.current++;
        if (lowFpsSamples.current >= 2) {
          activateLowPerformanceMode();
        }
      } else {
        lowFpsSamples.current = 0;
      }
    }
  });

  return null;
};
