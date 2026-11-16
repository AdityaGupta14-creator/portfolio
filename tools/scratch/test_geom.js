const path = require('path');
const THREE = require(path.join(__dirname, '../../app/node_modules/three'));

function createRoundedRectPath(width, height, radius) {
  const shape = new THREE.Shape();
  const x = -width / 2;
  const y = -height / 2;
  const w = width;
  const h = height;
  const r = Math.min(radius, Math.min(w / 2, h / 2));

  shape.moveTo(x + r, y);
  shape.lineTo(x + w - r, y);
  shape.quadraticCurveTo(x + w, y, x + w, y + r);
  shape.lineTo(x + w, y + h - r);
  shape.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  shape.lineTo(x + r, y + h);
  shape.quadraticCurveTo(x, y + h, x, y + h - r);
  shape.lineTo(x, y + r);
  shape.quadraticCurveTo(x, y, x + r, y);

  return shape;
}

const rectRimWidth = 0.054;
const rectRimHeight = 0.042;
const rectRimThickness = 0.0035;
const rectOuterR = 0.009;

const rectOuterShape = createRoundedRectPath(rectRimWidth, rectRimHeight, rectOuterR);
const rectInnerShape = createRoundedRectPath(
  rectRimWidth - 2 * rectRimThickness,
  rectRimHeight - 2 * rectRimThickness,
  Math.max(0.001, rectOuterR - rectRimThickness)
);
const reversed = rectInnerShape.getPoints().reverse();
console.log('Reversed length:', reversed.length);
console.log('First point:', reversed[0]);
console.log('Last point:', reversed[reversed.length - 1]);
console.log('Is reversed clockwise?', THREE.ShapeUtils.isClockWise(reversed));

const holePath = new THREE.Path(reversed);
console.log('holePath.getPoints().length:', holePath.getPoints().length);
console.log('holePath.getPoints() isClockWise:', THREE.ShapeUtils.isClockWise(holePath.getPoints()));
