/**
 * Growing Stars - Main Game Entry Point
 */

import { GameEngine } from './core/GameEngine';
import { renderHUD as renderWorldHUD } from './modules/hud/HUDOverlay';
import { renderHUD as renderPlayerHUD } from './modules/hud/PlayerHUD';
import { renderInventory, InventoryItem } from './modules/hud/InventoryHUD';
import { renderShop } from './modules/hud/ShopHUD';
import { renderPromptAndNotifications } from './modules/hud/PromptHUD';
import { TimeManager } from './modules/time/TimeManager';

interface WindowWithGameEngines extends Window {
  gameEngine?: GameEngine;
  timeManager?: TimeManager;
}

// Initialize and start the game
const initializeGame = async (): Promise<void> => {
  try {
    const gameEngine = new GameEngine('game-canvas');
    
    // Initialize time manager with accelerated time: 1 day = 40 seconds
    const SECONDS_PER_DAY = 40;
    const timeManager = new TimeManager({
      day: 1,
      secondsIntoDay: 0,
      dayDurationSeconds: SECONDS_PER_DAY,
      seasonIndex: 0,
      weather: 'clear',
    });
    
    // Connect time manager to game engine
    gameEngine.setTimeManager(timeManager);
    
    await gameEngine.initialize();
    gameEngine.start();
    
    // Expose game engine and time manager to global scope for debugging
    interface WindowWithGameEngines extends Window {
      gameEngine?: GameEngine;
      timeManager?: TimeManager;
    }
    const windowWithEngines = window as WindowWithGameEngines;
    windowWithEngines.gameEngine = gameEngine;
    windowWithEngines.timeManager = timeManager;
    
    console.log('Growing Stars game started successfully!');
    console.log('Controls:');
    console.log('- WASD: Move character');
    console.log('- P: Plant seed at player location');  
    console.log('- B: Toggle background');
    console.log('- 1/2/3/4: Force player direction (testing)');
    
  } catch (error) {
    console.error('Failed to initialize game:', error);
  }
};

// Start the game when the page loads
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initializeGame);
} else {
  initializeGame();
}

// HUD demo overlay: separate canvas and loop (procedural, no assets)
(() => {
  const hudCanvas = document.getElementById('hud-canvas') as HTMLCanvasElement | null;
  if (!hudCanvas) {
    console.error('HUD canvas not found!');
    return;
  }
  const ctx = hudCanvas.getContext('2d');
  if (!ctx) {
    console.error('HUD canvas context not available!');
    return;
  }

  const resize = () => {
    hudCanvas.width = window.innerWidth;
    hudCanvas.height = window.innerHeight;
  };
  resize();
  window.addEventListener('resize', resize);

  // Choose a persistent weather for each day (storms are relatively rare)
  let currentDayWeather: 'clear' | 'cloud' | 'storm' = chooseDailyWeather(0);
  let lastProcessedDay = 1; // Track the last day we processed

  let previousFrameTime = performance.now();
  let totalElapsedTime = 0;

  function chooseDailyWeather(seasonIndex: number): 'clear' | 'cloud' | 'storm' {
    // Base weights: clear (0.6), cloud (0.32), storm (0.08)
    // Slight seasonal variation: Spring +0.03 storm, Autumn +0.01 storm, Summer -0.01 storm, Winter -0.03 storm
    const season = ((seasonIndex % 4) + 4) % 4; // 0..3
    let pStorm = 0.08 + (season === 0 ? 0.03 : season === 2 ? 0.01 : season === 1 ? -0.01 : -0.03);
    pStorm = Math.max(0.01, Math.min(0.18, pStorm));
    let pCloud = 0.32;
    let pClear = 1 - (pStorm + pCloud);
    if (pClear < 0.5) { pClear = 0.5; pCloud = 1 - pStorm - pClear; }
    const r = Math.random();
    if (r < pStorm) return 'storm';
    if (r < pStorm + pCloud) return 'cloud';
    return 'clear';
  }

  const renderLoop = () => {
    const currentFrameTime = performance.now();
    const deltaTimeSeconds = (currentFrameTime - previousFrameTime) / 1000;
    previousFrameTime = currentFrameTime;
    totalElapsedTime += deltaTimeSeconds * 1000;

    // Update time manager
    const windowWithEngines = window as WindowWithGameEngines;
    const timeManager = windowWithEngines.timeManager;
    if (!timeManager) {
      requestAnimationFrame(renderLoop);
      return;
    }
    
    timeManager.updateTime(deltaTimeSeconds);
    const currentTimeState = timeManager.getState();
    
    // Check for day changes to update weather
    const currentDayNumber = currentTimeState.day;
    if (currentDayNumber !== lastProcessedDay) {
      currentDayWeather = chooseDailyWeather(currentTimeState.seasonIndex);
      lastProcessedDay = currentDayNumber;
    }
    
    // Set weather based on interior status
    const gameEngine = windowWithEngines.gameEngine;
    const isInsideBuilding = gameEngine && gameEngine.isInteriorScene ? gameEngine.isInteriorScene() : false;
    const actualWeather = isInsideBuilding ? 'clear' : currentDayWeather;
    timeManager.setWeather(actualWeather);

    // Clear canvas
    ctx.clearRect(0, 0, hudCanvas.width, hudCanvas.height);


    renderWorldHUD(ctx, currentTimeState, {
      canvasWidth: hudCanvas.width,
      canvasHeight: hudCanvas.height,
      margin: 16,
      disableDarkening: isInsideBuilding,
    });

    // Player resource HUD (top-left)
    const gameEngineForHUD = windowWithEngines.gameEngine;
    if (gameEngineForHUD && typeof gameEngineForHUD.getHUDSnapshot === 'function') {
      const hudSnapshot = gameEngineForHUD.getHUDSnapshot();
      renderPlayerHUD(ctx, hudSnapshot, { canvasWidth: hudCanvas.width, canvasHeight: hudCanvas.height, margin: 16 });
      if (typeof gameEngineForHUD.getInventoryView === 'function') {
        const inventoryView = gameEngineForHUD.getInventoryView();
        const inventorySlotSize = 32;
        const inventorySlotSpacing = 8;
        const inventoryMarginBottom = 16;
        renderInventory(ctx, inventoryView.items as InventoryItem[], inventoryView.selectedIndex, { slotSize: inventorySlotSize, spacing: inventorySlotSpacing, marginBottom: inventoryMarginBottom }, (itemContext, xPosition, yPosition, slotSize, inventoryItem) => {
          // Draw tiny plant icon for seeds using game assets
          if (inventoryItem.kind === 'seed') {
            const gameAssets = gameEngineForHUD.getAssets?.() ?? windowWithEngines.gameEngine?.getAssets?.();
            const plantSpriteImage = gameAssets?.plantSprites?.[inventoryItem.plantType];
            if (plantSpriteImage && plantSpriteImage.complete && plantSpriteImage.naturalWidth > 0) {
              const iconPadding = 4;
              const iconWidth = slotSize - iconPadding * 2;
              const iconHeight = slotSize - iconPadding * 2;
              itemContext.save();
              itemContext.imageSmoothingEnabled = false;
              itemContext.drawImage(plantSpriteImage, xPosition + iconPadding, yPosition + iconPadding, iconWidth, iconHeight);
              itemContext.restore();
              return;
            }
            // Fallback: draw a procedural sprout icon
            const sproutIconSize = Math.min(18, slotSize * 0.7);
            const sproutStartX = xPosition + slotSize * 0.16;
            const sproutStartY = yPosition + slotSize * 0.14;
            itemContext.save();
            itemContext.strokeStyle = '#6eff6e';
            itemContext.lineWidth = 2;
            itemContext.beginPath();
            itemContext.moveTo(sproutStartX + sproutIconSize * 0.5, sproutStartY + sproutIconSize);
            itemContext.quadraticCurveTo(sproutStartX + sproutIconSize * 0.55, sproutStartY + sproutIconSize * 0.6, sproutStartX + sproutIconSize * 0.5, sproutStartY + sproutIconSize * 0.3);
            itemContext.stroke();
            itemContext.fillStyle = '#a4ff7a';
            itemContext.beginPath();
            itemContext.ellipse(sproutStartX + sproutIconSize * 0.38, sproutStartY + sproutIconSize * 0.42, sproutIconSize * 0.18, sproutIconSize * 0.10, -0.6, 0, Math.PI * 2);
            itemContext.ellipse(sproutStartX + sproutIconSize * 0.62, sproutStartY + sproutIconSize * 0.40, sproutIconSize * 0.18, sproutIconSize * 0.10, 0.6, 0, Math.PI * 2);
            itemContext.fill();
            itemContext.restore();
            return;
          }
<<<<<<< HEAD
          // Tools: simple glyph
          itemContext.save();
          itemContext.strokeStyle = '#89ffe8';
          itemContext.lineWidth = 2;
          const toolIconCenterX = xPosition + slotSize * 0.5;
          const toolIconCenterY = yPosition + slotSize * 0.5;
          itemContext.beginPath();
          itemContext.arc(toolIconCenterX - 4, toolIconCenterY - 6, 5, Math.PI * 0.3, Math.PI * 1.7);
          itemContext.moveTo(toolIconCenterX - 1, toolIconCenterY - 2);
          itemContext.lineTo(toolIconCenterX + 6, toolIconCenterY + 6);
          itemContext.stroke();
          itemContext.restore();
=======
          // Tools: draw hoe icon if toolType present
          if ((item as any).toolType === 'hoe') {
            const pad = 6;
            const x1 = x + pad, y1 = y + size - pad;
            const x2 = x + size - pad, y2 = y + pad;
            ictx.save();
            ictx.strokeStyle = '#c8a26a';
            ictx.lineWidth = 3;
            ictx.lineCap = 'round';
            ictx.beginPath();
            ictx.moveTo(x1, y1);
            ictx.lineTo(x2, y2);
            ictx.stroke();
            const bx = x2 - 4, by = y2 + 2;
            ictx.fillStyle = '#43ffd9';
            ictx.shadowColor = '#43ffd9';
            ictx.shadowBlur = 6;
            ictx.beginPath();
            ictx.moveTo(bx, by);
            ictx.lineTo(bx + 8, by + 2);
            ictx.lineTo(bx + 4, by + 8);
            ictx.closePath();
            ictx.fill();
            ictx.shadowBlur = 0;
            ictx.restore();
          } else {
            ictx.save();
            ictx.strokeStyle = '#89ffe8';
            ictx.lineWidth = 2;
            const cx = x + size * 0.5, cy = y + size * 0.5;
            ictx.beginPath();
            ictx.arc(cx - 4, cy - 6, 5, Math.PI * 0.3, Math.PI * 1.7);
            ictx.moveTo(cx - 1, cy - 2);
            ictx.lineTo(cx + 6, cy + 6);
            ictx.stroke();
            ictx.restore();
          }
>>>>>>> bca5842 (feat(hoe): 3x3 patch placement, autotile edges/corners; respect existing center dirt; fix corner orientation; expand retile radius; add hoe tool icon and usage)
        });
        // Prompt and notifications above the inventory bar
        if (typeof gameEngineForHUD.getOverlayTexts === 'function') {
          const overlayTexts = gameEngineForHUD.getOverlayTexts();
          const inventoryTopY = hudCanvas.height - inventoryMarginBottom - inventorySlotSize - 10; // mirror InventoryHUD positioning
          renderPromptAndNotifications(ctx, overlayTexts.prompt, overlayTexts.notifications, { canvasWidth: hudCanvas.width, aboveY: inventoryTopY - 8 });
        }
        // Shop overlay (centered)
        if (gameEngineForHUD.getShopView) {
          const shopView = gameEngineForHUD.getShopView();
          renderShop(ctx, shopView, { canvasWidth: hudCanvas.width, canvasHeight: hudCanvas.height });
        }
      }
    }
    requestAnimationFrame(renderLoop);
  };
  requestAnimationFrame(renderLoop);
})();
