const fs = require('fs');
const glbBuffer = fs.readFileSync('app/public/models/cars.web.glb');
const jsonLength = glbBuffer.readUInt32LE(12);
const gltf = JSON.parse(glbBuffer.subarray(20, 20 + jsonLength).toString('utf8'));

const mesh56 = gltf.meshes[56]; // Wheel_E_Wheel_0
const mesh57 = gltf.meshes[57]; // Wheel_E_Body_0

console.log('Mesh 56 (Wheel):', mesh56);
console.log('Mesh 57 (Body part):', mesh57);
const acc56 = gltf.accessors[mesh56.primitives[0].attributes.POSITION];
const acc57 = gltf.accessors[mesh57.primitives[0].attributes.POSITION];
console.log('Mesh 56 bounds:', acc56.min, acc56.max);
console.log('Mesh 57 bounds:', acc57.min, acc57.max);
