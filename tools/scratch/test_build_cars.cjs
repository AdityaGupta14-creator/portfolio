const fs = require('fs');
const path = require('path');
const THREE = require(path.resolve(__dirname, '../../app/node_modules/three'));

// Load GLB JSON
const glbBuffer = fs.readFileSync('app/public/models/cars.web.glb');
const jsonLength = glbBuffer.readUInt32LE(12);
const gltf = JSON.parse(glbBuffer.subarray(20, 20 + jsonLength).toString('utf8'));

// Build mock Three.js objects from the GLTF JSON to test our extraction math!
// In GLTF:
// Node translations and rotations are known.
// Accessor min/max give the exact geometry bounds.

console.log('Testing geometry transformations...');
