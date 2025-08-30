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
  /** Scale factor for player character sprites */
  playerScale: 1.5, // 2x larger than current (0.75 * 2 = 1.5)
  /** Scale factor for plant sprites */
  plantScale: 1.5, // 4x larger than current (0.375 * 4 = 1.5) 
  /** Optional tight crop for the player house base collision (source pixels, before scaling). */
  playerHouseCollisionSize: {
    width: 222,
    height: 100,
  },
  /** Animation frames per second */
  framesPerSecond: 10,
} as const;

// Harvest/slash effect spritesheet configuration
export const HARVEST_EFFECT_CONFIG = {
  /** Columns in the slash sprite sheet (per row) */
  columns: 6,
  /** Rows in the slash sprite sheet (facing: up, left, down, right) */
  rows: 4,
  /** Playback fps for slash animation */
  framesPerSecond: 20,
  /** Scale to apply when drawing the slash */
  scale: 1.0,
} as const;

// Tile configuration
export const TILE_CONFIG = {
  /** Base square tile size in pixels */
  tileSize: 32,
} as const;

// World configuration (in tiles)
export const WORLD_CONFIG = {
  /** World width in tiles */
  widthTiles: 100,
  /** World height in tiles */
  heightTiles: 100,
} as const;

// Derived world size (in pixels)
export const WORLD_PIXEL_SIZE = {
  /** World width in pixels */
  width: TILE_CONFIG.tileSize * WORLD_CONFIG.widthTiles,
  /** World height in pixels */
  height: TILE_CONFIG.tileSize * WORLD_CONFIG.heightTiles,
} as const;

// House placement (tile grid)
export const HOUSE_CONFIG = {
  /** House base X tile index */
  tileX: 19,
  /** House base Y tile index; moved 3 tiles up from prior */
  tileY: 8,
} as const;

// Player movement configuration
export const PLAYER_CONFIG = {
  /** Movement speed in pixels per second */
  movementSpeed: 180,
  /** Feet collision box (display-space). Use a narrow box at the bottom of the sprite for accurate layering. */
  feetCollisionBox: {
    /** Width as a ratio of the displayed sprite width (0..1). */
    widthRatio: 0.4,
    /** Height of the feet box in pixels (display-space). Typically a small slice near the bottom. */
    heightPixels: 12,
  },
} as const;

// Plant system configuration
export const PLANT_CONFIG = {
  /** Base size for plant rendering calculations */
  size: 12,
  /** Time in seconds for plants to grow from seed to mature */
  growthDurationSeconds: 4,
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
