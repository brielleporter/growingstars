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
    this.playerCharacter.xPosition += movementInput.horizontalMovement * PLAYER_CONFIG.movementSpeed * deltaTimeSeconds;
    this.playerCharacter.yPosition += movementInput.verticalMovement * PLAYER_CONFIG.movementSpeed * deltaTimeSeconds;
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

    this.playerCharacter.xPosition = Math.max(
      halfWidth, 
      Math.min(this.canvasRef.width - halfWidth, this.playerCharacter.xPosition)
    );
    this.playerCharacter.yPosition = Math.max(
      halfHeight, 
      Math.min(this.canvasRef.height - halfHeight, this.playerCharacter.yPosition)
    );
  }

  private handleDirectionOverrides(): void {
    // Force direction for testing
    if (this.inputManager.isKeyPressed('1')) this.playerCharacter.currentRow = SPRITE_DIRECTIONS.up;
    if (this.inputManager.isKeyPressed('2')) this.playerCharacter.currentRow = SPRITE_DIRECTIONS.left;
    if (this.inputManager.isKeyPressed('3')) this.playerCharacter.currentRow = SPRITE_DIRECTIONS.down;
    if (this.inputManager.isKeyPressed('4')) this.playerCharacter.currentRow = SPRITE_DIRECTIONS.right;
  }
}