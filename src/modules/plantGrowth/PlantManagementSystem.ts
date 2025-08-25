/**
 * Plant growth and management system
 */

import { PlantEntity, PlantType } from '../../types/plantSystem.types';
import { PLANT_CONFIG } from '../../configuration/gameConstants';
import { ClickPosition } from '../inputHandling/MouseInputManager';

export class PlantManagementSystem {
  private plantedEntities: PlantEntity[] = [];
  private readonly availablePlantTypes: PlantType[] = ['eye', 'tentacle', 'jaws', 'spike', 'orb', 'mushroom'];

  public getPlantedEntities(): PlantEntity[] {
    return this.plantedEntities;
  }

  public updatePlantGrowth(): void {
    const currentTime = performance.now();
    
    this.plantedEntities.forEach(plant => {
      if (!plant.hasGrown) {
        const elapsedTimeSeconds = (currentTime - plant.plantingTime) / 1000;
        if (elapsedTimeSeconds >= PLANT_CONFIG.growthDurationSeconds) {
          plant.hasGrown = true;
          console.log(`Plant at (${plant.xPosition}, ${plant.yPosition}) has grown into a ${plant.plantType} plant!`);
        }
      }
    });
  }

  public handlePlantingClick(clickPosition: ClickPosition): void {
    // Check if there's already a plant nearby
    const existingPlantNearby = this.plantedEntities.find(plant =>
      Math.abs(plant.xPosition - clickPosition.x) < PLANT_CONFIG.spacingThreshold &&
      Math.abs(plant.yPosition - clickPosition.y) < PLANT_CONFIG.spacingThreshold
    );

    if (!existingPlantNearby) {
      this.plantSeed(clickPosition);
    }
  }

  public getPlantCount(): { total: number; seeds: number; mature: number } {
    const total = this.plantedEntities.length;
    const mature = this.plantedEntities.filter(plant => plant.hasGrown).length;
    const seeds = total - mature;
    
    return { total, seeds, mature };
  }

  public clearAllPlants(): void {
    this.plantedEntities = [];
  }

  private plantSeed(position: ClickPosition): void {
    const randomPlantType = this.getRandomPlantType();
    
    const newPlant: PlantEntity = {
      xPosition: position.x,
      yPosition: position.y,
      plantingTime: performance.now(),
      hasGrown: false,
      plantType: randomPlantType,
    };

    this.plantedEntities.push(newPlant);
    console.log(`Planted ${randomPlantType} seed at (${position.x}, ${position.y})`);
  }

  private getRandomPlantType(): PlantType {
    const randomIndex = Math.floor(Math.random() * this.availablePlantTypes.length);
    return this.availablePlantTypes[randomIndex];
  }
}
