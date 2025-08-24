/**
 * Player character rendering system
 */

import { PlayerCharacter, GameAssets, SpriteConfiguration } from '../../types/index';
import { RENDER_CONFIG } from '../../configuration/index';

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

  public renderPlayerCharacter(player: PlayerCharacter, assets: GameAssets): void {
    if (!assets.playerSprite.complete || this.spriteConfig.frameWidth === 0) {
      return;
    }

    const sourceX = player.currentFrame * this.spriteConfig.frameWidth;
    const sourceY = player.currentRow * this.spriteConfig.frameHeight;
    const displayWidth = this.spriteConfig.frameWidth * RENDER_CONFIG.scale;
    const displayHeight = this.spriteConfig.frameHeight * RENDER_CONFIG.scale;

    this.renderingContext.drawImage(
      assets.playerSprite,
      sourceX, sourceY, 
      this.spriteConfig.frameWidth, 
      this.spriteConfig.frameHeight,
      Math.round(player.xPosition - displayWidth / 2),
      Math.round(player.yPosition - displayHeight / 2),
      displayWidth, 
      displayHeight
    );
  }

  public getSpriteConfiguration(): SpriteConfiguration {
    return this.spriteConfig;
  }
}