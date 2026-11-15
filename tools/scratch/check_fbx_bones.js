const THREE = require('c:/Users/Aditya/Desktop/portfolio/app/node_modules/three');

// Let's inspect Walking.fbx bones via a quick regex
const fs = require('fs');
const content = fs.readFileSync('c:/Users/Aditya/Desktop/portfolio/app/public/animations/Walking.fbx', 'latin1');
const re = /Model::(mixamorig[A-Za-z0-9_:]+)/g;
const bones = new Set();
let match;
while ((match = re.exec(content)) !== null) {
  bones.add(match[1]);
}
console.log('All bones in Walking.fbx (count =', bones.size, '):');
console.log(Array.from(bones));
