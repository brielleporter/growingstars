/**
 * Type definitions for game assets and resources
 */

import { PlantType } from './plantSystem.types';

export interface GameAssets {
  /** Player character sprite sheet */
  playerSprite: HTMLImageElement;
  /** Home background image */
  homeBackground: HTMLImageElement;
  /** Barren/alien background image */
  barrenBackground: HTMLImageElement;
  /** Seed sprite for unmatured plants */
  seedSprite: HTMLImageElement;
  /** Collection of mature plant sprites by type */
  plantSprites: Record<PlantType, HTMLImageElement>;
}

export interface AssetPaths {
  /** Path to player sprite sheet */
  playerSpriteSheet: string;
  /** Path to home background */
  homeBackground: string;
  /** Path to barren background */
  barrenBackground: string;
  /** Path to seed sprite */
  seedSprite: string;
  /** Paths to plant sprites by type */
  plantSprites: Record<PlantType, string>;
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