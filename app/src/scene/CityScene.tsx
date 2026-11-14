import React, { useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { SkyAndAtmosphere } from './Environment/SkyAndAtmosphere';
import { StreetGround } from './Environment/StreetGround';
import { BrownstoneRow } from './Buildings/BrownstoneRow';
import { SketchfabCity } from './Buildings/SketchfabCity';
import { StreetProps } from './Props/StreetProps';
import { BuildingPins } from './Props/BuildingPins';
import { TrafficGroup } from './Actors/TrafficGroup';
import { PedestrianGroup } from './Actors/PedestrianGroup';
import { HostCharacter } from './Actors/HostCharacter';
import { useAppStore } from '../store/useAppStore';
import { PORTFOLIO_CONTENT } from '../data/content';

export const CityScene: React.FC = () => {
  const focusedBuildingIndex = useAppStore((s) => s.focusedBuildingIndex);
  const useOldCity = useAppStore((s) => s.useOldCity);
  const spotlightRef = useRef<THREE.SpotLight>(null);
  const spotlightTargetRef = useRef<THREE.Object3D>(null);

  // Animate spotlight following focused building
  useFrame(() => {
    if (spotlightRef.current && spotlightTargetRef.current) {
      if (focusedBuildingIndex !== null) {
        const b = PORTFOLIO_CONTENT.buildings[focusedBuildingIndex];
        spotlightTargetRef.current.position.set(b.xPos, 0, -19.2);
        spotlightRef.current.position.set(b.xPos, 25, 5);
        spotlightRef.current.intensity += (1.2 - spotlightRef.current.intensity) * 0.1;
      } else {
        spotlightRef.current.intensity += (0 - spotlightRef.current.intensity) * 0.1;
      }
    }
  });

  return (
    <>
      {/* 1. Sky, sun, halo, drifting clouds, dynamic lights, and fog */}
      <SkyAndAtmosphere />

      {/* 2. Ground, lawn, sidewalks, curbs, roadway, lane dashes, and crosswalks */}
      <StreetGround />

      {/* 3. Street Props: Vintage Streetlamps, Hydrants, Benches, and Swaying Trees */}
      <StreetProps />

      {/* 4. Buildings: New Sketchfab City vs. Legacy Brownstone Row (USE_OLD_CITY switch) */}
      {useOldCity ? (
        <>
          <BrownstoneRow />
          {/* Floating 3D Building Pins on Roofs (legacy) */}
          <BuildingPins />
        </>
      ) : (
        <SketchfabCity />
      )}

      {/* 6. Traffic Simulation: 12 Moving Cars/Cabs with Spinning Wheels & Lights */}
      <TrafficGroup />

      {/* 7. Pedestrian Simulation: 24 Articulated Walking Humanoids */}
      <PedestrianGroup />

      {/* 8. Articulated Host Character (Aditya) with Escort Pathfinding & Speech Bubble */}
      <HostCharacter />

      {/* Building Accent Spotlight */}
      <object3D ref={spotlightTargetRef} position={[0, 0, -19.2]} />
      <spotLight
        ref={spotlightRef}
        color={0xfbbf24}
        intensity={0}
        distance={80}
        angle={0.6}
        penumbra={0.5}
        decay={1}
        position={[0, 35, 15]}
        target={spotlightTargetRef.current || undefined}
      />
    </>
  );
};
