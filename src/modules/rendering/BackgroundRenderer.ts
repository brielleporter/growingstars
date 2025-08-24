/**
 * Background rendering system
 */

import { GameAssets } from '../../types/gameAssets.types';
import { CANVAS_CONFIG } from '../../configuration/gameConstants';

export class BackgroundRenderer {
  private renderingContext: CanvasRenderingContext2D;
  private useBarrenBackground = true;
  private cachedBarrenPattern: CanvasPattern | null = null;
  private cachedBaseDirtPattern: CanvasPattern | null = null;

  constructor(renderingContext: CanvasRenderingContext2D) {
    this.renderingContext = renderingContext;
  }

  public setUseBarrenBackground(useBarren: boolean): void {
    this.useBarrenBackground = useBarren;
  }

  public isUsingBarrenBackground(): boolean {
    return this.useBarrenBackground;
  }

  public renderBackground(assets: GameAssets, isBarrenAvailable: boolean): void {
    // 1) Prefer base dirt tile if available
    if (assets.baseDirtTile.complete && assets.baseDirtTile.naturalWidth > 0) {
      this.renderBaseDirtBackground(assets.baseDirtTile);
      return;
    }

    // 2) Legacy images (barren/home)
    const backgroundImage = (this.useBarrenBackground && isBarrenAvailable)
      ? assets.barrenBackground
      : assets.homeBackground;

    if (backgroundImage.complete && backgroundImage.naturalWidth > 0) {
      this.renderBackgroundImage(backgroundImage);
    } else {
      // 3) Procedural fallback
      this.renderProceduralBarrenBackground();
    }
  }

  private renderBackgroundImage(backgroundImage: HTMLImageElement): void {
    this.renderingContext.drawImage(
      backgroundImage,
      0, 0,
      CANVAS_CONFIG.width,
      CANVAS_CONFIG.height
    );
  }

  private renderProceduralBarrenBackground(): void {
    const barrenPattern = this.generateBarrenPattern();
    if (barrenPattern) {
      this.renderingContext.save();
      this.renderingContext.fillStyle = barrenPattern;
      this.renderingContext.fillRect(0, 0, CANVAS_CONFIG.width, CANVAS_CONFIG.height);
      this.renderingContext.restore();
    }
  }

  private renderBaseDirtBackground(dirtTile: HTMLImageElement): void {
    const pattern = this.generateBaseDirtPattern(dirtTile);
    if (pattern) {
      this.renderingContext.save();
      this.renderingContext.fillStyle = pattern;
      this.renderingContext.fillRect(0, 0, CANVAS_CONFIG.width, CANVAS_CONFIG.height);
      this.renderingContext.restore();
    }
  }

  private generateBaseDirtPattern(dirtTile: HTMLImageElement): CanvasPattern | null {
    if (this.cachedBaseDirtPattern) return this.cachedBaseDirtPattern;
    this.cachedBaseDirtPattern = this.renderingContext.createPattern(dirtTile, 'repeat');
    return this.cachedBaseDirtPattern;
  }

  private generateBarrenPattern(): CanvasPattern | null {
    if (this.cachedBarrenPattern) return this.cachedBarrenPattern;

    const patternCanvas = document.createElement('canvas');
    patternCanvas.width = 32;
    patternCanvas.height = 32;
    const patternContext = patternCanvas.getContext('2d');

    if (!patternContext) return null;

    patternContext.imageSmoothingEnabled = false;

    // Create alien soil pattern
    patternContext.fillStyle = '#1a2324';
    patternContext.fillRect(0, 0, 32, 32);

    patternContext.fillStyle = '#202c2e';
    patternContext.fillRect(0, 0, 16, 16);
    patternContext.fillRect(16, 16, 16, 16);

    patternContext.fillStyle = '#233335';
    for (let speckleIndex = 0; speckleIndex < 24; speckleIndex++) {
      const speckleX = Math.floor(Math.random() * 32);
      const speckleY = Math.floor(Math.random() * 32);
      patternContext.fillRect(speckleX, speckleY, 1, 1);
    }

    this.cachedBarrenPattern = this.renderingContext.createPattern(patternCanvas, 'repeat');
    return this.cachedBarrenPattern;
  }
}
