const fs = require('fs');
const glbBuffer = fs.readFileSync('app/public/models/cars.web.glb');
const jsonLength = glbBuffer.readUInt32LE(12);
const gltf = JSON.parse(glbBuffer.subarray(20, 20 + jsonLength).toString('utf8'));

// Wheel indices from our match
const wheelIndices = [
  9, 3, 7, 5,       // compact
  25, 21, 19, 23,   // coupe
  35, 31, 37, 33,   // hatchback
  49, 45, 47, 39,   // minivan
  51, 59, 61, 57,   // offroad
  73, 69, 71, 63,   // pickup
  85, 81, 79, 83,   // sedan
  91, 87, 89, 93,   // sport
  112, 106, 109, 99,// suv
  123, 119, 125, 121// wagon
];

wheelIndices.forEach(idx => {
  const node = gltf.nodes[idx];
  const childNames = (node.children || []).map(ci => `${gltf.nodes[ci].name} (mesh ${gltf.nodes[ci].mesh})`);
  console.log(`Wheel node [${idx}] "${node.name}": children=[${childNames.join(', ')}]`);
});
