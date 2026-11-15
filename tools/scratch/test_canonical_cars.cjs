const fs = require('fs');
const path = require('path');
const THREE = require(path.resolve(__dirname, '../../app/node_modules/three'));

const glbBuffer = fs.readFileSync('app/public/models/cars.web.glb');
const jsonLength = glbBuffer.readUInt32LE(12);
const gltf = JSON.parse(glbBuffer.subarray(20, 20 + jsonLength).toString('utf8'));

// The 10 car types and their body node names
const CARS = [
  { type: 'pickup', body: 'Pickup Body', angleDeg: 0 },
  { type: 'hatchback', body: 'Hatchback Body', angleDeg: 36 },
  { type: 'sport', body: 'Sport body', angleDeg: -36 },
  { type: 'minivan', body: 'minivan body', angleDeg: 72 },
  { type: 'suv', body: 'SUV Body', angleDeg: -72 },
  { type: 'coupe', body: 'Coupe Body', angleDeg: 108 },
  { type: 'offroad', body: 'Offroad Body', angleDeg: -108 },
  { type: 'compact', body: 'Compact Body', angleDeg: 144 },
  { type: 'wagon', body: 'Wagon Body', angleDeg: -144 },
  { type: 'sedan', body: 'Sedan Body', angleDeg: 180 },
];

// Let's test the 4 matched wheels for each car
const wheelNodes = [];
gltf.nodes.forEach((n, i) => {
  if (n.name && n.name.startsWith('Wheel_') && !n.name.includes('_Wheel_') && !n.name.includes('_Wheek_') && !n.name.includes('_Body_')) {
    wheelNodes.push({ index: i, name: n.name, translation: n.translation || [0,0,0], rotation: n.rotation || [0,0,0,1], children: n.children });
  }
});

CARS.forEach(car => {
  const bNode = gltf.nodes.find(n => n.name === car.body);
  const bPos = new THREE.Vector3(...bNode.translation);
  
  // Find 4 nearest wheels
  const wheels = wheelNodes
    .map(w => ({ w, dist: bPos.distanceTo(new THREE.Vector3(...w.translation)) }))
    .sort((a, b) => a.dist - b.dist)
    .slice(0, 4)
    .map(item => item.w);

  // Compute wheel center
  const wheelCenter = new THREE.Vector3();
  wheels.forEach(w => wheelCenter.add(new THREE.Vector3(...w.translation)));
  wheelCenter.divideScalar(4);

  console.log(`\n--- ${car.type.toUpperCase()} (${car.body}) ---`);
  console.log(`  Body pos: [${bPos.toArray().map(v => v.toFixed(0)).join(', ')}]`);
  console.log(`  Wheel center: [${wheelCenter.toArray().map(v => v.toFixed(0)).join(', ')}]`);
  console.log(`  Difference: [${bPos.clone().sub(wheelCenter).toArray().map(v => v.toFixed(0)).join(', ')}]`);
});
