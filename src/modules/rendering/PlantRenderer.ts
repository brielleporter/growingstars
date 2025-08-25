/**
 * Plant rendering system
 */

import { PlantEntity } from '../../types/plantSystem.types';
import { GameAssets } from '../../types/gameAssets.types';
import { RENDER_CONFIG, PLANT_CONFIG } from '../../configuration/gameConstants';

export class PlantRenderer {
  private renderingContext: CanvasRenderingContext2D;

  constructor(renderingContext: CanvasRenderingContext2D) {
    this.renderingContext = renderingContext;
  }

  public renderAllPlants(plants: PlantEntity[], assets: GameAssets): void {
    plants.forEach(plant => {
      this.renderSinglePlant(plant, assets);
    });
  }

  private renderSinglePlant(plant: PlantEntity, assets: GameAssets): void {
    this.renderingContext.save();
    
    if (plant.plantType === 'orb') {
      this.renderOrbPlant(plant, assets);
    } else {
      if (plant.hasGrown) {
        this.renderMaturePlant(plant, assets);
      } else {
        this.renderSeedPlant(plant, assets);
      }
    }
    
    this.renderingContext.restore();
  }

  /**
   * Render the 4-stage orb plant from a single horizontal spritesheet (4 columns x 1 row):
   * seedling, sprout, budding, harvest. Before grown, show stages 0..2. After grown, show stage 3.
   */
  private renderOrbPlant(plant: PlantEntity, assets: GameAssets): void {
    const img = assets.plantSprites['orb'];
    if (!img || !img.complete || img.naturalWidth === 0) {
      // Fallback simple circle when image not yet available
      const r = 6 * RENDER_CONFIG.plantScale;
      this.renderingContext.fillStyle = '#62d0ff';
      this.renderingContext.beginPath();
      this.renderingContext.arc(plant.xPosition, plant.yPosition - r / 2, r, 0, Math.PI * 2);
      this.renderingContext.fill();
      return;
    }

    const cols = 4;
    const frameW = Math.floor(img.naturalWidth / cols);
    const frameH = img.naturalHeight;

    const elapsed = (performance.now() - plant.plantingTime) / 1000;
    const total = Math.max(0.001, PLANT_CONFIG.growthDurationSeconds);
    let idx = Math.floor((elapsed / total) * cols); // 0..4
    if (!plant.hasGrown) idx = Math.min(idx, 2); // clamp to 0..2 until grown
    idx = Math.max(0, Math.min(3, idx)); // final clamp 0..3

    const sx = idx * frameW;
    const sy = 0;
    const scale = RENDER_CONFIG.plantScale;
    const dw = frameW * scale;
    const dh = frameH * scale;

    this.renderingContext.drawImage(
      img,
      sx, sy, frameW, frameH,
      plant.xPosition - dw / 2,
      plant.yPosition - dh / 2,
      dw, dh
    );
  }

  private renderMaturePlant(plant: PlantEntity, assets: GameAssets): void {
    const plantSprite = assets.plantSprites[plant.plantType];
    
    if (plantSprite.complete && plantSprite.naturalWidth > 0) {
      this.renderPlantSprite(plantSprite, plant.xPosition, plant.yPosition, RENDER_CONFIG.plantScale);
    } else {
      this.renderFallbackMaturePlant(plant.xPosition, plant.yPosition);
    }
  }

  private renderSeedPlant(plant: PlantEntity, assets: GameAssets): void {
    if (assets.seedSprite.complete && assets.seedSprite.naturalWidth > 0) {
      const seedScale = RENDER_CONFIG.plantScale * PLANT_CONFIG.seedScaleFactor;
      this.renderPlantSprite(assets.seedSprite, plant.xPosition, plant.yPosition, seedScale);
    } else {
      this.renderFallbackSeed(plant.xPosition, plant.yPosition);
    }
  }

  private renderPlantSprite(
    sprite: HTMLImageElement, 
    xPosition: number, 
    yPosition: number, 
    scale: number
  ): void {
    const spriteWidth = sprite.naturalWidth;
    const spriteHeight = sprite.naturalHeight;
    const drawWidth = spriteWidth * scale;
    const drawHeight = spriteHeight * scale;

    this.renderingContext.drawImage(
      sprite,
      xPosition - drawWidth / 2,
      yPosition - drawHeight / 2,
      drawWidth,
      drawHeight
    );
  }

  private renderFallbackMaturePlant(xPosition: number, yPosition: number): void {
    // Fallback: green rectangle for grown plant (scaled down)
    const scaledSize = PLANT_CONFIG.size * RENDER_CONFIG.plantScale;
    this.renderingContext.fillStyle = '#228B22';
    this.renderingContext.fillRect(
      xPosition - scaledSize,
      yPosition - scaledSize * 2,
      scaledSize * 2,
      scaledSize * 2
    );
  }

  private renderFallbackSeed(xPosition: number, yPosition: number): void {
    // Fallback: brown square for seed (scaled down)
    const scaledSeedSize = 4 * RENDER_CONFIG.plantScale * PLANT_CONFIG.seedScaleFactor;
    this.renderingContext.fillStyle = '#8B4513';
    this.renderingContext.fillRect(
      xPosition - scaledSeedSize, 
      yPosition - scaledSeedSize, 
      scaledSeedSize * 2, 
      scaledSeedSize * 2
    );
  }
}
