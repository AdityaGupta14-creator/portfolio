import * as THREE from 'three';

/**
 * Generates a clean procedural eye texture (white sclera, brown iris, black pupil, glint)
 */
export function createEyeTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    const fallback = new THREE.CanvasTexture(canvas);
    fallback.colorSpace = THREE.SRGBColorSpace;
    return fallback;
  }

  // 1. Sclera (eyeball white with subtle edge gradient)
  ctx.fillStyle = '#f8fafc';
  ctx.fillRect(0, 0, 256, 256);

  const scleraGrad = ctx.createRadialGradient(128, 128, 65, 128, 128, 126);
  scleraGrad.addColorStop(0, 'rgba(248, 250, 252, 0)');
  scleraGrad.addColorStop(0.85, 'rgba(226, 232, 240, 0.5)');
  scleraGrad.addColorStop(1, 'rgba(203, 213, 225, 0.85)');
  ctx.fillStyle = scleraGrad;
  ctx.fillRect(0, 0, 256, 256);

  // 2. Iris (warm amber-brown with dark outer limbal ring)
  const irisGrad = ctx.createRadialGradient(128, 128, 18, 128, 128, 66);
  irisGrad.addColorStop(0, '#92400e');   // Warm amber center
  irisGrad.addColorStop(0.5, '#78350f'); // Golden brown
  irisGrad.addColorStop(0.85, '#451a03'); // Deep espresso
  irisGrad.addColorStop(1, '#1c1917');   // Dark limbal ring
  ctx.beginPath();
  ctx.arc(128, 128, 66, 0, Math.PI * 2);
  ctx.fillStyle = irisGrad;
  ctx.fill();

  // Subtle radial iris striations
  ctx.strokeStyle = 'rgba(180, 83, 9, 0.25)';
  ctx.lineWidth = 1.5;
  for (let a = 0; a < Math.PI * 2; a += Math.PI / 16) {
    ctx.beginPath();
    ctx.moveTo(128 + Math.cos(a) * 22, 128 + Math.sin(a) * 22);
    ctx.lineTo(128 + Math.cos(a) * 62, 128 + Math.sin(a) * 62);
    ctx.stroke();
  }

  // 3. Pupil (deep black)
  ctx.beginPath();
  ctx.arc(128, 128, 28, 0, Math.PI * 2);
  ctx.fillStyle = '#09090b';
  ctx.fill();

  // 4. Specular highlight glint (gives eyes life and depth)
  ctx.beginPath();
  ctx.arc(112, 112, 9, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(255, 255, 255, 0.95)';
  ctx.fill();

  ctx.beginPath();
  ctx.arc(142, 142, 4.5, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
  ctx.fill();

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}

let cachedEyeMaterial: THREE.MeshStandardMaterial | null = null;
export function getEyeMaterial(): THREE.MeshStandardMaterial {
  if (!cachedEyeMaterial) {
    const eyeTex = createEyeTexture();
    cachedEyeMaterial = new THREE.MeshStandardMaterial({
      map: eyeTex,
      roughness: 0.15,
      metalness: 0.05,
      transparent: false,
      depthWrite: true,
      side: THREE.DoubleSide,
    });
  }
  return cachedEyeMaterial;
}

/**
 * Creates eyeball meshes positioned inside the eye sockets attached to mixamorigHead.
 * Coordinates are in mixamorigHead local bone space (cm units before avatar scaleFactor).
 */
export function createEyeballsGroup(): THREE.Group {
  const group = new THREE.Group();
  group.name = 'AvatarEyeballs';

  const eyeMat = getEyeMaterial();
  const eyeGeom = new THREE.SphereGeometry(1.65, 24, 20);
  // Rotate geometry so the iris/pupil in the center of the texture points directly forward (+Z)
  eyeGeom.rotateY(-Math.PI / 2);

  // Left Eye
  const leftEye = new THREE.Mesh(eyeGeom, eyeMat);
  leftEye.name = 'LeftEyeball';
  leftEye.position.set(3.20, 9.60, 11.75);
  leftEye.scale.set(1.0, 0.95, 1.0);
  leftEye.renderOrder = 1;
  group.add(leftEye);

  // Right Eye
  const rightEye = new THREE.Mesh(eyeGeom, eyeMat);
  rightEye.name = 'RightEyeball';
  rightEye.position.set(-3.20, 9.60, 11.75);
  rightEye.scale.set(1.0, 0.95, 1.0);
  rightEye.renderOrder = 1;
  group.add(rightEye);

  return group;
}

export type GlassesType = 'sunglasses' | 'clear' | 'none';

export interface GlassesOptions {
  type: GlassesType;
  frameColor?: number;
  lensColor?: number;
}

/**
 * Creates 3D glasses (two rounded lens discs, thin bridge, two temple arms)
 * sized and positioned to fit comfortably over the eyes in mixamorigHead space.
 */
export function createGlassesGroup(options: GlassesOptions = { type: 'sunglasses' }): THREE.Group {
  const group = new THREE.Group();
  group.name = `AvatarGlasses_${options.type}`;

  const isDark = options.type === 'sunglasses';
  const frameColor = options.frameColor ?? (isDark ? 0x18181b : 0x27272a);

  // Frame Material
  const frameMat = new THREE.MeshStandardMaterial({
    color: frameColor,
    roughness: 0.35,
    metalness: 0.65,
  });

  // Lens Material
  const lensColor = options.lensColor ?? (isDark ? 0x09090b : 0xdbeafe);
  const lensMat = new THREE.MeshStandardMaterial({
    color: lensColor,
    roughness: 0.1,
    metalness: 0.15,
    transparent: true,
    opacity: isDark ? 0.72 : 0.18,
    depthWrite: false,
  });

  // Center coordinates in mixamorigHead space
  const eyeY = 9.68;
  const eyeZ = 12.85;
  const eyeXOffset = 3.35;
  const lensRadius = 1.95;
  const rimRadius = 0.12;

  // 1. Left Lens Rim & Disc
  const leftLensGeom = new THREE.CylinderGeometry(lensRadius, lensRadius, 0.10, 24);
  leftLensGeom.rotateX(Math.PI / 2);
  const leftLens = new THREE.Mesh(leftLensGeom, lensMat);
  leftLens.position.set(eyeXOffset, eyeY, eyeZ);
  leftLens.renderOrder = 3;
  group.add(leftLens);

  const rimGeom = new THREE.TorusGeometry(lensRadius, rimRadius, 10, 28);
  const leftRim = new THREE.Mesh(rimGeom, frameMat);
  leftRim.position.set(eyeXOffset, eyeY, eyeZ);
  group.add(leftRim);

  // 2. Right Lens Rim & Disc
  const rightLensGeom = leftLensGeom.clone();
  const rightLens = new THREE.Mesh(rightLensGeom, lensMat);
  rightLens.position.set(-eyeXOffset, eyeY, eyeZ);
  rightLens.renderOrder = 3;
  group.add(rightLens);

  const rightRim = new THREE.Mesh(rimGeom, frameMat);
  rightRim.position.set(-eyeXOffset, eyeY, eyeZ);
  group.add(rightRim);

  // 3. Center Nose Bridge
  const bridgeWidth = eyeXOffset * 2 - lensRadius * 2 + 0.3; // ~3.1cm
  const bridgeGeom = new THREE.CylinderGeometry(rimRadius * 1.1, rimRadius * 1.1, bridgeWidth, 12);
  bridgeGeom.rotateZ(Math.PI / 2);
  const bridge = new THREE.Mesh(bridgeGeom, frameMat);
  bridge.position.set(0, eyeY + 0.25, eyeZ + 0.05);
  group.add(bridge);

  // 4. Temple Arms (hinges extending back to ears)
  const templeLength = 13.8;
  const templeGeom = new THREE.CylinderGeometry(rimRadius * 0.9, rimRadius * 0.7, templeLength, 10);
  templeGeom.rotateX(Math.PI / 2);

  // Left Temple Arm
  const leftTemple = new THREE.Mesh(templeGeom, frameMat);
  leftTemple.position.set(eyeXOffset + lensRadius + 0.05, eyeY + 0.35, eyeZ - templeLength / 2);
  // Slight inwards angle towards back of head
  leftTemple.rotation.y = -0.06;
  group.add(leftTemple);

  // Right Temple Arm
  const rightTemple = new THREE.Mesh(templeGeom, frameMat);
  rightTemple.position.set(-(eyeXOffset + lensRadius + 0.05), eyeY + 0.35, eyeZ - templeLength / 2);
  rightTemple.rotation.y = 0.06;
  group.add(rightTemple);

  return group;
}

/**
 * Attaches eyeball and glasses accessories to an avatar root object (Host or Pedestrian).
 * Attaches directly to mixamorigHead bone so they naturally track all head animations.
 */
export function attachFaceAccessories(
  avatarRoot: THREE.Object3D,
  options: {
    glasses?: GlassesType;
    addEyeballs?: boolean;
    frameColor?: number;
  } = {}
) {
  // 1. Hide untextured eyelash polygon planes to prevent black occluding mask
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
  let headBone: THREE.Object3D | undefined = avatarRoot.getObjectByName('mixamorigHead');
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

  if (!headBone) {
    console.warn('[AvatarAccessories] Could not find head bone on avatar');
    return;
  }

  // Remove any previously attached accessories to avoid duplicates
  const existingEyeballs = headBone.getObjectByName('AvatarEyeballs');
  if (existingEyeballs) headBone.remove(existingEyeballs);

  const existingGlasses = headBone.children.filter((c: THREE.Object3D) => c.name.startsWith('AvatarGlasses_'));
  existingGlasses.forEach((g: THREE.Object3D) => headBone?.remove(g));

  // 3. Attach Eyeballs (enabled by default)
  if (options.addEyeballs !== false) {
    const eyeballs = createEyeballsGroup();
    headBone.add(eyeballs);
  }

  // 4. Attach Glasses if requested
  const glassesType = options.glasses ?? 'sunglasses';
  if (glassesType !== 'none') {
    const glasses = createGlassesGroup({
      type: glassesType,
      frameColor: options.frameColor,
    });
    headBone.add(glasses);
  }
}
