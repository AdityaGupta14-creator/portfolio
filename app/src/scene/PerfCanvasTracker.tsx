import React from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { perfMetricsManager } from '../utils/perfTracker';

export const PerfCanvasTracker: React.FC = () => {
  const { gl } = useThree();

  useFrame(() => {
    perfMetricsManager.recordFrame(gl);
  });

  return null;
};
