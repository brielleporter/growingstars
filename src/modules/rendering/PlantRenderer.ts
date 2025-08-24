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
    
    if (plant.hasGrown) {
      this.renderMaturePlant(plant, assets);
    } else {
      this.renderSeedPlant(plant, assets);
    }
    
    this.renderingContext.restore();
  }

  private renderMaturePlant(plant: PlantEntity, assets: GameAssets): void {
    const plantSprite = assets.plantSprites[plant.plantType];
    
    if (plantSprite.complete && plantSprite.naturalWidth > 0) {
      this.renderPlantSprite(plantSprite, plant.xPosition, plant.yPosition, RENDER_CONFIG.scale);
    } else {
      this.renderFallbackMaturePlant(plant.xPosition, plant.yPosition);
    }
  }

  private renderSeedPlant(plant: PlantEntity, assets: GameAssets): void {
    if (assets.seedSprite.complete && assets.seedSprite.naturalWidth > 0) {
      const seedScale = RENDER_CONFIG.scale * PLANT_CONFIG.seedScaleFactor;
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
    // Fallback: green rectangle for grown plant
    this.renderingContext.fillStyle = '#228B22';
    this.renderingContext.fillRect(
      xPosition - PLANT_CONFIG.size,
      yPosition - PLANT_CONFIG.size * 2,
      PLANT_CONFIG.size * 2,
      PLANT_CONFIG.size * 2
    );
  }

  private renderFallbackSeed(xPosition: number, yPosition: number): void {
    // Fallback: brown square for seed
    this.renderingContext.fillStyle = '#8B4513';
    this.renderingContext.fillRect(
      xPosition - 4, 
      yPosition - 4, 
      8, 
      8
    );
  }
}