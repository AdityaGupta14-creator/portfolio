const fs = require('fs');
const glbBuffer = fs.readFileSync('app/public/models/cars.web.glb');
const jsonLength = glbBuffer.readUInt32LE(12);
const gltf = JSON.parse(glbBuffer.subarray(20, 20 + jsonLength).toString('utf8'));

// Mesh 7
const mesh7 = gltf.meshes[7];
console.log('Mesh 7 primitives:', mesh7.primitives);
const posAcc = gltf.accessors[mesh7.primitives[0].attributes.POSITION];
console.log('Coupe Body mesh 7 POSITION accessor min/max:', posAcc.min, posAcc.max);

// Also check Mesh 4 (Compact Body)
const mesh4 = gltf.meshes[4];
const posAcc4 = gltf.accessors[mesh4.primitives[0].attributes.POSITION];
console.log('Compact Body mesh 4 POSITION accessor min/max:', posAcc4.min, posAcc4.max);

// Also check Wheel meshes
const wheelMesh10 = gltf.meshes[10];
const posAccW10 = gltf.accessors[wheelMesh10.primitives[0].attributes.POSITION];
console.log('Wheel 19 (mesh 10) POSITION min/max:', posAccW10.min, posAccW10.max);
