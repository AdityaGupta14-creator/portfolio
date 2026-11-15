const fs = require('fs');
const THREE = require('c:/Users/Aditya/Desktop/portfolio/app/node_modules/three');
const SkeletonUtils = require('c:/Users/Aditya/Desktop/portfolio/app/node_modules/three/examples/jsm/utils/SkeletonUtils.js');

// Parse characters.glb to get Skin 0 bone hierarchy and create dummy skeletons
const buf = fs.readFileSync('c:/Users/Aditya/Desktop/portfolio/app/public/models/characters.glb');
const jsonLen = buf.readUInt32LE(12);
const jsonStr = buf.toString('utf8', 20, 20 + jsonLen);
const gltf = JSON.parse(jsonStr);

console.log('Testing SkeletonUtils imports:');
console.log('SkeletonUtils.retargetClip:', typeof SkeletonUtils.retargetClip);
console.log('SkeletonUtils.retarget:', typeof SkeletonUtils.retarget);
console.log('SkeletonUtils.clone:', typeof SkeletonUtils.clone);
