const fs = require('fs');
const path = require('path');
const THREE = require('c:/Users/Aditya/Desktop/portfolio/app/node_modules/three');
const { FBXLoader } = require('c:/Users/Aditya/Desktop/portfolio/app/node_modules/three/examples/jsm/loaders/FBXLoader.js');

global.URL = { createObjectURL: () => 'blob:dummy', revokeObjectURL: () => {} };
global.window = { innerWidth: 1024, innerHeight: 768, URL: global.URL, addEventListener: () => {}, removeEventListener: () => {} };
global.document = {
  createElement: () => ({ getContext: () => null, addEventListener: () => {}, removeEventListener: () => {} }),
  createElementNS: () => ({ addEventListener: () => {}, removeEventListener: () => {} })
};

const buf = fs.readFileSync('c:/Users/Aditya/Desktop/portfolio/app/public/animations/Waving.fbx');
const ab = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);

const loader = new FBXLoader();
const fbx = loader.parse(ab, '');
const clip = fbx.animations[0];
console.log('Clip duration:', clip.duration);
const armTrack = clip.tracks.find(t => t.name.includes('RightArm.quaternion'));
if (armTrack) {
  console.log('RightArm quat at start (t=0):', Array.from(armTrack.values.slice(0, 4)).map(v=>v.toFixed(3)));
  console.log('RightArm quat at end (t=duration):', Array.from(armTrack.values.slice(-4)).map(v=>v.toFixed(3)));
}
