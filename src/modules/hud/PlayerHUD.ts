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

export function renderHUD(ctx: CanvasRenderingContext2D, state: PlayerHUDState, opts: PlayerHUDOptions): void {
  const margin = opts.margin ?? 16;
  const panelW = opts.panelWidth ?? 260;
  // Calculate panel height based on rows
  const rowH = 32;
  const innerPad = 16; // Increased from 12 to 16 for more spacing from edges
  const rows = 3; // stamina, water, coins (seeds moved to bottom bar)
  const panelH = innerPad * 2 + 8 + rows * rowH + (rows - 1) * 16; // Added 8px for extra top spacing

  const x = margin;
  const y = margin;
  ctx.save();
  // Panel background
  roundRectPath(ctx, x, y, panelW, panelH, 12);
  const bg = ctx.createLinearGradient(x, y, x, y + panelH);
  bg.addColorStop(0, 'rgba(10, 25, 25, 0.85)');
  bg.addColorStop(1, 'rgba(10, 14, 18, 0.85)');
  ctx.fillStyle = bg;
  ctx.fill();
  ctx.lineWidth = 2;
  ctx.strokeStyle = '#43ffd9';
  ctx.shadowColor = '#43ffd9';
  ctx.shadowBlur = 12;
  ctx.stroke();
  ctx.shadowBlur = 0;
  ctx.restore();

  let cy = y + innerPad + 8; // Add extra 8px spacing from top
  // 1) Stamina bar (yellow progress bar) - moved to top with more spacing
  drawStaminaBar(ctx, x + innerPad, cy, panelW - innerPad * 2, rowH - 2, state.stamina, state.maxStamina);
  cy += rowH + 16; // Increased spacing

  // 2) Water bar (turquoise segmented battery)
  drawWaterBar(ctx, x + innerPad, cy, panelW - innerPad * 2, rowH - 2, state.water, state.maxWater);
  cy += rowH + 16; // Increased spacing

  // 3) Coin inventory (coin icon + amount)
  drawCoinsRow(ctx, x + innerPad, cy, panelW - innerPad * 2, rowH - 2, state.coins);
}

function drawWaterBar(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, water: number, maxWater: number): void {
  const segments = Math.max(1, maxWater | 0);
  const gap = 3;
  const segW = (w - gap * (segments - 1)) / segments;
  // Outer battery outline
  ctx.save();
  roundRectPath(ctx, x - 4, y - 2, w + 8, h + 4, 8);
  ctx.strokeStyle = 'rgba(67,255,217,0.6)';
  ctx.lineWidth = 1.5;
  ctx.stroke();
  // Tip
  const tipW = 8, tipH = Math.min(h * 0.6, 12);
  roundRectPath(ctx, x + w + 8, y + (h - tipH) / 2, tipW, tipH, 3);
  ctx.fillStyle = 'rgba(67,255,217,0.6)';
  ctx.fill();
  // Segments
  const filled = Math.max(0, Math.min(segments, Math.floor(water)));
  for (let i = 0; i < segments; i++) {
    const sx = Math.round(x + i * (segW + gap));
    const active = i < filled;
    const fill = active ? 'rgba(137,255,232,0.9)' : 'rgba(137,255,232,0.15)';
    const stroke = active ? '#43ffd9' : 'rgba(67,255,217,0.35)';
    roundRectPath(ctx, sx, y, segW, h, 4);
    ctx.fillStyle = fill;
    ctx.fill();
    ctx.strokeStyle = stroke;
    ctx.lineWidth = 1;
    ctx.stroke();
  }
  // Label
  ctx.fillStyle = '#89ffe8';
  ctx.font = '12px monospace';
  ctx.textBaseline = 'alphabetic';
  ctx.textAlign = 'left';
  ctx.fillText(`Water ${filled}/${segments}`, x, y - 4);
  ctx.restore();
}

function drawStaminaBar(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, stamina: number, maxStamina: number): void {
  const fillRatio = Math.max(0, Math.min(1, stamina / maxStamina));
  
  // Background bar
  ctx.save();
  roundRectPath(ctx, x - 2, y - 2, w + 4, h + 4, 6);
  ctx.strokeStyle = 'rgba(255, 215, 0, 0.6)';
  ctx.lineWidth = 1.5;
  ctx.stroke();
  
  // Background fill
  roundRectPath(ctx, x, y, w, h, 4);
  ctx.fillStyle = 'rgba(255, 215, 0, 0.1)';
  ctx.fill();
  
  // Foreground fill based on stamina level (smooth continuous fill)
  if (fillRatio > 0) {
    const fillW = w * fillRatio;
    
    // Use smooth clipping for continuous appearance
    ctx.save();
    roundRectPath(ctx, x, y, w, h, 4);
    ctx.clip();
    
    // Create full-width rectangle, but clipped to fillW
    roundRectPath(ctx, x, y, fillW, h, 4);
    
    // Color based on stamina level
    let fillColor = 'rgba(255, 215, 0, 0.8)'; // Golden yellow
    if (fillRatio < 0.25) {
      fillColor = 'rgba(255, 100, 100, 0.8)'; // Red when very low
    } else if (fillRatio < 0.5) {
      fillColor = 'rgba(255, 165, 0, 0.8)'; // Orange when low
    }
    
    ctx.fillStyle = fillColor;
    ctx.fill();
    
    // Highlight gradient for smooth appearance
    const grad = ctx.createLinearGradient(x, y, x, y + h);
    grad.addColorStop(0, 'rgba(255, 255, 255, 0.3)');
    grad.addColorStop(0.5, 'rgba(255, 255, 255, 0.1)');
    grad.addColorStop(1, 'rgba(0, 0, 0, 0.1)');
    ctx.fillStyle = grad;
    ctx.fillRect(x, y, fillW, h);
    
    ctx.restore();
  }
  
  // Label with more space from edge
  ctx.fillStyle = '#ffd700';
  ctx.font = '12px monospace';
  ctx.textBaseline = 'alphabetic';
  ctx.textAlign = 'left';
  const staminaText = `Stamina ${Math.round(stamina)}/${Math.round(maxStamina)}`;
  ctx.fillText(staminaText, x, y - 8); // Moved down from y-4 to y-8 for more space
  ctx.restore();
}

// (Seed row removed; seeds now shown in bottom inventory bar)

function drawCoinsRow(ctx: CanvasRenderingContext2D, x: number, y: number, _w: number, h: number, coins: number): void {
  const iconSize = Math.min(h, 18);
  drawCoinIcon(ctx, x, y + (h - iconSize) / 2, iconSize);
  ctx.save();
  ctx.fillStyle = '#ffe56b';
  ctx.shadowColor = 'rgba(255,229,107,0.45)';
  ctx.shadowBlur = 6;
  ctx.font = '13px monospace';
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'left';
  ctx.fillText(`${coins}`, x + iconSize + 10, y + h / 2);
  ctx.restore();
}

// (Sprout icon not used in top-left HUD)

function drawCoinIcon(ctx: CanvasRenderingContext2D, x: number, y: number, s: number): void {
  const r = s * 0.48;
  const cx = x + r + 1, cy = y + r + 1;
  ctx.save();
  const grad = ctx.createRadialGradient(cx - r * 0.3, cy - r * 0.3, r * 0.2, cx, cy, r);
  grad.addColorStop(0, '#fff2a1');
  grad.addColorStop(1, '#ffc94a');
  ctx.fillStyle = grad;
  ctx.shadowColor = 'rgba(255,229,107,0.6)';
  ctx.shadowBlur = 8;
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.strokeStyle = '#e6b300';
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.restore();
}

function roundRectPath(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.lineTo(x + w - rr, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + rr);
  ctx.lineTo(x + w, y + h - rr);
  ctx.quadraticCurveTo(x + w, y + h, x + w - rr, y + h);
  ctx.lineTo(x + rr, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - rr);
  ctx.lineTo(x, y + rr);
  ctx.quadraticCurveTo(x, y, x + rr, y);
}
