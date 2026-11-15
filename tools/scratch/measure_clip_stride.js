const fs = require('fs');
const THREE = require('c:/Users/Aditya/Desktop/portfolio/app/node_modules/three');
const { FBXLoader } = require('c:/Users/Aditya/Desktop/portfolio/app/node_modules/three/examples/jsm/loaders/FBXLoader.js');

global.URL = { createObjectURL: () => 'blob:dummy', revokeObjectURL: () => {} };
global.window = { innerWidth: 1024, innerHeight: 768, URL: global.URL, addEventListener: () => {}, removeEventListener: () => {} };
global.document = {
  createElement: () => ({ getContext: () => null, addEventListener: () => {}, removeEventListener: () => {} }),
  createElementNS: () => ({ addEventListener: () => {}, removeEventListener: () => {} })
};

const filePath = 'c:/Users/Aditya/Desktop/portfolio/app/public/animations/Walking.fbx';
const buf = fs.readFileSync(filePath);
const ab = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);

const loader = new FBXLoader();
const fbx = loader.parse(ab, '');

const box = new THREE.Box3().setFromObject(fbx);
const rawHeight = box.max.y - box.min.y;
console.log('Raw height:', rawHeight);

const clip = fbx.animations[0];
console.log('Clip name:', clip.name, 'Duration:', clip.duration);

let hipsTrack = null;
let footLTrack = null;
let footRTrack = null;

clip.tracks.forEach(t => {
  if (t.name.toLowerCase().endsWith('hips.position')) hipsTrack = t;
  if (t.name.toLowerCase().includes('leftfoot.position') || t.name.toLowerCase().includes('leftfoot.quaternion')) {
    // console.log('Foot track:', t.name);
  }
});

if (hipsTrack) {
  const vals = hipsTrack.values;
  const numKeys = vals.length / 3;
  const startX = vals[0], startY = vals[1], startZ = vals[2];
  const endX = vals[vals.length - 3], endY = vals[vals.length - 2], endZ = vals[vals.length - 1];
  console.log(`Hips start: (${startX}, ${startY}, ${startZ}), end: (${endX}, ${endY}, ${endZ})`);
  const dz = Math.abs(endZ - startZ);
  const dx = Math.abs(endX - startX);
  const dist = Math.hypot(dx, dz);
  console.log('Raw root motion travel distance (cm):', dist, 'dz:', dz, 'dx:', dx);

  const scaleTo175 = 1.75 / (rawHeight || 179.27);
  const worldStride = dist * scaleTo175;
  const naturalSpeed = worldStride / clip.duration;
  console.log('Scaled to 1.75m person:');
  console.log('Scale factor:', scaleTo175);
  console.log('World stride (m):', worldStride);
  console.log('Clip natural speed (m/s):', naturalSpeed);
}
