import React from 'react';
import { PORTFOLIO_CONTENT } from '../../data/content';
import { BrownstoneBlock } from './BrownstoneBlock';

export const BrownstoneRow: React.FC = () => {
  const { buildings } = PORTFOLIO_CONTENT;

  return (
    <group>
      {/* 2 Left Background Filler Townhouses */}
      <BrownstoneBlock centerX={-104} zPos={-19.2} variant={1} />
      <BrownstoneBlock centerX={-78} zPos={-19.2} variant={2} />

      {/* 5 Core Interactive Portfolio Buildings */}
      {buildings.map((b, idx) => (
        <BrownstoneBlock
          key={b.id}
          centerX={b.xPos}
          zPos={-19.2}
          buildingData={b}
          variant={idx}
        />
      ))}

      {/* 2 Right Background Filler Townhouses */}
      <BrownstoneBlock centerX={78} zPos={-19.2} variant={1} />
      <BrownstoneBlock centerX={104} zPos={-19.2} variant={0} />
    </group>
  );
};

