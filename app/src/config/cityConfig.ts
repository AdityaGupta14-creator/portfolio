/**
 * City Asset Configuration for Step 4 Sketchfab City Integration.
 * Global scale and positioning constants are centralized here.
 */

export const CITY_CONFIG = {
  // Scaling factor: Raw model height ~95.73 units -> 23.9m (~7 storeys @ 3.42m/storey, door ~2.1m)
  SCALE: 0.25,

  // Raw base offset from GLTF measurement: raw base sits at Y = -6.81494
  BASE_Y_OFFSET: 6.81494,

  // Street alignment
  NORTH_ROW_Z: -19.2,   // Main interactive portfolio side (faces camera)
  SOUTH_ROW_Z: 19.2,    // Opposite side of the street (facing north side)
  STREET_WIDTH: 38.4,   // Distance between facing facades

  // Material tuning for polished, stylized look (ACESFilmic + roughness 0.8)
  ROUGHNESS: 0.8,
  METALNESS: 0.04,

  // Building facade spacing
  BLOCK_WIDTH: 26.0,    // Matches the camera keyframe spacing (-52, -26, 0, 26, 52)
};
