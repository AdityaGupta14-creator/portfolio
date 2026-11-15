const fs = require('fs');
const glbBuffer = fs.readFileSync('app/public/models/cars.web.glb');
const jsonLength = glbBuffer.readUInt32LE(12);
const gltf = JSON.parse(glbBuffer.subarray(20, 20 + jsonLength).toString('utf8'));

console.log('Node 0 rot:', gltf.nodes[0].rotation);
console.log('Node 1 rot:', gltf.nodes[1].rotation);
