/**
 * Asset path configurations
 */

import { AssetPaths } from '../types/gameAssets.types';

export const ASSET_PATHS: AssetPaths = {
  playerSpriteSheet: '/src/assets/sprites/lwalk.png',
  homeBackground: '/src/assets/maps/lhome.png',
  barrenBackground: '', // Use procedural barren background instead
  dirtTile: '/src/assets/terrain/dirt_48.svg',
  seedSprite: '/src/assets/cursedLand/objectsSeparately/rock1Shadow11.png',
  plantSprites: {
    eye: '/src/assets/cursedLand/objectsSeparately/eyePlantShadow11.png',
    tentacle: '/src/assets/cursedLand/objectsSeparately/tentaclePlantShadow11.png',
    jaws: '/src/assets/cursedLand/objectsSeparately/jawsPlantShadow11.png',
    spike: '/src/assets/cursedLand/objectsSeparately/spikePlantShadow11.png',
  },
};
