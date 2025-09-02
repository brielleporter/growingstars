/**
 * Main game engine that orchestrates all game systems
 */

import { GameAssets } from '../types/gameAssets.types';
import { SPRITE_SHEET_CONFIG, SPRITE_DIRECTIONS, RENDER_CONFIG, TILE_CONFIG, WORLD_CONFIG, HARVEST_EFFECT_CONFIG, WATER_EFFECT_CONFIG, SLEEP_EFFECT_CONFIG, HOUSE_CONFIG, PLANT_PRICES } from '../configuration/gameConstants';
import type { PlantEntity } from '../types/plantSystem.types';
import { InventorySystem } from '../modules/inventory/InventorySystem';
import { PlayerCharacter } from '../types/playerCharacter.types';
import { AssetLoader } from '../assetManagement/AssetLoader';
import { KeyboardInputManager } from '../modules/inputHandling/KeyboardInputManager';
import { MouseInputManager } from '../modules/inputHandling/MouseInputManager';
import { PlayerMovementSystem } from '../modules/playerCharacter/PlayerMovementSystem';
import { PlantManagementSystem } from '../modules/plantGrowth/PlantManagementSystem';
import { BackgroundRenderer } from '../modules/rendering/BackgroundRenderer';
import { BuildingRenderer } from '../modules/rendering/BuildingRenderer';
import { PlantRenderer } from '../modules/rendering/PlantRenderer';
import { PlayerCharacterRenderer } from '../modules/rendering/PlayerCharacterRenderer';
import { MapLoader, LoadedMap } from '../modules/tilemap/MapLoader';
import { TilemapRenderer } from '../modules/rendering/TilemapRenderer';
import { Camera } from '../modules/rendering/Camera';
import type { TimeManager } from '../modules/time/TimeManager';
import { StaminaSystem } from '../modules/player/StaminaSystem';

export class GameEngine {
  private canvas: HTMLCanvasElement;
  private renderingContext: CanvasRenderingContext2D;

  // System managers
  private assetLoader: AssetLoader;
  private keyboardInput: KeyboardInputManager;
  private mouseInput: MouseInputManager;
  private playerMovement: PlayerMovementSystem;
  private plantManagement: PlantManagementSystem;

  // Renderers
  private backgroundRenderer: BackgroundRenderer;
  private buildingRenderer: BuildingRenderer;
  private plantRenderer: PlantRenderer;
  private playerRenderer: PlayerCharacterRenderer;
  private mapLoader: MapLoader;
  private tilemapRenderer: TilemapRenderer;
  private worldMap: LoadedMap | null = null;
  private interactionAreas: Array<{ x: number; y: number; w: number; h: number; kind: 'well' | 'ship' | 'enterHouse' | 'exitHouse' | 'bed' | 'storefront' }> = [];
  private staticCollisionRects: Array<{ x: number; y: number; w: number; h: number }> = [];
  private camera!: Camera;
  private centerOriginPosition = { x: 0, y: 0 };
  private houseWorldPosition = { x: 0, y: 0 };
  private isInsideBuilding = false;
  private fadeTransitionState: { active: boolean; startTime: number; duration: number; midPointFired: boolean; onMidPointCallback?: () => Promise<void> | void } = { active: false, startTime: 0, duration: 600, midPointFired: false };
  // Storefront prop (bones)
  private storefrontImage: HTMLImageElement | null = null;
  private storefrontWorldPosition = { x: 0, y: 0 };
  private storefrontCollisionBox: { x: number; y: number; w: number; h: number } | null = null;
  // Shop UI state
  private isShopOpen = false;
  private selectedShopItemIndex = 0;
  private availableShopItems: Array<{ plantType: 'eye' | 'tentacle' | 'jaws' | 'spike' | 'orb' | 'mushroom'; price: number }> = [];

  // Game state
  private gameAssets!: GameAssets;
  private isGameRunning = false;
  private previousFrameTimestamp = 0;
  private harvestingInputHandler?: () => void;
  private activeVisualEffects: Array<{ x: number; baselineY: number; startTime: number; kind: 'slash' | 'water'; row: number; targetHeight: number; targetPlant?: PlantEntity }> = [];
  private sleepWorldAnim: { active: boolean; startTime: number; x: number; y: number } = { active: false, startTime: 0, x: 0, y: 0 };
  private gameNotifications: Array<{ text: string; expirationTime: number }> = [];
  private wasInteractionKeyPressed = false;
  private shouldSuppressEmptyShipPrompt = false;
  private wasQuitShopKeyPressed = false;
  private inventory: InventorySystem;
  // Simple demo data for HUD seeds (since seeds are not yet an inventory item)
  private hudDisplaySeedType: string = 'sprout';
  private hudDisplaySeedCount: number = 12;
  // Bottom inventory bar
  private playerInventorySlots: Array<{ kind: 'seed'; plantType: 'eye' | 'tentacle' | 'jaws' | 'spike' | 'orb' | 'mushroom'; count: number } | { kind: 'tool'; toolType?: 'hoe' | 'wrench'; count: number } | null> = [];
  private selectedInventorySlotIndex = 0;
  private wasLeftArrowPressed = false;
  private wasRightArrowPressed = false;
  private wasSpaceKeyPressed = false;
  private wasUpArrowPressed = false;
  private wasDownArrowPressed = false;
  private wasEnterKeyPressed = false;
  private wasEscapeKeyPressed = false;
  // Player systems
  // timeManager is passed to setTimeManager but not stored as it's managed externally
  // Track hoed tiles (within base chunk coords)
  private hoed: Set<string> = new Set();
  // Tiles that came pre-hoed in the map (center dirt 32,336) and should not be overwritten
  private lockedHoed: Set<string> = new Set();
  private sleepSequenceTimer: number | null = null;
  // Player systems
  private staminaSystem?: StaminaSystem;

  constructor(canvasElementId: string) {
    const canvasElement = document.getElementById(canvasElementId);
    if (!canvasElement || !(canvasElement instanceof HTMLCanvasElement)) {
      throw new Error(`Canvas element with id '${canvasElementId}' not found`);
    }

    const renderingContext = canvasElement.getContext('2d');
    if (!renderingContext) {
      throw new Error('Canvas 2D context not available');
    }

    this.canvas = canvasElement;
    this.renderingContext = renderingContext;
    this.renderingContext.imageSmoothingEnabled = false;
    
    // Set up canvas to fill viewport
    this.setupViewportCanvas();

    // Initialize systems
    this.assetLoader = new AssetLoader();
    this.keyboardInput = new KeyboardInputManager();
    this.mouseInput = new MouseInputManager(this.canvas);
    this.playerMovement = new PlayerMovementSystem(this.keyboardInput);
    this.playerMovement.setCanvasReference(this.canvas);
    this.plantManagement = new PlantManagementSystem();
    // Start with some water capacity (e.g., 10 units) and full can
    this.inventory = new InventorySystem(0, undefined, 10, 10);

    // Initialize renderers
    this.backgroundRenderer = new BackgroundRenderer(this.renderingContext);
    this.buildingRenderer = new BuildingRenderer(this.renderingContext);
    this.plantRenderer = new PlantRenderer(this.renderingContext);
    this.playerRenderer = new PlayerCharacterRenderer(this.renderingContext);
    this.mapLoader = new MapLoader();
    this.tilemapRenderer = new TilemapRenderer(this.renderingContext);
    this.camera = new Camera();
    this.camera.setViewport(this.canvas.width, this.canvas.height);
    // Initialize inventory bar (8 slots)
    this.playerInventorySlots = new Array(8).fill(null);
    this.playerInventorySlots[0] = { kind: 'seed', plantType: 'eye', count: 6 };
    this.playerInventorySlots[1] = { kind: 'seed', plantType: 'tentacle', count: 6 };
    this.playerInventorySlots[2] = { kind: 'seed', plantType: 'spike', count: 6 };
    this.playerInventorySlots[3] = { kind: 'tool', toolType: 'hoe', count: 1 } as any;
  }

  private renderSleepEffectWorld(): void {
    if (!this.sleepWorldAnim.active) return;
    const img = this.gameAssets.sleepSprite as HTMLImageElement;
    if (!img || !img.complete || img.naturalWidth === 0 || img.naturalHeight === 0) {
      this.sleepWorldAnim.active = false;
      return;
    }
    const now = performance.now();
    const elapsed = (now - this.sleepWorldAnim.startTime) / 1000;
    const secPerFrame = 1 / SLEEP_EFFECT_CONFIG.framesPerSecond;
    const frame = Math.floor(elapsed / secPerFrame);
    const frameW = Math.floor(img.naturalWidth / SLEEP_EFFECT_CONFIG.columns);
    const frameH = img.naturalHeight; // 1 row
    const sx = Math.min(frame, SLEEP_EFFECT_CONFIG.columns - 1) * frameW;
    const sy = 0;

    // Draw at player's world position with same display height as player
    const playerCfg = this.playerRenderer.getSpriteConfiguration();
    const playerDisplayH = playerCfg.frameHeight * RENDER_CONFIG.playerScale;
    const drawH = Math.max(1, Math.floor(playerDisplayH));
    const drawW = Math.max(1, Math.floor((frameW / frameH) * drawH));
    const dx = Math.round(this.sleepWorldAnim.x - drawW / 2 - this.camera.x);
    const dy = Math.round(this.sleepWorldAnim.y - drawH / 2 - this.camera.y);
    this.renderingContext.save();
    this.renderingContext.globalAlpha = 0.95;
    this.renderingContext.drawImage(img, sx, sy, frameW, frameH, dx, dy, drawW, drawH);
    this.renderingContext.restore();
  }

  private triggerSleepAnimation(): void {
    const player = this.playerMovement.getPlayerCharacter();
    this.sleepWorldAnim = { active: true, startTime: performance.now(), x: player.xPosition, y: player.yPosition };
  }

  private isDirtTileAtWorld(x: number, y: number): boolean {
    if (!this.worldMap) return false;
    const tileSize = TILE_CONFIG.tileSize;
    const tx = Math.floor((x - this.centerOriginPosition.x) / tileSize);
    const ty = Math.floor((y - this.centerOriginPosition.y) / tileSize);
    if (tx < 0 || ty < 0 || tx >= this.worldMap.widthTiles || ty >= this.worldMap.heightTiles) return false;
    const dirtLayer = this.worldMap.layers.find(l => l.name.toLowerCase().includes('dirt'));
    if (!dirtLayer) return false;
    const idx = ty * this.worldMap.widthTiles + tx;
    const gid = dirtLayer.data[idx] | 0;
    return gid !== 0;
  }

  private triggerSleepSequence(complete: () => void): void {
    // Start/refresh animation at player position
    this.triggerSleepAnimation();
    const animMs = (SLEEP_EFFECT_CONFIG.columns / SLEEP_EFFECT_CONFIG.framesPerSecond) * 1000;
    const holdMs = 700; // hold on last frame before fade
    const fadeMs = 1200; // fade duration
    if (this.sleepSequenceTimer) {
      window.clearTimeout(this.sleepSequenceTimer);
      this.sleepSequenceTimer = null;
    }
    // After animation + hold, start fade and advance day at midpoint
    this.sleepSequenceTimer = window.setTimeout(() => {
      const mid = async () => {
        this.sleepWorldAnim.active = false;
        await Promise.resolve(complete());
      };
      this.startFadeTransition(mid, fadeMs);
    }, Math.max(0, Math.floor(animMs + holdMs)));
  }

  private setupViewportCanvas(): void {
    const resizeCanvas = () => {
      this.canvas.width = window.innerWidth;
      this.canvas.height = window.innerHeight;
      this.renderingContext.imageSmoothingEnabled = false;
    };
    
    // Set initial size
    resizeCanvas();
    
    // Handle window resize
    window.addEventListener('resize', resizeCanvas);
  }

  public setTimeManager(timeManager: TimeManager): void {
    this.staminaSystem = new StaminaSystem(timeManager);
    
    // Setup stamina system callbacks
    this.staminaSystem.onCoinsChanged((amount) => {
      if (amount < 0) {
        const currentCoins = this.inventory.getCoins();
        if (currentCoins >= Math.abs(amount)) {
          this.inventory.modifyCoins(amount);
        } else {
          this.pushNotification('You would have lost coins but have none.');
        }
      }
    });
    
    this.staminaSystem.onNotificationRequested((message) => {
      this.pushNotification(message);
    });
    // Play sleep collapse animation when auto-sleep triggers
    this.staminaSystem.onAutoSleep(() => {
      this.triggerSleepAnimation();
    });
    // Orchestrate hold + fade before advancing day
    this.staminaSystem.onAutoSleepRequested((complete) => {
      this.triggerSleepSequence(complete);
    });
    
    // Set up shop item refresh on day/season changes
    let previousDayNumber = timeManager.getState().day;
    let previousSeasonIndex = timeManager.getState().seasonIndex;
    
    timeManager.addListener((currentTimeState) => {
      if (currentTimeState.day !== previousDayNumber || currentTimeState.seasonIndex !== previousSeasonIndex) {
        this.refreshShopItems(currentTimeState.day, currentTimeState.seasonIndex);
        previousDayNumber = currentTimeState.day;
        previousSeasonIndex = currentTimeState.seasonIndex;
      }
    });
  }

  public async initialize(): Promise<void> {
    console.log('Initializing Growing Stars game engine...');

    // Load all assets
    this.gameAssets = await this.assetLoader.loadAllAssets();

    // Initialize input systems
    this.keyboardInput.initialize();
    this.mouseInput.initialize();

    // Set up plant placement on P key press
    this.setupPlantingInput();
    // Load world map (Tiled)
    try {
      this.worldMap = await this.mapLoader.loadMap('/src/assets/maps/homeMap.tmj');
      // Compute world/tile sizing and camera
      const tileSize = TILE_CONFIG.tileSize;
      const baseChunkWidth = this.worldMap.widthTiles * tileSize;
      const baseChunkHeight = this.worldMap.heightTiles * tileSize;
      this.centerOriginPosition = { x: baseChunkWidth, y: baseChunkHeight };
      const totalWorldWidth = baseChunkWidth * 3;
      const totalWorldHeight = baseChunkHeight * 3;
      this.camera.setWorldSize(totalWorldWidth, totalWorldHeight);
      this.playerMovement.setWorldSize(totalWorldWidth, totalWorldHeight);
      // Place player at center of center chunk
      const playerCharacter = this.playerMovement.getPlayerCharacter();
      playerCharacter.xPosition = this.centerOriginPosition.x + Math.floor(baseChunkWidth / 2);
      playerCharacter.yPosition = this.centerOriginPosition.y + Math.floor(baseChunkHeight / 2);
      this.camera.follow(playerCharacter.xPosition, playerCharacter.yPosition);
      // House world location inside center chunk
      const houseWorldX = this.centerOriginPosition.x + Math.floor((HOUSE_CONFIG.tileX + 0.5) * tileSize);
      const houseWorldY = this.centerOriginPosition.y + Math.floor((HOUSE_CONFIG.tileY + 1) * tileSize);
      this.houseWorldPosition = { x: houseWorldX, y: houseWorldY };
      // Build interaction areas and static collisions
      this.buildInteractionAreas();
      console.log('Loaded Tiled map:', this.worldMap.widthTiles, 'x', this.worldMap.heightTiles);
    } catch (e) {
      console.warn('Failed to load Tiled map:', e);
      this.worldMap = null;
    }
    // Set up harvesting on H key press
    this.setupHarvestingInput();

    // Initialize sprite dimensions when player sprite loads
    this.gameAssets.playerSprite.onload = () => {
      this.initializeSpriteDimensions();
    };

    // If sprite is already loaded, initialize dimensions immediately
    if (this.gameAssets.playerSprite.complete) {
      this.initializeSpriteDimensions();
    }

    // Compute storefront world position precisely one chunk above the house baseline
    if (this.worldMap) {
      const tileSize = TILE_CONFIG.tileSize;
      const chunkHeight = this.worldMap.heightTiles * tileSize;
      const storefrontX = this.houseWorldPosition.x;
      const storefrontY = this.houseWorldPosition.y - chunkHeight;
      this.storefrontWorldPosition = { x: storefrontX, y: storefrontY };
      // Collision aligned to the storefront's bottom tile (same baseline as image)
      this.storefrontCollisionBox = { x: Math.floor(storefrontX - tileSize / 2), y: Math.floor(storefrontY - tileSize), w: tileSize, h: tileSize };
    }

    // Load storefront image (bonesShadow21) and align collision to the drawn PNG bounds
    this.storefrontImage = new Image();
    this.storefrontImage.onload = () => {
      const storefrontImageElement = this.storefrontImage!;
      const originalImageWidth = storefrontImageElement.naturalWidth;
      const originalImageHeight = storefrontImageElement.naturalHeight;
      const tileSize = TILE_CONFIG.tileSize;
      // Horizontal crop: 3 tiles per side (already correct per feedback)
      const horizontalShrinkAmount = 3 * tileSize;
      const croppedWidth = Math.max(tileSize, originalImageWidth - horizontalShrinkAmount * 2);
      const collisionBoxX = Math.floor(this.storefrontWorldPosition.x - Math.floor(originalImageWidth / 2) + horizontalShrinkAmount);
      // Vertical crop: reduce front/south (bottom) by 1 tile, and bring in above (top) by 3 tiles
      const topCropAmount = 3 * tileSize;
      const bottomCropAmount = 1 * tileSize;
      const imageTopY = this.storefrontWorldPosition.y - originalImageHeight;
      const collisionBoxY = Math.floor(imageTopY + topCropAmount);
      const croppedHeight = Math.max(tileSize, originalImageHeight - topCropAmount - bottomCropAmount);
      this.storefrontCollisionBox = { x: collisionBoxX, y: collisionBoxY, w: croppedWidth, h: croppedHeight };
      // Refresh interactions and collisions now that storefront bounds are known
      this.buildInteractionAreas();
      this.updateWorldCollisions();
    };
    this.storefrontImage.src = '/src/assets/cursedLand/objectsSeparately/bonesShadow21.png';

    // Initialize shop items
    this.refreshShopItems();

    console.log('Game engine initialized successfully');
  }

  public start(): void {
    if (this.isGameRunning) {
      console.warn('Game is already running');
      return;
    }

    this.isGameRunning = true;
    this.previousFrameTimestamp = performance.now();
    requestAnimationFrame(this.gameLoop.bind(this));
    console.log('Game started');
  }

  public stop(): void {
    this.isGameRunning = false;
    this.keyboardInput.cleanup();
    this.mouseInput.cleanup();
    console.log('Game stopped');
  }

  // HUD snapshot for player resources
  public getHUDSnapshot(): { water: number; maxWater: number; seeds: number; seedType: string; coins: number; stamina: number; maxStamina: number } {
    const water = this.inventory.getWater();
    const maxWater = this.inventory.getWaterCapacity();
    const coins = this.inventory.getState().coins;
    const staminaState = this.staminaSystem?.getState() ?? { current: 100, maximum: 100 };
    return {
      water,
      maxWater,
      seeds: this.hudDisplaySeedCount,
      seedType: this.hudDisplaySeedType,
      coins,
      stamina: staminaState.current,
      maxStamina: staminaState.maximum,
    };
  }

  public getInventoryView(): { items: Array<{ kind: 'seed'; plantType: 'eye' | 'tentacle' | 'jaws' | 'spike' | 'orb' | 'mushroom'; count: number } | { kind: 'tool'; toolType?: 'hoe' | 'wrench'; count: number } | null>; selectedIndex: number } {
    return { items: this.playerInventorySlots, selectedIndex: this.selectedInventorySlotIndex };
  }

  public isInteriorScene(): boolean {
    return this.isInsideBuilding;
  }


  private moveSelection(dir: number): void {
    const n = this.playerInventorySlots.length;
    this.selectedInventorySlotIndex = (this.selectedInventorySlotIndex + dir + n) % n;
  }

  private hasAnySeeds(): boolean {
    for (const it of this.playerInventorySlots) { if (it && it.kind === 'seed' && it.count > 0) return true; }
    return false;
  }

  private consumeOneSeed(): void {
    // Prefer selected slot if it is seeds
    let idx = this.selectedInventorySlotIndex;
    if (!(this.playerInventorySlots[idx] && this.playerInventorySlots[idx]!.kind === 'seed' && (this.playerInventorySlots[idx] as any).count > 0)) {
      idx = this.playerInventorySlots.findIndex(it => it && it.kind === 'seed' && it.count > 0);
      if (idx < 0) return;
    }
    const it = this.playerInventorySlots[idx] as any;
    it.count -= 1;
    if (it.count <= 0) this.playerInventorySlots[idx] = null;
  }

  private useSelectedItem(): void {
    const it = this.playerInventorySlots[this.selectedInventorySlotIndex];
    if (!it) { this.pushNotification('Empty slot'); return; }
    if (it.kind === 'seed') {
      const player = this.playerMovement.getPlayerCharacter();
      const plantingPosition = this.calculatePlantingPosition(player);
      if (!this.isDirtTileAtWorld(plantingPosition.x, plantingPosition.y)) {
        this.pushNotification('You can only plant in dirt');
        return;
      }
      const planted = this.plantManagement.handlePlantingClick(plantingPosition, it.plantType as any);
      if (planted) {
        this.consumeOneSeed();
      } else {
        this.pushNotification('Too close to another plant');
      }
    } else {
      const tool = it as any;
      if (tool.toolType === 'hoe') {
        this.applyHoe();
      } else {
        this.pushNotification('Used tool');
      }
    }
  }

  private getSelectedSeedType(): 'eye' | 'tentacle' | 'jaws' | 'spike' | 'orb' | 'mushroom' | null {
    const it = this.playerInventorySlots[this.selectedInventorySlotIndex];
    if (it && it.kind === 'seed' && it.count > 0) return it.plantType;
    const idx = this.playerInventorySlots.findIndex(s => s && s.kind === 'seed' && s.count > 0);
    if (idx >= 0) return (this.playerInventorySlots[idx] as any).plantType;
    return null;
  }

  private setupPlantingInput(): void {
    // Handle P key for planting
    let lastPlantTime = 0;
    const PLANT_COOLDOWN = 500; // 500ms cooldown between plants

    const plantingHandler = () => {
      if (this.keyboardInput.isKeyPressed('p')) {
        const currentTime = performance.now();
        if (currentTime - lastPlantTime > PLANT_COOLDOWN) {
          const player = this.playerMovement.getPlayerCharacter();
          const plantingPosition = this.calculatePlantingPosition(player);
          if (this.hasAnySeeds()) {
            if (!this.isDirtTileAtWorld(plantingPosition.x, plantingPosition.y)) {
              this.pushNotification('You can only plant in dirt');
              lastPlantTime = currentTime; // debounce to avoid spam
              return;
            }
            const seedType = this.getSelectedSeedType();
            const planted = this.plantManagement.handlePlantingClick(plantingPosition, seedType ?? undefined);
            if (planted) this.consumeOneSeed(); else this.pushNotification('Too close to another plant');
          } else {
            this.pushNotification('No seeds');
          }
          lastPlantTime = currentTime;
        }
      }
    };

    // Check for P key every frame (will be called in game loop)
    this.plantingInputHandler = plantingHandler;
  }

  

  private setupHarvestingInput(): void {
    // Handle H key for harvesting mature plants
    let lastHarvestTime = 0;
    const HARVEST_COOLDOWN = 350; // ms between harvests
    const HARVEST_REACH = TILE_CONFIG.tileSize * 1.25;

    const harvestHandler = () => {
      if (this.keyboardInput.isKeyPressed('h')) {
        const now = performance.now();
        if (now - lastHarvestTime > HARVEST_COOLDOWN) {
          const player = this.playerMovement.getPlayerCharacter();
          const target = this.calculatePlantingPosition(player);
          // Prefer tile-accurate: find plant reference without removing
          const tx = Math.floor(target.x / TILE_CONFIG.tileSize);
          const ty = Math.floor(target.y / TILE_CONFIG.tileSize);
          let targetPlant: PlantEntity | null = this.plantManagement.findMatureAtTile(tx, ty, TILE_CONFIG.tileSize);
          if (!targetPlant) {
            // fallback to distance-based find
            targetPlant = this.plantManagement.findNearestMature(target, HARVEST_REACH);
          }
          if (targetPlant) {
            // Spawn slash effect centered on player feet
            const spriteCfg = this.playerRenderer.getSpriteConfiguration();
            const displayHeight = spriteCfg.frameHeight * RENDER_CONFIG.playerScale;
            const baselineY = player.yPosition + displayHeight / 2;
            const targetHeight = Math.floor(displayHeight * HARVEST_EFFECT_CONFIG.scale);
            const row = player.currentRow; // up,left,down,right mapping
            this.activeVisualEffects.push({ x: player.xPosition, baselineY, startTime: now, kind: 'slash', row, targetHeight, targetPlant });
          }
          lastHarvestTime = now;
        }
      }
    };

    this.harvestingInputHandler = harvestHandler;
  }

  private handleWatering(): void {
    const player = this.playerMovement.getPlayerCharacter();
    const now = performance.now();
    const spriteCfg = this.playerRenderer.getSpriteConfiguration();
    if (!spriteCfg.frameHeight) return;
    // Require water to perform watering
    if (!this.inventory.useWater(1)) {
      this.pushNotification('Out of water');
      return;
    }
    const displayHeight = spriteCfg.frameHeight * RENDER_CONFIG.playerScale;
    const baselineY = player.yPosition + displayHeight / 2;
    const targetHeight = Math.floor(displayHeight * WATER_EFFECT_CONFIG.scale);
    const row = player.currentRow;
    this.activeVisualEffects.push({ x: player.xPosition, baselineY, startTime: now, kind: 'water', row, targetHeight });
    // Attempt to water nearby tiles: forward, current, and orthogonal neighbors
    const tile = TILE_CONFIG.tileSize;
    const feetX = player.xPosition;
    const feetY = player.yPosition + displayHeight / 2;
    const ftX = Math.floor(feetX / tile);
    const ftY = Math.floor(feetY / tile);
    let fwdX = ftX, fwdY = ftY;
    switch (player.currentRow) {
      case SPRITE_DIRECTIONS.up:    fwdY = ftY - 1; break;
      case SPRITE_DIRECTIONS.down:  fwdY = ftY + 1; break;
      case SPRITE_DIRECTIONS.left:  fwdX = ftX - 1; break;
      case SPRITE_DIRECTIONS.right: fwdX = ftX + 1; break;
    }
    const candidates: Array<{x:number;y:number}> = [
      { x: fwdX, y: fwdY },
      { x: ftX,  y: ftY },
      { x: ftX - 1, y: ftY },
      { x: ftX + 1, y: ftY },
      { x: ftX, y: ftY - 1 },
      { x: ftX, y: ftY + 1 },
    ];
    let watered = false;
    for (const c of candidates) {
      if (this.plantManagement.waterAtTile(c.x, c.y, tile)) { watered = true; break; }
    }
    if (!watered) {
      // final fallback around feet to catch any off-grid placements
      this.plantManagement.waterNearest({ x: feetX, y: feetY }, tile * 0.95);
    } else {
      this.pushNotification('Watered');
    }
  }

  private plantingInputHandler?: () => void;

  private calculatePlantingPosition(player: PlayerCharacter): { x: number; y: number } {
    // Place seed in the adjacent tile next to the player's feet
    const tile = TILE_CONFIG.tileSize;

    // Determine feet position from player center and sprite display size
    const spriteCfg = this.playerRenderer.getSpriteConfiguration();
    const displayHeight = spriteCfg.frameHeight * RENDER_CONFIG.playerScale;
    const feetX = player.xPosition;
    const feetY = player.yPosition + displayHeight / 2;

    // Current feet tile indices
    let tx = Math.floor(feetX / tile);
    let ty = Math.floor(feetY / tile);

    // Move to adjacent tile based on facing direction
    switch (player.currentRow) {
      case SPRITE_DIRECTIONS.up:
        ty -= 1;
        break;
      case SPRITE_DIRECTIONS.down:
        ty += 1;
        break;
      case SPRITE_DIRECTIONS.left:
        tx -= 1;
        break;
      case SPRITE_DIRECTIONS.right:
        tx += 1;
        break;
      default:
        ty += 1; // default forward
        break;
    }

    // Clamp to world tile bounds
    tx = Math.max(0, Math.min(WORLD_CONFIG.widthTiles - 1, tx));
    ty = Math.max(0, Math.min(WORLD_CONFIG.heightTiles - 1, ty));

    // Return the world position at the center of that tile
    return {
      x: (tx + 0.5) * tile,
      y: (ty + 0.5) * tile,
    };
  }

  private initializeSpriteDimensions(): void {
    const spriteWidth = this.gameAssets.playerSprite.naturalWidth;
    const spriteHeight = this.gameAssets.playerSprite.naturalHeight;

    this.playerMovement.initializeSpriteDimensions(spriteWidth, spriteHeight);
    this.playerRenderer.initializeSpriteDimensions(
      spriteWidth,
      spriteHeight,
      SPRITE_SHEET_CONFIG.columns,
      SPRITE_SHEET_CONFIG.rows
    );

    console.log(`Loaded sprite sheet: ${spriteWidth}x${spriteHeight} → frame ${Math.floor(spriteWidth / SPRITE_SHEET_CONFIG.columns)}x${Math.floor(spriteHeight / SPRITE_SHEET_CONFIG.rows)} (grid ${SPRITE_SHEET_CONFIG.columns}x${SPRITE_SHEET_CONFIG.rows})`);
  }

  private gameLoop(currentTimestamp: number): void {
    if (!this.isGameRunning) return;

    const deltaTimeSeconds = (currentTimestamp - this.previousFrameTimestamp) / 1000;
    this.previousFrameTimestamp = currentTimestamp;

    this.updateGameState(deltaTimeSeconds);
    this.renderFrame();

    requestAnimationFrame(this.gameLoop.bind(this));
  }

  private updateGameState(deltaTimeSeconds: number): void {
    // Handle background toggle
    if (this.keyboardInput.isKeyPressed('b')) {
      this.backgroundRenderer.setUseBarrenBackground(
        !this.backgroundRenderer.isUsingBarrenBackground()
      );
    }

    // Handle planting input
    if (this.plantingInputHandler && !this.isShopOpen) {
      this.plantingInputHandler();
    }
    // Handle interactions (E key) on key-down edge to avoid spamming
    const ePressed = this.keyboardInput.isKeyPressed('e');
    if (ePressed && !this.wasInteractionKeyPressed) {
      this.handleInteractions();
    }
    this.wasInteractionKeyPressed = ePressed;
    // Handle watering (Q key) on key-down edge
    const qPressed = this.keyboardInput.isKeyPressed('q');
    if (qPressed && !this.wasQuitShopKeyPressed && !this.isShopOpen) {
      this.handleWatering();
    }
    this.wasQuitShopKeyPressed = qPressed;
    // Handle harvesting input
    if (this.harvestingInputHandler && !this.isShopOpen) {
      this.harvestingInputHandler();
    }

    // Shop input handling
    if (this.isShopOpen) {
      this.handleShopInput();
    } else {
      // Inventory selection only when shop closed
      const left = this.keyboardInput.isKeyPressed('arrowleft');
      const right = this.keyboardInput.isKeyPressed('arrowright');
      if (left && !this.wasLeftArrowPressed) this.moveSelection(-1);
      if (right && !this.wasRightArrowPressed) this.moveSelection(1);
      this.wasLeftArrowPressed = left;
      this.wasRightArrowPressed = right;

      const space = this.keyboardInput.isKeyPressed(' ');
      if (space && !this.wasSpaceKeyPressed) this.useSelectedItem();
      this.wasSpaceKeyPressed = space;
    }

    const space = this.keyboardInput.isKeyPressed(' ');
    if (space && !this.wasSpaceKeyPressed) this.useSelectedItem();
    this.wasSpaceKeyPressed = space;

    // If it's raining outside, water all unwatered seeds automatically
    if (this.isRainingOutside()) {
      this.plantManagement.waterAllUnwatered();
    }

    // Update stamina system
    this.staminaSystem?.update();

    // Update fade transition state
    if (this.fadeTransitionState.active) {
      const now = performance.now();
      const t = now - this.fadeTransitionState.startTime;
      if (!this.fadeTransitionState.midPointFired && t >= this.fadeTransitionState.duration / 2) {
        this.fadeTransitionState.midPointFired = true;
        // Switch maps at midpoint
        const fn = this.fadeTransitionState.onMidPointCallback;
        if (fn) Promise.resolve(fn()).catch(err => console.error('Transition mid callback failed', err));
      }
      if (t >= this.fadeTransitionState.duration) {
        this.fadeTransitionState.active = false;
        this.fadeTransitionState.onMidPointCallback = undefined;
      }
    }


    // Update collisions (house base as a blocking rect)
    this.updateWorldCollisions();

    // Update game systems
    this.playerMovement.updatePlayerMovement(deltaTimeSeconds);
    this.plantManagement.updatePlantGrowth();
    // Follow camera to player
    const p = this.playerMovement.getPlayerCharacter();
    if (this.camera) this.camera.follow(p.xPosition, p.yPosition);
  }

  private isRainingOutside(): boolean {
    try {
      const w = (window as any).currentWeather;
      return !this.isInsideBuilding && w === 'storm';
    } catch (_) { return false; }
  }

  private updateWorldCollisions(): void {
    if (this.isInsideBuilding) {
      // In interior scene, use only static collisions (none by default)
      this.playerMovement.setCollisionRects(this.staticCollisionRects);
      return;
    }
    const base = this.gameAssets.buildings?.playerHouseBase;
    if (!base || !base.complete || base.naturalWidth === 0) {
      this.playerMovement.setCollisionRects(this.staticCollisionRects);
      return;
    }
    const dw = base.naturalWidth;
    const dh = base.naturalHeight;
    const dx = Math.floor(this.houseWorldPosition.x - Math.floor(dw / 2));
    const dy = Math.floor(this.houseWorldPosition.y - dh);
    // Tight collision crop (222x100 at 1x), anchored to bottom-center
    const cropW = RENDER_CONFIG.playerHouseCollisionSize.width;
    const cropH = RENDER_CONFIG.playerHouseCollisionSize.height;
    const cx = Math.floor((dx + dw / 2) - cropW / 2);
    const cy = Math.floor(dy + dh - cropH);
    const combined = [...this.staticCollisionRects, { x: cx, y: cy, w: cropW, h: cropH }];
    if (this.storefrontCollisionBox) combined.push(this.storefrontCollisionBox);
    this.playerMovement.setCollisionRects(combined);
  }

  private buildInteractionAreas(): void {
    if (!this.worldMap) return;
    const tile = TILE_CONFIG.tileSize;
    const baseLayerOffset = { x: this.centerOriginPosition.x, y: this.centerOriginPosition.y };
    const areas: Array<{ x: number; y: number; w: number; h: number; kind: 'well' | 'ship' | 'enterHouse' | 'exitHouse' | 'bed' | 'storefront' }> = [];
    const addFromLayer = (name: string, kind: 'well' | 'ship' | 'bed') => {
      const layer = this.worldMap!.layers.find(l => l.name === name);
      if (!layer) return;
      const w = layer.width, h = layer.height;
      for (let ty = 0; ty < h; ty++) {
        for (let tx = 0; tx < w; tx++) {
          if (layer.data[ty * w + tx]) {
            areas.push({ x: baseLayerOffset.x + tx * tile, y: baseLayerOffset.y + ty * tile, w: tile, h: tile, kind });
          }
        }
      }
    };
    addFromLayer('interactWell', 'well');
    addFromLayer('interactShip', 'ship');
    if (this.isInsideBuilding) {
      addFromLayer('interactBed', 'bed');
    }
    if (!this.isInsideBuilding) {
      // Add house door interaction in front of the house base (approximate center tile)
      const doorX = Math.floor(this.houseWorldPosition.x - tile / 2);
      const doorY = Math.floor(this.houseWorldPosition.y - tile);
      areas.push({ x: doorX, y: doorY, w: tile, h: tile, kind: 'enterHouse' });
      // Storefront interact areas on all sides (perimeter of its collision rect)
      if (this.storefrontCollisionBox) {
        const s = this.storefrontCollisionBox;
        const startTx = Math.floor(s.x / tile);
        const endTx = Math.floor((s.x + s.w - 1) / tile);
        const startTy = Math.floor(s.y / tile);
        const endTy = Math.floor((s.y + s.h - 1) / tile);
        // Top and bottom rows
        for (let txi = startTx; txi <= endTx; txi++) {
          areas.push({ x: txi * tile, y: startTy * tile, w: tile, h: tile, kind: 'storefront' });
          areas.push({ x: txi * tile, y: endTy * tile, w: tile, h: tile, kind: 'storefront' });
        }
        // Left and right columns
        for (let tyi = startTy; tyi <= endTy; tyi++) {
          areas.push({ x: startTx * tile, y: tyi * tile, w: tile, h: tile, kind: 'storefront' });
          areas.push({ x: endTx * tile, y: tyi * tile, w: tile, h: tile, kind: 'storefront' });
        }
      }
    }
    if (this.isInsideBuilding && this.worldMap) {
      // Exit interaction at Tiled tile (1,6)
      const originX = (this.worldMap as any).originX ?? 0;
      const originY = (this.worldMap as any).originY ?? 0;
      const exitTileX = Math.max(0, Math.min(this.worldMap.widthTiles - 1, 1 - originX));
      const exitTileY = Math.max(0, Math.min(this.worldMap.heightTiles - 1, 6 - originY));
      const exitX = exitTileX * tile;
      const exitY = exitTileY * tile;
      areas.push({ x: exitX, y: exitY, w: tile, h: tile, kind: 'exitHouse' });
    }
    this.interactionAreas = areas;
    // Leave collisions to world/house geometry; interactions are not collidable
  }

  private handleInteractions(): void {
    const near = this.getFeetAdjacentInteraction();
    if (!near) return;
    if (near.kind === 'enterHouse') {
      this.enterHouse();
    } else if (near.kind === 'exitHouse') {
      this.exitHouse();
    } else if (near.kind === 'storefront') {
      this.isShopOpen = true;
      this.selectedShopItemIndex = 0;
    } else if (near.kind === 'bed') {
      this.sleepAtBed();
    } else if (near.kind === 'ship') {
      const { items, coins } = this.computeSalePreview();
      if (items <= 0 || coins <= 0) {
        this.pushNotification('Nothing to ship');
        return;
      }
      const res = this.inventory.sellAllPlants(PLANT_PRICES as any);
      this.pushNotification(`Shipped ${items} for ${res.coinsGained} coins`);
      // After a successful sale, suppress the immediate 'Nothing to ship' prompt
      // while the player remains in range. It will show again after they leave and return.
      this.shouldSuppressEmptyShipPrompt = true;
    } else if (near.kind === 'well') {
      const before = this.inventory.getWater();
      this.inventory.refillWater();
      const after = this.inventory.getWater();
      if (after > before) this.pushNotification('Water refilled');
    }
  }

  // No longer used: adjacency check handles interactions more reliably with collidable tiles

  private renderFrame(): void {
    // Clear canvas
    this.renderingContext.clearRect(0, 0, this.canvas.width, this.canvas.height);

    // Render Tiled map if available; otherwise background
    if (this.worldMap) {
      const tile = TILE_CONFIG.tileSize;
      const chunkW = this.worldMap.widthTiles * tile;
      const chunkH = this.worldMap.heightTiles * tile;
      // Base map
      this.tilemapRenderer.render(this.worldMap, { x: this.camera.x, y: this.camera.y }, { x: this.centerOriginPosition.x, y: this.centerOriginPosition.y });
      if (!this.isInsideBuilding) {
        // Exterior world repeats surrounding chunks for endless feel
        const layers = ['baseGround', 'detailsGround'];
        this.tilemapRenderer.renderFiltered(this.worldMap, layers, { x: this.camera.x, y: this.camera.y }, { x: this.centerOriginPosition.x - chunkW, y: this.centerOriginPosition.y });
        this.tilemapRenderer.renderFiltered(this.worldMap, layers, { x: this.camera.x, y: this.camera.y }, { x: this.centerOriginPosition.x + chunkW, y: this.centerOriginPosition.y });
        this.tilemapRenderer.renderFiltered(this.worldMap, layers, { x: this.camera.x, y: this.camera.y }, { x: this.centerOriginPosition.x, y: this.centerOriginPosition.y - chunkH });
        this.tilemapRenderer.renderFiltered(this.worldMap, layers, { x: this.camera.x, y: this.camera.y }, { x: this.centerOriginPosition.x, y: this.centerOriginPosition.y + chunkH });
        // Corners
        this.tilemapRenderer.renderFiltered(this.worldMap, layers, { x: this.camera.x, y: this.camera.y }, { x: this.centerOriginPosition.x - chunkW, y: this.centerOriginPosition.y - chunkH });
        this.tilemapRenderer.renderFiltered(this.worldMap, layers, { x: this.camera.x, y: this.camera.y }, { x: this.centerOriginPosition.x + chunkW, y: this.centerOriginPosition.y - chunkH });
        this.tilemapRenderer.renderFiltered(this.worldMap, layers, { x: this.camera.x, y: this.camera.y }, { x: this.centerOriginPosition.x - chunkW, y: this.centerOriginPosition.y + chunkH });
        this.tilemapRenderer.renderFiltered(this.worldMap, layers, { x: this.camera.x, y: this.camera.y }, { x: this.centerOriginPosition.x + chunkW, y: this.centerOriginPosition.y + chunkH });
      }
    } else {
      this.backgroundRenderer.renderBackground(
        this.gameAssets,
        this.assetLoader.isBarrenAvailable()
      );
    }

    // Render building bases (below player) only in exterior
    if (!this.isInsideBuilding) {
      this.buildingRenderer.renderBuildingBases(this.gameAssets, { x: this.camera.x, y: this.camera.y }, this.houseWorldPosition);
      // Render storefront prop (bones) below player
      const imgStore = this.storefrontImage;
      if (imgStore && imgStore.complete && imgStore.naturalWidth > 0 && imgStore.naturalHeight > 0) {
        const dx = Math.floor(this.storefrontWorldPosition.x - Math.floor(imgStore.naturalWidth / 2) - this.camera.x);
        const dy = Math.floor(this.storefrontWorldPosition.y - imgStore.naturalHeight - this.camera.y);
        this.renderingContext.drawImage(imgStore, dx, dy);
      }
    }

    // Render plants
    this.plantRenderer.renderAllPlants(
      this.plantManagement.getPlantedEntities(),
      this.gameAssets,
      { x: this.camera.x, y: this.camera.y }
    );

    // Render player character unless an effect should replace idle
    const playerForRender = this.playerMovement.getPlayerCharacter();
    const replaceIdle = this.sleepWorldAnim.active || (!playerForRender.isMoving && (this.isEffectActive('slash') || this.isEffectActive('water')));
    if (!replaceIdle) {
      this.playerRenderer.renderPlayerCharacter(
        playerForRender,
        this.gameAssets,
        { x: this.camera.x, y: this.camera.y }
      );
    }

    // Render effects (slash) above player
    this.renderEffects();

    // Render sleep collapse in world-space (replaces player when active)
    this.renderSleepEffectWorld();

    // Render building roofs (above player) only in exterior
    if (!this.isInsideBuilding) {
      this.buildingRenderer.renderBuildingRoofs(this.gameAssets, { x: this.camera.x, y: this.camera.y }, this.houseWorldPosition);
    }

    // HUD and prompts (screen-space)
    this.renderHUD();
  }

  private renderEffects(): void {
    const now = performance.now();
    const ctx = this.renderingContext;
    const img = this.gameAssets.harvestSlashSprite;
    if (!img || !img.complete || img.naturalWidth === 0 || img.naturalHeight === 0) {
      this.activeVisualEffects = [];
      return;
    }
    const { columns: hCols, rows: hRows } = HARVEST_EFFECT_CONFIG;
    const frameWSlash = Math.floor(img.naturalWidth / hCols);
    const frameHSlash = Math.floor(img.naturalHeight / hRows);

    const effectsLeft: typeof this.activeVisualEffects = [];
    for (const e of this.activeVisualEffects) {
      const elapsed = (now - e.startTime) / 1000;
      const isSlash = e.kind === 'slash';
      const cfg = isSlash ? HARVEST_EFFECT_CONFIG : WATER_EFFECT_CONFIG;
      const imgKind = isSlash ? this.gameAssets.harvestSlashSprite : this.gameAssets.waterSprite;
      const secPerFrame = 1 / cfg.framesPerSecond;
      const frameW = isSlash ? frameWSlash : Math.floor(imgKind.naturalWidth / cfg.columns);
      const frameH = isSlash ? frameHSlash : Math.floor(imgKind.naturalHeight / cfg.rows);
      const frameIndex = Math.floor(elapsed / secPerFrame);
      if (frameIndex >= cfg.columns) {
        if (e.kind === 'slash' && e.targetPlant) {
          if (this.plantManagement.removePlant(e.targetPlant)) {
            this.inventory.addPlant(e.targetPlant.plantType);
          }
        }
        continue; // finished
      }
      effectsLeft.push(e);
      const col = frameIndex % cfg.columns;
      const row = Math.max(0, Math.min(cfg.rows - 1, e.row));
      const sx = col * frameW;
      const sy = row * frameH;
      const dh = Math.max(1, Math.floor(e.targetHeight));
      const dw = Math.max(1, Math.floor((frameW / frameH) * dh));
      ctx.save();
      // Camera-aware: draw in world space
      ctx.translate(-this.camera.x, -this.camera.y);
      ctx.globalAlpha = 0.95;
      ctx.drawImage(
        imgKind,
        sx, sy, frameW, frameH,
        Math.round(e.x - dw / 2),
        Math.round(e.baselineY - dh),
        dw, dh
      );
      ctx.restore();
    }
    this.activeVisualEffects = effectsLeft;
  }

  // hasActiveSlashEffect superseded by isEffectActive(kind)

  private isEffectActive(kind: 'slash' | 'water'): boolean {
    const now = performance.now();
    const cfg = kind === 'slash' ? HARVEST_EFFECT_CONFIG : WATER_EFFECT_CONFIG;
    const secPerFrame = 1 / cfg.framesPerSecond;
    for (const e of this.activeVisualEffects) {
      if (e.kind !== kind) continue;
      const elapsed = (now - e.startTime) / 1000;
      if (Math.floor(elapsed / secPerFrame) < cfg.columns) return true;
    }
    return false;
  }

  private renderHUD(): void {
    const ctx = this.renderingContext;
    // Draw only fade overlay here; other HUD is drawn on the HUD canvas overlay
    if (this.fadeTransitionState.active) {
      const now = performance.now();
      const t = Math.max(0, Math.min(1, (now - this.fadeTransitionState.startTime) / this.fadeTransitionState.duration));
      const alpha = t < 0.5 ? (t / 0.5) : (1 - (t - 0.5) / 0.5);
      ctx.save();
      ctx.globalAlpha = Math.max(0, Math.min(1, alpha));
      ctx.fillStyle = '#000000';
      ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);
      ctx.restore();
    }

  }


  private getInteractionPrompt(): string | null {
    const near = this.getFeetAdjacentInteraction();
    if (!near) {
      // Reset suppression when player leaves interaction range
      this.shouldSuppressEmptyShipPrompt = false;
      return null;
    }
    if (near.kind === 'enterHouse') return 'Press E to enter house';
    if (near.kind === 'exitHouse') return 'Press E to exit house';
    if (near.kind === 'storefront') return 'Press E to open store';
    if (near.kind === 'bed') return 'Press E to sleep';
    if (near.kind === 'ship') {
      const { items, coins } = this.computeSalePreview();
      if (items > 0) return `Press E to ship ${items} for ${coins} coins`;
      // Items are empty
      return this.shouldSuppressEmptyShipPrompt ? null : 'Nothing to ship';
    }
    if (near.kind === 'well') return 'Press E to fill water (TODO)';
    return null;
  }

  public getOverlayTexts(): { prompt: string | null; notifications: string[] } {
    // Filter notifications and return texts for HUD overlay rendering
    const now = performance.now();
    this.gameNotifications = this.gameNotifications.filter(n => n.expirationTime > now);
    return {
      prompt: this.getInteractionPrompt(),
      notifications: this.gameNotifications.map(n => n.text),
    };
  }

  private getFeetAdjacentInteraction(): { kind: 'well' | 'ship' | 'enterHouse' | 'exitHouse' | 'bed' | 'storefront' } | null {
    const player = this.playerMovement.getPlayerCharacter();
    const spriteCfg = this.playerRenderer.getSpriteConfiguration();
    if (!spriteCfg.frameHeight) return null;
    const displayHeight = spriteCfg.frameHeight * RENDER_CONFIG.playerScale;
    const feetX = player.xPosition;
    const feetY = player.yPosition + displayHeight / 2;
    const tile = TILE_CONFIG.tileSize;
    const ftX = Math.floor(feetX / tile);
    const ftY = Math.floor(feetY / tile);
    // Adjacent if same tile or orthogonally neighboring tiles
    for (const a of this.interactionAreas) {
      const ax = Math.floor(a.x / tile);
      const ay = Math.floor(a.y / tile);
      const manhattan = Math.abs(ftX - ax) + Math.abs(ftY - ay);
      if (manhattan <= 1) { return { kind: a.kind as any }; }
    }
    return null;
  }

  private async enterHouse(): Promise<void> {
    this.startFadeTransition(async () => {
      try {
        const interior = await this.mapLoader.loadMap('/src/assets/maps/Interior1.tmx');
        this.worldMap = interior;
        this.isInsideBuilding = true;
        // Reset camera/world to interior extents
        const tile = TILE_CONFIG.tileSize;
        const worldW = interior.widthTiles * tile;
        const worldH = interior.heightTiles * tile;
        this.centerOriginPosition = { x: 0, y: 0 }; // interior drawn at world origin
        this.camera.setWorldSize(worldW, worldH);
        this.playerMovement.setWorldSize(worldW, worldH);
        // Spawn at door inside. Current spawn reported is too far bottom-right.
        // Adjust by moving 8 tiles left and 7 tiles up from the previous spot.
        // Spawn using Tiled tile coordinates (hover shows `1,5`).
        // Our stitched arrays start at (originX, originY) in Tiled's global tile space.
        const originX = (interior as any).originX ?? 0;
        const originY = (interior as any).originY ?? 0;
        // Spawn at Tiled tile (1,4)
        let spawnTileX = 1 - originX;
        let spawnTileY = 4 - originY;
        // Clamp within map
        spawnTileX = Math.max(0, Math.min(interior.widthTiles - 1, spawnTileX));
        spawnTileY = Math.max(0, Math.min(interior.heightTiles - 1, spawnTileY));
        const p = this.playerMovement.getPlayerCharacter();
        p.xPosition = Math.floor((spawnTileX + 0.5) * tile);
        p.yPosition = Math.floor((spawnTileY + 0.5) * tile);
        this.camera.follow(p.xPosition, p.yPosition);
        // Interactions and collisions inside
        this.buildInteractionAreas();
        this.buildInteriorCollisions();
        this.updateWorldCollisions();
        this.pushNotification('Entered house');
      } catch (e) {
        console.error('Failed to load interior map', e);
        this.pushNotification('Failed to enter house');
      }
    });
  }

  private async exitHouse(): Promise<void> {
    this.startFadeTransition(async () => {
      try {
        const exterior = await this.mapLoader.loadMap('/src/assets/maps/homeMap.tmj');
        this.worldMap = exterior;
        this.isInsideBuilding = false;
        const tile = TILE_CONFIG.tileSize;
        const baseW = exterior.widthTiles * tile;
        const baseH = exterior.heightTiles * tile;
        this.centerOriginPosition = { x: baseW, y: baseH };
        const worldW = baseW * 3;
        const worldH = baseH * 3;
        this.camera.setWorldSize(worldW, worldH);
        this.playerMovement.setWorldSize(worldW, worldH);
        // Place player outside the door, just below the house
        const p = this.playerMovement.getPlayerCharacter();
        const outX = this.centerOriginPosition.x + Math.floor((HOUSE_CONFIG.tileX + 0.5) * tile);
        const outY = this.centerOriginPosition.y + Math.floor((HOUSE_CONFIG.tileY + 2) * tile);
        p.xPosition = outX;
        p.yPosition = outY;
        this.camera.follow(p.xPosition, p.yPosition);
        // Recompute house world and interactions
        this.houseWorldPosition = { x: this.centerOriginPosition.x + Math.floor((HOUSE_CONFIG.tileX + 0.5) * tile), y: this.centerOriginPosition.y + Math.floor((HOUSE_CONFIG.tileY + 1) * tile) };
        // Restore exterior collision state (no static collisions on exterior map)
        this.staticCollisionRects = [];
        this.buildInteractionAreas();
        this.updateWorldCollisions();
        this.pushNotification('Exited house');
      } catch (e) {
        console.error('Failed to load exterior map', e);
        this.pushNotification('Failed to exit house');
      }
    });
  }

  private startFadeTransition(onMidPointCallback: () => Promise<void> | void, durationMs = 600): void {
    this.fadeTransitionState = { active: true, startTime: performance.now(), duration: durationMs, midPointFired: false, onMidPointCallback };
  }

  private buildInteriorCollisions(): void {
    if (!this.worldMap) return;
    // Rule: any tile that is NOT in the 'Floor' layer is non-walkable.
    const floor = this.worldMap.layers.find(l => l.name.toLowerCase() === 'floor');
    const tile = TILE_CONFIG.tileSize;
    const rects: Array<{ x: number; y: number; w: number; h: number }> = [];
    if (floor) {
      const w = floor.width, h = floor.height;
      for (let ty = 0; ty < h; ty++) {
        for (let tx = 0; tx < w; tx++) {
          const idx = ty * w + tx;
          const isFloor = (floor.data[idx] | 0) !== 0;
          if (!isFloor) {
            rects.push({ x: tx * tile, y: ty * tile, w: tile, h: tile });
          }
        }
      }
    }
    this.staticCollisionRects = rects;
    this.playerMovement.setCollisionRects(this.staticCollisionRects);
  }

  private sleepAtBed(): void {
    this.startFadeTransition(() => {
      // Use the stamina system to handle sleep
      this.staminaSystem?.sleep();
    }, 800);
  }

  private computeSalePreview(): { items: number; coins: number } {
    const inv = this.inventory.getState();
    let items = 0;
    let coins = 0;
    (Object.keys(inv.counts) as Array<keyof typeof inv.counts>).forEach(k => {
      const qty = inv.counts[k] || 0;
      items += qty;
      const price = (PLANT_PRICES as any)[k] || 0;
      coins += qty * price;
    });
    return { items, coins };
  }

  private pushNotification(text: string, durationMs = 1800): void {
    this.gameNotifications.push({ text, expirationTime: performance.now() + durationMs });
  }

  // Collision debug overlay removed per request

  // Utility methods for debugging
  public getGameStats(): any {
    return {
      isRunning: this.isGameRunning,
      assetsLoaded: this.assetLoader.areAllAssetsLoaded(),
      loadingProgress: this.assetLoader.getLoadingProgress(),
      plantCount: this.plantManagement.getPlantCount(),
      playerPosition: {
        x: this.playerMovement.getPlayerCharacter().xPosition,
        y: this.playerMovement.getPlayerCharacter().yPosition
      }
    };
  }


  public getAssets(): GameAssets {
    return this.gameAssets;
  }

  private handleShopInput(): void {
    // Navigation
    const up = this.keyboardInput.isKeyPressed('arrowup');
    const down = this.keyboardInput.isKeyPressed('arrowdown');
    if (up && !this.wasUpArrowPressed) {
      this.selectedShopItemIndex = (this.selectedShopItemIndex - 1 + this.availableShopItems.length) % this.availableShopItems.length;
    }
    if (down && !this.wasDownArrowPressed) {
      this.selectedShopItemIndex = (this.selectedShopItemIndex + 1) % this.availableShopItems.length;
    }
    this.wasUpArrowPressed = up;
    this.wasDownArrowPressed = down;

    // Purchase
    const enter = this.keyboardInput.isKeyPressed('enter');
    if (enter && !this.wasEnterKeyPressed) {
      const item = this.availableShopItems[this.selectedShopItemIndex];
      if (this.inventory.spendCoins(item.price)) {
        this.addSeedsToInventory(item.plantType, 1);
        this.pushNotification(`Bought ${item.plantType} seed`);
      } else {
        this.pushNotification('Not enough coins');
      }
    }
    this.wasEnterKeyPressed = enter;

    // Close
    const esc = this.keyboardInput.isKeyPressed('escape');
    if (esc && !this.wasEscapeKeyPressed) {
      this.isShopOpen = false;
    }
    this.wasEscapeKeyPressed = esc;
  }

  private addSeedsToInventory(plantType: 'eye' | 'tentacle' | 'jaws' | 'spike' | 'orb' | 'mushroom', amount: number): void {
    // Find slot with same seed type
    let idx = this.playerInventorySlots.findIndex(it => it && it.kind === 'seed' && it.plantType === plantType);
    if (idx < 0) idx = this.playerInventorySlots.findIndex(it => it === null);
    if (idx < 0) { this.pushNotification('Inventory full'); return; }
    const existing = this.playerInventorySlots[idx];
    if (!existing) this.playerInventorySlots[idx] = { kind: 'seed', plantType, count: amount };
    else (existing as any).count += amount;
  }


  public getShopView(): { open: boolean; items: Array<{ plantType: 'eye' | 'tentacle' | 'jaws' | 'spike' | 'orb' | 'mushroom'; price: number }>; selectedIndex: number; coins: number } {
    return { open: this.isShopOpen, items: this.availableShopItems, selectedIndex: this.selectedShopItemIndex, coins: this.inventory.getCoins() };
  }



  // Randomize shop items for the current day/season
  public refreshShopItems(_day?: number, seasonIndex?: number): void {
    const catalog: Array<{ plantType: 'eye' | 'tentacle' | 'jaws' | 'spike' | 'orb' | 'mushroom'; basePrice: number }> = [
      { plantType: 'eye', basePrice: 8 },
      { plantType: 'tentacle', basePrice: 9 },
      { plantType: 'jaws', basePrice: 10 },
      { plantType: 'spike', basePrice: 11 },
      { plantType: 'orb', basePrice: 14 },
      { plantType: 'mushroom', basePrice: 6 },
    ];
    // Shuffle
    for (let i = catalog.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [catalog[i], catalog[j]] = [catalog[j], catalog[i]];
    }
    const count = 3 + Math.floor(Math.random() * 2); // 3 or 4
    const pick = catalog.slice(0, count);
    const s = seasonIndex !== undefined ? ((seasonIndex % 4) + 4) % 4 : undefined;
    this.availableShopItems = pick.map(p => {
      let delta = Math.floor(Math.random() * 5) - 2; // -2..+2
      if (s !== undefined) {
        if (s === 0 && p.plantType === 'mushroom') delta -= 1; // spring
        if (s === 2 && p.plantType === 'jaws') delta -= 1; // autumn
        if (s === 1 && p.plantType === 'spike') delta += 1; // summer
        if (s === 3 && p.plantType === 'orb') delta += 1;   // winter
      }
      return { plantType: p.plantType, price: Math.max(1, p.basePrice + delta) };
    });
    this.selectedShopItemIndex = 0;
  }


  private applyHoe(): void {
    if (!this.worldMap) return;
    const tileSize = TILE_CONFIG.tileSize;
    const player = this.playerMovement.getPlayerCharacter();
    const target = this.calculatePlantingPosition(player);
    const cx = Math.floor((target.x - this.centerOriginPosition.x) / tileSize);
    const cy = Math.floor((target.y - this.centerOriginPosition.y) / tileSize);
    if (cx < 0 || cy < 0 || cx >= this.worldMap.widthTiles || cy >= this.worldMap.heightTiles) return;

    // Mark a full 3x3 patch centered at (cx, cy) as hoed
    const minX = Math.max(0, cx - 1);
    const maxX = Math.min(this.worldMap.widthTiles - 1, cx + 1);
    const minY = Math.max(0, cy - 1);
    const maxY = Math.min(this.worldMap.heightTiles - 1, cy + 1);
    const layer = this.worldMap.layers.find(l => l.name.toLowerCase().includes('dirt'));
    let centerGid = 0;
    const ts = this.worldMap.tilesets.find(t => t.tilewidth === 16 && t.tileheight === 16 && t.columns === 17 && (t as any).image?.naturalWidth === 272 && (t as any).image?.naturalHeight === 912);
    if (ts) centerGid = ts.firstgid + 359; // center localId
    for (let ty = minY; ty <= maxY; ty++) {
      for (let tx = minX; tx <= maxX; tx++) {
        const key = `${tx},${ty}`;
        this.hoed.add(key);
        if (layer && centerGid) {
          const idx = ty * this.worldMap.widthTiles + tx;
          if ((layer.data[idx] | 0) === centerGid) {
            this.lockedHoed.add(key);
          }
        }
      }
    }
    // Retile the 3x3 patch and a 2-tile perimeter around it for smooth edges across connections
    const rminX = Math.max(0, minX - 2);
    const rmaxX = Math.min(this.worldMap.widthTiles - 1, maxX + 2);
    const rminY = Math.max(0, minY - 2);
    const rmaxY = Math.min(this.worldMap.heightTiles - 1, maxY + 2);
    for (let ty = rminY; ty <= rmaxY; ty++) {
      for (let tx = rminX; tx <= rmaxX; tx++) {
        this.retileAt(tx, ty);
      }
    }
    this.pushNotification('Hoed');
  }

  private retileAt(tx: number, ty: number): void {
    if (!this.worldMap) return;
    if (tx < 0 || ty < 0 || tx >= this.worldMap.widthTiles || ty >= this.worldMap.heightTiles) return;
    const layer = this.worldMap.layers.find(l => l.name.toLowerCase().includes('dirt'));
    if (!layer) return;
    const idx = ty * this.worldMap.widthTiles + tx;
    const key = `${tx},${ty}`;
    if (!this.hoed.has(key)) {
      return;
    }
    const n = this.hoed.has(`${tx},${ty-1}`);
    const s = this.hoed.has(`${tx},${ty+1}`);
    const w = this.hoed.has(`${tx-1},${ty}`);
    const e = this.hoed.has(`${tx+1},${ty}`);
    const role = this.pickDirtRole(n, e, s, w);
    const gid = this.dirtRoleToGid(role);
    if (gid) layer.data[idx] = gid;
  }

  private pickDirtRole(n: boolean, e: boolean, s: boolean, w: boolean): 'center'|'edge_n'|'edge_e'|'edge_s'|'edge_w'|'corner_nw'|'corner_ne'|'corner_sw'|'corner_se' {
    // Determine outside neighbors (non-hoed) around this hoed tile
    const on = !n, oe = !e, os = !s, ow = !w;
    const outsideCount = (on?1:0) + (oe?1:0) + (os?1:0) + (ow?1:0);

    // Adjacent outside pair => corner tile (connects those two edges)
    if (on && ow) return 'corner_nw';
    if (ow && os) return 'corner_sw';
    if (os && oe) return 'corner_se';
    if (oe && on) return 'corner_ne';

    // Single outside => edge toward that outside
    if (outsideCount === 1) {
      if (on) return 'edge_n';
      if (oe) return 'edge_e';
      if (os) return 'edge_s';
      if (ow) return 'edge_w';
    }

    // Opposite outside (two) or none => center fallback
    return 'center';
  }

  private dirtRoleToGid(role: string): number | 0 {
    if (!this.worldMap) return 0;
    const ts = this.worldMap.tilesets.find(t => t.tilewidth === 16 && t.tileheight === 16 && t.columns === 17 && t.image.naturalWidth === 272 && t.image.naturalHeight === 912);
    if (!ts) return 0;
    const localMap: Record<string, number> = {
      center: 359,
      edge_w: 358,
      edge_s: 376,
      edge_e: 360,
      edge_n: 342,
      corner_nw: 341,
      corner_sw: 375,
      corner_se: 377,
      corner_ne: 343,
    };
    const lid = localMap[role] ?? 359;
    return ts.firstgid + lid;
  }
}
