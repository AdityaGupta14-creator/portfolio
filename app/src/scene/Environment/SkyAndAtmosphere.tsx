import React, { useMemo, useRef, useEffect } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { useGLTF } from '@react-three/drei';
import * as THREE from 'three';
import { useAppStore } from '../../store/useAppStore';
import {
  SKY_MODEL_CONFIG,
  SKY_MODE_PALETTES,
  SkyMode,
} from '../../data/skyModes';
import { materials } from '../../utils/proceduralTextures';
import { perfRenderTracker } from '../../utils/perfTracker';

// Preload the cartoon sky GLB asset once
useGLTF.preload(SKY_MODEL_CONFIG.modelPath);

const _scratchSunPos = new THREE.Vector3();

// ── 1. Sky Dome Shader: Vertical Gradient + Celestial Sun Glow ─────────────
const skyVertexShader = /* glsl */ `
  varying vec3 vWorldPosition;
  void main() {
    vec4 worldPos = modelMatrix * vec4(position, 1.0);
    vWorldPosition = worldPos.xyz;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const skyFragmentShader = /* glsl */ `
  uniform vec3 uHorizon;
  uniform vec3 uMiddle;
  uniform vec3 uZenith;
  uniform vec3 uSunPosition;
  uniform vec3 uSunColor;
  uniform float uExponent;
  varying vec3 vWorldPosition;

  void main() {
    vec3 dir = normalize(vWorldPosition);
    float h = max(dir.y, 0.0);
    float t = pow(h, uExponent);
    
    // Smooth 3-stop vertical gradient for natural atmospheric transition
    vec3 color = t < 0.45
      ? mix(uHorizon, uMiddle, t / 0.45)
      : mix(uMiddle, uZenith, (t - 0.45) / 0.55);

    // Radiant celestial sun glow blended directly into the dome
    vec3 sunDir = normalize(uSunPosition);
    float sunDot = max(dot(dir, sunDir), 0.0);
    // Wide atmospheric golden haze + luminous core corona
    float sunGlow = pow(sunDot, 3.5) * 0.45 + pow(sunDot, 12.0) * 0.65 + pow(sunDot, 64.0) * 0.95;
    color += uSunColor * sunGlow;

    gl_FragColor = vec4(color, 1.0);
  }
`;

// ── 2. Procedural Twinkling Stars Shader (Night Only) ───────────────────────
const starsVertexShader = /* glsl */ `
  uniform float uTime;
  uniform float uStarsOpacity;
  attribute vec2 aTwinkle;
  attribute float aSize;
  varying float vOpacity;

  void main() {
    float twinkle = 0.5 + 0.5 * sin(uTime * aTwinkle.y + aTwinkle.x);
    vOpacity = uStarsOpacity * twinkle;
    gl_PointSize = aSize * (0.8 + 0.35 * twinkle);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const starsFragmentShader = /* glsl */ `
  varying float vOpacity;
  void main() {
    float d = length(gl_PointCoord - vec2(0.5));
    if (d > 0.5) discard;
    float alpha = smoothstep(0.5, 0.08, d) * vOpacity;
    gl_FragColor = vec4(0.92, 0.96, 1.0, alpha);
  }
`;

// ── 3. Soft Sun & Moon Radial Glow Textures (Canvas Generated) ──────────────
let cachedSunGlowTexture: THREE.CanvasTexture | null = null;
function getSunGlowTexture(): THREE.CanvasTexture {
  if (cachedSunGlowTexture) return cachedSunGlowTexture;
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    const grad = ctx.createRadialGradient(128, 128, 0, 128, 128, 128);
    grad.addColorStop(0, 'rgba(255, 255, 245, 1.0)');
    grad.addColorStop(0.12, 'rgba(255, 242, 195, 0.90)');
    grad.addColorStop(0.30, 'rgba(255, 220, 145, 0.60)');
    grad.addColorStop(0.55, 'rgba(255, 185, 105, 0.28)');
    grad.addColorStop(0.80, 'rgba(255, 165, 85, 0.08)');
    grad.addColorStop(1.0, 'rgba(255, 155, 75, 0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 256, 256);
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  cachedSunGlowTexture = tex;
  return tex;
}

let cachedMoonGlowTexture: THREE.CanvasTexture | null = null;
function getMoonGlowTexture(): THREE.CanvasTexture {
  if (cachedMoonGlowTexture) return cachedMoonGlowTexture;
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    const grad = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
    grad.addColorStop(0, 'rgba(255, 252, 230, 0.95)');
    grad.addColorStop(0.35, 'rgba(225, 215, 175, 0.42)');
    grad.addColorStop(0.7, 'rgba(165, 195, 240, 0.12)');
    grad.addColorStop(1, 'rgba(165, 195, 240, 0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 128, 128);
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  cachedMoonGlowTexture = tex;
  return tex;
}

// ── 4. Cloud Instance Definition ───────────────────────────────────────────
interface CloudInstanceData {
  geomIdx: number;       // 0..3 (which of the 4 GLB cloud geometries)
  instIdx: number;       // index inside that specific InstancedMesh
  x: number;
  y: number;
  z: number;
  scaleX: number;
  scaleY: number;
  scaleZ: number;
  rotX: number;
  rotY: number;
  rotZ: number;
  speed: number;
  tintMultiplier: number;
}

// ── 5. Lightweight Silhouetted Birds ────────────────────────────────────────
interface BirdData {
  pos: [number, number, number];
  speed: number;
  flapSpeed: number;
  flapOffset: number;
  scale: number;
}

export const SkyAndAtmosphere: React.FC = () => {
  perfRenderTracker.mark('SkyAndAtmosphere');
  const skyMode = useAppStore((s) => s.skyMode);
  const isLowPerformanceMode = useAppStore((s) => s.isLowPerformanceMode);
  const { scene, gl } = useThree();

  const hemiRef = useRef<THREE.HemisphereLight>(null);
  const ambientRef = useRef<THREE.AmbientLight>(null);
  const sunLightRef = useRef<THREE.DirectionalLight>(null);
  const sunMeshRef = useRef<THREE.Group>(null);
  const haloRef = useRef<THREE.Mesh>(null);
  const sunGlowSpriteRef = useRef<THREE.Sprite>(null);

  const moonGroupRef = useRef<THREE.Group>(null);
  const moonGlowSpriteRef = useRef<THREE.Sprite>(null);
  const starsPointsRef = useRef<THREE.Points>(null);
  const cloudGroupRef = useRef<THREE.Group>(null);
  const instancedMeshRefs = useRef<(THREE.InstancedMesh | null)[]>([]);

  const birdGroupRef = useRef<THREE.Group>(null);
  const birdMeshesRef = useRef<(THREE.Group | null)[]>([]);

  // ── A. Load GLB Once and Extract Meshes ───────────────────────────────────
  const gltf = useGLTF(SKY_MODEL_CONFIG.modelPath);

  // Extract the 4 unique cloud geometries and original "nuven" material
  const { cloudGeometries, originalNuvenMat } = useMemo(() => {
    const geometries: THREE.BufferGeometry[] = [];
    let nuvenMat: THREE.MeshStandardMaterial | null = null;

    // Find cloud plane meshes (Object_12, Object_14, Object_16, Object_18)
    const cloudMeshNames = ['Object_12', 'Object_14', 'Object_16', 'Object_18'];

    gltf.scene.traverse((child) => {
      if ((child as THREE.Mesh).isMesh) {
        const mesh = child as THREE.Mesh;
        if (cloudMeshNames.includes(mesh.name) || (mesh.material && (mesh.material as THREE.Material).name === 'nuven')) {
          if (!nuvenMat && mesh.material) {
            nuvenMat = mesh.material as THREE.MeshStandardMaterial;
          }
          // Clone geometry to isolate from GLB cache
          const clonedGeom = mesh.geometry.clone();
          // Ensure normals and bounding info are ready
          clonedGeom.computeVertexNormals();
          geometries.push(clonedGeom);
        }
      }
    });

    return { cloudGeometries: geometries, originalNuvenMat: nuvenMat as THREE.MeshStandardMaterial | null };
  }, [gltf]);

  // Clone cloud material with settings for instanced rendering
  const cloudMaterial = useMemo(() => {
    let mat: THREE.MeshStandardMaterial;
    if (originalNuvenMat) {
      mat = originalNuvenMat.clone();
    } else {
      mat = new THREE.MeshStandardMaterial({ color: 0xffffff });
    }
    mat.transparent = true;
    mat.depthWrite = false;
    mat.side = THREE.DoubleSide;
    mat.blending = THREE.NormalBlending;
    mat.roughness = 1.0;
    return mat;
  }, [originalNuvenMat]);

  // Build moon group from extracted GLB moon nodes
  const moonGroup = useMemo(() => {
    const group = new THREE.Group();
    group.name = 'MoonGroupFromGLB';
    const moonNodeNames = ['Cube_2', 'Cube001_3', 'Cube002_4', 'Cube003_5'];

    gltf.scene.traverse((child) => {
      if (moonNodeNames.includes(child.name)) {
        const clone = child.clone(true);
        group.add(clone);
      }
    });

    // Make moon materials transparent so we can smoothly tween opacity, and disable fog so it shines clearly
    group.traverse((c) => {
      if ((c as THREE.Mesh).isMesh) {
        const m = ((c as THREE.Mesh).material as THREE.Material).clone();
        m.transparent = true;
        (m as THREE.MeshStandardMaterial).fog = false;
        (c as THREE.Mesh).material = m;
      }
    });

    // Scale and orient cartoon moon nicely in the night sky
    group.scale.setScalar(8.5);
    // Face street viewpoint
    group.rotation.y = Math.PI * 0.35;
    return group;
  }, [gltf]);

  // ── B. Cloud Instancing Layout (3 Depth Layers + Horizon Tilting) ──────────
  const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;
  const isLowQuality = isLowPerformanceMode || isMobile;
  const totalClouds = isLowQuality ? SKY_MODEL_CONFIG.lowInstances : SKY_MODEL_CONFIG.desktopInstances;
  const perGeomCount = Math.max(1, Math.floor(totalClouds / 4));

  const cloudInstances = useMemo<CloudInstanceData[]>(() => {
    let seed = 98765;
    const rnd = () => {
      seed = (seed * 9301 + 49297) % 233280;
      return seed / 233280;
    };

    const instances: CloudInstanceData[] = [];
    const geomCount = Math.max(1, cloudGeometries.length);

    // 3 depth layers definition: all situated well above building rooftops (Y >= 38m)
    // Near: Y in [38, 50], Mid: Y in [48, 60], Far: Y in [58, 74]
    const layers = [
      { name: 'near', yMin: 38, yMax: 50, rMin: 20, rMax: 85, baseScale: 12.0, speedMin: 0.024, speedMax: 0.038 },
      { name: 'mid',  yMin: 48, yMax: 60, rMin: 35, rMax: 120, baseScale: 14.5, speedMin: 0.016, speedMax: 0.026 },
      { name: 'far',  yMin: 58, yMax: 74, rMin: 55, rMax: 150, baseScale: 18.0, speedMin: 0.010, speedMax: 0.018 },
    ];

    const countsPerGeom = [0, 0, 0, 0];

    for (let i = 0; i < totalClouds; i++) {
      const geomIdx = i % geomCount;
      const instIdx = countsPerGeom[geomIdx]++;
      const layer = layers[i % layers.length];

      // Distribute in circular/elliptical canopy around camera
      const angle = rnd() * Math.PI * 2;
      const radius = layer.rMin + rnd() * (layer.rMax - layer.rMin);
      const x = Math.cos(angle) * radius * 1.15;
      const z = Math.sin(angle) * radius;
      const y = layer.yMin + rnd() * (layer.yMax - layer.yMin);

      // Random scale variation (0.6x to 2.5x as required)
      const scaleMult = 0.6 + rnd() * 1.9;
      const finalScale = layer.baseScale * scaleMult;
      const aspectMult = 1.1 + rnd() * 0.4;

      // Horizon tilting: outer clouds tilt toward camera so they don't look like flat lines
      const distFromCenter = Math.sqrt(x * x + z * z);
      let rotX = 0;
      let rotZ = 0;
      if (distFromCenter > 45) {
        // Tilt plane upwards between 35° and 58°
        const tiltAngle = 0.60 + rnd() * 0.40;
        rotX = Math.cos(angle) * tiltAngle;
        rotZ = Math.sin(angle) * tiltAngle;
      }

      const rotY = rnd() * Math.PI * 2;
      const speed = layer.speedMin + rnd() * (layer.speedMax - layer.speedMin);
      const tintMultiplier = 0.94 + rnd() * 0.12; // Subtle tint variation

      instances.push({
        geomIdx,
        instIdx,
        x,
        y,
        z,
        scaleX: finalScale * aspectMult,
        scaleY: finalScale,
        scaleZ: finalScale * 1.1,
        rotX,
        rotY,
        rotZ,
        speed,
        tintMultiplier,
      });
    }

    return instances;
  }, [totalClouds, cloudGeometries.length]);

  // ── C. Procedural Twinkling Stars (Upper Hemisphere Only, Night Only) ─────
  const starsCount = isLowQuality ? SKY_MODEL_CONFIG.starsLowCount : SKY_MODEL_CONFIG.starsDesktopCount;

  const { starsGeometry, starsMat } = useMemo(() => {
    let seed = 44556;
    const rnd = () => {
      seed = (seed * 9301 + 49297) % 233280;
      return seed / 233280;
    };

    const geom = new THREE.BufferGeometry();
    const positions = new Float32Array(starsCount * 3);
    const twinkle = new Float32Array(starsCount * 2);
    const sizes = new Float32Array(starsCount);

    const R = 385; // Upper hemisphere inside sky dome (radius 420)

    for (let i = 0; i < starsCount; i++) {
      const theta = rnd() * Math.PI * 2;
      // Elevation from 4° above horizon to 86° near zenith (Y > 0)
      const phi = 0.07 + rnd() * (Math.PI * 0.5 - 0.14);

      positions[i * 3] = R * Math.cos(phi) * Math.sin(theta);
      positions[i * 3 + 1] = R * Math.sin(phi); // Strictly upper hemisphere
      positions[i * 3 + 2] = R * Math.cos(phi) * Math.cos(theta);

      twinkle[i * 2] = rnd() * Math.PI * 2;         // Phase offset
      twinkle[i * 2 + 1] = 1.5 + rnd() * 3.5;       // Twinkle speed

      sizes[i] = 1.8 + rnd() * 3.2;                // Point size
    }

    geom.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geom.setAttribute('aTwinkle', new THREE.BufferAttribute(twinkle, 2));
    geom.setAttribute('aSize', new THREE.BufferAttribute(sizes, 1));

    const mat = new THREE.ShaderMaterial({
      vertexShader: starsVertexShader,
      fragmentShader: starsFragmentShader,
      uniforms: {
        uTime: { value: 0 },
        uStarsOpacity: { value: 0.0 },
      },
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });

    return { starsGeometry: geom, starsMat: mat };
  }, [starsCount]);

  // ── D. Sky Dome Shader ───────────────────────────────────────────────────
  const initialPalette = SKY_MODE_PALETTES[skyMode] || SKY_MODE_PALETTES.morning;

  const skyUniforms = useRef({
    uHorizon: { value: initialPalette.skyHorizon.clone() },
    uMiddle: { value: initialPalette.skyMiddle.clone() },
    uZenith: { value: initialPalette.skyTop.clone() },
    uSunPosition: { value: new THREE.Vector3(...initialPalette.lightPosition) },
    uSunColor: { value: initialPalette.lightColor.clone() },
    uExponent: { value: 0.52 },
  });

  const skyMat = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: skyVertexShader,
        fragmentShader: skyFragmentShader,
        uniforms: skyUniforms.current,
        side: THREE.BackSide,
        depthWrite: false,
      }),
    []
  );

  // ── E. Silhouetted Flock of Birds Crossing the Sky ────────────────────────
  const birds = useMemo<BirdData[]>(() => {
    return [
      { pos: [-40, 42, -22], speed: 0.065, flapSpeed: 5.5, flapOffset: 0.0, scale: 0.65 },
      { pos: [-46, 44, -25], speed: 0.065, flapSpeed: 5.8, flapOffset: 0.8, scale: 0.58 },
      { pos: [-34, 40, -19], speed: 0.064, flapSpeed: 5.2, flapOffset: 1.4, scale: 0.62 },
      { pos: [-52, 45, -28], speed: 0.066, flapSpeed: 6.0, flapOffset: 2.1, scale: 0.52 },
      { pos: [-28, 39, -16], speed: 0.063, flapSpeed: 5.0, flapOffset: 2.8, scale: 0.60 },
    ];
  }, []);

  const wingGeom = useMemo(() => {
    const geom = new THREE.BufferGeometry();
    const vertices = new Float32Array([
      0, 0, 0,
      -0.75, 0.05, 0.15,
      -0.15, 0, 0.35,
    ]);
    geom.setAttribute('position', new THREE.BufferAttribute(vertices, 3));
    geom.computeVertexNormals();
    return geom;
  }, []);

  const birdMat = useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        color: 0x222a38,
        side: THREE.DoubleSide,
      }),
    []
  );

  // ── F. Dynamic 1.5s Transition State & Interpolation Engine ──────────────
  const currentModeRef = useRef<SkyMode>(skyMode);
  const transitionRef = useRef({
    progress: 1.0,
    from: { ...initialPalette },
    to: { ...initialPalette },
    current: {
      skyTop: initialPalette.skyTop.clone(),
      skyMiddle: initialPalette.skyMiddle.clone(),
      skyHorizon: initialPalette.skyHorizon.clone(),
      fogColor: initialPalette.fogColor.clone(),
      fogNear: initialPalette.fogNear,
      fogFar: initialPalette.fogFar,
      cloudTint: initialPalette.cloudTint.clone(),
      cloudOpacity: initialPalette.cloudOpacity,
      cloudEmissive: initialPalette.cloudEmissive.clone(),
      cloudEmissiveIntensity: initialPalette.cloudEmissiveIntensity,
      lightColor: initialPalette.lightColor.clone(),
      lightIntensity: initialPalette.lightIntensity,
      lightPosition: [...initialPalette.lightPosition] as [number, number, number],
      hemiSky: initialPalette.hemiSky.clone(),
      hemiGround: initialPalette.hemiGround.clone(),
      hemiIntensity: initialPalette.hemiIntensity,
      ambientColor: initialPalette.ambientColor.clone(),
      ambientIntensity: initialPalette.ambientIntensity,
      exposure: initialPalette.exposure,
      moonOpacity: initialPalette.moonOpacity,
      starsOpacity: initialPalette.starsOpacity,
      windowGlow: initialPalette.windowGlow,
    },
  });

  // Trigger smooth transition whenever skyMode changes
  useEffect(() => {
    if (skyMode !== currentModeRef.current) {
      const tr = transitionRef.current;
      // Start from current intermediate interpolated state to avoid sudden snaps
      tr.from = {
        name: currentModeRef.current,
        skyTop: tr.current.skyTop.clone(),
        skyMiddle: tr.current.skyMiddle.clone(),
        skyHorizon: tr.current.skyHorizon.clone(),
        fogColor: tr.current.fogColor.clone(),
        fogNear: tr.current.fogNear,
        fogFar: tr.current.fogFar,
        cloudTint: tr.current.cloudTint.clone(),
        cloudOpacity: tr.current.cloudOpacity,
        cloudEmissive: tr.current.cloudEmissive.clone(),
        cloudEmissiveIntensity: tr.current.cloudEmissiveIntensity,
        lightColor: tr.current.lightColor.clone(),
        lightIntensity: tr.current.lightIntensity,
        lightPosition: [...tr.current.lightPosition] as [number, number, number],
        hemiSky: tr.current.hemiSky.clone(),
        hemiGround: tr.current.hemiGround.clone(),
        hemiIntensity: tr.current.hemiIntensity,
        ambientColor: tr.current.ambientColor.clone(),
        ambientIntensity: tr.current.ambientIntensity,
        exposure: tr.current.exposure,
        moonOpacity: tr.current.moonOpacity,
        starsOpacity: tr.current.starsOpacity,
        windowGlow: tr.current.windowGlow,
      };
      tr.to = SKY_MODE_PALETTES[skyMode] || SKY_MODE_PALETTES.morning;
      tr.progress = 0.0;
      currentModeRef.current = skyMode;
    }
  }, [skyMode]);

  // Set initial instance matrices & colors once meshes mount
  const dummyMatrixObj = useMemo(() => new THREE.Object3D(), []);
  const initialSetupDoneRef = useRef(false);

  useEffect(() => {
    if (initialSetupDoneRef.current) return;
    if (cloudGeometries.length === 0) return;

    // Apply colors with tint variations to InstancedMeshes
    const baseColor = initialPalette.cloudTint;
    cloudInstances.forEach((inst) => {
      const mesh = instancedMeshRefs.current[inst.geomIdx];
      if (mesh) {
        dummyMatrixObj.position.set(inst.x, inst.y, inst.z);
        dummyMatrixObj.rotation.set(inst.rotX, inst.rotY, inst.rotZ);
        dummyMatrixObj.scale.set(inst.scaleX, inst.scaleY, inst.scaleZ);
        dummyMatrixObj.updateMatrix();
        mesh.setMatrixAt(inst.instIdx, dummyMatrixObj.matrix);

        const variedColor = new THREE.Color().copy(baseColor).multiplyScalar(inst.tintMultiplier);
        mesh.setColorAt(inst.instIdx, variedColor);
      }
    });

    instancedMeshRefs.current.forEach((m) => {
      if (m) {
        m.instanceMatrix.needsUpdate = true;
        if (m.instanceColor) m.instanceColor.needsUpdate = true;
      }
    });

    initialSetupDoneRef.current = true;
  }, [cloudInstances, cloudGeometries.length, initialPalette.cloudTint, dummyMatrixObj]);

  // ── G. Animation Frame Loop ───────────────────────────────────────────────
  useFrame(({ clock, camera }, delta) => {
    const elapsed = clock.getElapsedTime();
    const dt = Math.min(delta, 0.1);
    const tr = transitionRef.current;

    // 1. Advance 1.5s Transition Tween
    if (tr.progress < 1.0) {
      tr.progress = Math.min(1.0, tr.progress + dt / SKY_MODEL_CONFIG.transitionDurationSec);
    }
    // Cubic Ease In-Out curve
    const p = tr.progress;
    const t = p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2;

    const from = tr.from;
    const to = tr.to;
    const cur = tr.current;

    // Interpolate all active palette parameters
    cur.skyTop.lerpColors(from.skyTop, to.skyTop, t);
    cur.skyMiddle.lerpColors(from.skyMiddle, to.skyMiddle, t);
    cur.skyHorizon.lerpColors(from.skyHorizon, to.skyHorizon, t);
    cur.fogColor.lerpColors(from.fogColor, to.fogColor, t);
    cur.fogNear = THREE.MathUtils.lerp(from.fogNear, to.fogNear, t);
    cur.fogFar = THREE.MathUtils.lerp(from.fogFar, to.fogFar, t);

    cur.cloudTint.lerpColors(from.cloudTint, to.cloudTint, t);
    cur.cloudOpacity = THREE.MathUtils.lerp(from.cloudOpacity, to.cloudOpacity, t);
    cur.cloudEmissive.lerpColors(from.cloudEmissive, to.cloudEmissive, t);
    cur.cloudEmissiveIntensity = THREE.MathUtils.lerp(from.cloudEmissiveIntensity, to.cloudEmissiveIntensity, t);

    cur.lightColor.lerpColors(from.lightColor, to.lightColor, t);
    cur.lightIntensity = THREE.MathUtils.lerp(from.lightIntensity, to.lightIntensity, t);
    cur.lightPosition[0] = THREE.MathUtils.lerp(from.lightPosition[0], to.lightPosition[0], t);
    cur.lightPosition[1] = THREE.MathUtils.lerp(from.lightPosition[1], to.lightPosition[1], t);
    cur.lightPosition[2] = THREE.MathUtils.lerp(from.lightPosition[2], to.lightPosition[2], t);

    cur.hemiSky.lerpColors(from.hemiSky, to.hemiSky, t);
    cur.hemiGround.lerpColors(from.hemiGround, to.hemiGround, t);
    cur.hemiIntensity = THREE.MathUtils.lerp(from.hemiIntensity, to.hemiIntensity, t);
    cur.ambientColor.lerpColors(from.ambientColor, to.ambientColor, t);
    cur.ambientIntensity = THREE.MathUtils.lerp(from.ambientIntensity, to.ambientIntensity, t);

    cur.exposure = THREE.MathUtils.lerp(from.exposure, to.exposure, t);
    cur.moonOpacity = THREE.MathUtils.lerp(from.moonOpacity, to.moonOpacity, t);
    cur.starsOpacity = THREE.MathUtils.lerp(from.starsOpacity, to.starsOpacity, t);
    cur.windowGlow = THREE.MathUtils.lerp(from.windowGlow, to.windowGlow, t);

    // 2. Apply to Sky Dome Shader Uniforms
    skyUniforms.current.uHorizon.value.copy(cur.skyHorizon);
    skyUniforms.current.uMiddle.value.copy(cur.skyMiddle);
    skyUniforms.current.uZenith.value.copy(cur.skyTop);
    skyUniforms.current.uSunPosition.value.set(...cur.lightPosition);
    skyUniforms.current.uSunColor.value.copy(cur.lightColor);
    scene.background = null;

    // 3. Fog and Camera Altitude Mist Penetration
    const camY = camera.position.y;
    if (scene.fog) {
      scene.fog.color.copy(cur.fogColor);

      // Mist builds smoothly as camera passes through cloud layer (Y=28 to Y=56)
      let mistFactor = 0;
      if (camY >= 28 && camY <= 56) {
        mistFactor = 1.0 - Math.abs(camY - 42) / 14;
        mistFactor = THREE.MathUtils.clamp(mistFactor, 0.0, 1.0);
        mistFactor = Math.sin(mistFactor * Math.PI * 0.5);
      }

      const linearFog = scene.fog as THREE.Fog;
      if (linearFog.isFog) {
        const targetNear = THREE.MathUtils.lerp(cur.fogNear, 8, mistFactor);
        const targetFar = THREE.MathUtils.lerp(cur.fogFar, 65, mistFactor);
        linearFog.near = targetNear;
        linearFog.far = targetFar;
      }
    }

    // 4. Cloud Canopy Follows Camera Horizontally (X, Z) with Infinite Wrapping
    if (cloudGroupRef.current) {
      cloudGroupRef.current.position.set(camera.position.x, 0, camera.position.z);
    }

    // Update cloud material color & opacity
    cloudMaterial.color.copy(cur.cloudTint);
    cloudMaterial.opacity = cur.cloudOpacity;
    cloudMaterial.emissive.copy(cur.cloudEmissive);
    cloudMaterial.emissiveIntensity = cur.cloudEmissiveIntensity;

    // Drift cloud instances and update transforms
    const speedScale = dt * 60;
    cloudInstances.forEach((inst) => {
      inst.x += inst.speed * speedScale;
      // Infinite wrapping box: [-150, 150]
      if (inst.x > 150) {
        inst.x = -150;
      }

      const mesh = instancedMeshRefs.current[inst.geomIdx];
      if (mesh) {
        dummyMatrixObj.position.set(inst.x, inst.y, inst.z);
        dummyMatrixObj.rotation.set(inst.rotX, inst.rotY, inst.rotZ);
        dummyMatrixObj.scale.set(inst.scaleX, inst.scaleY, inst.scaleZ);
        dummyMatrixObj.updateMatrix();
        mesh.setMatrixAt(inst.instIdx, dummyMatrixObj.matrix);
      }
    });

    instancedMeshRefs.current.forEach((m) => {
      if (m) m.instanceMatrix.needsUpdate = true;
    });

    // 5. Directional, Ambient, & Hemisphere Lights
    if (sunLightRef.current) {
      sunLightRef.current.color.copy(cur.lightColor);
      sunLightRef.current.intensity = cur.lightIntensity;
      sunLightRef.current.position.set(...cur.lightPosition);
    }
    if (hemiRef.current) {
      hemiRef.current.color.copy(cur.hemiSky);
      hemiRef.current.groundColor.copy(cur.hemiGround);
      hemiRef.current.intensity = cur.hemiIntensity;
    }
    if (ambientRef.current) {
      ambientRef.current.color.copy(cur.ambientColor);
      ambientRef.current.intensity = cur.ambientIntensity;
    }

    // 6. Moon & Stars Animation (Night Elements)
    // Moon visibility and opacity
    const isMoonVisible = cur.moonOpacity > 0.005;
    if (moonGroupRef.current) {
      moonGroupRef.current.visible = isMoonVisible;
      if (isMoonVisible) {
        moonGroupRef.current.traverse((c) => {
          if ((c as THREE.Mesh).isMesh) {
            const m = (c as THREE.Mesh).material as THREE.MeshStandardMaterial;
            if (m && 'opacity' in m) {
              m.opacity = cur.moonOpacity;
            }
          }
        });
      }
    }
    if (moonGlowSpriteRef.current) {
      moonGlowSpriteRef.current.visible = isMoonVisible;
      moonGlowSpriteRef.current.material.opacity = cur.moonOpacity * 0.85;
      moonGlowSpriteRef.current.scale.setScalar(64 + Math.sin(elapsed * 1.5) * 3.0);
    }

    // Stars Twinkle Shader
    const isStarsVisible = cur.starsOpacity > 0.005;
    if (starsPointsRef.current) {
      starsPointsRef.current.visible = isStarsVisible;
    }
    if (isStarsVisible) {
      starsMat.uniforms.uTime.value = elapsed;
      starsMat.uniforms.uStarsOpacity.value = cur.starsOpacity;
    }

    // Sun Disc & Halo breathing (Morning and Evening)
    const isSunVisible = cur.moonOpacity < 0.99;
    if (sunMeshRef.current) {
      sunMeshRef.current.visible = isSunVisible;
      if (isSunVisible) {
        // Position sun on celestial sphere along light direction
        _scratchSunPos.set(cur.lightPosition[0], cur.lightPosition[1], cur.lightPosition[2]).normalize().multiplyScalar(220);
        sunMeshRef.current.position.copy(_scratchSunPos);
        if (haloRef.current) {
          haloRef.current.scale.setScalar(1 + Math.sin(elapsed * 1.8) * 0.06);
          (haloRef.current.material as THREE.MeshBasicMaterial).opacity = (1.0 - cur.moonOpacity) * 0.42;
        }
        if (sunGlowSpriteRef.current) {
          const pulse = 1.0 + Math.sin(elapsed * 1.2) * 0.05;
          sunGlowSpriteRef.current.scale.set(180 * pulse, 180 * pulse, 1);
          (sunGlowSpriteRef.current.material as THREE.SpriteMaterial).opacity = (1.0 - cur.moonOpacity) * 0.72;
        }
      }
    }

    // 7. Window Glow on Buildings
    materials.upperWindow.emissiveIntensity = cur.windowGlow;
    materials.storefrontWindow.emissiveIntensity = cur.windowGlow;

    // Tone Mapping Exposure
    gl.toneMappingExposure = cur.exposure;

    // 8. Birds crossing the sky slowly with gentle wing flaps
    birdMeshesRef.current.forEach((bGroup, idx) => {
      if (bGroup) {
        const b = birds[idx];
        bGroup.position.x += b.speed;
        if (bGroup.position.x > 140) {
          bGroup.position.x = -140;
        }

        const flap = Math.sin(elapsed * b.flapSpeed + b.flapOffset) * 0.38;
        const leftWing = bGroup.children[0];
        const rightWing = bGroup.children[1];
        if (leftWing) leftWing.rotation.z = flap;
        if (rightWing) rightWing.rotation.z = -flap;
      }
    });
  });

  return (
    <>
      {/* Fog seamlessly matches horizon */}
      <fog attach="fog" args={[initialPalette.fogColor.getHex(), initialPalette.fogNear, initialPalette.fogFar]} />

      {/* Sky Dome with Vertical Gradient and Celestial Sun/Moon Glow */}
      <mesh material={skyMat} renderOrder={-1000}>
        <sphereGeometry args={[420, 32, 32]} />
      </mesh>

      {/* Lighting */}
      <hemisphereLight ref={hemiRef} args={[0xf3f8ff, 0x4a5568, initialPalette.hemiIntensity]} />
      <ambientLight ref={ambientRef} color={initialPalette.ambientColor.getHex()} intensity={initialPalette.ambientIntensity} />

      {/* Directional Sun/Moon Light */}
      <directionalLight
        ref={sunLightRef}
        position={initialPalette.lightPosition}
        intensity={initialPalette.lightIntensity}
        color={initialPalette.lightColor.getHex()}
        castShadow
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
        shadow-camera-near={10}
        shadow-camera-far={250}
        shadow-camera-left={-120}
        shadow-camera-right={120}
        shadow-camera-top={120}
        shadow-camera-bottom={-120}
        shadow-bias={-0.0005}
      />

      {/* ── Sun Mesh, Halo & Radiant Sun Glow Sprite (Visible in Morning & Evening) ── */}
      <group ref={sunMeshRef} position={[120, 110, -180]}>
        {/* Soft Radiant Sun Glow Sprite */}
        <sprite
          ref={sunGlowSpriteRef}
          position={[0, 0, -2]}
          scale={[180, 180, 1]}
          material={
            new THREE.SpriteMaterial({
              map: getSunGlowTexture(),
              transparent: true,
              opacity: 0.72,
              blending: THREE.AdditiveBlending,
              depthWrite: false,
              fog: false,
            })
          }
        />
        <mesh>
          <sphereGeometry args={[15, 32, 32]} />
          <meshBasicMaterial color={0xfffaea} fog={false} />
        </mesh>
        <mesh ref={haloRef}>
          <sphereGeometry args={[28, 32, 32]} />
          <meshBasicMaterial
            color={0xffdf99}
            transparent
            opacity={0.42}
            blending={THREE.AdditiveBlending}
            fog={false}
          />
        </mesh>
      </group>

      {/* ── Moon Group & Soft Radial Glow Sprite (Visible at Night Only) ── */}
      <group position={[55, 82, -100]}>
        {/* Soft Radial Glow Sprite behind Moon */}
        <sprite
          ref={moonGlowSpriteRef}
          position={[0, 0, -2]}
          scale={[64, 64, 1]}
          material={
            new THREE.SpriteMaterial({
              map: getMoonGlowTexture(),
              transparent: true,
              opacity: 0.0,
              blending: THREE.AdditiveBlending,
              depthWrite: false,
              fog: false,
            })
          }
        />
        {/* Low-poly cartoon moon extracted from GLB */}
        <primitive ref={moonGroupRef} object={moonGroup} visible={false} />
      </group>

      {/* ── Procedural Twinkling Stars (Upper Hemisphere, Night Only) ──── */}
      <points
        ref={starsPointsRef}
        geometry={starsGeometry}
        material={starsMat}
        visible={false}
      />

      {/* ── Instanced Cloud Canopy (4 Shapes from GLB, 3 Depth Layers) ─── */}
      <group ref={cloudGroupRef}>
        {cloudGeometries.map((geom, idx) => (
          <instancedMesh
            key={idx}
            ref={(el) => {
              instancedMeshRefs.current[idx] = el;
            }}
            args={[geom, cloudMaterial, perGeomCount]}
            frustumCulled={false}
          />
        ))}
      </group>

      {/* ── Silhouetted Birds Crossing the Sky ─────────────────────────── */}
      <group ref={birdGroupRef}>
        {birds.map((b, idx) => (
          <group
            key={idx}
            ref={(el) => {
              birdMeshesRef.current[idx] = el;
            }}
            position={b.pos}
            scale={b.scale}
            rotation={[0, Math.PI / 2 + 0.15, 0]}
          >
            {/* Left Wing */}
            <mesh geometry={wingGeom} material={birdMat} />
            {/* Right Wing (mirrored along X) */}
            <mesh geometry={wingGeom} material={birdMat} scale={[-1, 1, 1]} />
          </group>
        ))}
      </group>
    </>
  );
};
