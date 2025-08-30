import type { PlantType } from '../../types/plantSystem.types';
import type { InventoryCounts, InventoryState } from '../../types/inventory.types';

export class InventorySystem {
  private counts: InventoryCounts;
  private coins: number;
  private capacity?: number;

  constructor(initialCoins = 0, capacity?: number) {
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
}

