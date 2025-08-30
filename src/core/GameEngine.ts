/**
 * Main game engine that orchestrates all game systems
 */

import { GameAssets } from '../types/gameAssets.types';
import { SPRITE_SHEET_CONFIG, SPRITE_DIRECTIONS, RENDER_CONFIG, TILE_CONFIG, WORLD_CONFIG, HARVEST_EFFECT_CONFIG, HOUSE_CONFIG, PLANT_PRICES } from '../configuration/gameConstants';
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
  private interactionAreas: Array<{ x: number; y: number; w: number; h: number; kind: 'well' | 'ship' }>=[];
  private staticCollisionRects: Array<{ x: number; y: number; w: number; h: number }>=[];
  private camera!: Camera;
  private centerOrigin = { x: 0, y: 0 };
  private houseWorld = { x: 0, y: 0 };

  // Game state
  private gameAssets!: GameAssets;
  private isRunning = false;
  private lastTimestamp = 0;
  private harvestingInputHandler?: () => void;
  private activeEffects: Array<{ x: number; baselineY: number; start: number; kind: 'slash'; row: number; targetHeight: number }>=[];
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
    this.inventory = new InventorySystem(0);

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
    // Set up harvesting on H key press
    this.setupHarvestingInput();

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
    const HARVEST_REACH = TILE_CONFIG.tileSize * 0.9;

    const harvestHandler = () => {
      if (this.keyboardInput.isKeyPressed('h')) {
        const now = performance.now();
        if (now - lastHarvestTime > HARVEST_COOLDOWN) {
          const player = this.playerMovement.getPlayerCharacter();
          const target = this.calculatePlantingPosition(player);
          const harvested = this.plantManagement.harvestNearest(target, HARVEST_REACH);
          if (harvested) {
            // Add to inventory
            this.inventory.addPlant(harvested.plantType);
            // Spawn slash effect centered on player feet
            const spriteCfg = this.playerRenderer.getSpriteConfiguration();
            const displayHeight = spriteCfg.frameHeight * RENDER_CONFIG.playerScale;
            const baselineY = player.yPosition + displayHeight / 2;
            const targetHeight = Math.floor(displayHeight * HARVEST_EFFECT_CONFIG.scale);
            const row = player.currentRow; // up,left,down,right mapping
            this.activeEffects.push({ x: player.xPosition, baselineY, start: now, kind: 'slash', row, targetHeight });
          }
          lastHarvestTime = now;
        }
      }
    };

    this.harvestingInputHandler = harvestHandler;
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
    // Handle interactions (E key)
    if (this.keyboardInput.isKeyPressed('e')) {
      this.handleInteractions();
    }
    // Handle harvesting input
    if (this.harvestingInputHandler) {
      this.harvestingInputHandler();
    }
    // Handle harvesting input
    if (this.harvestingInputHandler) {
      this.harvestingInputHandler();
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

  private updateWorldCollisions(): void {
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
    const areas: Array<{ x: number; y: number; w: number; h: number; kind: 'well' | 'ship' }> = [];
    const addFromLayer = (name: string, kind: 'well' | 'ship') => {
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
    this.interactionAreas = areas;
    // Make them collidable by default
    this.staticCollisionRects = areas.map(a => ({ x: a.x, y: a.y, w: a.w, h: a.h }));
  }

  private handleInteractions(): void {
    // Use player's feet position
    const player = this.playerMovement.getPlayerCharacter();
    const spriteCfg = this.playerRenderer.getSpriteConfiguration();
    const displayHeight = spriteCfg.frameHeight * RENDER_CONFIG.playerScale;
    const feetX = player.xPosition;
    const feetY = player.yPosition + displayHeight / 2;
    const probe = { x: feetX - 2, y: feetY - 2, w: 4, h: 4 };
    const hit = this.interactionAreas.find(a => this.rectsOverlap(probe, a));
    if (!hit) return;
    if (hit.kind === 'ship') {
      const res = this.inventory.sellAll(PLANT_PRICES as any);
      if (res.coinsGained > 0) {
        console.log(`Shipped goods for ${res.coinsGained} coins. Total coins: ${this.inventory.getCoins()}`);
      } else {
        console.log('Nothing to ship.');
      }
    } else if (hit.kind === 'well') {
      console.log('Interacted with well. TODO: add water system.');
    }
  }

  private rectsOverlap(a: { x: number; y: number; w: number; h: number }, b: { x: number; y: number; w: number; h: number }): boolean {
    return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
  }

  private renderFrame(): void {
    // Clear canvas
    this.renderingContext.clearRect(0, 0, this.canvas.width, this.canvas.height);

    // Render Tiled map if available; otherwise background
    if (this.worldMap) {
      const tile = TILE_CONFIG.tileSize;
      const chunkW = this.worldMap.widthTiles * tile;
      const chunkH = this.worldMap.heightTiles * tile;
      // Center map
      this.tilemapRenderer.render(this.worldMap, { x: this.camera.x, y: this.camera.y }, { x: this.centerOrigin.x, y: this.centerOrigin.y });
      // Four neighbors: base + details
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
    } else {
      this.backgroundRenderer.renderBackground(
        this.gameAssets,
        this.assetLoader.isBarrenAvailable()
      );
    }

    // Render building bases (below player)
    this.buildingRenderer.renderBuildingBases(this.gameAssets, { x: this.camera.x, y: this.camera.y }, this.houseWorld);

    // Render plants
    this.plantRenderer.renderAllPlants(
      this.plantManagement.getPlantedEntities(),
      this.gameAssets,
      { x: this.camera.x, y: this.camera.y }
    );

    // Render player character unless slash is replacing idle
    const playerForRender = this.playerMovement.getPlayerCharacter();
    const replaceIdleWithSlash = !playerForRender.isMoving && this.hasActiveSlashEffect();
    if (!replaceIdleWithSlash) {
      this.playerRenderer.renderPlayerCharacter(
        playerForRender,
        this.gameAssets,
        { x: this.camera.x, y: this.camera.y }
      );
    }

    // Render effects (slash) above player
    this.renderEffects();

    // Render building roofs (above player)
    this.buildingRenderer.renderBuildingRoofs(this.gameAssets, { x: this.camera.x, y: this.camera.y }, this.houseWorld);

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
    const { columns, rows, framesPerSecond } = HARVEST_EFFECT_CONFIG;
    const secPerFrame = 1 / framesPerSecond;
    const frameW = Math.floor(img.naturalWidth / columns);
    const frameH = Math.floor(img.naturalHeight / rows);

    const effectsLeft: typeof this.activeEffects = [];
    for (const e of this.activeEffects) {
      const elapsed = (now - e.start) / 1000;
      const frameIndex = Math.floor(elapsed / secPerFrame);
      if (frameIndex >= columns) continue; // finished
      effectsLeft.push(e);
      const col = frameIndex % columns;
      const row = Math.max(0, Math.min(rows - 1, e.row));
      const sx = col * frameW;
      const sy = row * frameH;
      const dh = Math.max(1, Math.floor(e.targetHeight));
      const dw = Math.max(1, Math.floor((frameW / frameH) * dh));
      ctx.save();
      ctx.globalAlpha = 0.95;
      ctx.drawImage(
        img,
        sx, sy, frameW, frameH,
        Math.round(e.x - dw / 2),
        Math.round(e.baselineY - dh),
        dw, dh
      );
      ctx.restore();
    }
    this.activeEffects = effectsLeft;
  }

  private hasActiveSlashEffect(): boolean {
    const now = performance.now();
    const img = this.gameAssets.harvestSlashSprite;
    if (!img || !img.complete || img.naturalWidth === 0 || img.naturalHeight === 0) return false;
    const { columns, framesPerSecond } = HARVEST_EFFECT_CONFIG;
    const secPerFrame = 1 / framesPerSecond;
    for (const e of this.activeEffects) {
      if (e.kind !== 'slash') continue;
      const elapsed = (now - e.start) / 1000;
      const frameIndex = Math.floor(elapsed / secPerFrame);
      if (frameIndex < columns) return true;
    }
    return false;
  }

  private renderHUD(): void {
    const ctx = this.renderingContext;
    // Gather inventory state
    const inv = this.inventory.getState();
    const counts = inv.counts;
    const lines: string[] = [
      `Coins: ${inv.coins}`,
      ...Object.keys(counts).map(k => `${k}: ${counts[k as keyof typeof counts]}`)
    ];
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
    ctx.restore();
  }

  private getInteractionPrompt(): string | null {
    // Use player's feet to test overlap
    const player = this.playerMovement.getPlayerCharacter();
    const spriteCfg = this.playerRenderer.getSpriteConfiguration();
    if (!spriteCfg.frameHeight) return null;
    const displayHeight = spriteCfg.frameHeight * RENDER_CONFIG.playerScale;
    const feetX = player.xPosition;
    const feetY = player.yPosition + displayHeight / 2;
    const probe = { x: feetX - 2, y: feetY - 2, w: 4, h: 4 };
    const hit = this.interactionAreas.find(a => this.rectsOverlap(probe, a));
    if (!hit) return null;
    if (hit.kind === 'ship') return 'Press E to ship crops';
    if (hit.kind === 'well') return 'Press E to fill water (TODO)';
    return null;
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
}
