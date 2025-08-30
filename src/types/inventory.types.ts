/**
 * Inventory types for harvested items and currency
 */

import type { PlantType } from './plantSystem.types';

export type InventoryCounts = Record<PlantType, number>;

export interface InventoryState {
  counts: InventoryCounts;
  coins: number;
  capacity?: number;
}

