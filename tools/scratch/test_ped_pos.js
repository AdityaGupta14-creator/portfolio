function mulberry32(a) {
  return () => {
    let t = (a += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rng = mulberry32(108);
const lanes = [
  { zCenter: -11.5, zSpread: 0.45, xMin: -76, xMax: 76, faceDir: 1 },
  { zCenter: -8.2, zSpread: 0.45, xMin: -76, xMax: 76, faceDir: -1 },
  { zCenter: 7.6, zSpread: 0.45, xMin: -76, xMax: 76, faceDir: -1 },
  { zCenter: 10.6, zSpread: 0.55, xMin: -76, xMax: 76, faceDir: 1 },
];
for(let i=0; i<12; i++) {
  const lane = lanes[i % lanes.length];
  const mult = 0.85 + rng()*0.35;
  const dir = (i % 2 === 0 ? lane.faceDir : -lane.faceDir);
  const x = lane.xMin + 6 + rng() * (lane.xMax - lane.xMin - 12);
  const z = lane.zCenter + (rng() - 0.5) * 2 * lane.zSpread;
  console.log(`Ped ${i}: lane=${lane.zCenter}, x=${x.toFixed(1)}, z=${z.toFixed(1)}, dir=${dir}`);
}
