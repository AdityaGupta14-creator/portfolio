export type GlassesStyle = 'sunglasses' | 'clear' | 'round';

export interface GlassesConfig {
  position: [number, number, number]; // [X, Y, Z] in meters relative to mixamorigHead
  rotationX: number;                  // Pitch tilt in degrees
  scale: number;                      // Uniform size multiplier (1.0 = ~0.14m total width)
  style: GlassesStyle;
}

/**
 * Tuned constants for Host Character and Cloned Pedestrians.
 * Coordinates are in meters relative to the mixamorigHead bone anchor:
 * - X: 0.0 (centered on nose bridge)
 * - Y: eye level (60% of head height from chin)
 * - Z: flush in front of the face/bridge (+0.005m clearance)
 */
export const DEFAULT_GLASSES_CONFIG: GlassesConfig = {
  position: [0.0, 0.097, 0.135],
  rotationX: 2.0,
  scale: 1.0,
  style: 'sunglasses',
};
