/**
 * Asset path configurations
 */

import { AssetPaths } from '../types/index';

export const ASSET_PATHS: AssetPaths = {
  playerSpriteSheet: '/src/gameAssets/sprites/walk.png',
  homeBackground: '/src/gameAssets/maps/home.png',
  barrenBackground: '/src/gameAssets/maps/home_barren.png',
  seedSprite: '/src/gameAssets/cursedLand/objectsSeparately/rock1Shadow11.png',
  plantSprites: {
    eye: '/src/gameAssets/cursedLand/objectsSeparately/eyePlantShadow11.png',
    tentacle: '/src/gameAssets/cursedLand/objectsSeparately/tentaclePlantShadow11.png',
    jaws: '/src/gameAssets/cursedLand/objectsSeparately/jawsPlantShadow11.png',
    spike: '/src/gameAssets/cursedLand/objectsSeparately/spikePlantShadow11.png',
  },
};