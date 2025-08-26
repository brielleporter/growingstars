/**
 * Building rendering system
 */

import { GameAssets } from '../../types/gameAssets.types';

export class BuildingRenderer {
  private renderingContext: CanvasRenderingContext2D;

  constructor(renderingContext: CanvasRenderingContext2D) {
    this.renderingContext = renderingContext;
  }

  /**
   * Draw static buildings. For now, render the player house at canvas center.
   * Future: accept world positions, base/roof split, and y-sort overlays.
   */
  public renderBuildingBases(assets: GameAssets): void {
    const base = assets.buildings?.playerHouseBase;
    this.drawHouseSprite(base);
  }

  public renderBuildingRoofs(assets: GameAssets): void {
    const roof = assets.buildings?.playerHouseRoof;
    this.drawHouseSprite(roof);
  }

  private drawHouseSprite(sprite?: HTMLImageElement): void {
    if (!sprite || !sprite.complete || sprite.naturalWidth === 0) return;

    const canvas = this.renderingContext.canvas;
    const dw = sprite.naturalWidth;
    const dh = sprite.naturalHeight;
    const centerX = Math.floor(canvas.width / 2);
    const centerY = Math.floor(canvas.height / 2);
    const dx = centerX - Math.floor(dw / 2);
    const dy = centerY - dh;
    this.renderingContext.drawImage(sprite, dx, dy, dw, dh);
  }
}
