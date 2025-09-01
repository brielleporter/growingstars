import type { PlantType } from '../../types/plantSystem.types';
import type { InventoryCounts, InventoryState } from '../../types/inventory.types';

export class InventorySystem {
  private plantCounts: InventoryCounts;
  private totalCoins: number;
  private inventoryCapacity?: number;
  private currentWaterAmount: number;
  private maximumWaterCapacity: number;

  constructor(startingCoins = 0, inventoryLimit?: number, startingWater = 10, maxWaterCapacity = 10) {
    this.plantCounts = {
      eye: 0,
      tentacle: 0,
      jaws: 0,
      spike: 0,
      orb: 0,
      mushroom: 0,
    };
    this.totalCoins = startingCoins;
    this.inventoryCapacity = inventoryLimit;
    this.currentWaterAmount = Math.max(0, Math.min(startingWater, maxWaterCapacity));
    this.maximumWaterCapacity = maxWaterCapacity;
  }

  public addPlant(plantType: PlantType): boolean {
    if (this.inventoryCapacity !== undefined && this.getTotalPlantCount() >= this.inventoryCapacity) {
      return false;
    }
    this.plantCounts[plantType] = (this.plantCounts[plantType] ?? 0) + 1;
    return true;
  }

  public getPlantCount(plantType: PlantType): number {
    return this.plantCounts[plantType] ?? 0;
  }

  public getTotalPlantCount(): number {
    return Object.values(this.plantCounts).reduce((totalCount, currentCount) => totalCount + currentCount, 0);
  }

  public sellAllPlants(plantPrices: Record<PlantType, number>): { coinsGained: number } {
    let totalCoinsGained = 0;
    (Object.keys(this.plantCounts) as PlantType[]).forEach((plantType) => {
      const plantQuantity = this.plantCounts[plantType] ?? 0;
      if (plantQuantity > 0) {
        const pricePerPlant = plantPrices[plantType] ?? 0;
        totalCoinsGained += plantQuantity * pricePerPlant;
        this.plantCounts[plantType] = 0;
      }
    });
    this.totalCoins += totalCoinsGained;
    return { coinsGained: totalCoinsGained };
  }

  public getCoins(): number {
    return this.totalCoins;
  }

  public spendCoins(coinAmount: number): boolean {
    if (coinAmount <= 0) return true;
    if (this.totalCoins < coinAmount) return false;
    this.totalCoins -= coinAmount;
    return true;
  }

  public modifyCoins(coinAmountChange: number): void {
    this.totalCoins = Math.max(0, this.totalCoins + coinAmountChange);
  }

  public getState(): InventoryState {
    return { counts: { ...this.plantCounts }, coins: this.totalCoins, capacity: this.inventoryCapacity };
  }

  // Water can APIs
  public getWater(): number { return this.currentWaterAmount; }
  public getWaterCapacity(): number { return this.maximumWaterCapacity; }
  public refillWater(): void { this.currentWaterAmount = this.maximumWaterCapacity; }
  public useWater(waterUnits = 1): boolean {
    if (this.currentWaterAmount < waterUnits) return false;
    this.currentWaterAmount -= waterUnits;
    return true;
  }
}
