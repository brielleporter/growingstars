/**
 * Type definitions for the player character system
 */

export interface PlayerCharacter {
  /** X position on the game canvas */
  xPosition: number;
  /** Y position on the game canvas */
  yPosition: number;
  /** Current sprite row (direction) */
  currentRow: number;
  /** Current animation frame */
  currentFrame: number;
  /** Animation timer for frame transitions */
  animationTimer: number;
  /** Whether the player is currently moving */
  isMoving: boolean;
}

export type PlayerDirection = 'up' | 'down' | 'left' | 'right';

export interface PlayerMovementInput {
  horizontalMovement: number;
  verticalMovement: number;
  isMoving: boolean;
}