const fs = require('fs');
const path = require('path');
const THREE = require(path.resolve(__dirname, '../../app/node_modules/three'));

const glbBuffer = fs.readFileSync('app/public/models/cars.web.glb');
const jsonLength = glbBuffer.readUInt32LE(12);
const gltf = JSON.parse(glbBuffer.subarray(20, 20 + jsonLength).toString('utf8'));

// The 10 car types and body nodes
const CAR_DEFS = [
  { type: 'compact', nodeName: 'Compact Body', angleDeg: 144 },
  { type: 'coupe', nodeName: 'Coupe Body', angleDeg: 108 },
  { type: 'hatchback', nodeName: 'Hatchback Body', angleDeg: 36 },
  { type: 'minivan', nodeName: 'minivan body', angleDeg: 72 },
  { type: 'offroad', nodeName: 'Offroad Body', angleDeg: -108 },
  { type: 'pickup', nodeName: 'Pickup Body', angleDeg: 0 },
  { type: 'sedan', nodeName: 'Sedan Body', angleDeg: 180 },
  { type: 'sport', nodeName: 'Sport body', angleDeg: -36 },
  { type: 'suv', nodeName: 'SUV Body', angleDeg: -72 },
  { type: 'wagon', nodeName: 'Wagon Body', angleDeg: -144 },
];

console.log('Inspecting raw node orientations and mesh layouts...');
CAR_DEFS.forEach(def => {
  const bNode = gltf.nodes.find(n => n.name === def.nodeName);
  const q = new THREE.Quaternion(...(bNode.rotation || [0,0,0,1]));
  const e = new THREE.Euler().setFromQuaternion(q);
  console.log(`${def.type} (${def.nodeName}): Euler deg=[${(e.x*180/Math.PI).toFixed(1)}, ${(e.y*180/Math.PI).toFixed(1)}, ${(e.z*180/Math.PI).toFixed(1)}]`);
});
