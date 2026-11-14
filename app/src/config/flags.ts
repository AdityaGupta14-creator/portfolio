/**
 * Feature flags for Phase 1 Asset Integration.
 * USE_OLD_CITY:
 *  - true: renders the original procedural BrownstoneRow and procedural actors
 *  - false: renders the new Sketchfab GLB models (city.opt.glb and characters.opt.glb)
 *
 * Supports override via URL query param: ?oldCity=1 or ?oldCity=0
 */

const getInitialOldCityFlag = (): boolean => {
  if (typeof window !== 'undefined') {
    const params = new URLSearchParams(window.location.search);
    if (params.has('oldCity')) {
      return params.get('oldCity') === '1' || params.get('oldCity') === 'true';
    }
  }
  // Default to true while building the new assets, until Step 4 activates the new city
  return true;
};

export const FLAGS = {
  USE_OLD_CITY: getInitialOldCityFlag(),
};
