const fs = require('fs');
const path = require('path');
const THREE = require(path.resolve(__dirname, '../../app/node_modules/three'));

const glbBuffer = fs.readFileSync('app/public/models/cars.web.glb');
const jsonLength = glbBuffer.readUInt32LE(12);
const gltf = JSON.parse(glbBuffer.subarray(20, 20 + jsonLength).toString('utf8'));

// Check Coupe Body (node 15) and its wheels
// Let's inspect the 4 wheels of Coupe in world space and relative to Coupe Body node
const coupeNode = gltf.nodes[15];
console.log('Coupe node translation:', coupeNode.translation);
console.log('Coupe node rotation:', coupeNode.rotation);

// In the gltf scene, each node's world transform:
// Coupe Body world pos = [-6854, 0, 2225]
// Wheels 19, 21, 23, 25 world pos:
[19, 21, 23, 25].forEach(i => {
  const w = gltf.nodes[i];
  console.log(`Wheel ${i} (${w.name}): [${w.translation.map(v => v.toFixed(0)).join(', ')}]`);
});
