const fs = require('fs');
const path = require('path');
const THREE = require(path.resolve(__dirname, '../../app/node_modules/three'));

const glbBuffer = fs.readFileSync('app/public/models/cars.web.glb');
const jsonLength = glbBuffer.readUInt32LE(12);
const gltf = JSON.parse(glbBuffer.subarray(20, 20 + jsonLength).toString('utf8'));

// Check world transform of all 10 car bodies and all 40 wheels in raw GLTF coordinates
console.log('--- ALL BODIES ---');
const bodies = [
  'Compact Body', 'Coupe Body', 'Hatchback Body', 'minivan body', 'Offroad Body',
  'Pickup Body', 'Sedan Body', 'Sport body', 'SUV Body', 'Wagon Body'
];

bodies.forEach(name => {
  const node = gltf.nodes.find(n => n.name === name);
  const q = new THREE.Quaternion(...(node.rotation || [0,0,0,1]));
  const e = new THREE.Euler().setFromQuaternion(q);
  console.log(`${name}: pos=[${node.translation.map(v => v.toFixed(0))}], rot Euler deg=[${(e.x*180/Math.PI).toFixed(1)}, ${(e.y*180/Math.PI).toFixed(1)}, ${(e.z*180/Math.PI).toFixed(1)}]`);
});

console.log('\n--- WHEELS 19, 21, 23, 25 (Wheel_F for Coupe) ---');
[19, 21, 23, 25].forEach(i => {
  const w = gltf.nodes[i];
  const q = new THREE.Quaternion(...(w.rotation || [0,0,0,1]));
  const e = new THREE.Euler().setFromQuaternion(q);
  console.log(`${w.name} (${i}): pos=[${w.translation.map(v => v.toFixed(0))}], rot Euler deg=[${(e.x*180/Math.PI).toFixed(1)}, ${(e.y*180/Math.PI).toFixed(1)}, ${(e.z*180/Math.PI).toFixed(1)}]`);
});
