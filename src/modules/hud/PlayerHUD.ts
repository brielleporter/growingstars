export interface PlayerHUDState {
  water: number;      // 0..maxWater
  maxWater: number;   // e.g., 10
  seeds: number;      // count
  seedType: string;   // label
  coins: number;      // count
  stamina: number;    // 0..maxStamina
  maxStamina: number; // e.g., 100
}

export interface PlayerHUDOptions {
  canvasWidth: number;
  canvasHeight: number;
  margin?: number;
  panelWidth?: number;
}

export function renderHUD(canvasContext: CanvasRenderingContext2D, hudState: PlayerHUDState, renderOptions: PlayerHUDOptions): void {
  const panelMargin = renderOptions.margin ?? 16;
  const panelWidth = renderOptions.panelWidth ?? 260;
  // Calculate panel height based on rows
  const rowHeight = 32;
  const innerPadding = 16; // Increased from 12 to 16 for more spacing from edges
  const numberOfRows = 3; // stamina, water, coins (seeds moved to bottom bar)
  const panelHeight = innerPadding * 2 + 8 + numberOfRows * rowHeight + (numberOfRows - 1) * 16; // Added 8px for extra top spacing

  const panelX = panelMargin;
  const panelY = panelMargin;
  canvasContext.save();
  // Panel background
  roundRectPath(canvasContext, panelX, panelY, panelWidth, panelHeight, 12);
  const backgroundGradient = canvasContext.createLinearGradient(panelX, panelY, panelX, panelY + panelHeight);
  backgroundGradient.addColorStop(0, 'rgba(10, 25, 25, 0.85)');
  backgroundGradient.addColorStop(1, 'rgba(10, 14, 18, 0.85)');
  canvasContext.fillStyle = backgroundGradient;
  canvasContext.fill();
  canvasContext.lineWidth = 2;
  canvasContext.strokeStyle = '#43ffd9';
  canvasContext.shadowColor = '#43ffd9';
  canvasContext.shadowBlur = 12;
  canvasContext.stroke();
  canvasContext.shadowBlur = 0;
  canvasContext.restore();

  let currentRowY = panelY + innerPadding + 8; // Add extra 8px spacing from top
  // 1) Stamina bar (yellow progress bar) - moved to top with more spacing
  drawStaminaBar(canvasContext, panelX + innerPadding, currentRowY, panelWidth - innerPadding * 2, rowHeight - 2, hudState.stamina, hudState.maxStamina);
  currentRowY += rowHeight + 16; // Increased spacing

  // 2) Water bar (turquoise segmented battery)
  drawWaterBar(canvasContext, panelX + innerPadding, currentRowY, panelWidth - innerPadding * 2, rowHeight - 2, hudState.water, hudState.maxWater);
  currentRowY += rowHeight + 16; // Increased spacing

  // 3) Coin inventory (coin icon + amount)
  drawCoinsRow(canvasContext, panelX + innerPadding, currentRowY, panelWidth - innerPadding * 2, rowHeight - 2, hudState.coins);
}

function drawWaterBar(canvasContext: CanvasRenderingContext2D, barX: number, barY: number, barWidth: number, barHeight: number, currentWater: number, maximumWater: number): void {
  const numberOfSegments = Math.max(1, maximumWater | 0);
  const segmentGap = 3;
  const segmentWidth = (barWidth - segmentGap * (numberOfSegments - 1)) / numberOfSegments;
  // Outer battery outline
  canvasContext.save();
  roundRectPath(canvasContext, barX - 4, barY - 2, barWidth + 8, barHeight + 4, 8);
  canvasContext.strokeStyle = 'rgba(67,255,217,0.6)';
  canvasContext.lineWidth = 1.5;
  canvasContext.stroke();
  // Tip
  const batteryTipWidth = 8;
  const batteryTipHeight = Math.min(barHeight * 0.6, 12);
  roundRectPath(canvasContext, barX + barWidth + 8, barY + (barHeight - batteryTipHeight) / 2, batteryTipWidth, batteryTipHeight, 3);
  canvasContext.fillStyle = 'rgba(67,255,217,0.6)';
  canvasContext.fill();
  // Segments
  const filledSegmentCount = Math.max(0, Math.min(numberOfSegments, Math.floor(currentWater)));
  for (let segmentIndex = 0; segmentIndex < numberOfSegments; segmentIndex++) {
    const segmentX = Math.round(barX + segmentIndex * (segmentWidth + segmentGap));
    const isSegmentActive = segmentIndex < filledSegmentCount;
    const segmentFillColor = isSegmentActive ? 'rgba(137,255,232,0.9)' : 'rgba(137,255,232,0.15)';
    const segmentStrokeColor = isSegmentActive ? '#43ffd9' : 'rgba(67,255,217,0.35)';
    roundRectPath(canvasContext, segmentX, barY, segmentWidth, barHeight, 4);
    canvasContext.fillStyle = segmentFillColor;
    canvasContext.fill();
    canvasContext.strokeStyle = segmentStrokeColor;
    canvasContext.lineWidth = 1;
    canvasContext.stroke();
  }
  // Label
  canvasContext.fillStyle = '#89ffe8';
  canvasContext.font = '12px monospace';
  canvasContext.textBaseline = 'alphabetic';
  canvasContext.textAlign = 'left';
  canvasContext.fillText(`Water ${filledSegmentCount}/${numberOfSegments}`, barX, barY - 4);
  canvasContext.restore();
}

function drawStaminaBar(canvasContext: CanvasRenderingContext2D, barX: number, barY: number, barWidth: number, barHeight: number, currentStamina: number, maximumStamina: number): void {
  const staminaFillRatio = Math.max(0, Math.min(1, currentStamina / maximumStamina));
  
  // Background bar
  canvasContext.save();
  roundRectPath(canvasContext, barX - 2, barY - 2, barWidth + 4, barHeight + 4, 6);
  canvasContext.strokeStyle = 'rgba(255, 215, 0, 0.6)';
  canvasContext.lineWidth = 1.5;
  canvasContext.stroke();
  
  // Background fill
  roundRectPath(canvasContext, barX, barY, barWidth, barHeight, 4);
  canvasContext.fillStyle = 'rgba(255, 215, 0, 0.1)';
  canvasContext.fill();
  
  // Foreground fill based on stamina level (smooth continuous fill)
  if (staminaFillRatio > 0) {
    const filledBarWidth = barWidth * staminaFillRatio;
    
    // Use smooth clipping for continuous appearance
    canvasContext.save();
    roundRectPath(canvasContext, barX, barY, barWidth, barHeight, 4);
    canvasContext.clip();
    
    // Create full-width rectangle, but clipped to filledBarWidth
    roundRectPath(canvasContext, barX, barY, filledBarWidth, barHeight, 4);
    
    // Color based on stamina level
    let staminaBarColor = 'rgba(255, 215, 0, 0.8)'; // Golden yellow
    if (staminaFillRatio < 0.25) {
      staminaBarColor = 'rgba(255, 100, 100, 0.8)'; // Red when very low
    } else if (staminaFillRatio < 0.5) {
      staminaBarColor = 'rgba(255, 165, 0, 0.8)'; // Orange when low
    }
    
    canvasContext.fillStyle = staminaBarColor;
    canvasContext.fill();
    
    // Highlight gradient for smooth appearance
    const highlightGradient = canvasContext.createLinearGradient(barX, barY, barX, barY + barHeight);
    highlightGradient.addColorStop(0, 'rgba(255, 255, 255, 0.3)');
    highlightGradient.addColorStop(0.5, 'rgba(255, 255, 255, 0.1)');
    highlightGradient.addColorStop(1, 'rgba(0, 0, 0, 0.1)');
    canvasContext.fillStyle = highlightGradient;
    canvasContext.fillRect(barX, barY, filledBarWidth, barHeight);
    
    canvasContext.restore();
  }
  
  // Label with more space from edge
  canvasContext.fillStyle = '#ffd700';
  canvasContext.font = '12px monospace';
  canvasContext.textBaseline = 'alphabetic';
  canvasContext.textAlign = 'left';
  const staminaLabelText = `Stamina ${Math.round(currentStamina)}/${Math.round(maximumStamina)}`;
  canvasContext.fillText(staminaLabelText, barX, barY - 8); // Moved down from y-4 to y-8 for more space
  canvasContext.restore();
}

// (Seed row removed; seeds now shown in bottom inventory bar)

function drawCoinsRow(canvasContext: CanvasRenderingContext2D, rowX: number, rowY: number, _rowWidth: number, rowHeight: number, coinCount: number): void {
  const coinIconSize = Math.min(rowHeight, 18);
  drawCoinIcon(canvasContext, rowX, rowY + (rowHeight - coinIconSize) / 2, coinIconSize);
  canvasContext.save();
  canvasContext.fillStyle = '#ffe56b';
  canvasContext.shadowColor = 'rgba(255,229,107,0.45)';
  canvasContext.shadowBlur = 6;
  canvasContext.font = '13px monospace';
  canvasContext.textBaseline = 'middle';
  canvasContext.textAlign = 'left';
  canvasContext.fillText(`${coinCount}`, rowX + coinIconSize + 10, rowY + rowHeight / 2);
  canvasContext.restore();
}

// (Sprout icon not used in top-left HUD)

function drawCoinIcon(canvasContext: CanvasRenderingContext2D, iconX: number, iconY: number, iconSize: number): void {
  const coinRadius = iconSize * 0.48;
  const coinCenterX = iconX + coinRadius + 1;
  const coinCenterY = iconY + coinRadius + 1;
  canvasContext.save();
  const coinGradient = canvasContext.createRadialGradient(coinCenterX - coinRadius * 0.3, coinCenterY - coinRadius * 0.3, coinRadius * 0.2, coinCenterX, coinCenterY, coinRadius);
  coinGradient.addColorStop(0, '#fff2a1');
  coinGradient.addColorStop(1, '#ffc94a');
  canvasContext.fillStyle = coinGradient;
  canvasContext.shadowColor = 'rgba(255,229,107,0.6)';
  canvasContext.shadowBlur = 8;
  canvasContext.beginPath();
  canvasContext.arc(coinCenterX, coinCenterY, coinRadius, 0, Math.PI * 2);
  canvasContext.fill();
  canvasContext.shadowBlur = 0;
  canvasContext.strokeStyle = '#e6b300';
  canvasContext.lineWidth = 1;
  canvasContext.stroke();
  canvasContext.restore();
}

function roundRectPath(canvasContext: CanvasRenderingContext2D, rectX: number, rectY: number, rectWidth: number, rectHeight: number, cornerRadius: number): void {
  const adjustedRadius = Math.min(cornerRadius, rectWidth / 2, rectHeight / 2);
  canvasContext.beginPath();
  canvasContext.moveTo(rectX + adjustedRadius, rectY);
  canvasContext.lineTo(rectX + rectWidth - adjustedRadius, rectY);
  canvasContext.quadraticCurveTo(rectX + rectWidth, rectY, rectX + rectWidth, rectY + adjustedRadius);
  canvasContext.lineTo(rectX + rectWidth, rectY + rectHeight - adjustedRadius);
  canvasContext.quadraticCurveTo(rectX + rectWidth, rectY + rectHeight, rectX + rectWidth - adjustedRadius, rectY + rectHeight);
  canvasContext.lineTo(rectX + adjustedRadius, rectY + rectHeight);
  canvasContext.quadraticCurveTo(rectX, rectY + rectHeight, rectX, rectY + rectHeight - adjustedRadius);
  canvasContext.lineTo(rectX, rectY + adjustedRadius);
  canvasContext.quadraticCurveTo(rectX, rectY, rectX + adjustedRadius, rectY);
}
