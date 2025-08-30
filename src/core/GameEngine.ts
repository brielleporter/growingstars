/**
 * Main game engine that orchestrates all game systems
 */

import { GameAssets } from '../types/gameAssets.types';
import { SPRITE_SHEET_CONFIG, SPRITE_DIRECTIONS, RENDER_CONFIG, TILE_CONFIG, WORLD_CONFIG, HARVEST_EFFECT_CONFIG, WATER_EFFECT_CONFIG, HOUSE_CONFIG, PLANT_PRICES } from '../configuration/gameConstants';
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
  private interactionAreas: Array<{ x: number; y: number; w: number; h: number; kind: 'well' | 'ship' | 'enterHouse' | 'exitHouse' | 'bed' }>=[];
  private staticCollisionRects: Array<{ x: number; y: number; w: number; h: number }>=[];
  private camera!: Camera;
  private centerOrigin = { x: 0, y: 0 };
  private houseWorld = { x: 0, y: 0 };
  private isInterior = false;
  private fadeTransition: { active: boolean; start: number; duration: number; midFired: boolean; onMid?: () => Promise<void> | void } = { active: false, start: 0, duration: 600, midFired: false };

  // Game state
  private gameAssets!: GameAssets;
  private isRunning = false;
  private lastTimestamp = 0;
  private harvestingInputHandler?: () => void;
  private activeEffects: Array<{ x: number; baselineY: number; start: number; kind: 'slash' | 'water'; row: number; targetHeight: number; targetPlant?: PlantEntity }>=[];
  private notifications: Array<{ text: string; until: number }> = [];
  private wasEPressed = false;
  private suppressEmptyShipPrompt = false;
  private wasQPressed = false;
  private inventory: InventorySystem;

  constructor(canvasElementId: string) {
    const canvas = document.getElementById(canvasElementId) as HTMLCanvasElement;
    if (!canvas) {
      throw new Error(`Canvas element with id '${canvasElementId}' not found`);
    }

    const context = canvas.getContext('2d');
    if (!context) {
      throw new Error('Canvas 2D context not available');
    }

    this.canvas = canvas;
    this.renderingContext = context;
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
      const tile = TILE_CONFIG.tileSize;
      const baseW = this.worldMap.widthTiles * tile;
      const baseH = this.worldMap.heightTiles * tile;
      this.centerOrigin = { x: baseW, y: baseH };
      const worldW = baseW * 3;
      const worldH = baseH * 3;
      this.camera.setWorldSize(worldW, worldH);
      this.playerMovement.setWorldSize(worldW, worldH);
      // Place player at center of center chunk
      const p = this.playerMovement.getPlayerCharacter();
      p.xPosition = this.centerOrigin.x + Math.floor(baseW / 2);
      p.yPosition = this.centerOrigin.y + Math.floor(baseH / 2);
      this.camera.follow(p.xPosition, p.yPosition);
      // House world location inside center chunk
      const hx = this.centerOrigin.x + Math.floor((HOUSE_CONFIG.tileX + 0.5) * tile);
      const hy = this.centerOrigin.y + Math.floor((HOUSE_CONFIG.tileY + 1) * tile);
      this.houseWorld = { x: hx, y: hy };
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

    console.log('Game engine initialized successfully');
  }

  public start(): void {
    if (this.isRunning) {
      console.warn('Game is already running');
      return;
    }

    this.isRunning = true;
    this.lastTimestamp = performance.now();
    requestAnimationFrame(this.gameLoop.bind(this));
    console.log('Game started');
  }

  public stop(): void {
    this.isRunning = false;
    this.keyboardInput.cleanup();
    this.mouseInput.cleanup();
    console.log('Game stopped');
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
          this.plantManagement.handlePlantingClick(plantingPosition);
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
            this.activeEffects.push({ x: player.xPosition, baselineY, start: now, kind: 'slash', row, targetHeight, targetPlant });
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
    this.activeEffects.push({ x: player.xPosition, baselineY, start: now, kind: 'water', row, targetHeight });
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
    if (!this.isRunning) return;

    const deltaTimeSeconds = (currentTimestamp - this.lastTimestamp) / 1000;
    this.lastTimestamp = currentTimestamp;

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
    if (this.plantingInputHandler) {
      this.plantingInputHandler();
    }
    // Handle interactions (E key) on key-down edge to avoid spamming
    const ePressed = this.keyboardInput.isKeyPressed('e');
    if (ePressed && !this.wasEPressed) {
      this.handleInteractions();
    }
    this.wasEPressed = ePressed;
    // Handle watering (Q key) on key-down edge
    const qPressed = this.keyboardInput.isKeyPressed('q');
    if (qPressed && !this.wasQPressed) {
      this.handleWatering();
    }
    this.wasQPressed = qPressed;
    // Handle harvesting input
    if (this.harvestingInputHandler) {
      this.harvestingInputHandler();
    }

    // If it's raining outside, water all unwatered seeds automatically
    if (this.isRainingOutside()) {
      this.plantManagement.waterAllUnwatered();
    }

    // Update fade transition state
    if (this.fadeTransition.active) {
      const now = performance.now();
      const t = now - this.fadeTransition.start;
      if (!this.fadeTransition.midFired && t >= this.fadeTransition.duration / 2) {
        this.fadeTransition.midFired = true;
        // Switch maps at midpoint
        const fn = this.fadeTransition.onMid;
        if (fn) Promise.resolve(fn()).catch(err => console.error('Transition mid callback failed', err));
      }
      if (t >= this.fadeTransition.duration) {
        this.fadeTransition.active = false;
        this.fadeTransition.onMid = undefined;
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
      return !this.isInterior && w === 'storm';
    } catch (_) { return false; }
  }

  private updateWorldCollisions(): void {
    if (this.isInterior) {
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
    const dx = Math.floor(this.houseWorld.x - Math.floor(dw / 2));
    const dy = Math.floor(this.houseWorld.y - dh);
    // Tight collision crop (222x100 at 1x), anchored to bottom-center
    const cropW = RENDER_CONFIG.playerHouseCollisionSize.width;
    const cropH = RENDER_CONFIG.playerHouseCollisionSize.height;
    const cx = Math.floor((dx + dw / 2) - cropW / 2);
    const cy = Math.floor(dy + dh - cropH);
    const combined = [...this.staticCollisionRects, { x: cx, y: cy, w: cropW, h: cropH }];
    this.playerMovement.setCollisionRects(combined);
  }

  private buildInteractionAreas(): void {
    if (!this.worldMap) return;
    const tile = TILE_CONFIG.tileSize;
    const baseLayerOffset = { x: this.centerOrigin.x, y: this.centerOrigin.y };
    const areas: Array<{ x: number; y: number; w: number; h: number; kind: 'well' | 'ship' | 'enterHouse' | 'exitHouse' | 'bed' }> = [];
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
    if (this.isInterior) {
      addFromLayer('interactBed', 'bed');
    }
    if (!this.isInterior) {
      // Add house door interaction in front of the house base (approximate center tile)
      const doorX = Math.floor(this.houseWorld.x - tile / 2);
      const doorY = Math.floor(this.houseWorld.y - tile);
      areas.push({ x: doorX, y: doorY, w: tile, h: tile, kind: 'enterHouse' });
    }
    if (this.isInterior && this.worldMap) {
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
    } else if (near.kind === 'bed') {
      this.sleepAtBed();
    } else if (near.kind === 'ship') {
      const { items, coins } = this.computeSalePreview();
      if (items <= 0 || coins <= 0) {
        this.pushNotification('Nothing to ship');
        return;
      }
      const res = this.inventory.sellAll(PLANT_PRICES as any);
      this.pushNotification(`Shipped ${items} for ${res.coinsGained} coins`);
      // After a successful sale, suppress the immediate 'Nothing to ship' prompt
      // while the player remains in range. It will show again after they leave and return.
      this.suppressEmptyShipPrompt = true;
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
      this.tilemapRenderer.render(this.worldMap, { x: this.camera.x, y: this.camera.y }, { x: this.centerOrigin.x, y: this.centerOrigin.y });
      if (!this.isInterior) {
        // Exterior world repeats surrounding chunks for endless feel
        const layers = ['baseGround', 'detailsGround'];
        this.tilemapRenderer.renderFiltered(this.worldMap, layers, { x: this.camera.x, y: this.camera.y }, { x: this.centerOrigin.x - chunkW, y: this.centerOrigin.y });
        this.tilemapRenderer.renderFiltered(this.worldMap, layers, { x: this.camera.x, y: this.camera.y }, { x: this.centerOrigin.x + chunkW, y: this.centerOrigin.y });
        this.tilemapRenderer.renderFiltered(this.worldMap, layers, { x: this.camera.x, y: this.camera.y }, { x: this.centerOrigin.x, y: this.centerOrigin.y - chunkH });
        this.tilemapRenderer.renderFiltered(this.worldMap, layers, { x: this.camera.x, y: this.camera.y }, { x: this.centerOrigin.x, y: this.centerOrigin.y + chunkH });
        // Corners
        this.tilemapRenderer.renderFiltered(this.worldMap, layers, { x: this.camera.x, y: this.camera.y }, { x: this.centerOrigin.x - chunkW, y: this.centerOrigin.y - chunkH });
        this.tilemapRenderer.renderFiltered(this.worldMap, layers, { x: this.camera.x, y: this.camera.y }, { x: this.centerOrigin.x + chunkW, y: this.centerOrigin.y - chunkH });
        this.tilemapRenderer.renderFiltered(this.worldMap, layers, { x: this.camera.x, y: this.camera.y }, { x: this.centerOrigin.x - chunkW, y: this.centerOrigin.y + chunkH });
        this.tilemapRenderer.renderFiltered(this.worldMap, layers, { x: this.camera.x, y: this.camera.y }, { x: this.centerOrigin.x + chunkW, y: this.centerOrigin.y + chunkH });
      }
    } else {
      this.backgroundRenderer.renderBackground(
        this.gameAssets,
        this.assetLoader.isBarrenAvailable()
      );
    }

    // Render building bases (below player) only in exterior
    if (!this.isInterior) {
      this.buildingRenderer.renderBuildingBases(this.gameAssets, { x: this.camera.x, y: this.camera.y }, this.houseWorld);
    }

    // Render plants
    this.plantRenderer.renderAllPlants(
      this.plantManagement.getPlantedEntities(),
      this.gameAssets,
      { x: this.camera.x, y: this.camera.y }
    );

    // Render player character unless an effect should replace idle
    const playerForRender = this.playerMovement.getPlayerCharacter();
    const replaceIdle = !playerForRender.isMoving && (this.isEffectActive('slash') || this.isEffectActive('water'));
    if (!replaceIdle) {
      this.playerRenderer.renderPlayerCharacter(
        playerForRender,
        this.gameAssets,
        { x: this.camera.x, y: this.camera.y }
      );
    }

    // Render effects (slash) above player
    this.renderEffects();

    // Render building roofs (above player) only in exterior
    if (!this.isInterior) {
      this.buildingRenderer.renderBuildingRoofs(this.gameAssets, { x: this.camera.x, y: this.camera.y }, this.houseWorld);
    }

    // HUD and prompts (screen-space)
    this.renderHUD();
  }

  private renderEffects(): void {
    const now = performance.now();
    const ctx = this.renderingContext;
    const img = this.gameAssets.harvestSlashSprite;
    if (!img || !img.complete || img.naturalWidth === 0 || img.naturalHeight === 0) {
      this.activeEffects = [];
      return;
    }
    const { columns: hCols, rows: hRows } = HARVEST_EFFECT_CONFIG;
    const frameWSlash = Math.floor(img.naturalWidth / hCols);
    const frameHSlash = Math.floor(img.naturalHeight / hRows);

    const effectsLeft: typeof this.activeEffects = [];
    for (const e of this.activeEffects) {
      const elapsed = (now - e.start) / 1000;
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
    this.activeEffects = effectsLeft;
  }

  // hasActiveSlashEffect superseded by isEffectActive(kind)

  private isEffectActive(kind: 'slash' | 'water'): boolean {
    const now = performance.now();
    const cfg = kind === 'slash' ? HARVEST_EFFECT_CONFIG : WATER_EFFECT_CONFIG;
    const secPerFrame = 1 / cfg.framesPerSecond;
    for (const e of this.activeEffects) {
      if (e.kind !== kind) continue;
      const elapsed = (now - e.start) / 1000;
      if (Math.floor(elapsed / secPerFrame) < cfg.columns) return true;
    }
    return false;
  }

  private renderHUD(): void {
    const ctx = this.renderingContext;
    // Gather inventory state
    const inv = this.inventory.getState();
    const counts = inv.counts;
    const lines: string[] = [`Coins: ${inv.coins}`, `Water: ${this.inventory.getWater()}/${this.inventory.getWaterCapacity()}`];
    (Object.keys(counts) as Array<keyof typeof counts>).forEach(k => lines.push(`${String(k)}: ${counts[k]}`));
    const padding = 8;
    const lineH = 16;
    const boxW = 160;
    const boxH = padding * 2 + lineH * lines.length;
    ctx.save();
    // Box top-left
    ctx.globalAlpha = 0.6;
    ctx.fillStyle = '#000000';
    ctx.fillRect(10, 10, boxW, boxH);
    ctx.globalAlpha = 1.0;
    ctx.fillStyle = '#ffffff';
    ctx.font = '12px monospace';
    lines.forEach((t, i) => ctx.fillText(t, 10 + padding, 10 + padding + (i + 1) * lineH - 4));

    // Contextual prompt if in range of interaction
    const prompt = this.getInteractionPrompt();
    if (prompt) {
      const canvas = ctx.canvas;
      const pw = ctx.measureText(prompt).width + 20;
      const ph = 28;
      const px = Math.floor((canvas.width - pw) / 2);
      const py = canvas.height - ph - 16;
      ctx.globalAlpha = 0.75;
      ctx.fillStyle = '#111111';
      ctx.fillRect(px, py, pw, ph);
      ctx.globalAlpha = 1.0;
      ctx.fillStyle = '#ffffff';
      ctx.font = '14px monospace';
      ctx.fillText(prompt, px + 10, py + 18);
    }

    // Notifications (stacked above prompt)
    const now = performance.now();
    this.notifications = this.notifications.filter(n => n.until > now);
    if (this.notifications.length) {
      const canvas = ctx.canvas;
      let y = canvas.height - 60;
      ctx.globalAlpha = 0.9;
      ctx.fillStyle = '#000000';
      ctx.font = '14px monospace';
      this.notifications.forEach(n => {
        const w = ctx.measureText(n.text).width + 20;
        const x = Math.floor((canvas.width - w) / 2);
        ctx.fillRect(x, y, w, 26);
        ctx.fillStyle = '#ffffff';
        ctx.fillText(n.text, x + 10, y + 18);
        ctx.fillStyle = '#000000';
        y -= 32;
      });
      ctx.globalAlpha = 1.0;
    }
    ctx.restore();

    // Controls overlay removed; using HTML legend instead

    // Fade overlay (last)
    if (this.fadeTransition.active) {
      const now = performance.now();
      const t = Math.max(0, Math.min(1, (now - this.fadeTransition.start) / this.fadeTransition.duration));
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
      this.suppressEmptyShipPrompt = false;
      return null;
    }
    if (near.kind === 'enterHouse') return 'Press E to enter house';
    if (near.kind === 'exitHouse') return 'Press E to exit house';
    if (near.kind === 'bed') return 'Press E to sleep';
    if (near.kind === 'ship') {
      const { items, coins } = this.computeSalePreview();
      if (items > 0) return `Press E to ship ${items} for ${coins} coins`;
      // Items are empty
      return this.suppressEmptyShipPrompt ? null : 'Nothing to ship';
    }
    if (near.kind === 'well') return 'Press E to fill water (TODO)';
    return null;
  }

  private getFeetAdjacentInteraction(): { kind: 'well' | 'ship' | 'enterHouse' | 'exitHouse' | 'bed' } | null {
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
        this.isInterior = true;
        // Reset camera/world to interior extents
        const tile = TILE_CONFIG.tileSize;
        const worldW = interior.widthTiles * tile;
        const worldH = interior.heightTiles * tile;
        this.centerOrigin = { x: 0, y: 0 }; // interior drawn at world origin
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
        this.isInterior = false;
        const tile = TILE_CONFIG.tileSize;
        const baseW = exterior.widthTiles * tile;
        const baseH = exterior.heightTiles * tile;
        this.centerOrigin = { x: baseW, y: baseH };
        const worldW = baseW * 3;
        const worldH = baseH * 3;
        this.camera.setWorldSize(worldW, worldH);
        this.playerMovement.setWorldSize(worldW, worldH);
        // Place player outside the door, just below the house
        const p = this.playerMovement.getPlayerCharacter();
        const outX = this.centerOrigin.x + Math.floor((HOUSE_CONFIG.tileX + 0.5) * tile);
        const outY = this.centerOrigin.y + Math.floor((HOUSE_CONFIG.tileY + 2) * tile);
        p.xPosition = outX;
        p.yPosition = outY;
        this.camera.follow(p.xPosition, p.yPosition);
        // Recompute house world and interactions
        this.houseWorld = { x: this.centerOrigin.x + Math.floor((HOUSE_CONFIG.tileX + 0.5) * tile), y: this.centerOrigin.y + Math.floor((HOUSE_CONFIG.tileY + 1) * tile) };
        this.buildInteractionAreas();
        this.updateWorldCollisions();
        this.pushNotification('Exited house');
      } catch (e) {
        console.error('Failed to load exterior map', e);
        this.pushNotification('Failed to exit house');
      }
    });
  }

  private startFadeTransition(onMid: () => Promise<void> | void, durationMs = 600): void {
    this.fadeTransition = { active: true, start: performance.now(), duration: durationMs, midFired: false, onMid };
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
    // Simple fade and notification for now
    this.startFadeTransition(() => {
      this.pushNotification('You feel rested');
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
    this.notifications.push({ text, until: performance.now() + durationMs });
  }

  // Collision debug overlay removed per request

  // Utility methods for debugging
  public getGameStats(): any {
    return {
      isRunning: this.isRunning,
      assetsLoaded: this.assetLoader.areAllAssetsLoaded(),
      loadingProgress: this.assetLoader.getLoadingProgress(),
      plantCount: this.plantManagement.getPlantCount(),
      playerPosition: {
        x: this.playerMovement.getPlayerCharacter().xPosition,
        y: this.playerMovement.getPlayerCharacter().yPosition
      }
    };
  }

  // Expose whether the player is inside the interior scene
  public isInteriorScene(): boolean {
    return this.isInterior;
  }
}
