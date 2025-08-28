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
  public renderBuildingBases(assets: GameAssets, cameraOffset?: { x: number; y: number }, houseWorld?: { x: number; y: number }): void {
    const base = assets.buildings?.playerHouseBase;
    this.drawHouseSprite(base, cameraOffset, houseWorld);
  }

  public renderBuildingRoofs(assets: GameAssets, cameraOffset?: { x: number; y: number }, houseWorld?: { x: number; y: number }): void {
    const roof = assets.buildings?.playerHouseRoof;
    this.drawHouseSprite(roof, cameraOffset, houseWorld);
  }

  private drawHouseSprite(sprite?: HTMLImageElement, cameraOffset?: { x: number; y: number }, houseWorld?: { x: number; y: number }): void {
    if (!sprite || !sprite.complete || sprite.naturalWidth === 0) return;

    const dw = sprite.naturalWidth;
    const dh = sprite.naturalHeight;
    // If a world position is provided, use it; otherwise center on canvas
    if (houseWorld) {
      const offX = cameraOffset?.x ?? 0;
      const offY = cameraOffset?.y ?? 0;
      const dx = Math.floor(houseWorld.x - dw / 2 - offX);
      const dy = Math.floor(houseWorld.y - dh - offY);
      this.renderingContext.drawImage(sprite, dx, dy, dw, dh);
    } else {
      const canvas = this.renderingContext.canvas;
      const centerX = Math.floor(canvas.width / 2);
      const centerY = Math.floor(canvas.height / 2);
      const dx = centerX - Math.floor(dw / 2);
      const dy = centerY - dh;
      this.renderingContext.drawImage(sprite, dx, dy, dw, dh);
    }
  }
}
