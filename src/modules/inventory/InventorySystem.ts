import type { PlantType } from '../../types/plantSystem.types';
import type { InventoryCounts, InventoryState } from '../../types/inventory.types';

export class InventorySystem {
  private counts: InventoryCounts;
  private coins: number;
  private capacity?: number;
  private water: number;
  private waterCapacity: number;

  constructor(initialCoins = 0, capacity?: number, initialWater = 10, waterCapacity = 10) {
    this.counts = {
      eye: 0,
      tentacle: 0,
      jaws: 0,
      spike: 0,
      orb: 0,
      mushroom: 0,
    };
    this.coins = initialCoins;
    this.capacity = capacity;
    this.water = Math.max(0, Math.min(initialWater, waterCapacity));
    this.waterCapacity = waterCapacity;
  }

  public addPlant(type: PlantType): boolean {
    if (this.capacity !== undefined && this.getTotalCount() >= this.capacity) {
      return false;
    }
    this.counts[type] = (this.counts[type] ?? 0) + 1;
    return true;
  }

  public getCount(type: PlantType): number {
    return this.counts[type] ?? 0;
  }

  public getTotalCount(): number {
    return Object.values(this.counts).reduce((a, b) => a + b, 0);
  }

  public sellAll(prices: Record<PlantType, number>): { coinsGained: number } {
    let gained = 0;
    (Object.keys(this.counts) as PlantType[]).forEach((k) => {
      const qty = this.counts[k] ?? 0;
      if (qty > 0) {
        const price = prices[k] ?? 0;
        gained += qty * price;
        this.counts[k] = 0;
      }
    });
    this.coins += gained;
    return { coinsGained: gained };
  }

  public getCoins(): number {
    return this.coins;
  }

  public getState(): InventoryState {
    return { counts: { ...this.counts }, coins: this.coins, capacity: this.capacity };
  }

  // Water can APIs
  public getWater(): number { return this.water; }
  public getWaterCapacity(): number { return this.waterCapacity; }
  public refillWater(): void { this.water = this.waterCapacity; }
  public useWater(units = 1): boolean {
    if (this.water < units) return false;
    this.water -= units;
    return true;
  }
}
