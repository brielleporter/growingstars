/**
 * Asset loading and management system
 */

import { GameAssets } from '../types/gameAssets.types';
import { PlantType } from '../types/plantSystem.types';
import { ASSET_PATHS } from '../configuration/assetPaths';

export class AssetLoader {
  private assets: GameAssets;
  private loadedCount = 0;
  private totalAssets = 0;
  private isBarrenBackgroundAvailable = false;

  constructor() {
    this.assets = {
      playerSprite: new Image(),
      homeBackground: new Image(),
      barrenBackground: new Image(),
      dirtTile: new Image(),
      seedSprite: new Image(),
      plantSprites: {
        eye: new Image(),
        tentacle: new Image(),
        jaws: new Image(),
        spike: new Image(),
        orb: new Image(),
        mushroom: new Image(),
      },
      buildings: {
        playerHouseBase: new Image(),
        playerHouseRoof: new Image(),
      },
    };
  }

  /**
   * Load all game assets
   */
  public async loadAllAssets(): Promise<GameAssets> {
    this.calculateTotalAssets();
    
    // Load basic assets
    this.loadAsset(this.assets.playerSprite, ASSET_PATHS.playerSpriteSheet);
    this.loadAsset(this.assets.homeBackground, ASSET_PATHS.homeBackground);
    this.loadAsset(this.assets.dirtTile, ASSET_PATHS.dirtTile);
    this.loadAsset(this.assets.seedSprite, ASSET_PATHS.seedSprite);
    
    // Load barren background with error handling
    this.loadBarrenBackground();
    
    // Load plant sprites
    Object.entries(ASSET_PATHS.plantSprites).forEach(([plantType, path]) => {
      this.loadAsset(this.assets.plantSprites[plantType as PlantType], path);
    });

    // Load buildings
    this.loadAsset(this.assets.buildings.playerHouseBase, ASSET_PATHS.buildings.playerHouseBase);
    this.loadAsset(this.assets.buildings.playerHouseRoof, ASSET_PATHS.buildings.playerHouseRoof);

    return this.assets;
  }

  /**
   * Get the loaded assets
   */
  public getAssets(): GameAssets {
    return this.assets;
  }

  /**
   * Check if barren background is available
   */
  public isBarrenAvailable(): boolean {
    return this.isBarrenBackgroundAvailable;
  }

  /**
   * Get loading progress (0-1)
   */
  public getLoadingProgress(): number {
    return this.totalAssets > 0 ? this.loadedCount / this.totalAssets : 0;
  }

  /**
   * Check if all assets are loaded
   */
  public areAllAssetsLoaded(): boolean {
    return this.loadedCount === this.totalAssets;
  }

  private calculateTotalAssets(): void {
    // Count: player, home, dirt, seed, barren (handled in its loader), plants, buildings
    const baseCount = 5; // player, home, dirt, seed, barren
    const plantCount = Object.keys(ASSET_PATHS.plantSprites).length;
    const buildingCount = Object.keys(ASSET_PATHS.buildings).length;
    this.totalAssets = baseCount + plantCount + buildingCount;
  }

  private loadAsset(imageElement: HTMLImageElement, assetPath: string): void {
    imageElement.onload = () => {
      this.loadedCount++;
      console.log(`Loaded asset: ${assetPath} (${this.loadedCount}/${this.totalAssets})`);
    };
    
    imageElement.onerror = () => {
      console.error(`Failed to load asset: ${assetPath}`);
      this.loadedCount++; // Still count as "loaded" to prevent hanging
    };
    
    imageElement.src = assetPath;
  }

  private loadBarrenBackground(): void {
    // If no barren background path is provided, use procedural background
    if (!ASSET_PATHS.barrenBackground) {
      this.isBarrenBackgroundAvailable = false;
      this.loadedCount++;
      console.log('Using procedural barren background');
      return;
    }
    
    this.assets.barrenBackground.onload = () => {
      this.isBarrenBackgroundAvailable = true;
      this.loadedCount++;
      console.log(`Loaded barren background (${this.loadedCount}/${this.totalAssets})`);
    };
    
    this.assets.barrenBackground.onerror = () => {
      this.isBarrenBackgroundAvailable = false;
      this.loadedCount++;
      console.log('Barren background not available, using procedural pattern');
    };
    
    this.assets.barrenBackground.src = ASSET_PATHS.barrenBackground;
  }
}
