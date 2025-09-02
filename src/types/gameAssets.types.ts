/**
 * Type definitions for game assets and resources
 */

import { PlantType } from './plantSystem.types';

export interface GameAssets {
  /** Player character sprite sheet */
  playerSprite: HTMLImageElement;
  /** Slash/harvest sprite sheet */
  harvestSlashSprite: HTMLImageElement;
  /** Watering effect sprite sheet */
  waterSprite: HTMLImageElement;
  /** Sleep collapse sprite sheet (6 frames) */
  sleepSprite: HTMLImageElement;
  /** Home background image */
  homeBackground: HTMLImageElement;
  /** Barren/alien background image (optional, may be empty path) */
  barrenBackground: HTMLImageElement;
  /** Base terrain tile (dirt) */
  dirtTile: HTMLImageElement;
  /** Seed sprite for unmatured plants */
  seedSprite: HTMLImageElement;
  /** Collection of mature plant sprites by type */
  plantSprites: Record<PlantType, HTMLImageElement>;
  /** Building sprites (e.g., player house, shops) */
  buildings: {
    playerHouseBase: HTMLImageElement;
    playerHouseRoof: HTMLImageElement;
  };
}

export interface AssetPaths {
  /** Path to player sprite sheet */
  playerSpriteSheet: string;
  /** Path to harvest slash sprite sheet */
  harvestSlashSpriteSheet: string;
  /** Path to watering effect sprite sheet */
  waterSpriteSheet: string;
  /** Path to sleep collapse sprite sheet */
  sleepSpriteSheet: string;
  /** Path to home background */
  homeBackground: string;
  /** Path to barren background (can be empty to use procedural) */
  barrenBackground: string;
  /** Path to dirt terrain tile */
  dirtTile: string;
  /** Path to seed sprite */
  seedSprite: string;
  /** Paths to plant sprites by type */
  plantSprites: Record<PlantType, string>;
  /** Paths to building sprites */
  buildings: {
    playerHouseBase: string;
    playerHouseRoof: string;
  };
}

export interface SpriteConfiguration {
  /** Number of columns in the sprite sheet */
  columns: number;
  /** Number of rows in the sprite sheet */
  rows: number;
  /** Width of each frame in pixels */
  frameWidth: number;
  /** Height of each frame in pixels */
  frameHeight: number;
}
