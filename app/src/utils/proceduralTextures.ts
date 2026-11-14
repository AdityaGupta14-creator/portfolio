import * as THREE from 'three';

/**
 * Procedural PBR Canvas Texture Generators
 * Recreates the exact procedural textures from the vanilla brownstone avenue.
 * Memoized to prevent GPU memory leaks or re-generation during React renders.
 */

// 1. Procedural Brick Textures (Color map + Bump map)
export function createBrickTextures(baseHex: string, altHex: string) {
  const c = document.createElement('canvas');
  c.width = 512;
  c.height = 512;
  const ctx = c.getContext('2d')!;

  const bumpC = document.createElement('canvas');
  bumpC.width = 512;
  bumpC.height = 512;
  const bCtx = bumpC.getContext('2d')!;

  ctx.fillStyle = '#c8beb0';
  ctx.fillRect(0, 0, 512, 512);
  bCtx.fillStyle = '#222222';
  bCtx.fillRect(0, 0, 512, 512);

  const rows = 16;
  const cols = 8;
  const brickH = 512 / rows;
  const brickW = 512 / cols;
  const mortar = 3;

  for (let r = 0; r < rows; r++) {
    const offset = (r % 2) * (brickW / 2);
    for (let col = -1; col <= cols; col++) {
      const x = col * brickW + offset;
      const y = r * brickH;

      ctx.fillStyle = Math.random() > 0.35 ? baseHex : altHex;
      ctx.fillRect(x + mortar, y + mortar, brickW - mortar * 2, brickH - mortar * 2);

      ctx.fillStyle = `rgba(0,0,0,${(Math.random() * 0.14).toFixed(2)})`;
      ctx.fillRect(x + mortar, y + mortar, brickW - mortar * 2, brickH - mortar * 2);

      const gray = 185 + Math.floor(Math.random() * 55);
      bCtx.fillStyle = `rgb(${gray},${gray},${gray})`;
      bCtx.fillRect(x + mortar, y + mortar, brickW - mortar * 2, brickH - mortar * 2);
    }
  }

  const map = new THREE.CanvasTexture(c);
  map.wrapS = THREE.RepeatWrapping;
  map.wrapT = THREE.RepeatWrapping;
  map.repeat.set(3.5, 5.5);

  const bumpMap = new THREE.CanvasTexture(bumpC);
  bumpMap.wrapS = THREE.RepeatWrapping;
  bumpMap.wrapT = THREE.RepeatWrapping;
  bumpMap.repeat.set(3.5, 5.5);

  return { map, bumpMap };
}

// 2. Procedural Sidewalk Paved Tile Texture
export function createPavedTexture() {
  const c = document.createElement('canvas');
  c.width = 512;
  c.height = 512;
  const ctx = c.getContext('2d')!;

  ctx.fillStyle = '#8d959e';
  ctx.fillRect(0, 0, 512, 512);

  const tileH = 64;
  const tileW = 96;
  for (let y = 0; y < 512; y += tileH) {
    const shift = ((y / tileH) % 2) * (tileW / 2);
    for (let x = -tileW; x < 512; x += tileW) {
      const shade = 128 + Math.floor(Math.random() * 26);
      ctx.fillStyle = `rgb(${shade}, ${shade + 6}, ${shade + 13})`;
      ctx.fillRect(x + shift + 3, y + 3, tileW - 6, tileH - 6);

      ctx.strokeStyle = '#5b626a';
      ctx.lineWidth = 3;
      ctx.strokeRect(x + shift + 2, y + 2, tileW - 4, tileH - 4);
    }
  }

  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(42, 5);
  return tex;
}

// 3. Procedural Lawn Grass Texture
export function createGrassTexture() {
  const c = document.createElement('canvas');
  c.width = 512;
  c.height = 512;
  const ctx = c.getContext('2d')!;

  const grad = ctx.createLinearGradient(0, 0, 512, 512);
  grad.addColorStop(0, '#8eb939');
  grad.addColorStop(0.5, '#9ec642');
  grad.addColorStop(1, '#7da832');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 512, 512);

  for (let i = 0; i < 4500; i++) {
    const gx = Math.random() * 512;
    const gy = Math.random() * 512;
    ctx.fillStyle = Math.random() > 0.45 ? 'rgba(182, 218, 72, 0.35)' : 'rgba(95, 138, 34, 0.32)';
    ctx.fillRect(gx, gy, 2, 6);
  }

  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(22, 5);
  return tex;
}

// 4. Procedural Asphalt Roadway Texture
export function createAsphaltTexture() {
  const c = document.createElement('canvas');
  c.width = 512;
  c.height = 512;
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = '#6c7580';
  ctx.fillRect(0, 0, 512, 512);

  for (let i = 0; i < 6000; i++) {
    const v = 95 + Math.floor(Math.random() * 35);
    ctx.fillStyle = `rgba(${v},${v + 4},${v + 9},0.28)`;
    ctx.fillRect(Math.random() * 512, Math.random() * 512, 3, 3);
  }
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(36, 4);
  return tex;
}

// 5. Procedural Warm Window Texture (Upper floors & Storefront variants)
export function createWarmWindowTexture(isStorefront = false) {
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 256;
  const ctx = c.getContext('2d')!;

  const grad = ctx.createLinearGradient(0, 0, 0, 256);
  grad.addColorStop(0, '#4a321f');
  grad.addColorStop(0.45, '#9c6b3b');
  grad.addColorStop(1, '#e8aa64');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 256, 256);

  ctx.fillStyle = 'rgba(52, 32, 18, 0.55)';
  for (let sy = 55; sy < 210; sy += 42) {
    ctx.fillRect(24, sy, 208, 6);
    for (let bx = 30; bx < 215; bx += 18) {
      const bh = 18 + (bx % 14);
      ctx.fillRect(bx, sy - bh, 12, bh);
    }
  }

  const rad = ctx.createRadialGradient(128, 120, 8, 128, 130, 110);
  rad.addColorStop(0, 'rgba(255, 248, 215, 0.98)');
  rad.addColorStop(0.45, 'rgba(255, 198, 105, 0.65)');
  rad.addColorStop(1, 'rgba(255, 160, 60, 0)');
  ctx.fillStyle = rad;
  ctx.fillRect(0, 0, 256, 256);

  if (isStorefront) {
    ctx.fillStyle = '#3f6a2e';
    for (let px = 36; px < 230; px += 52) {
      ctx.beginPath();
      ctx.arc(px, 218, 18, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#5d3a24';
      ctx.fillRect(px - 10, 226, 20, 24);
      ctx.fillStyle = '#4c7c38';
    }
  }

  ctx.strokeStyle = '#262c32';
  ctx.lineWidth = 14;
  ctx.strokeRect(0, 0, 256, 256);
  ctx.lineWidth = 7;
  ctx.beginPath();
  if (isStorefront) {
    ctx.moveTo(85, 0);
    ctx.lineTo(85, 256);
    ctx.moveTo(170, 0);
    ctx.lineTo(170, 256);
    ctx.moveTo(0, 68);
    ctx.lineTo(256, 68);
  } else {
    ctx.moveTo(0, 128);
    ctx.lineTo(256, 128);
    ctx.moveTo(128, 0);
    ctx.lineTo(128, 256);
  }
  ctx.stroke();

  ctx.fillStyle = 'rgba(255,255,255,0.12)';
  ctx.beginPath();
  ctx.moveTo(20, 0);
  ctx.lineTo(75, 0);
  ctx.lineTo(0, 160);
  ctx.lineTo(0, 95);
  ctx.closePath();
  ctx.fill();

  return new THREE.CanvasTexture(c);
}

// 6. Procedural Store Signboard Texture with Auto-Fitting & High Contrast
const signTextureCache = new Map<string, THREE.CanvasTexture>();

export function getStoreSignTexture(title: string, number: string): THREE.CanvasTexture {
  const key = `${number}-${title}`;
  if (signTextureCache.has(key)) {
    return signTextureCache.get(key)!;
  }

  const c = document.createElement('canvas');
  c.width = 1024;
  c.height = 256;
  const ctx = c.getContext('2d')!;

  // Deep obsidian/onyx backing with subtle vignette
  const grad = ctx.createLinearGradient(0, 0, 0, 256);
  grad.addColorStop(0, '#101726');
  grad.addColorStop(0.5, '#070a10');
  grad.addColorStop(1, '#0e1422');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 1024, 256);

  // Outer gold frame border
  ctx.strokeStyle = '#b45309';
  ctx.lineWidth = 12;
  ctx.strokeRect(8, 8, 1008, 240);

  // Inner bright gold accent pinstripe
  ctx.strokeStyle = '#fbbf24';
  ctx.lineWidth = 4;
  ctx.strokeRect(22, 22, 980, 212);

  // Corner brass rivets/embellishments
  const cornerRivets = [
    [32, 32],
    [992, 32],
    [32, 224],
    [992, 224],
  ];
  ctx.fillStyle = '#fde68a';
  cornerRivets.forEach(([rx, ry]) => {
    ctx.beginPath();
    ctx.arc(rx, ry, 6, 0, Math.PI * 2);
    ctx.fill();
  });

  // Auto-fit font calculation to ensure high legibility without clipping
  const displayText = `${number}  •  ${title.toUpperCase()}`;
  const maxTextWidth = 920;
  let fontSize = 76;
  ctx.font = `bold ${fontSize}px 'Space Grotesk', 'Inter', sans-serif`;
  let textWidth = ctx.measureText(displayText).width;

  while (textWidth > maxTextWidth && fontSize > 36) {
    fontSize -= 2;
    ctx.font = `bold ${fontSize}px 'Space Grotesk', 'Inter', sans-serif`;
    textWidth = ctx.measureText(displayText).width;
  }

  // Draw drop shadow for crisp readability from street level
  ctx.shadowColor = 'rgba(0, 0, 0, 0.95)';
  ctx.shadowBlur = 10;
  ctx.shadowOffsetX = 0;
  ctx.shadowOffsetY = 4;

  ctx.fillStyle = '#ffffff';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(displayText, 512, 128);

  // Reset shadow
  ctx.shadowColor = 'transparent';

  const texture = new THREE.CanvasTexture(c);
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.anisotropy = 16;
  texture.needsUpdate = true;

  signTextureCache.set(key, texture);
  return texture;
}

// 7. Procedural Denim Jacket Texture (Host Avatar Outfit)
export function createDenimJacketTexture(): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 256;
  const ctx = c.getContext('2d')!;

  ctx.fillStyle = '#263347';
  ctx.fillRect(0, 0, 256, 256);

  const patchColors = ['rgba(68, 86, 114, 0.55)', 'rgba(30, 41, 59, 0.65)', 'rgba(82, 102, 132, 0.4)'];
  for (let i = 0; i < 42; i++) {
    ctx.fillStyle = patchColors[i % patchColors.length];
    ctx.beginPath();
    const px = Math.random() * 256;
    const py = Math.random() * 256;
    ctx.ellipse(px, py, 14 + Math.random() * 24, 8 + Math.random() * 16, Math.random() * Math.PI, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.strokeStyle = 'rgba(255,255,255,0.04)';
  ctx.lineWidth = 1;
  for (let i = -256; i < 512; i += 4) {
    ctx.beginPath();
    ctx.moveTo(i, 0);
    ctx.lineTo(i + 256, 256);
    ctx.stroke();
  }

  ctx.strokeStyle = 'rgba(148, 163, 184, 0.45)';
  ctx.lineWidth = 2;
  ctx.strokeRect(8, 8, 240, 240);

  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  return tex;
}

// 8. Procedural Coral Tee Graphic Texture (Host Avatar Outfit)
export function createCoralShirtTexture(): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 256;
  const ctx = c.getContext('2d')!;

  ctx.fillStyle = '#f25c48';
  ctx.fillRect(0, 0, 256, 256);

  ctx.fillStyle = '#f9a8d4';
  ctx.beginPath();
  ctx.arc(128, 118, 42, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = '#f25c48';
  ctx.font = "bold 22px 'Inter', sans-serif";
  ctx.textAlign = 'center';
  ctx.fillText('AG', 128, 126);

  return new THREE.CanvasTexture(c);
}

// 9. Procedural Jeans Texture (Host Avatar Outfit)
export function createJeansTexture(): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 256;
  const ctx = c.getContext('2d')!;

  const grad = ctx.createLinearGradient(0, 0, 256, 256);
  grad.addColorStop(0, '#243b61');
  grad.addColorStop(0.5, '#2c4875');
  grad.addColorStop(1, '#1e3252');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 256, 256);

  ctx.fillStyle = 'rgba(255,255,255,0.03)';
  for (let i = 0; i < 1800; i++) {
    ctx.fillRect(Math.random() * 256, Math.random() * 256, 2, 4);
  }
  return new THREE.CanvasTexture(c);
}

/**
 * Shared Singleton Textures & Materials
 */
export const textures = {
  redBrick: createBrickTextures('#8e3722', '#792b18'),
  brownBrick: createBrickTextures('#7c3d25', '#68301b'),
  tanBrick: createBrickTextures('#9b5533', '#844425'),
  paved: createPavedTexture(),
  grass: createGrassTexture(),
  asphalt: createAsphaltTexture(),
  upperWindow: createWarmWindowTexture(false),
  storefrontWindow: createWarmWindowTexture(true),
  denimJacket: createDenimJacketTexture(),
  coralShirt: createCoralShirtTexture(),
  jeans: createJeansTexture(),
};

export const materials = {
  brickRed: new THREE.MeshStandardMaterial({
    map: textures.redBrick.map,
    bumpMap: textures.redBrick.bumpMap,
    bumpScale: 0.08,
    roughness: 0.85,
  }),
  brickBrown: new THREE.MeshStandardMaterial({
    map: textures.brownBrick.map,
    bumpMap: textures.brownBrick.bumpMap,
    bumpScale: 0.08,
    roughness: 0.85,
  }),
  brickTan: new THREE.MeshStandardMaterial({
    map: textures.tanBrick.map,
    bumpMap: textures.tanBrick.bumpMap,
    bumpScale: 0.08,
    roughness: 0.85,
  }),
  creamStone: new THREE.MeshStandardMaterial({ color: 0xdccab0, roughness: 0.72 }),
  darkTrim: new THREE.MeshStandardMaterial({ color: 0x283036, roughness: 0.55, metalness: 0.2 }),
  ironBlack: new THREE.MeshStandardMaterial({ color: 0x1a1e22, roughness: 0.45, metalness: 0.65 }),
  upperWindow: new THREE.MeshStandardMaterial({
    map: textures.upperWindow,
    emissiveMap: textures.upperWindow,
    emissive: new THREE.Color(0xffa34d),
    emissiveIntensity: 0,
  }),
  storefrontWindow: new THREE.MeshStandardMaterial({
    map: textures.storefrontWindow,
    emissiveMap: textures.storefrontWindow,
    emissive: new THREE.Color(0xffa34d),
    emissiveIntensity: 0,
  }),
  grass: new THREE.MeshStandardMaterial({
    map: textures.grass,
    roughness: 0.88,
    metalness: 0.02,
  }),
  sidewalk: new THREE.MeshStandardMaterial({
    map: textures.paved,
    roughness: 0.8,
    metalness: 0.05,
  }),
  curb: new THREE.MeshStandardMaterial({ color: 0x9aa2ab, roughness: 0.75 }),
  asphalt: new THREE.MeshStandardMaterial({
    map: textures.asphalt,
    roughness: 0.72,
    metalness: 0.08,
  }),
  dashLine: new THREE.MeshBasicMaterial({ color: 0xdce3ec }),
};
