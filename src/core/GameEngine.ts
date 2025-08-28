/**
 * Main game engine that orchestrates all game systems
 */

import { GameAssets } from '../types/gameAssets.types';
import { SPRITE_SHEET_CONFIG, SPRITE_DIRECTIONS, RENDER_CONFIG, TILE_CONFIG, WORLD_CONFIG, HOUSE_CONFIG } from '../configuration/gameConstants';
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
import { Camera } from '../modules/rendering/Camera';
import { MapLoader, LoadedMap } from '../modules/tilemap/MapLoader';
import { TilemapRenderer } from '../modules/rendering/TilemapRenderer';

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
  private camera: Camera;
  private mapLoader: MapLoader;
  private tilemapRenderer: TilemapRenderer;
  private worldMap: LoadedMap | null = null;
  private houseWorld = { x: 0, y: 0 };
  private centerOrigin = { x: 0, y: 0 }; // where the center map chunk starts in world space

  // Game state
  private gameAssets!: GameAssets;
  private isRunning = false;
  private lastTimestamp = 0;

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

    // Initialize renderers
    this.backgroundRenderer = new BackgroundRenderer(this.renderingContext);
    this.buildingRenderer = new BuildingRenderer(this.renderingContext);
    this.plantRenderer = new PlantRenderer(this.renderingContext);
    this.playerRenderer = new PlayerCharacterRenderer(this.renderingContext);
    this.camera = new Camera();
    // Ensure camera knows current viewport immediately
    this.camera.setViewport(this.canvas.width, this.canvas.height);
    this.mapLoader = new MapLoader();
    this.tilemapRenderer = new TilemapRenderer(this.renderingContext);

    // World/tile setup
    const worldWidth = WORLD_CONFIG.widthTiles * TILE_CONFIG.tileSize;
    const worldHeight = WORLD_CONFIG.heightTiles * TILE_CONFIG.tileSize;
    this.camera.setWorldSize(worldWidth, worldHeight);
    this.playerMovement.setWorldSize(worldWidth, worldHeight);

    // Initial player placement (world center)
    this.playerMovement.getPlayerCharacter().xPosition = Math.floor(worldWidth / 2);
    this.playerMovement.getPlayerCharacter().yPosition = Math.floor(worldHeight / 2);
    // Center camera on player now (before first frame)
    this.camera.follow(
      this.playerMovement.getPlayerCharacter().xPosition,
      this.playerMovement.getPlayerCharacter().yPosition
    );

    // House placement at tile (bottom-center)
    const houseTileX = HOUSE_CONFIG.tileX;
    const houseTileY = HOUSE_CONFIG.tileY;
    this.houseWorld.x = Math.floor((houseTileX + 0.5) * TILE_CONFIG.tileSize);
    this.houseWorld.y = Math.floor((houseTileY + 1) * TILE_CONFIG.tileSize);
  }

  private setupViewportCanvas(): void {
    const resizeCanvas = () => {
      this.canvas.width = window.innerWidth;
      this.canvas.height = window.innerHeight;
      this.renderingContext.imageSmoothingEnabled = false;
      if (this.camera) this.camera.setViewport(this.canvas.width, this.canvas.height);
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

    // Load world map
    try {
      this.worldMap = await this.mapLoader.loadMap('/src/assets/maps/homeMap.tmj');
      const displayTile = TILE_CONFIG.tileSize;
      const baseW = this.worldMap.widthTiles * displayTile;
      const baseH = this.worldMap.heightTiles * displayTile;
      // Center chunk origin so that there is one chunk on each side
      this.centerOrigin = { x: baseW, y: baseH };
      // Expand world to 3x3 grid (we currently draw center + 4 sides; corners remain empty but still within bounds)
      const worldW = baseW * 3;
      const worldH = baseH * 3;
      this.camera.setWorldSize(worldW, worldH);
      this.playerMovement.setWorldSize(worldW, worldH);
      // Position player at the center of the center chunk
      const centerX = this.centerOrigin.x + Math.floor(baseW / 2);
      const centerY = this.centerOrigin.y + Math.floor(baseH / 2);
      const player = this.playerMovement.getPlayerCharacter();
      player.xPosition = centerX;
      player.yPosition = centerY;
      this.camera.follow(centerX, centerY);
      // Shift house position into center chunk space
      this.houseWorld.x += this.centerOrigin.x;
      this.houseWorld.y += this.centerOrigin.y;
      console.log(`Loaded world map: ${this.worldMap.widthTiles}x${this.worldMap.heightTiles} tiles`);
    } catch (err) {
      console.warn('Map load failed; using background fallback', err);
    }

    // Initialize input systems
    this.keyboardInput.initialize();
    this.mouseInput.initialize();

    // Set up plant placement on P key press
    this.setupPlantingInput();

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

  private plantingInputHandler?: () => void;

  private calculatePlantingPosition(player: PlayerCharacter): { x: number; y: number } {
    const PLANTING_DISTANCE = 40; // Distance in front of player to plant
    
    let offsetX = 0;
    let offsetY = 0;
    
    // Calculate offset based on player's facing direction
    switch (player.currentRow) {
      case SPRITE_DIRECTIONS.up:
        offsetY = -PLANTING_DISTANCE;
        break;
      case SPRITE_DIRECTIONS.down:
        offsetY = PLANTING_DISTANCE;
        break;
      case SPRITE_DIRECTIONS.left:
        offsetX = -PLANTING_DISTANCE;
        break;
      case SPRITE_DIRECTIONS.right:
        offsetX = PLANTING_DISTANCE;
        break;
      default:
        // Default to planting in front (down)
        offsetY = PLANTING_DISTANCE;
        break;
    }
    
    return {
      x: player.xPosition + offsetX,
      y: player.yPosition + offsetY
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


    // Update collisions (house base as a blocking rect)
    this.updateWorldCollisions();

    // Update game systems
    this.playerMovement.updatePlayerMovement(deltaTimeSeconds);
    this.plantManagement.updatePlantGrowth();
    // Camera follow
    const p = this.playerMovement.getPlayerCharacter();
    this.camera.follow(p.xPosition, p.yPosition);
  }

  private updateWorldCollisions(): void {
    const base = this.gameAssets.buildings?.playerHouseBase;
    if (!base || !base.complete || base.naturalWidth === 0) {
      this.playerMovement.setCollisionRects([]);
      return;
    }
    const dw = base.naturalWidth;
    const dh = base.naturalHeight;
    const dx = Math.floor(this.houseWorld.x - dw / 2);
    const dy = Math.floor(this.houseWorld.y - dh);
    // Tight collision crop (222x100 at 1x), anchored to bottom-center
    const cropW = RENDER_CONFIG.playerHouseCollisionSize.width;
    const cropH = RENDER_CONFIG.playerHouseCollisionSize.height;
    const cx = Math.floor((dx + dw / 2) - cropW / 2);
    const cy = Math.floor(dy + dh - cropH);
    this.playerMovement.setCollisionRects([{ x: cx, y: cy, w: cropW, h: cropH }]);
  }

  private renderFrame(): void {
    // Clear canvas
    this.renderingContext.clearRect(0, 0, this.canvas.width, this.canvas.height);

    // Render tilemap or fallback background
    if (this.worldMap) {
      // Base dimensions
      const tile = TILE_CONFIG.tileSize;
      const chunkW = this.worldMap.widthTiles * tile;
      const chunkH = this.worldMap.heightTiles * tile;

      // Center chunk at centerOrigin
      this.tilemapRenderer.render(
        this.worldMap,
        { x: this.camera.x, y: this.camera.y },
        { x: this.centerOrigin.x, y: this.centerOrigin.y }
      );

      // Four neighbors (top, bottom, left, right) with base + randomized details
      const neighborLayers = ['baseGround', 'detailsGround'];
      const neighborVariation = { randomizedLayers: { detailsGround: { density: 0.7, flipHChance: 0.4, rotate90Chance: 0.2, rotate180Chance: 0.15, jitterPx: 1 } }, seed: 4242 };
      this.tilemapRenderer.renderFilteredWithVariation(
        this.worldMap,
        neighborLayers,
        neighborVariation,
        { x: this.camera.x, y: this.camera.y },
        { x: this.centerOrigin.x - chunkW, y: this.centerOrigin.y }
      ); // left
      this.tilemapRenderer.renderFilteredWithVariation(
        this.worldMap,
        neighborLayers,
        neighborVariation,
        { x: this.camera.x, y: this.camera.y },
        { x: this.centerOrigin.x + chunkW, y: this.centerOrigin.y }
      ); // right
      this.tilemapRenderer.renderFilteredWithVariation(
        this.worldMap,
        neighborLayers,
        neighborVariation,
        { x: this.camera.x, y: this.camera.y },
        { x: this.centerOrigin.x, y: this.centerOrigin.y - chunkH }
      ); // top
      this.tilemapRenderer.renderFilteredWithVariation(
        this.worldMap,
        neighborLayers,
        neighborVariation,
        { x: this.camera.x, y: this.camera.y },
        { x: this.centerOrigin.x, y: this.centerOrigin.y + chunkH }
      ); // bottom

      // Corners with decoration variation: draw base + randomized detailsGround
      const cornerLayers = ['baseGround', 'detailsGround'];
      const variation = { randomizedLayers: { detailsGround: { density: 0.6, flipHChance: 0.5 } }, seed: 1337 };
      this.tilemapRenderer.renderFilteredWithVariation(
        this.worldMap,
        cornerLayers,
        variation,
        { x: this.camera.x, y: this.camera.y },
        { x: this.centerOrigin.x - chunkW, y: this.centerOrigin.y - chunkH }
      ); // top-left
      this.tilemapRenderer.renderFilteredWithVariation(
        this.worldMap,
        cornerLayers,
        variation,
        { x: this.camera.x, y: this.camera.y },
        { x: this.centerOrigin.x + chunkW, y: this.centerOrigin.y - chunkH }
      ); // top-right
      this.tilemapRenderer.renderFilteredWithVariation(
        this.worldMap,
        cornerLayers,
        variation,
        { x: this.camera.x, y: this.camera.y },
        { x: this.centerOrigin.x - chunkW, y: this.centerOrigin.y + chunkH }
      ); // bottom-left
      this.tilemapRenderer.renderFilteredWithVariation(
        this.worldMap,
        cornerLayers,
        variation,
        { x: this.camera.x, y: this.camera.y },
        { x: this.centerOrigin.x + chunkW, y: this.centerOrigin.y + chunkH }
      ); // bottom-right
    } else {
      this.backgroundRenderer.renderBackground(
        this.gameAssets,
        this.assetLoader.isBarrenAvailable(),
        { x: this.camera.x, y: this.camera.y }
      );
    }

    // Render building bases (below player)
    this.buildingRenderer.renderBuildingBases(
      this.gameAssets,
      { x: this.camera.x, y: this.camera.y },
      this.houseWorld
    );

    // Render plants
    this.plantRenderer.renderAllPlants(
      this.plantManagement.getPlantedEntities(),
      this.gameAssets,
      { x: this.camera.x, y: this.camera.y }
    );

    // Render player character
    this.playerRenderer.renderPlayerCharacter(
      this.playerMovement.getPlayerCharacter(),
      this.gameAssets,
      { x: this.camera.x, y: this.camera.y }
    );

    // Render building roofs (above player)
    this.buildingRenderer.renderBuildingRoofs(
      this.gameAssets,
      { x: this.camera.x, y: this.camera.y },
      this.houseWorld
    );
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
