/**
 * Game configuration constants
 */

// Sprite sheet configuration
export const SPRITE_SHEET_CONFIG = {
  columns: 9,
  rows: 4,
} as const;

// Animation directions (row indices in sprite sheet)
export const SPRITE_DIRECTIONS = {
  up: 0,
  left: 1,
  down: 2,
  right: 3,
} as const;

// Rendering configuration
export const RENDER_CONFIG = {
  /** Scale factor for all sprites */
  scale: 3,
  /** Animation frames per second */
  framesPerSecond: 10,
} as const;

// Player movement configuration
export const PLAYER_CONFIG = {
  /** Movement speed in pixels per second */
  movementSpeed: 180,
} as const;

// Plant system configuration
export const PLANT_CONFIG = {
  /** Base size for plant rendering calculations */
  size: 12,
  /** Time in seconds for plants to grow from seed to mature */
  growthDurationSeconds: 10,
  /** Minimum distance between plants to prevent overcrowding */
  spacingThreshold: 30,
  /** Scale factor for seed sprites (smaller than mature plants) */
  seedScaleFactor: 0.5,
} as const;

// Canvas configuration
export const CANVAS_CONFIG = {
  width: 800,
  height: 560,
} as const;