import React, { useRef, useEffect } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { useAppStore } from '../store/useAppStore';

export const PerformanceManager: React.FC = () => {
  const { gl } = useThree();
  const dpr = useAppStore((s) => s.dpr);
  const shadowsEnabled = useAppStore((s) => s.shadowsEnabled);
  const isLowPerformanceMode = useAppStore((s) => s.isLowPerformanceMode);
  const activateLowPerformanceMode = useAppStore((s) => s.activateLowPerformanceMode);
  const isLoading = useAppStore((s) => s.isLoading);

  const loadEndTimeRef = useRef<number | null>(null);
  const windowStartTime = useRef<number | null>(null);
  const frameCount = useRef(0);

  // Keep renderer DPR & shadow map in sync with store
  useEffect(() => {
    gl.setPixelRatio(dpr);
    gl.shadowMap.enabled = shadowsEnabled;
  }, [dpr, shadowsEnabled, gl]);

  // Monitor framerate in useFrame
  useFrame(() => {
    if (isLowPerformanceMode) return;

    const now = performance.now();

    // 1. Hold timer while scene is still loading assets
    if (isLoading) {
      loadEndTimeRef.current = null;
      windowStartTime.current = null;
      frameCount.current = 0;
      return;
    }

    // Set load finish timestamp upon completion of loading screen
    if (loadEndTimeRef.current === null) {
      loadEndTimeRef.current = now;
      console.log('[PerformanceManager] Scene load finished. Starting 3-second grace period...');
      return;
    }

    // 2. 3-second grace period after load to allow shader compilation and texture uploads
    if (now - loadEndTimeRef.current < 3000) {
      windowStartTime.current = now;
      frameCount.current = 0;
      return;
    }

    // Initialize 2-second moving average window
    if (windowStartTime.current === null) {
      windowStartTime.current = now;
      frameCount.current = 0;
      return;
    }

    // 3. Accumulate frames over 2-second window
    frameCount.current++;
    const windowElapsed = now - windowStartTime.current;

    if (windowElapsed >= 2000) {
      const avgFps = (frameCount.current * 1000) / windowElapsed;
      console.log(`[PerformanceManager] Measured FPS (2s average): ${avgFps.toFixed(1)}`);

      // Only drop quality if the 2-second average is strictly below 30 FPS
      if (avgFps < 30) {
        console.warn(`[PerformanceManager] Average FPS (${avgFps.toFixed(1)}) fell below 30 FPS threshold. Dropping quality to low performance mode.`);
        activateLowPerformanceMode();
      }

      // Reset for next 2-second sampling window
      frameCount.current = 0;
      windowStartTime.current = now;
    }
  });

  return null;
};
