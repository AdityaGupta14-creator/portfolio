const path = require('path');
const fs = require('fs');
const THREE = require(path.resolve(__dirname, '../../app/node_modules/three'));

const glbBuffer = fs.readFileSync('app/public/models/cars.web.glb');
const jsonLength = glbBuffer.readUInt32LE(12);
const gltf = JSON.parse(glbBuffer.subarray(20, 20 + jsonLength).toString('utf8'));

// Compact body node
const n = gltf.nodes[11];
console.log('Compact body node in gltf:', n);
