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

  /** Attempt to harvest a mature plant near the given position. Returns the harvested plant (or null). */
  public harvestNearest(position: { x: number; y: number }, maxDistance: number): PlantEntity | null {
    let bestIndex = -1;
    let bestDistSq = Number.POSITIVE_INFINITY;
    for (let i = 0; i < this.plantedEntities.length; i++) {
      const p = this.plantedEntities[i];
      if (!p.hasGrown) continue; // only mature plants
      const dx = p.xPosition - position.x;
      const dy = p.yPosition - position.y;
      const distSq = dx * dx + dy * dy;
      if (distSq < bestDistSq && distSq <= maxDistance * maxDistance) {
        bestDistSq = distSq;
        bestIndex = i;
      }
    }
    if (bestIndex >= 0) {
      const harvested = this.plantedEntities.splice(bestIndex, 1)[0];
      console.log(`Harvested ${harvested.plantType} at (${harvested.xPosition}, ${harvested.yPosition})`);
      return harvested;
    }
    return null;
  }

  /** Find nearest mature plant within maxDistance of position, without removing it. */
  public findNearestMature(position: { x: number; y: number }, maxDistance: number): PlantEntity | null {
    let best: PlantEntity | null = null;
    let bestDistSq = Number.POSITIVE_INFINITY;
    for (let i = 0; i < this.plantedEntities.length; i++) {
      const p = this.plantedEntities[i];
      if (!p.hasGrown) continue;
      const dx = p.xPosition - position.x;
      const dy = p.yPosition - position.y;
      const d2 = dx * dx + dy * dy;
      if (d2 <= maxDistance * maxDistance && d2 < bestDistSq) {
        bestDistSq = d2;
        best = p;
      }
    }
    return best;
  }

  /** Remove a specific plant entity by reference. Returns true if removed. */
  public removePlant(plant: PlantEntity): boolean {
    const idx = this.plantedEntities.indexOf(plant);
    if (idx >= 0) {
      this.plantedEntities.splice(idx, 1);
      return true;
    }
    return false;
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
