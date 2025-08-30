/**
 * Type definitions for the plant growing system
 */

export type PlantType = 'eye' | 'tentacle' | 'jaws' | 'spike' | 'orb' | 'mushroom';

export interface PlantEntity {
  /** X position where the plant was planted */
  xPosition: number;
  /** Y position where the plant was planted */
  yPosition: number;
  /** Timestamp when the plant was planted */
  plantingTime: number;
  /** Whether the plant has been watered to begin growth */
  watered: boolean;
  /** Timestamp when watering started (growth timer starts from this) */
  wateringStartTime?: number | null;
  /** Whether the plant has finished growing */
  hasGrown: boolean;
  /** The type of plant that will grow */
  plantType: PlantType;
}

export interface PlantGrowthConfiguration {
  /** Time in seconds for a plant to grow from seed to mature */
  growthDurationSeconds: number;
  /** Minimum distance between plants to prevent overcrowding */
  plantSpacingThreshold: number;
  /** Base size for plant rendering calculations */
  plantSize: number;
}
