/**
 * Growing Stars - Main Game Entry Point
 */

import { GameEngine } from './core/GameEngine';

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