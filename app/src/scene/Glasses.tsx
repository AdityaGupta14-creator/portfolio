import React, { useMemo } from 'react';
import * as THREE from 'three';
import { GlassesConfig, GlassesStyle, DEFAULT_GLASSES_CONFIG } from '../data/glassesConfig';

export type { GlassesStyle, GlassesConfig };
export { DEFAULT_GLASSES_CONFIG };

// ═════════════════════════════════════════════════════════════════════════════
//  1. SHARED GEOMETRIES & MATERIALS CACHE (High Performance & Shared GPU Buffers)
// ═════════════════════════════════════════════════════════════════════════════

interface CachedGeometries {
  rectRim: THREE.ExtrudeGeometry;
  rectLens: THREE.ExtrudeGeometry;
  roundRim: THREE.ExtrudeGeometry;
  roundLens: THREE.ExtrudeGeometry;
  bridge: THREE.BufferGeometry;
  templeArm: THREE.BufferGeometry;
}

let cachedGeometries: CachedGeometries | null = null;
let cachedFrameMaterial: THREE.MeshStandardMaterial | null = null;
let cachedSunglassesLensMaterial: THREE.MeshStandardMaterial | null = null;
let cachedClearLensMaterial: THREE.MeshStandardMaterial | null = null;

function createRoundedRectPath(width: number, height: number, radius: number): THREE.Shape {
  const shape = new THREE.Shape();
  const x = -width / 2;
  const y = -height / 2;
  const w = width;
  const h = height;
  const r = Math.min(radius, Math.min(w / 2, h / 2));

  // Counter-clockwise outer contour
  shape.moveTo(x + r, y);
  shape.lineTo(x + w - r, y);
  shape.quadraticCurveTo(x + w, y, x + w, y + r);
  shape.lineTo(x + w, y + h - r);
  shape.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  shape.lineTo(x + r, y + h);
  shape.quadraticCurveTo(x, y + h, x, y + h - r);
  shape.lineTo(x, y + r);
  shape.quadraticCurveTo(x, y, x + r, y);

  return shape;
}

function createRoundedRectHole(width: number, height: number, radius: number): THREE.Path {
  const hole = new THREE.Path();
  const x = -width / 2;
  const y = -height / 2;
  const w = width;
  const h = height;
  const r = Math.min(radius, Math.min(w / 2, h / 2));

  // Clockwise hole contour for Three.js Earcut triangulation
  hole.moveTo(x + r, y);
  hole.quadraticCurveTo(x, y, x, y + r);
  hole.lineTo(x, y + h - r);
  hole.quadraticCurveTo(x, y + h, x + r, y + h);
  hole.lineTo(x + w - r, y + h);
  hole.quadraticCurveTo(x + w, y + h, x + w, y + h - r);
  hole.lineTo(x + w, y + r);
  hole.quadraticCurveTo(x + w, y, x + w - r, y);
  hole.lineTo(x + r, y);

  return hole;
}

function initSharedGeometries(): CachedGeometries {
  if (cachedGeometries) return cachedGeometries;

  // ── Rectangular Rims (~0.054m wide x 0.042m tall) ──
  const rectRimWidth = 0.054;
  const rectRimHeight = 0.042;
  const rectRimThickness = 0.0035;
  const rectOuterR = 0.009;

  const rectOuterShape = createRoundedRectPath(rectRimWidth, rectRimHeight, rectOuterR);
  const rectHole = createRoundedRectHole(
    rectRimWidth - 2 * rectRimThickness,
    rectRimHeight - 2 * rectRimThickness,
    Math.max(0.001, rectOuterR - rectRimThickness)
  );
  rectOuterShape.holes.push(rectHole);

  const extrudeOpts: THREE.ExtrudeGeometryOptions = {
    depth: 0.0028,
    bevelEnabled: true,
    bevelThickness: 0.0008,
    bevelSize: 0.0008,
    bevelSegments: 3,
  };

  const rectRim = new THREE.ExtrudeGeometry(rectOuterShape, extrudeOpts);

  // Rectangular Lens
  const rectLensShape = createRoundedRectPath(
    rectRimWidth - 2 * rectRimThickness + 0.0008,
    rectRimHeight - 2 * rectRimThickness + 0.0008,
    Math.max(0.001, rectOuterR - rectRimThickness)
  );
  const rectLens = new THREE.ExtrudeGeometry(rectLensShape, { depth: 0.001, bevelEnabled: false });

  // ── Round Rims (radius 0.0225m) ──
  const roundOuterR = 0.0225;
  const roundInnerR = 0.019;
  const roundOuterShape = new THREE.Shape();
  roundOuterShape.absarc(0, 0, roundOuterR, 0, Math.PI * 2, false);
  const roundHole = new THREE.Path();
  roundHole.absarc(0, 0, roundInnerR, 0, Math.PI * 2, true);
  roundOuterShape.holes.push(roundHole);

  const roundRim = new THREE.ExtrudeGeometry(roundOuterShape, extrudeOpts);

  // Round Lens
  const roundLensShape = new THREE.Shape();
  roundLensShape.absarc(0, 0, roundInnerR + 0.0005, 0, Math.PI * 2, false);
  const roundLens = new THREE.ExtrudeGeometry(roundLensShape, { depth: 0.001, bevelEnabled: false });

  // ── Center Nose Bridge (arched bar connecting the two rims) ──
  const bridgeCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(-0.010, 0.002, 0.001),
    new THREE.Vector3(0.0, 0.006, 0.003),
    new THREE.Vector3(0.010, 0.002, 0.001),
  ]);
  const bridge = new THREE.TubeGeometry(bridgeCurve, 12, 0.0016, 8, false);

  // ── Temple Arms (thin bar reaching 0.13m back to ears, flaring around hair and curving down) ──
  const templeArmCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0, 0, 0),
    new THREE.Vector3(0.003, 0.001, -0.04),
    new THREE.Vector3(0.006, 0.0, -0.08),
    new THREE.Vector3(0.006, -0.006, -0.11),
    new THREE.Vector3(0.005, -0.022, -0.130),
  ]);
  const templeArm = new THREE.TubeGeometry(templeArmCurve, 20, 0.0016, 8, false);

  cachedGeometries = {
    rectRim,
    rectLens,
    roundRim,
    roundLens,
    bridge,
    templeArm,
  };

  return cachedGeometries;
}

function getSharedMaterials() {
  if (!cachedFrameMaterial) {
    // Matte black frame material
    cachedFrameMaterial = new THREE.MeshStandardMaterial({
      color: 0x111111,
      roughness: 0.85,
      metalness: 0.1,
      side: THREE.DoubleSide,
    });
  }

  if (!cachedSunglassesLensMaterial) {
    // Dark tint sunglasses lenses (colour #111, opacity 0.85, slight roughness 0.2, depthWrite = false)
    cachedSunglassesLensMaterial = new THREE.MeshStandardMaterial({
      color: 0x111111,
      roughness: 0.2,
      metalness: 0.15,
      transparent: true,
      opacity: 0.85,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
  }

  if (!cachedClearLensMaterial) {
    // Clear glasses lenses (almost transparent, opacity 0.15)
    cachedClearLensMaterial = new THREE.MeshStandardMaterial({
      color: 0xe2e8f0,
      roughness: 0.1,
      metalness: 0.05,
      transparent: true,
      opacity: 0.15,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
  }

  return {
    frame: cachedFrameMaterial,
    sunglassesLens: cachedSunglassesLensMaterial,
    clearLens: cachedClearLensMaterial,
  };
}

// ═════════════════════════════════════════════════════════════════════════════
//  2. GLASSES 3D ASSEMBLY
// ═════════════════════════════════════════════════════════════════════════════

export function buildGlassesMesh(style: GlassesStyle = 'sunglasses'): THREE.Group {
  const geoms = initSharedGeometries();
  const mats = getSharedMaterials();

  const group = new THREE.Group();
  group.name = `GlassesMesh_${style}`;

  const isRound = style === 'round';
  const rimGeom = isRound ? geoms.roundRim : geoms.rectRim;
  const lensGeom = isRound ? geoms.roundLens : geoms.rectLens;
  const lensMat = style === 'clear' ? mats.clearLens : mats.sunglassesLens;

  // Interpupillary / rim distance (~0.064m between centers)
  const eyeSpacing = 0.064;
  const halfSpacing = eyeSpacing / 2;

  // 1. Left Rim & Lens
  const leftRim = new THREE.Mesh(rimGeom, mats.frame);
  leftRim.position.set(halfSpacing, 0, 0);
  leftRim.castShadow = true;
  group.add(leftRim);

  const leftLens = new THREE.Mesh(lensGeom, lensMat);
  leftLens.position.set(halfSpacing, 0, 0.001);
  leftLens.renderOrder = 10; // Renders after face
  group.add(leftLens);

  // 2. Right Rim & Lens
  const rightRim = new THREE.Mesh(rimGeom, mats.frame);
  rightRim.position.set(-halfSpacing, 0, 0);
  rightRim.castShadow = true;
  group.add(rightRim);

  const rightLens = new THREE.Mesh(lensGeom, lensMat);
  rightLens.position.set(-halfSpacing, 0, 0.001);
  rightLens.renderOrder = 10; // Renders after face
  group.add(rightLens);

  // 3. Nose Bridge
  const bridge = new THREE.Mesh(geoms.bridge, mats.frame);
  bridge.castShadow = true;
  group.add(bridge);

  // 4. Temple Arms (hinges at outer edges ~0.068m from center)
  const hingeX = 0.068;

  // Left Temple Arm (flares along head contour and hooks over ear)
  const leftTemple = new THREE.Mesh(geoms.templeArm, mats.frame);
  leftTemple.position.set(hingeX, 0.004, 0.0);
  leftTemple.castShadow = true;
  group.add(leftTemple);

  // Right Temple Arm (mirrored along X axis)
  const rightTemple = new THREE.Mesh(geoms.templeArm, mats.frame);
  rightTemple.position.set(-hingeX, 0.004, 0.0);
  rightTemple.scale.set(-1, 1, 1);
  rightTemple.castShadow = true;
  group.add(rightTemple);

  return group;
}

// ═════════════════════════════════════════════════════════════════════════════
//  3. HEAD BONE MEASUREMENT & ATTACHMENT
// ═════════════════════════════════════════════════════════════════════════════

export function findHeadBone(avatarRoot: THREE.Object3D): THREE.Object3D | null {
  let headBone = avatarRoot.getObjectByName('mixamorigHead');
  if (!headBone) {
    avatarRoot.traverse((child) => {
      if ((child as THREE.Bone).isBone) {
        const bName = child.name.toLowerCase();
        if (bName.includes('head') && !bName.includes('top') && !bName.includes('end')) {
          if (!headBone) headBone = child;
        }
      }
    });
  }
  return headBone || null;
}

export function measureHeadBoneWorldScale(avatarRoot: THREE.Object3D): THREE.Vector3 {
  avatarRoot.updateMatrixWorld(true);
  const headBone = findHeadBone(avatarRoot);
  const boneWorldScale = new THREE.Vector3(1, 1, 1);

  if (headBone) {
    headBone.getWorldScale(boneWorldScale);
    console.log(
      `[Glasses] Measured mixamorigHead world scale: X=${boneWorldScale.x.toFixed(6)}, Y=${boneWorldScale.y.toFixed(6)}, Z=${boneWorldScale.z.toFixed(6)}`
    );
  } else {
    console.warn('[Glasses] mixamorigHead not found; using default Mixamo scale 0.009762');
    boneWorldScale.set(0.009762, 0.009762, 0.009762);
  }

  return boneWorldScale;
}

/**
 * Attaches the glasses to the avatar's mixamorigHead bone with scale compensation.
 * Also hides untextured eyelashes so no black eye outlines show.
 */
export function attachGlassesToHead(
  avatarRoot: THREE.Object3D,
  config: Partial<GlassesConfig> = {}
): THREE.Group | null {
  // 1. Hide untextured eyelash polygon planes that cause black eye outline
  avatarRoot.traverse((child) => {
    if ((child as THREE.Mesh).isMesh) {
      const mesh = child as THREE.Mesh;
      const lower = mesh.name.toLowerCase();
      if (lower.includes('eyelash') || lower.includes('lash')) {
        mesh.visible = false;
      }
    }
  });

  // 2. Find head bone
  const headBone = findHeadBone(avatarRoot);
  if (!headBone) {
    console.warn('[Glasses] Could not find mixamorigHead on avatar');
    return null;
  }

  // 3. Remove existing glasses / anchors
  const existingAnchor = headBone.getObjectByName('GlassesAnchor');
  if (existingAnchor) {
    headBone.remove(existingAnchor);
  }

  // Also remove legacy AvatarGlasses_ objects
  const legacyGlasses = headBone.children.filter((c) => c.name.startsWith('AvatarGlasses_') || c.name.startsWith('Glasses'));
  legacyGlasses.forEach((g) => headBone?.remove(g));

  // 4. Measure head bone world scale and compute compensation
  const boneWorldScale = measureHeadBoneWorldScale(avatarRoot);
  const scaleX = boneWorldScale.x || 0.009762;
  const scaleY = boneWorldScale.y || 0.009762;
  const scaleZ = boneWorldScale.z || 0.009762;

  // Compensation scale makes 1 unit inside GlassesAnchor equal 1.0 real-world meter
  const anchorGroup = new THREE.Group();
  anchorGroup.name = 'GlassesAnchor';
  anchorGroup.scale.set(1 / scaleX, 1 / scaleY, 1 / scaleZ);

  // 5. Assemble Glasses Mesh
  const mergedConfig: GlassesConfig = { ...DEFAULT_GLASSES_CONFIG, ...config };
  const glassesMesh = buildGlassesMesh(mergedConfig.style);

  // Position, Rotation, Scale in real-world meters
  const [px, py, pz] = mergedConfig.position;
  glassesMesh.position.set(px, py, pz);
  glassesMesh.rotation.x = THREE.MathUtils.degToRad(mergedConfig.rotationX);
  glassesMesh.scale.setScalar(mergedConfig.scale);

  anchorGroup.add(glassesMesh);
  headBone.add(anchorGroup);

  return glassesMesh;
}

// ═════════════════════════════════════════════════════════════════════════════
//  4. REACT THREE FIBER COMPONENT
// ═════════════════════════════════════════════════════════════════════════════

export const Glasses: React.FC<GlassesConfig> = ({
  position,
  rotationX,
  scale,
  style,
}) => {
  const meshGroup = useMemo(() => buildGlassesMesh(style), [style]);

  return (
    <group
      position={position}
      rotation={[THREE.MathUtils.degToRad(rotationX), 0, 0]}
      scale={scale}
    >
      <primitive object={meshGroup} />
    </group>
  );
};

export default Glasses;
