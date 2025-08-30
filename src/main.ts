/**
 * Growing Stars - Main Game Entry Point
 */

import { GameEngine } from './core/GameEngine';
import { renderHUD as renderWorldHUD, HUDState } from './modules/hud/HUDOverlay';
import { renderHUD as renderPlayerHUD } from './modules/hud/PlayerHUD';
import { renderInventory, InventoryItem } from './modules/hud/InventoryHUD';
import { renderPromptAndNotifications } from './modules/hud/PromptHUD';

// Initialize and start the game
const initializeGame = async (): Promise<void> => {
  try {
    const gameEngine = new GameEngine('game-canvas');
    
    await gameEngine.initialize();
    gameEngine.start();
    
    // Expose game engine to global scope for debugging
    (window as any).gameEngine = gameEngine;
    
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
  if (!hudCanvas) return;
  const ctx = hudCanvas.getContext('2d');
  if (!ctx) return;

  const resize = () => {
    hudCanvas.width = window.innerWidth;
    hudCanvas.height = window.innerHeight;
  };
  resize();
  window.addEventListener('resize', resize);

  // Simulated accelerated time: 1 day = 40 seconds
  const DAY_SECONDS = 40;
  let state: HUDState = {
    day: 1,
    secondsIntoDay: 0,
    dayDurationSeconds: DAY_SECONDS,
    seasonIndex: 0,
    weather: 'clear',
  };
  // Choose a persistent weather for each day (storms are relatively rare)
  let currentDayWeather: 'clear' | 'cloud' | 'storm' = chooseDailyWeather(state.seasonIndex);

  let last = performance.now();
  let totalElapsed = 0;

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

  const loop = () => {
    const now = performance.now();
    const dt = (now - last) / 1000;
    last = now;
    totalElapsed += dt * 1000;

    // Advance time
    state.secondsIntoDay += dt;
    if (state.secondsIntoDay >= state.dayDurationSeconds) {
      state.secondsIntoDay -= state.dayDurationSeconds;
      state.day += 1;
      // advance season every 10 days
      if ((state.day - 1) % 10 === 0) state.seasonIndex = (state.seasonIndex + 1) % 4;
      // pick new day's weather
      currentDayWeather = chooseDailyWeather(state.seasonIndex);
    }
    // Weather for the day; disable weather while inside
    const ge = (window as any).gameEngine as GameEngine | undefined;
    const inside = !!ge && typeof (ge as any).isInteriorScene === 'function' ? ge.isInteriorScene() : false;
    state.weather = inside ? 'clear' : currentDayWeather;
    // Expose current weather globally so the game can react (e.g., rain waters plants)
    (window as any).currentWeather = state.weather;

    renderWorldHUD(ctx, state, {
      canvasWidth: hudCanvas.width,
      canvasHeight: hudCanvas.height,
      margin: 16,
      disableDarkening: inside,
    });

    // Player resource HUD (top-left)
    const ge2 = (window as any).gameEngine as GameEngine | undefined;
    if (ge2 && typeof (ge2 as any).getHUDSnapshot === 'function') {
      const snap = ge2.getHUDSnapshot();
      renderPlayerHUD(ctx, snap, { canvasWidth: hudCanvas.width, canvasHeight: hudCanvas.height, margin: 16 });
      if (typeof (ge2 as any).getInventoryView === 'function') {
        const inv = (ge2 as any).getInventoryView();
        const slotSize = 32, spacing = 8, marginBottom = 16;
        renderInventory(ctx, inv.items as InventoryItem[], inv.selectedIndex, { slotSize, spacing, marginBottom }, (ictx, x, y, size, item) => {
          // Draw tiny plant icon for seeds using game assets
          if (item.kind === 'seed') {
            const assets = (ge2 as any).getAssets?.() ?? (window as any).gameEngine?.getAssets?.();
            const img = assets?.plantSprites?.[item.plantType];
            if (img && img.complete && img.naturalWidth > 0) {
              const pad = 4;
              const dw = size - pad * 2;
              const dh = size - pad * 2;
              ictx.save();
              ictx.imageSmoothingEnabled = false;
              ictx.drawImage(img, x + pad, y + pad, dw, dh);
              ictx.restore();
              return;
            }
            // Fallback: draw a procedural sprout icon
            const s = Math.min(18, size * 0.7);
            const sx = x + size * 0.16, sy = y + size * 0.14;
            ictx.save();
            ictx.strokeStyle = '#6eff6e';
            ictx.lineWidth = 2;
            ictx.beginPath();
            ictx.moveTo(sx + s * 0.5, sy + s);
            ictx.quadraticCurveTo(sx + s * 0.55, sy + s * 0.6, sx + s * 0.5, sy + s * 0.3);
            ictx.stroke();
            ictx.fillStyle = '#a4ff7a';
            ictx.beginPath();
            ictx.ellipse(sx + s * 0.38, sy + s * 0.42, s * 0.18, s * 0.10, -0.6, 0, Math.PI * 2);
            ictx.ellipse(sx + s * 0.62, sy + s * 0.40, s * 0.18, s * 0.10, 0.6, 0, Math.PI * 2);
            ictx.fill();
            ictx.restore();
            return;
          }
          // Tools: simple glyph
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
        });
        // Prompt and notifications above the inventory bar
        if (typeof (ge2 as any).getOverlayTexts === 'function') {
          const overlay = (ge2 as any).getOverlayTexts();
          const invTopY = hudCanvas.height - marginBottom - slotSize - 10; // mirror InventoryHUD positioning
          renderPromptAndNotifications(ctx, overlay.prompt, overlay.notifications, { canvasWidth: hudCanvas.width, aboveY: invTopY - 8 });
        }
      }
    }
    requestAnimationFrame(loop);
  };
  requestAnimationFrame(loop);
})();
