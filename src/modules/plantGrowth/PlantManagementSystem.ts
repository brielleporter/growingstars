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
      if (plant.hasGrown) return;
      // Growth is gated until watered
      if (!plant.watered) return;
      const start = plant.wateringStartTime ?? plant.plantingTime;
      const elapsedTimeSeconds = (currentTime - start) / 1000;
      if (elapsedTimeSeconds >= PLANT_CONFIG.growthDurationSeconds) {
        plant.hasGrown = true;
        console.log(`Plant at (${plant.xPosition}, ${plant.yPosition}) has grown into a ${plant.plantType} plant!`);
      }
    });
  }

  public handlePlantingClick(clickPosition: ClickPosition, plantTypeOverride?: PlantType): boolean {
    // Check if there's already a plant nearby
    const existingPlantNearby = this.plantedEntities.find(plant =>
      Math.abs(plant.xPosition - clickPosition.x) < PLANT_CONFIG.spacingThreshold &&
      Math.abs(plant.yPosition - clickPosition.y) < PLANT_CONFIG.spacingThreshold
    );

    if (!existingPlantNearby) {
      this.plantSeed(clickPosition, plantTypeOverride);
      return true;
    }
    return false;
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

  /** Harvest a mature plant that occupies the exact tile (tileX, tileY). Returns the harvested plant or null. */
  public harvestAtTile(tileX: number, tileY: number, tileSize: number): PlantEntity | null {
    const idx = this.plantedEntities.findIndex(p => {
      if (!p.hasGrown) return false;
      const pxTile = Math.floor(p.xPosition / tileSize);
      const pyTile = Math.floor(p.yPosition / tileSize);
      return pxTile === tileX && pyTile === tileY;
    });
    if (idx >= 0) {
      const harvested = this.plantedEntities.splice(idx, 1)[0];
      console.log(`Harvested ${harvested.plantType} at tile (${tileX}, ${tileY})`);
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

  /** Find a mature plant occupying the exact tile (tileX, tileY), without removing it. */
  public findMatureAtTile(tileX: number, tileY: number, tileSize: number): PlantEntity | null {
    for (const p of this.plantedEntities) {
      if (!p.hasGrown) continue;
      const pxTile = Math.floor(p.xPosition / tileSize);
      const pyTile = Math.floor(p.yPosition / tileSize);
      if (pxTile === tileX && pyTile === tileY) return p;
    }
    return null;
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

  /** Water a seed at the exact tile; starts growth timer if not already watered. */
  public waterAtTile(tileX: number, tileY: number, tileSize: number): boolean {
    const p = this.plantedEntities.find(pl => {
      if (pl.hasGrown) return false;
      const px = Math.floor(pl.xPosition / tileSize);
      const py = Math.floor(pl.yPosition / tileSize);
      return px === tileX && py === tileY;
    });
    if (!p) return false;
    if (!p.watered) {
      p.watered = true;
      p.wateringStartTime = performance.now();
      console.log(`Watered plant at tile (${tileX}, ${tileY})`);
      return true;
    }
    return false;
  }

  /** Water the nearest not-grown plant within a given distance of position; returns true if watered. */
  public waterNearest(position: { x: number; y: number }, maxDistance: number): boolean {
    let best: PlantEntity | null = null;
    let bestDistSq = Number.POSITIVE_INFINITY;
    for (const p of this.plantedEntities) {
      if (p.hasGrown) continue;
      if (p.watered) continue;
      const dx = p.xPosition - position.x;
      const dy = p.yPosition - position.y;
      const d2 = dx * dx + dy * dy;
      if (d2 <= maxDistance * maxDistance && d2 < bestDistSq) {
        bestDistSq = d2;
        best = p;
      }
    }
    if (!best) return false;
    best.watered = true;
    best.wateringStartTime = performance.now();
    console.log(`Watered nearest plant at (${best.xPosition}, ${best.yPosition})`);
    return true;
  }

  /** Water all planted seeds that are not yet grown and not yet watered. Returns number watered. */
  public waterAllUnwatered(startTime?: number): number {
    const t = startTime ?? performance.now();
    let count = 0;
    for (const p of this.plantedEntities) {
      if (p.hasGrown) continue;
      if (p.watered) continue;
      p.watered = true;
      p.wateringStartTime = t;
      count++;
    }
    if (count > 0) {
      console.log(`Rain watered ${count} seed(s).`);
    }
    return count;
  }

  private plantSeed(position: ClickPosition, plantTypeOverride?: PlantType): void {
    const randomPlantType = plantTypeOverride ?? this.getRandomPlantType();
    
    const newPlant: PlantEntity = {
      xPosition: position.x,
      yPosition: position.y,
      plantingTime: performance.now(),
      watered: false,
      wateringStartTime: null,
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
