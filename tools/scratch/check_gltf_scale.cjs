const path = require('path');
const fs = require('fs');

const glbBuffer = fs.readFileSync('app/public/models/cars.web.glb');
const jsonLength = glbBuffer.readUInt32LE(12);
const gltf = JSON.parse(glbBuffer.subarray(20, 20 + jsonLength).toString('utf8'));

gltf.nodes.forEach((n, i) => {
  if (n.scale) {
    console.log(`Node [${i}] "${n.name}" has scale:`, n.scale);
  }
});
