import React, { useMemo } from 'react';
import * as THREE from 'three';
import { BUILDING_PROXIES, BuildingProxyDef, RAW_BOUNDS } from '../../data/buildings';

/**
 * Creates a crisp, high-contrast storefront sign texture.
 * Dark obsidian panel, dual polished gold/amber border, building number pill,
 * bold warm amber title, and warm golden cream subtitle.
 */
function createStorefrontCanvasTexture(proxy: BuildingProxyDef): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = 256;
  const ctx = canvas.getContext('2d');
  if (!ctx) return new THREE.CanvasTexture(canvas);

  // 1. Dark obsidian panel background
  ctx.fillStyle = '#0a0e17';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Interior panel inset
  ctx.fillStyle = '#0f172a';
  ctx.fillRect(12, 12, canvas.width - 24, canvas.height - 24);

  // 2. Dual polished gold/amber border
  ctx.strokeStyle = '#d97706';
  ctx.lineWidth = 8;
  ctx.strokeRect(6, 6, canvas.width - 12, canvas.height - 12);

  ctx.strokeStyle = '#fbbf24';
  ctx.lineWidth = 3;
  ctx.strokeRect(16, 16, canvas.width - 32, canvas.height - 32);

  // Corner brass rosettes
  const rosetteRadius = 7;
  const corners = [
    [24, 24],
    [canvas.width - 24, 24],
    [24, canvas.height - 24],
    [canvas.width - 24, canvas.height - 24],
  ];
  ctx.fillStyle = '#f59e0b';
  corners.forEach(([cx, cy]) => {
    ctx.beginPath();
    ctx.arc(cx, cy, rosetteRadius, 0, Math.PI * 2);
    ctx.fill();
  });

  // 3. Building Number Badge Pill (e.g. 101, 103, 105, 107, 109)
  ctx.fillStyle = proxy.sign.trimColor;
  ctx.beginPath();
  ctx.roundRect(32, (canvas.height - 72) / 2, 88, 72, 16);
  ctx.fill();

  ctx.fillStyle = '#0a0e17';
  ctx.font = 'bold 38px "Space Grotesk", sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(proxy.number, 76, canvas.height / 2);

  // 4. Shop Title (Bold Warm Amber, high-contrast)
  ctx.fillStyle = '#fbbf24';
  ctx.font = 'bold 56px "Space Grotesk", "Inter", sans-serif';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.shadowColor = 'rgba(0, 0, 0, 0.85)';
  ctx.shadowBlur = 8;
  ctx.fillText(proxy.sign.title, 142, canvas.height / 2 - 28);

  // 5. Divider and Category Subtitle (Warm Golden Cream)
  ctx.shadowBlur = 6;
  ctx.fillStyle = '#fef08a';
  ctx.font = 'bold 38px "Space Grotesk", "Inter", sans-serif';
  ctx.fillText(`/  ${proxy.sign.subtitle.toUpperCase()}`, 144, canvas.height / 2 + 32);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 8;
  texture.needsUpdate = true;
  return texture;
}

/**
 * Creates an authentic striped canvas awning texture.
 */
function createAwningFabricTexture(accentColor: string): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d');
  if (!ctx) return new THREE.CanvasTexture(canvas);

  const stripeWidth = 64;
  for (let x = 0; x < canvas.width; x += stripeWidth * 2) {
    ctx.fillStyle = accentColor;
    ctx.fillRect(x, 0, stripeWidth, canvas.height);
    ctx.fillStyle = '#fbf7ee';
    ctx.fillRect(x + stripeWidth, 0, stripeWidth, canvas.height);
  }

  // Subtle fabric thread lines
  ctx.strokeStyle = 'rgba(0,0,0,0.06)';
  ctx.lineWidth = 1;
  for (let y = 0; y < canvas.height; y += 8) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(canvas.width, y);
    ctx.stroke();
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(4, 1);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.needsUpdate = true;
  return texture;
}

export const StorefrontSignsAndAwnings: React.FC = () => {
  // Memoize canvas textures for all 5 hero buildings
  const { signTextures, awningTextures } = useMemo(() => {
    const sTexs: Record<number, THREE.CanvasTexture> = {};
    const aTexs: Record<number, THREE.CanvasTexture> = {};
    BUILDING_PROXIES.forEach((p) => {
      sTexs[p.id] = createStorefrontCanvasTexture(p);
      aTexs[p.id] = createAwningFabricTexture(p.sign.awningColor);
    });
    return { signTextures: sTexs, awningTextures: aTexs };
  }, []);

  // Shared geometry definitions
  const signGeom = useMemo(() => new THREE.BoxGeometry(3.2, 0.8, 0.1), []);
  const frameMat = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: 0x18181b,
        roughness: 0.5,
        metalness: 0.4,
        depthWrite: true,
      }),
    []
  );

  return (
    <group name="StorefrontSignsAndAwnings">
      {BUILDING_PROXIES.map((proxy) => {
        const signTex = signTextures[proxy.id];
        const awningTex = awningTextures[proxy.id];

        // Facade wall sits at RAW_BOUNDS.northRowZ (-13.40m)
        // Sign mounted 0.05m off wall: center Z = -13.40 + 0.05 + 0.05 = -13.30
        const signZ = RAW_BOUNDS.northRowZ + proxy.sign.wallOffset + proxy.sign.depth / 2;
        // Mounted on the architectural frieze band above ground-floor entrance
        const signY = 4.35;

        // Awning sits right over the doorway below the sign board
        const awningTopY = 3.45;
        const awningDropY = 2.95;
        const awningWallZ = RAW_BOUNDS.northRowZ + 0.02;
        const awningFrontZ = RAW_BOUNDS.northRowZ + 0.90;

        return (
          <group key={`storefront-${proxy.id}`} position={[proxy.xPos, 0, 0]}>
            {/* ── 1. Thin 3D Sign Board Box (3.2m x 0.8m x 0.1m) ──────────────── */}
            <group position={[0, signY, signZ]}>
              {/* Dark Bronze / Iron Outer Frame */}
              <mesh geometry={signGeom} material={frameMat} castShadow receiveShadow />

              {/* Front Sign Face with High-Contrast Canvas Texture */}
              <mesh position={[0, 0, proxy.sign.depth / 2 + 0.002]}>
                <planeGeometry args={[proxy.sign.width - 0.04, proxy.sign.height - 0.04]} />
                <meshStandardMaterial
                  map={signTex}
                  roughness={0.35}
                  metalness={0.15}
                  depthWrite={true}
                  polygonOffset={true}
                  polygonOffsetFactor={-1}
                  polygonOffsetUnits={-1}
                />
              </mesh>

              {/* Mounting Pegs attaching sign to brick facade */}
              {[-1.4, 1.4].map((pegX) => (
                <mesh
                  key={pegX}
                  position={[pegX, 0, -proxy.sign.depth / 2 - proxy.sign.wallOffset / 2]}
                  rotation={[Math.PI / 2, 0, 0]}
                >
                  <cylinderGeometry args={[0.025, 0.025, proxy.sign.wallOffset, 8]} />
                  <meshStandardMaterial color={0x0f172a} metalness={0.6} roughness={0.4} />
                </mesh>
              ))}
            </group>

            {/* ── 2. Storefront Fabric Awning directly over Doorway ─────────────── */}
            <group>
              {/* Slanted Awning Canopy Plane */}
              {/* Length along slope = sqrt(dy^2 + dz^2) = sqrt((3.45 - 2.95)^2 + 0.88^2) ≈ 1.01m */}
              <mesh
                position={[0, (awningTopY + awningDropY) / 2, (awningWallZ + awningFrontZ) / 2]}
                rotation={[-Math.atan2(awningTopY - awningDropY, awningFrontZ - awningWallZ), 0, 0]}
                castShadow
                receiveShadow
              >
                <planeGeometry args={[3.2, 1.01]} />
                <meshStandardMaterial
                  map={awningTex}
                  roughness={0.8}
                  side={THREE.DoubleSide}
                  depthWrite={true}
                  polygonOffset={true}
                  polygonOffsetFactor={-1}
                  polygonOffsetUnits={-1}
                />
              </mesh>

              {/* Awning Front Drop Valance Flap */}
              <mesh position={[0, awningDropY - 0.10, awningFrontZ]}>
                <planeGeometry args={[3.2, 0.20]} />
                <meshStandardMaterial
                  color={proxy.sign.awningColor}
                  roughness={0.85}
                  side={THREE.DoubleSide}
                  depthWrite={true}
                  polygonOffset={true}
                  polygonOffsetFactor={-1}
                  polygonOffsetUnits={-1}
                />
              </mesh>

              {/* Left and Right Black Iron Support Struts */}
              {[-1.58, 1.58].map((sx) => (
                <mesh
                  key={`strut-${sx}`}
                  position={[sx, (awningDropY + 2.50) / 2, (awningFrontZ + awningWallZ) / 2]}
                  rotation={[Math.atan2(awningFrontZ - awningWallZ, awningDropY - 2.50), 0, 0]}
                >
                  <cylinderGeometry args={[0.02, 0.02, 1.05, 8]} />
                  <meshStandardMaterial color={0x1e293b} metalness={0.7} roughness={0.3} />
                </mesh>
              ))}
            </group>

            {/* ── 3. Vintage Gooseneck Storefront Lamp ───────────────────────── */}
            <group position={[0, signY + 0.60, RAW_BOUNDS.northRowZ]}>
              {/* Wall Mounting Plate */}
              <mesh position={[0, 0, 0.02]} rotation={[Math.PI / 2, 0, 0]}>
                <cylinderGeometry args={[0.07, 0.07, 0.03, 12]} />
                <meshStandardMaterial color={0x18181b} metalness={0.6} roughness={0.4} />
              </mesh>

              {/* Curved Arm Pipe */}
              <mesh position={[0, 0.08, 0.22]} rotation={[Math.PI / 6, 0, 0]}>
                <cylinderGeometry args={[0.018, 0.018, 0.38, 8]} />
                <meshStandardMaterial color={0xd97706} metalness={0.7} roughness={0.3} />
              </mesh>

              {/* Lamp Cone Hood */}
              <mesh position={[0, 0.14, 0.38]}>
                <coneGeometry args={[0.16, 0.12, 16]} />
                <meshStandardMaterial color={0x18181b} metalness={0.6} roughness={0.3} />
              </mesh>

              {/* Warm Amber Downward Storefront Illumination on Sign */}
              <pointLight
                position={[0, 0.02, 0.38]}
                color={0xfbbf24}
                intensity={1.4}
                distance={5.0}
                decay={1.6}
              />
            </group>
          </group>
        );
      })}
    </group>
  );
};
