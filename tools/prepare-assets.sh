#!/usr/bin/env bash
# tools/prepare-assets.sh
# Prepares and optimizes Sketchfab city.glb and characters.glb for the portfolio
set -e

echo "================================================================="
echo "        Phase 1 Asset Preparation Script                        "
echo "================================================================="

# 1. Convert city.glb from KHR_materials_pbrSpecularGlossiness to metallic-roughness
echo "[1/3] Converting city.glb to metallic-roughness workflow..."
npx @gltf-transform/cli metalrough app/public/models/city.glb app/public/models/city.mr.glb

# 2. Optimize city.glb with meshopt compression and WebP textures (max 2048)
echo "[2/3] Optimizing city.glb (meshopt + webp 2048)..."
npx @gltf-transform/cli optimize app/public/models/city.mr.glb app/public/models/city.opt.glb \
  --compress meshopt \
  --texture-compress webp \
  --texture-size 2048 \
  --flatten false \
  --join false

rm -f app/public/models/city.mr.glb

# 3. Optimize characters.glb with meshopt compression and WebP textures (max 1024)
echo "[3/3] Optimizing characters.glb (meshopt + webp 1024, preserving rigs)..."
npx @gltf-transform/cli optimize app/public/models/characters.glb app/public/models/characters.opt.glb \
  --compress meshopt \
  --texture-compress webp \
  --texture-size 1024 \
  --flatten false \
  --join false

# 4. Generate audit report
echo "Printing asset inspection report..."
node tools/report-assets.js

echo "Asset preparation complete! Output files:"
echo " - app/public/models/city.opt.glb"
echo " - app/public/models/characters.opt.glb"
