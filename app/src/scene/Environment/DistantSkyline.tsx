import React, { useMemo } from 'react';

interface SkylineBuilding {
  pos: [number, number, number];
  size: [number, number, number];
  color: string;
  hasSpire?: boolean;
}

export const DistantSkyline: React.FC = () => {
  // Generate deterministic distant skyscraper blocks
  const buildings = useMemo<SkylineBuilding[]>(() => {
    const list: SkylineBuilding[] = [];
    const colors = ['#334155', '#475569', '#3b4252', '#2e3440', '#4c566a', '#3f3f46'];

    // 1. North distant skyline (behind the brownstone row)
    for (let x = -160; x <= 160; x += 18) {
      const h = 32 + ((Math.abs(x * 13) % 45) + 8);
      const w = 12 + ((Math.abs(x * 7) % 10));
      const d = 12 + ((Math.abs(x * 11) % 10));
      const z = -65 - ((Math.abs(x * 17) % 45));
      const color = colors[Math.abs(x) % colors.length];
      list.push({
        pos: [x + ((x % 3) * 2), h / 2, z],
        size: [w, h, d],
        color,
        hasSpire: h > 55,
      });
    }

    // 2. South distant skyline (behind south facing row)
    for (let x = -150; x <= 150; x += 22) {
      const h = 28 + ((Math.abs(x * 19) % 35));
      const w = 14 + ((Math.abs(x * 5) % 8));
      const d = 14 + ((Math.abs(x * 9) % 8));
      const z = 65 + ((Math.abs(x * 13) % 40));
      const color = colors[(Math.abs(x) + 2) % colors.length];
      list.push({
        pos: [x, h / 2, z],
        size: [w, h, d],
        color,
        hasSpire: h > 50,
      });
    }

    // 3. West / East distant horizon avenue vistas (framing both ends of the street)
    const endPositions: Array<[number, number]> = [
      [-220, -15], [-200, 10], [-175, -5], [-155, 18], [-140, -18],
      [140, -18], [155, 18], [175, -5], [200, 10], [220, -15]
    ];
    endPositions.forEach(([x, z], idx) => {
      const h = 38 + ((Math.abs(x * 11) % 32));
      const w = 18 + ((Math.abs(x * 3) % 12));
      const d = 18 + ((Math.abs(x * 5) % 12));
      list.push({
        pos: [x, h / 2, z],
        size: [w, h, d],
        color: colors[idx % colors.length],
        hasSpire: h > 48,
      });
    });

    return list;
  }, []);

  return (
    <group name="DistantSkyline">
      {buildings.map((b, i) => (
        <group key={i} position={b.pos}>
          {/* Main Tower Box */}
          <mesh castShadow={false} receiveShadow>
            <boxGeometry args={b.size} />
            <meshStandardMaterial
              color={b.color}
              roughness={0.9}
              metalness={0.05}
              toneMapped
            />
          </mesh>

          {/* Rooftop Structure / Antenna Spire */}
          {b.hasSpire && (
            <mesh position={[0, b.size[1] / 2 + 3, 0]}>
              <cylinderGeometry args={[0.2, 0.4, 6, 8]} />
              <meshStandardMaterial color="#64748b" roughness={0.8} />
            </mesh>
          )}

          {/* Rooftop Mechanical Box */}
          <mesh position={[0, b.size[1] / 2 + 1, 0]}>
            <boxGeometry args={[b.size[0] * 0.4, 2, b.size[2] * 0.4]} />
            <meshStandardMaterial color="#1e293b" roughness={0.9} />
          </mesh>
        </group>
      ))}
    </group>
  );
};
