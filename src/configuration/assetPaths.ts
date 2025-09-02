/**
 * Asset path configurations
 */

import { AssetPaths } from '../types/gameAssets.types';

export const ASSET_PATHS: AssetPaths = {
  playerSpriteSheet: '/src/assets/sprites/walk.png',
  harvestSlashSpriteSheet: '/src/assets/sprites/slash.png',
  waterSpriteSheet: '/src/assets/sprites/water.png',
  sleepSpriteSheet: '/src/assets/sprites/sleep.png',
  // Empty string means: use procedural barren background
  homeBackground: '',
  barrenBackground: '',
  dirtTile: '/src/assets/terrain/dirt48.svg',
  seedSprite: '/src/assets/cursedLand/objectsSeparately/rock1Shadow11.png',
  plantSprites: {
    eye: '/src/assets/cursedLand/objectsSeparately/eyePlantShadow11.png',
    tentacle: '/src/assets/cursedLand/objectsSeparately/tentacePlantShadow11.png',
    jaws: '/src/assets/cursedLand/objectsSeparately/jawPlantShadow11.png',
    spike: '/src/assets/cursedLand/objectsSeparately/spikePlantShadow11.png',
    orb: '/src/assets/plants/plant-orb.png',
    mushroom: '/src/assets/plants/plantMushroom.png',
  },
  buildings: {
    playerHouseBase: '/src/assets/buildings/playerHouseBase.png',
    playerHouseRoof: '/src/assets/buildings/playerHouseRoof.png',
  },
};
