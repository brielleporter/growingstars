/**
 * Background rendering system
 */

import { GameAssets } from '../../types/gameAssets.types';
import { TILE_CONFIG } from '../../configuration/gameConstants';

export class BackgroundRenderer {
  private renderingContext: CanvasRenderingContext2D;
  private useBarrenBackground = true;
  private cachedBarrenPattern: CanvasPattern | null = null;
  private cachedDirtPattern: CanvasPattern | null = null;

  constructor(renderingContext: CanvasRenderingContext2D) {
    this.renderingContext = renderingContext;
  }

  public setUseBarrenBackground(useBarren: boolean): void {
    this.useBarrenBackground = useBarren;
  }

  public isUsingBarrenBackground(): boolean {
    return this.useBarrenBackground;
  }

  public renderBackground(assets: GameAssets, isBarrenAvailable: boolean, _cameraOffset?: { x: number; y: number }): void {
    // 1) Prefer dirt tile as base terrain
    if (assets.dirtTile.complete && assets.dirtTile.naturalWidth > 0) {
      this.renderDirtTileBackground(assets.dirtTile);
      return;
    }

    // 2) Fallback to legacy backgrounds
    const backgroundImage = (this.useBarrenBackground && isBarrenAvailable)
      ? assets.barrenBackground
      : assets.homeBackground;

    if (backgroundImage.complete && backgroundImage.naturalWidth > 0) {
      this.renderBackgroundImage(backgroundImage);
    } else {
      // 3) Final fallback to procedural background
      this.renderProceduralBarrenBackground();
    }
  }

  private renderBackgroundImage(backgroundImage: HTMLImageElement): void {
    const canvas = this.renderingContext.canvas;
    this.renderingContext.drawImage(
      backgroundImage,
      0, 0,
      canvas.width,
      canvas.height
    );
  }

  private renderProceduralBarrenBackground(): void {
    const barrenPattern = this.generateBarrenPattern();
    if (barrenPattern) {
      const canvas = this.renderingContext.canvas;
      this.renderingContext.save();
      this.renderingContext.fillStyle = barrenPattern;
      this.renderingContext.fillRect(0, 0, canvas.width, canvas.height);
      this.renderingContext.restore();
    }
  }

  private renderDirtTileBackground(dirtTile: HTMLImageElement): void {
    const pattern = this.generateDirtPattern(dirtTile);
    if (pattern) {
      const canvas = this.renderingContext.canvas;
      this.renderingContext.save();
      this.renderingContext.fillStyle = pattern;
      this.renderingContext.fillRect(0, 0, canvas.width, canvas.height);
      this.renderingContext.restore();
    }
  }


  private generateDirtPattern(dirtTile: HTMLImageElement): CanvasPattern | null {
    if (this.cachedDirtPattern) return this.cachedDirtPattern;
    this.cachedDirtPattern = this.renderingContext.createPattern(dirtTile, 'repeat');
    return this.cachedDirtPattern;
  }

  private generateBarrenPattern(): CanvasPattern | null {
    if (this.cachedBarrenPattern) return this.cachedBarrenPattern;

    const patternCanvas = document.createElement('canvas');
    const tile = TILE_CONFIG.tileSize;
    patternCanvas.width = tile;
    patternCanvas.height = tile;
    const patternContext = patternCanvas.getContext('2d');

    if (!patternContext) return null;

    patternContext.imageSmoothingEnabled = false;

    // Create alien soil pattern
    patternContext.fillStyle = '#1a2324';
    patternContext.fillRect(0, 0, tile, tile);

    patternContext.fillStyle = '#202c2e';
    const half = Math.floor(tile / 2);
    patternContext.fillRect(0, 0, half, half);
    patternContext.fillRect(half, half, half, half);

    patternContext.fillStyle = '#233335';
    for (let speckleIndex = 0; speckleIndex < 24; speckleIndex++) {
      const speckleX = Math.floor(Math.random() * tile);
      const speckleY = Math.floor(Math.random() * tile);
      patternContext.fillRect(speckleX, speckleY, 1, 1);
    }

    this.cachedBarrenPattern = this.renderingContext.createPattern(patternCanvas, 'repeat');
    return this.cachedBarrenPattern;
  }
}
