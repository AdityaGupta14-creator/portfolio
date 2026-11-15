const fs = require('fs');
const path = require('path');
const THREE = require(path.resolve(__dirname, '../../app/node_modules/three'));

const glbBuffer = fs.readFileSync('app/public/models/cars.web.glb');
const jsonLength = glbBuffer.readUInt32LE(12);
const gltf = JSON.parse(glbBuffer.subarray(20, 20 + jsonLength).toString('utf8'));

// 1. Identify all 10 car body nodes
const CAR_DEFS = [
  { type: 'compact', nodeName: 'Compact Body' },
  { type: 'coupe', nodeName: 'Coupe Body' },
  { type: 'hatchback', nodeName: 'Hatchback Body' },
  { type: 'minivan', nodeName: 'minivan body' },
  { type: 'offroad', nodeName: 'Offroad Body' },
  { type: 'pickup', nodeName: 'Pickup Body' },
  { type: 'sedan', nodeName: 'Sedan Body' },
  { type: 'sport', nodeName: 'Sport body' },
  { type: 'suv', nodeName: 'SUV Body' },
  { type: 'wagon', nodeName: 'Wagon Body' },
];

// Let's find all wheel nodes (40 total)
const wheelNodes = [];
gltf.nodes.forEach((n, i) => {
  if (n.name && n.name.startsWith('Wheel_') && !n.name.includes('_Wheel_') && !n.name.includes('_Wheek_') && !n.name.includes('_Body_')) {
    wheelNodes.push({ index: i, name: n.name, translation: n.translation || [0,0,0], rotation: n.rotation || [0,0,0,1], children: n.children });
  }
});

console.log(`Found ${wheelNodes.length} wheel nodes.`);

CAR_DEFS.forEach(def => {
  const bodyNode = gltf.nodes.find(n => n.name === def.nodeName);
  const bPos = new THREE.Vector3(...bodyNode.translation);
  const bQuat = new THREE.Quaternion(...bodyNode.rotation);
  
  // Find 4 nearest wheels
  const wheelsWithDist = wheelNodes.map(w => {
    const wPos = new THREE.Vector3(...w.translation);
    return { w, dist: bPos.distanceTo(wPos) };
  });
  wheelsWithDist.sort((a, b) => a.dist - b.dist);
  const top4 = wheelsWithDist.slice(0, 4);

  console.log(`\nCar "${def.type}" (${def.nodeName}):`);
  console.log(`  Body Pos: [${bPos.toArray().map(v => v.toFixed(0)).join(', ')}]`);
  top4.forEach(({ w, dist }) => {
    console.log(`    Wheel [${w.index}] "${w.name}": dist=${dist.toFixed(0)}mm, pos=[${w.translation.map(v => v.toFixed(0)).join(', ')}]`);
  });
});
