import React, { useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { useAppStore } from '../../store/useAppStore';
import { SKY_CONFIG } from '../../config/skyConfig';
import { materials } from '../../utils/proceduralTextures';

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
  uniform vec3 uZenith;
  uniform vec3 uSunPosition;
  uniform vec3 uSunColor;
  uniform float uExponent;
  varying vec3 vWorldPosition;

  void main() {
    vec3 dir = normalize(vWorldPosition);
    float h = max(dir.y, 0.0);
    float t = pow(h, uExponent);
    vec3 color = mix(uHorizon, uZenith, t);

    // Soft celestial sun glow directly blended into the dome
    vec3 sunDir = normalize(uSunPosition);
    float sunDot = max(dot(dir, sunDir), 0.0);
    float sunGlow = pow(sunDot, 8.0) * 0.28 + pow(sunDot, 48.0) * 0.50;
    color += uSunColor * sunGlow;

    gl_FragColor = vec4(color, 1.0);
  }
`;

// ── 2. Procedural Organic Soft Cloud Puff Texture (Canvas Generated) ───────
let cachedCloudTexture: THREE.CanvasTexture | null = null;

function getSharedCloudTexture(): THREE.CanvasTexture {
  if (cachedCloudTexture) return cachedCloudTexture;

  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d');

  if (!ctx) {
    cachedCloudTexture = new THREE.CanvasTexture(canvas);
    return cachedCloudTexture;
  }

  const imgData = ctx.createImageData(256, 256);
  const data = imgData.data;

  // Overlapping soft Gaussian puff centers
  const centers = [
    { x: 128, y: 132, r: 84, w: 1.0 },
    { x: 92, y: 140, r: 64, w: 0.82 },
    { x: 164, y: 138, r: 66, w: 0.84 },
    { x: 108, y: 108, r: 58, w: 0.76 },
    { x: 148, y: 110, r: 60, w: 0.78 },
  ];

  for (let y = 0; y < 256; y++) {
    const normY = y / 255; // 0 = top, 1 = bottom
    for (let x = 0; x < 256; x++) {
      let density = 0;
      for (const c of centers) {
        const dx = x - c.x;
        const dy = y - c.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < c.r) {
          const t = dist / c.r;
          const d = Math.cos(t * Math.PI * 0.5);
          density += d * d * c.w;
        }
      }
      density = Math.min(1.0, density);

      // Off-white with subtle peach top light (normY ~ 0) to faintly blue-grey underside (normY ~ 1)
      const r = Math.round(255 - normY * 38);
      const g = Math.round(246 - normY * 20);
      const b = Math.round(238 + (235 - 238) * normY);
      const a = Math.round(density * 255);

      const idx = (y * 256 + x) * 4;
      data[idx] = r;
      data[idx + 1] = g;
      data[idx + 2] = b;
      data[idx + 3] = a;
    }
  }

  ctx.putImageData(imgData, 0, 0);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.generateMipmaps = true;
  cachedCloudTexture = tex;
  return cachedCloudTexture;
}

// ── 3. Cloud Sprite Instance Definition ─────────────────────────────────────
interface CloudSpriteData {
  id: number;
  layer: 'near' | 'mid' | 'far';
  x: number;
  y: number;
  z: number;
  scaleX: number;
  scaleY: number;
  speed: number;
  baseOpacity: number;
}

// ── 4. Lightweight Birds Crossing the Sky ────────────────────────────────────
interface BirdData {
  pos: [number, number, number];
  speed: number;
  flapSpeed: number;
  flapOffset: number;
  scale: number;
}

export const SkyAndAtmosphere: React.FC = () => {
  const isGoldenEvening = useAppStore((s) => s.isGoldenEvening);
  const isLowPerformanceMode = useAppStore((s) => s.isLowPerformanceMode);
  const { scene } = useThree();

  const hemiRef = useRef<THREE.HemisphereLight>(null);
  const ambientRef = useRef<THREE.AmbientLight>(null);
  const sunLightRef = useRef<THREE.DirectionalLight>(null);
  const haloRef = useRef<THREE.Mesh>(null);
  const cloudGroupRef = useRef<THREE.Group>(null);
  const birdGroupRef = useRef<THREE.Group>(null);
  const birdMeshesRef = useRef<(THREE.Group | null)[]>([]);

  // Sky dome shader uniforms
  const skyUniforms = useRef({
    uHorizon: { value: SKY_CONFIG.day.skyHorizon.clone() },
    uZenith: { value: SKY_CONFIG.day.skyZenith.clone() },
    uSunPosition: { value: new THREE.Vector3(...SKY_CONFIG.day.sunPosition) },
    uSunColor: { value: SKY_CONFIG.day.sun.clone() },
    uExponent: { value: 0.50 },
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

  // Shared cloud sprite texture & material
  const cloudTexture = useMemo(() => getSharedCloudTexture(), []);
  const cloudMaterial = useMemo(
    () =>
      new THREE.SpriteMaterial({
        map: cloudTexture,
        color: 0xffffff,
        transparent: true,
        opacity: 0.72,
        depthWrite: false,
        blending: THREE.NormalBlending,
      }),
    [cloudTexture]
  );

  // Generate 3 depth layers of clouds (near / mid / far)
  const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;
  const isLowQuality = isLowPerformanceMode || isMobile;

  const cloudSprites = useMemo<CloudSpriteData[]>(() => {
    let seed = 12345;
    const rnd = () => {
      seed = (seed * 9301 + 49297) % 233280;
      return seed / 233280;
    };

    const count = isLowQuality ? SKY_CONFIG.clouds.mobileCount : SKY_CONFIG.clouds.desktopCount;
    const perLayer = Math.floor(count / 3);
    const sprites: CloudSpriteData[] = [];

    const layers: Array<{
      name: 'near' | 'mid' | 'far';
      yRange: [number, number];
      zRange: [number, number];
      scaleRange: [number, number];
      speedRange: [number, number];
      opacityRange: [number, number];
    }> = [
      {
        name: 'near',
        yRange: SKY_CONFIG.clouds.nearLayer.yRange,
        zRange: SKY_CONFIG.clouds.nearLayer.zRange,
        scaleRange: SKY_CONFIG.clouds.nearLayer.scaleRange,
        speedRange: [0.024, 0.038],
        opacityRange: [0.65, 0.85],
      },
      {
        name: 'mid',
        yRange: SKY_CONFIG.clouds.midLayer.yRange,
        zRange: SKY_CONFIG.clouds.midLayer.zRange,
        scaleRange: SKY_CONFIG.clouds.midLayer.scaleRange,
        speedRange: [0.016, 0.026],
        opacityRange: [0.55, 0.75],
      },
      {
        name: 'far',
        yRange: SKY_CONFIG.clouds.farLayer.yRange,
        zRange: SKY_CONFIG.clouds.farLayer.zRange,
        scaleRange: SKY_CONFIG.clouds.farLayer.scaleRange,
        speedRange: [0.010, 0.018],
        opacityRange: [0.45, 0.65],
      },
    ];

    let id = 0;
    layers.forEach((l) => {
      for (let i = 0; i < perLayer; i++) {
        const x = -130 + rnd() * 260;
        const y = l.yRange[0] + rnd() * (l.yRange[1] - l.yRange[0]);
        const z = l.zRange[0] + rnd() * (l.zRange[1] - l.zRange[0]);
        const baseScale = l.scaleRange[0] + rnd() * (l.scaleRange[1] - l.scaleRange[0]);
        const aspect = 1.35 + rnd() * 0.45; // Clouds are wider horizontally
        const speed = l.speedRange[0] + rnd() * (l.speedRange[1] - l.speedRange[0]);
        const baseOpacity = l.opacityRange[0] + rnd() * (l.opacityRange[1] - l.opacityRange[0]);

        sprites.push({
          id: id++,
          layer: l.name,
          x,
          y,
          z,
          scaleX: baseScale * aspect,
          scaleY: baseScale,
          speed,
          baseOpacity,
        });
      }
    });

    return sprites;
  }, [isLowQuality]);

  // Generate 5 lightweight birds gliding across the sky
  const birds = useMemo<BirdData[]>(() => {
    return [
      { pos: [-40, 42, -22], speed: 0.065, flapSpeed: 5.5, flapOffset: 0.0, scale: 0.65 },
      { pos: [-46, 44, -25], speed: 0.065, flapSpeed: 5.8, flapOffset: 0.8, scale: 0.58 },
      { pos: [-34, 40, -19], speed: 0.064, flapSpeed: 5.2, flapOffset: 1.4, scale: 0.62 },
      { pos: [-52, 45, -28], speed: 0.066, flapSpeed: 6.0, flapOffset: 2.1, scale: 0.52 },
      { pos: [-28, 39, -16], speed: 0.063, flapSpeed: 5.0, flapOffset: 2.8, scale: 0.60 },
    ];
  }, []);

  // Wing geometry: simple 2-triangle low-poly bird
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
        color: 0x334155, // Silhouetted slate bird
        side: THREE.DoubleSide,
      }),
    []
  );

  // Sprite references for drifting animation
  const spriteRefs = useRef<(THREE.Sprite | null)[]>([]);

  // Animation frame loop: sky lerp, dynamic cloud penetration mist, drifting & culling
  useFrame(({ clock, camera }) => {
    const elapsed = clock.getElapsedTime();
    const target = isGoldenEvening ? SKY_CONFIG.goldenEvening : SKY_CONFIG.day;
    const rate = 0.02;

    // 1. Lerp Sky Dome Shader Uniforms
    skyUniforms.current.uHorizon.value.lerp(target.skyHorizon, rate);
    skyUniforms.current.uZenith.value.lerp(target.skyZenith, rate);
    skyUniforms.current.uSunColor.value.lerp(target.sun, rate);
    skyUniforms.current.uSunPosition.value.lerp(
      new THREE.Vector3(...target.sunPosition),
      rate
    );

    // Disable scene.background so sky dome is visible
    scene.background = null;

    // 2. Camera Altitude & Cloud Penetration Mist
    const camY = camera.position.y;

    // Mist builds when camera plunges through cloud bank (Y=28 to Y=56), peaks at Y=42
    if (scene.fog) {
      scene.fog.color.lerp(target.fog, rate);

      const mistMinY = SKY_CONFIG.descent.mistCloudMinY;
      const mistMaxY = SKY_CONFIG.descent.mistCloudMaxY;
      const mistCenterY = (mistMinY + mistMaxY) / 2;
      const mistHalfSpan = (mistMaxY - mistMinY) / 2;

      let mistFactor = 0;
      if (camY >= mistMinY && camY <= mistMaxY) {
        mistFactor = 1.0 - Math.abs(camY - mistCenterY) / mistHalfSpan;
        mistFactor = THREE.MathUtils.clamp(mistFactor, 0.0, 1.0);
        mistFactor = Math.sin(mistFactor * Math.PI * 0.5);
      }

      // Base street fog: [20, 180]. Under cloud mist: contracts to [8, 65]
      const linearFog = scene.fog as THREE.Fog;
      if (linearFog.isFog) {
        const targetNear = THREE.MathUtils.lerp(20, 8, mistFactor);
        const targetFar = THREE.MathUtils.lerp(180, 65, mistFactor);
        linearFog.near += (targetNear - linearFog.near) * 0.08;
        linearFog.far += (targetFar - linearFog.far) * 0.08;
      }
    }

    // 3. Performance Culling: Disable clouds when camera is well below them (camY < 14)
    const isCloudsVisible = camY >= SKY_CONFIG.clouds.cullAltitude;
    if (cloudGroupRef.current) {
      cloudGroupRef.current.visible = isCloudsVisible;
    }

    // 4. Cloud Drift & Wrap (only update when visible)
    if (isCloudsVisible) {
      cloudMaterial.color.lerp(target.cloudTint, rate);

      // Fade clouds out as camera approaches street level (Y: 28 down to 14)
      const altitudeFade = THREE.MathUtils.clamp((camY - 14) / 14, 0.0, 1.0);

      spriteRefs.current.forEach((sp, idx) => {
        if (sp) {
          const cfg = cloudSprites[idx];
          sp.position.x += cfg.speed;
          if (sp.position.x > 135) {
            sp.position.x = -135;
          }
          sp.material.opacity = cfg.baseOpacity * altitudeFade;
        }
      });
    }

    // 5. Birds crossing the sky slowly with gentle wing flaps
    birdMeshesRef.current.forEach((bGroup, idx) => {
      if (bGroup) {
        const b = birds[idx];
        bGroup.position.x += b.speed;
        if (bGroup.position.x > 120) {
          bGroup.position.x = -120;
        }

        const flap = Math.sin(elapsed * b.flapSpeed + b.flapOffset) * 0.38;
        const leftWing = bGroup.children[0];
        const rightWing = bGroup.children[1];
        if (leftWing) leftWing.rotation.z = flap;
        if (rightWing) rightWing.rotation.z = -flap;
      }
    });

    // 6. Smooth Lerp Lighting
    if (hemiRef.current) {
      hemiRef.current.color.lerp(target.hemiSky, rate);
      hemiRef.current.groundColor.lerp(target.hemiGround, rate);
    }
    if (ambientRef.current) {
      ambientRef.current.color.lerp(target.ambient, rate);
    }
    if (sunLightRef.current) {
      sunLightRef.current.color.lerp(target.sun, rate);
      sunLightRef.current.intensity += (target.sunIntensity - sunLightRef.current.intensity) * rate;
    }

    // Window emissive glow
    materials.upperWindow.emissiveIntensity +=
      (target.windowGlow - materials.upperWindow.emissiveIntensity) * rate;
    materials.storefrontWindow.emissiveIntensity +=
      (target.windowGlow - materials.storefrontWindow.emissiveIntensity) * rate;

    // Sun halo breathing animation
    if (haloRef.current) {
      haloRef.current.scale.setScalar(1 + Math.sin(elapsed * 1.8) * 0.04);
    }
  });

  return (
    <>
      {/* Fog — seamlessly matches horizon peach */}
      <fog attach="fog" args={[SKY_CONFIG.day.fog.getHex(), 20, 180]} />

      {/* Sky Dome with Vertical Gradient and Soft Celestial Sun Glow */}
      <mesh material={skyMat} renderOrder={-1000}>
        <sphereGeometry args={[420, 32, 32]} />
      </mesh>

      {/* Lighting */}
      <hemisphereLight ref={hemiRef} args={[0xf3f8ff, 0x4a5568, 0.65]} />
      <ambientLight ref={ambientRef} color={0xfff5e6} intensity={0.45} />

      {/* Directional Sun */}
      <directionalLight
        ref={sunLightRef}
        position={SKY_CONFIG.day.sunPosition}
        intensity={1.35}
        color={0xfff1d6}
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

      {/* Sun Mesh & Soft Corona Halo */}
      <group position={[120, 110, -180]}>
        <mesh>
          <sphereGeometry args={[14, 32, 32]} />
          <meshBasicMaterial color={0xfff4d9} />
        </mesh>
        <mesh ref={haloRef}>
          <sphereGeometry args={[22, 32, 32]} />
          <meshBasicMaterial
            color={0xffe2a0}
            transparent
            opacity={0.18}
            blending={THREE.AdditiveBlending}
          />
        </mesh>
      </group>

      {/* ── Soft Layered Cloud Sprites (3 Depth Layers) ────────────────── */}
      <group ref={cloudGroupRef}>
        {cloudSprites.map((c, i) => (
          <sprite
            key={c.id}
            ref={(el) => {
              spriteRefs.current[i] = el;
            }}
            material={cloudMaterial}
            position={[c.x, c.y, c.z]}
            scale={[c.scaleX, c.scaleY, 1]}
          />
        ))}
      </group>

      {/* ── 4-6 Small Birds Crossing the Sky Slowly ────────────────────── */}
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
