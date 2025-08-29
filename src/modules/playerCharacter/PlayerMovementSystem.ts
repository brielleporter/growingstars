/**
 * Player character movement and animation system
 */

import { PlayerCharacter, PlayerMovementInput } from '../../types/playerCharacter.types';
import { SPRITE_DIRECTIONS, PLAYER_CONFIG, RENDER_CONFIG, SPRITE_SHEET_CONFIG } from '../../configuration/gameConstants';
import { KeyboardInputManager } from '../inputHandling/KeyboardInputManager';

export class PlayerMovementSystem {
  private playerCharacter: PlayerCharacter;
  private inputManager: KeyboardInputManager;
  private spriteFrameWidth = 0;
  private spriteFrameHeight = 0;
  private canvasRef: HTMLCanvasElement | null = null;
  private collisionRects: Array<{ x: number; y: number; w: number; h: number }> = [];
  private worldBounds: { width: number; height: number } | null = null;

  constructor(inputManager: KeyboardInputManager) {
    this.inputManager = inputManager;
    this.playerCharacter = {
      xPosition: 400, // Default center position
      yPosition: 300, // Default center position,
      currentRow: SPRITE_DIRECTIONS.down,
      currentFrame: 0,
      animationTimer: 0,
      isMoving: false,
    };
  }

  public setCanvasReference(canvas: HTMLCanvasElement): void {
    this.canvasRef = canvas;
    // Center player when canvas is set
    this.playerCharacter.xPosition = canvas.width / 2;
    this.playerCharacter.yPosition = canvas.height / 2;
  }

  public initializeSpriteDimensions(spriteWidth: number, spriteHeight: number): void {
    this.spriteFrameWidth = Math.floor(spriteWidth / SPRITE_SHEET_CONFIG.columns);
    this.spriteFrameHeight = Math.floor(spriteHeight / SPRITE_SHEET_CONFIG.rows);
  }

  public getPlayerCharacter(): PlayerCharacter {
    return this.playerCharacter;
  }

  /** Replace the current list of world collision rectangles (screen-space). */
  public setCollisionRects(rects: Array<{ x: number; y: number; w: number; h: number }>): void {
    this.collisionRects = rects || [];
  }

  public setWorldBounds(bounds: { width: number; height: number } | null): void {
    this.worldBounds = bounds;
  }

  public setWorldSize(width: number, height: number): void {
    this.worldBounds = { width, height };
  }

  // Collision debug accessor removed per request

  public updatePlayerMovement(deltaTimeSeconds: number): void {
    const movementInput = this.calculateMovementInput();
    this.applyMovement(movementInput, deltaTimeSeconds);
    this.updateAnimation(movementInput, deltaTimeSeconds);
    this.constrainToCanvas();
    this.handleDirectionOverrides();
  }

  private calculateMovementInput(): PlayerMovementInput {
    let horizontalMovement = 0;
    let verticalMovement = 0;

    if (this.inputManager.isKeyPressed('w')) {
      verticalMovement -= 1;
    }
    if (this.inputManager.isKeyPressed('s')) {
      verticalMovement += 1;
    }
    if (this.inputManager.isKeyPressed('a')) {
      horizontalMovement -= 1;
    }
    if (this.inputManager.isKeyPressed('d')) {
      horizontalMovement += 1;
    }

    const isMoving = horizontalMovement !== 0 || verticalMovement !== 0;

    // Normalize diagonal movement
    if (isMoving && horizontalMovement && verticalMovement) {
      const diagonalNormalization = 1 / Math.sqrt(2);
      horizontalMovement *= diagonalNormalization;
      verticalMovement *= diagonalNormalization;
    }

    return { horizontalMovement, verticalMovement, isMoving };
  }

  private applyMovement(movementInput: PlayerMovementInput, deltaTimeSeconds: number): void {
    this.playerCharacter.isMoving = movementInput.isMoving;

    // Update player direction based on movement
    if (Math.abs(movementInput.horizontalMovement) > Math.abs(movementInput.verticalMovement)) {
      this.playerCharacter.currentRow = movementInput.horizontalMovement > 0 
        ? SPRITE_DIRECTIONS.right 
        : SPRITE_DIRECTIONS.left;
    } else if (Math.abs(movementInput.verticalMovement) > 0) {
      this.playerCharacter.currentRow = movementInput.verticalMovement > 0 
        ? SPRITE_DIRECTIONS.down 
        : SPRITE_DIRECTIONS.up;
    }

    // Apply movement
    const dx = movementInput.horizontalMovement * PLAYER_CONFIG.movementSpeed * deltaTimeSeconds;
    const dy = movementInput.verticalMovement * PLAYER_CONFIG.movementSpeed * deltaTimeSeconds;

    this.playerCharacter.xPosition += dx;
    this.playerCharacter.yPosition += dy;

    // Resolve collisions against world rectangles
    this.resolveCollisions(dx, dy);
  }

  private updateAnimation(movementInput: PlayerMovementInput, deltaTimeSeconds: number): void {
    const secondsPerFrame = 1 / RENDER_CONFIG.framesPerSecond;
    
    if (movementInput.isMoving) {
      this.playerCharacter.animationTimer += deltaTimeSeconds;
      while (this.playerCharacter.animationTimer >= secondsPerFrame) {
        this.playerCharacter.currentFrame = (this.playerCharacter.currentFrame + 1) % SPRITE_SHEET_CONFIG.columns;
        this.playerCharacter.animationTimer -= secondsPerFrame;
      }
    } else {
      this.playerCharacter.currentFrame = 0; // Idle frame
      this.playerCharacter.animationTimer = 0;
    }
  }

  private constrainToCanvas(): void {
    if (this.spriteFrameWidth === 0 || this.spriteFrameHeight === 0 || !this.canvasRef) return;

    const displayWidth = this.spriteFrameWidth * RENDER_CONFIG.playerScale;
    const displayHeight = this.spriteFrameHeight * RENDER_CONFIG.playerScale;
    const halfWidth = displayWidth / 2;
    const halfHeight = displayHeight / 2;

    // Effective bounds: use world size if available; ignore canvas when using camera/world coords
    const worldW = this.worldBounds?.width ?? this.canvasRef.width;
    const worldH = this.worldBounds?.height ?? this.canvasRef.height;
    const maxX = worldW - halfWidth;
    const maxY = worldH - halfHeight;
    const minX = halfWidth;
    const minY = halfHeight;

    this.playerCharacter.xPosition = Math.max(minX, Math.min(maxX, this.playerCharacter.xPosition));
    this.playerCharacter.yPosition = Math.max(minY, Math.min(maxY, this.playerCharacter.yPosition));
  }

  private resolveCollisions(dx: number, dy: number): void {
    if (this.spriteFrameWidth === 0 || this.spriteFrameHeight === 0) return;

    const displayWidth = this.spriteFrameWidth * RENDER_CONFIG.playerScale;
    const displayHeight = this.spriteFrameHeight * RENDER_CONFIG.playerScale;
    const halfH = displayHeight / 2;

    // Feet collision box (narrow slice at bottom of sprite)
    const feetWidth = Math.max(6, Math.min(displayWidth, displayWidth * PLAYER_CONFIG.feetCollisionBox.widthRatio));
    const feetHeight = PLAYER_CONFIG.feetCollisionBox.heightPixels; // already display-space
    let px = this.playerCharacter.xPosition - feetWidth / 2;
    // bottom of sprite
    const bottomY = this.playerCharacter.yPosition + halfH;
    let py = bottomY - feetHeight;
    const pw = feetWidth;
    const ph = feetHeight;

    for (const r of this.collisionRects) {
      if (px < r.x + r.w && px + pw > r.x && py < r.y + r.h && py + ph > r.y) {
        // Compute overlap on each axis
        const overlapX1 = (r.x + r.w) - px;      // push right
        const overlapX2 = (px + pw) - r.x;       // push left
        const overlapY1 = (r.y + r.h) - py;      // push down
        const overlapY2 = (py + ph) - r.y;       // push up

        // Choose smallest penetration vector, favoring separating along movement axis
        const penLeft = overlapX2;
        const penRight = overlapX1;
        const penUp = overlapY2;
        const penDown = overlapY1;

        // Decide axis: prefer the axis of greater movement magnitude
        const preferX = Math.abs(dx) >= Math.abs(dy);

        if (preferX) {
          if (dx > 0) {
            // moving right, push left
            this.playerCharacter.xPosition -= penLeft;
          } else if (dx < 0) {
            // moving left, push right
            this.playerCharacter.xPosition += penRight;
          } else {
            // no x movement: pick smallest
            if (penLeft < penRight) this.playerCharacter.xPosition -= penLeft; else this.playerCharacter.xPosition += penRight;
          }
        } else {
          if (dy > 0) {
            // moving down, push up
            this.playerCharacter.yPosition -= penUp;
          } else if (dy < 0) {
            // moving up, push down
            this.playerCharacter.yPosition += penDown;
          } else {
            // no y movement: pick smallest
            if (penUp < penDown) this.playerCharacter.yPosition -= penUp; else this.playerCharacter.yPosition += penDown;
          }
        }

        // Recompute feet AABB after adjustment
        px = this.playerCharacter.xPosition - pw / 2;
        const newBottomY = this.playerCharacter.yPosition + halfH;
        py = newBottomY - ph;
      }
    }
  }

  private handleDirectionOverrides(): void {
    // Force direction for testing
    if (this.inputManager.isKeyPressed('1')) this.playerCharacter.currentRow = SPRITE_DIRECTIONS.up;
    if (this.inputManager.isKeyPressed('2')) this.playerCharacter.currentRow = SPRITE_DIRECTIONS.left;
    if (this.inputManager.isKeyPressed('3')) this.playerCharacter.currentRow = SPRITE_DIRECTIONS.down;
    if (this.inputManager.isKeyPressed('4')) this.playerCharacter.currentRow = SPRITE_DIRECTIONS.right;
  }
}
