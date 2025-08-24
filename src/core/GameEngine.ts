/**
 * Main game engine that orchestrates all game systems
 */

import { GameAssets } from '../types/gameAssets.types';
import { CANVAS_CONFIG, SPRITE_SHEET_CONFIG } from '../configuration/gameConstants';
import { AssetLoader } from '../assetManagement/AssetLoader';
import { KeyboardInputManager } from '../gameSystems/inputHandling/KeyboardInputManager';
import { MouseInputManager } from '../gameSystems/inputHandling/MouseInputManager';
import { PlayerMovementSystem } from '../gameSystems/playerCharacter/PlayerMovementSystem';
import { PlantManagementSystem } from '../gameSystems/plantGrowth/PlantManagementSystem';
import { BackgroundRenderer } from '../gameSystems/rendering/BackgroundRenderer';
import { PlantRenderer } from '../gameSystems/rendering/PlantRenderer';
import { PlayerCharacterRenderer } from '../gameSystems/rendering/PlayerCharacterRenderer';

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
  private plantRenderer: PlantRenderer;
  private playerRenderer: PlayerCharacterRenderer;

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

    // Initialize systems
    this.assetLoader = new AssetLoader();
    this.keyboardInput = new KeyboardInputManager();
    this.mouseInput = new MouseInputManager(this.canvas);
    this.playerMovement = new PlayerMovementSystem(this.keyboardInput);
    this.plantManagement = new PlantManagementSystem();

    // Initialize renderers
    this.backgroundRenderer = new BackgroundRenderer(this.renderingContext);
    this.plantRenderer = new PlantRenderer(this.renderingContext);
    this.playerRenderer = new PlayerCharacterRenderer(this.renderingContext);
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
          this.plantManagement.handlePlantingClick({
            x: player.xPosition,
            y: player.yPosition
          });
          lastPlantTime = currentTime;
        }
      }
    };

    // Check for P key every frame (will be called in game loop)
    this.plantingInputHandler = plantingHandler;
  }

  private plantingInputHandler?: () => void;

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

    // Update game systems
    this.playerMovement.updatePlayerMovement(deltaTimeSeconds);
    this.plantManagement.updatePlantGrowth();
  }

  private renderFrame(): void {
    // Clear canvas
    this.renderingContext.clearRect(0, 0, CANVAS_CONFIG.width, CANVAS_CONFIG.height);

    // Render background
    this.backgroundRenderer.renderBackground(
      this.gameAssets,
      this.assetLoader.isBarrenAvailable()
    );

    // Render plants
    this.plantRenderer.renderAllPlants(
      this.plantManagement.getPlantedEntities(),
      this.gameAssets
    );

    // Render player character
    this.playerRenderer.renderPlayerCharacter(
      this.playerMovement.getPlayerCharacter(),
      this.gameAssets
    );
  }

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