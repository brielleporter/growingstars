/**
 * Player character rendering system
 */

import { PlayerCharacter } from '../../types/playerCharacter.types';
import { GameAssets, SpriteConfiguration } from '../../types/gameAssets.types';
import { RENDER_CONFIG } from '../../configuration/gameConstants';

export class PlayerCharacterRenderer {
  private renderingContext: CanvasRenderingContext2D;
  private spriteConfig: SpriteConfiguration = { columns: 0, rows: 0, frameWidth: 0, frameHeight: 0 };

  constructor(renderingContext: CanvasRenderingContext2D) {
    this.renderingContext = renderingContext;
  }

  public initializeSpriteDimensions(spriteWidth: number, spriteHeight: number, columns: number, rows: number): void {
    this.spriteConfig = {
      columns,
      rows,
      frameWidth: Math.floor(spriteWidth / columns),
      frameHeight: Math.floor(spriteHeight / rows),
    };
  }

  public renderPlayerCharacter(player: PlayerCharacter, assets: GameAssets, cameraOffset?: { x: number; y: number }): void {
    if (!assets.playerSprite.complete || this.spriteConfig.frameWidth === 0) {
      return;
    }

    const sourceX = player.currentFrame * this.spriteConfig.frameWidth;
    const sourceY = player.currentRow * this.spriteConfig.frameHeight;
    const displayWidth = this.spriteConfig.frameWidth * RENDER_CONFIG.playerScale;
    const displayHeight = this.spriteConfig.frameHeight * RENDER_CONFIG.playerScale;

    const offsetX = cameraOffset?.x ?? 0;
    const offsetY = cameraOffset?.y ?? 0;

    this.renderingContext.drawImage(
      assets.playerSprite,
      sourceX, sourceY, 
      this.spriteConfig.frameWidth, 
      this.spriteConfig.frameHeight,
      Math.round(player.xPosition - displayWidth / 2 - offsetX),
      Math.round(player.yPosition - displayHeight / 2 - offsetY),
      displayWidth, 
      displayHeight
    );
  }

  public getSpriteConfiguration(): SpriteConfiguration {
    return this.spriteConfig;
  }
}
