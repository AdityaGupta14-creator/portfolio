/**
 * City Asset Configuration for Step 4 Sketchfab City Integration.
 * Global scale and positioning constants are centralized here.
 */

export const CITY_CONFIG = {
  // Scaling factor: Raw model height ~95.73 units -> 23.9m (~7 storeys @ 3.42m/storey, door ~2.1m)
  SCALE: 0.25,

  // Raw base offset from GLTF measurement: raw base sits at Y = -6.81494
  BASE_Y_OFFSET: 6.81494,

  // Street alignment & ground height
  PAVEMENT_Y: 0.16,     // Bases sit at pavement level (y = 0.16)
  NORTH_ROW_Z: -13.4,   // Main interactive portfolio side (faces camera / street)
  SOUTH_ROW_Z: 13.4,    // Opposite side of the street (facing north side)
  STREET_WIDTH: 26.8,   // Distance between facing facades

  // Material tuning for polished, stylized look (ACESFilmic + roughness 0.8)
  ROUGHNESS: 0.8,
  METALNESS: 0.04,

  // Building facade spacing
  BLOCK_WIDTH: 26.0,    // Matches the camera keyframe spacing (-52, -26, 0, 26, 52)
};
