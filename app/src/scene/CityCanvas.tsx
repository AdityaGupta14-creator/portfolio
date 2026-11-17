import React, { Suspense } from 'react';
import { Canvas } from '@react-three/fiber';
import * as THREE from 'three';
import { CityScene } from './CityScene';
import { CameraController } from './CameraController';
import { PerformanceManager } from './PerformanceManager';
import { PerfCanvasTracker } from './PerfCanvasTracker';
import { useAppStore } from '../store/useAppStore';

export const CityCanvas: React.FC = () => {
  const dpr = useAppStore((s) => s.dpr);
  const shadowsEnabled = useAppStore((s) => s.shadowsEnabled);

  return (
    <div id="canvas-container" className="fixed inset-0 w-screen h-screen z-0 pointer-events-auto">
      <Canvas
        shadows={shadowsEnabled}
        dpr={dpr}
        camera={{ position: [0, 70, 60], fov: 45, near: 0.5, far: 500 }}
        gl={{
          antialias: true,
          powerPreference: 'high-performance',
          toneMapping: THREE.ACESFilmicToneMapping,
          toneMappingExposure: 1.0,
        }}
        onCreated={({ gl }) => {
          gl.shadowMap.enabled = shadowsEnabled;
          gl.shadowMap.type = THREE.PCFSoftShadowMap;
        }}
      >
        <PerfCanvasTracker />
        <PerformanceManager />
        <CameraController />
        <Suspense fallback={null}>
          <CityScene />
        </Suspense>
      </Canvas>
    </div>
  );
};
