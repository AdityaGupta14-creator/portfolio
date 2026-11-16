const fs = require('fs');
const path = require('path');
const THREE = require('three');
require('three/examples/jsm/loaders/FBXLoader.js');

// Since FBXLoader in node requires DOM/canvas polyfill or we can inspect via browser CDP
console.log('Inspecting via browser CDP...');
