const fs = require('fs');
const path = require('path');
const THREE = require(path.resolve(__dirname, '../../app/node_modules/three'));

const glbBuffer = fs.readFileSync('app/public/models/cars.web.glb');
const jsonLength = glbBuffer.readUInt32LE(12);
const gltf = JSON.parse(glbBuffer.subarray(20, 20 + jsonLength).toString('utf8'));

// Let's inspect the buffer data directly to compute vertex positions if needed,
// or inspect node transforms and geometry bounds.
console.log('Testing Three.js scene graph building for cars...');

const CAR_TYPES = [
  'compact', 'coupe', 'hatchback', 'minivan', 'offroad',
  'pickup', 'sedan', 'sport', 'suv', 'wagon'
];

const CAR_NODE_NAMES = {
  compact: 'Compact Body',
  coupe: 'Coupe Body',
  hatchback: 'Hatchback Body',
  minivan: 'minivan body',
  offroad: 'Offroad Body',
  pickup: 'Pickup Body',
  sedan: 'Sedan Body',
  sport: 'Sport body',
  suv: 'SUV Body',
  wagon: 'Wagon Body'
};

console.log('Definitions mapped:', Object.keys(CAR_NODE_NAMES).length);
