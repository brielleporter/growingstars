export type ShopItem = { plantType: 'eye' | 'tentacle' | 'jaws' | 'spike' | 'orb' | 'mushroom'; price: number };

export interface ShopState {
  open: boolean;
  items: ShopItem[];
  selectedIndex: number;
  coins: number;
}

export function renderShop(ctx: CanvasRenderingContext2D, state: ShopState, opts: { canvasWidth: number; canvasHeight: number }) {
  if (!state.open) return;
  const w = Math.min(420, Math.floor(opts.canvasWidth * 0.6));
  const h = Math.min(320, Math.floor(opts.canvasHeight * 0.6));
  const x = Math.floor((opts.canvasWidth - w) / 2);
  const y = Math.floor((opts.canvasHeight - h) / 2);

  // Panel
  ctx.save();
  roundRectPath(ctx, x, y, w, h, 14);
  const grad = ctx.createLinearGradient(x, y, x, y + h);
  grad.addColorStop(0, 'rgba(10,25,25,0.92)');
  grad.addColorStop(1, 'rgba(10,14,18,0.92)');
  ctx.fillStyle = grad;
  ctx.fill();
  ctx.lineWidth = 2;
  ctx.strokeStyle = '#43ffd9';
  ctx.shadowColor = '#43ffd9';
  ctx.shadowBlur = 12;
  ctx.stroke();
  ctx.shadowBlur = 0;

  // Header
  ctx.fillStyle = '#c8fff5';
  ctx.font = 'bold 16px monospace';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.fillText('Storefront', x + 16, y + 12);
  ctx.textAlign = 'right';
  ctx.fillStyle = '#ffe56b';
  ctx.fillText(`${state.coins} coins`, x + w - 16, y + 12);

  // Items list
  const listX = x + 16;
  const listY = y + 44;
  const rowH = 38;
  for (let i = 0; i < state.items.length; i++) {
    const it = state.items[i];
    const ry = listY + i * rowH;
    // row background (selected)
    if (i === state.selectedIndex) {
      ctx.save();
      roundRectPath(ctx, listX - 6, ry - 4, w - 32, rowH - 2, 8);
      ctx.fillStyle = 'rgba(67,255,217,0.12)';
      ctx.fill();
      ctx.strokeStyle = '#43ffd9';
      ctx.lineWidth = 1;
      ctx.stroke();
      ctx.restore();
    }
    // icon (procedural sprout placeholder)
    drawSproutIcon(ctx, listX, ry + 4, 22);
    // name + price
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#89ffe8';
    ctx.font = '14px monospace';
    ctx.fillText(cap(it.plantType) + ' seeds', listX + 30, ry + rowH / 2);
    ctx.textAlign = 'right';
    ctx.fillStyle = '#ffe56b';
    ctx.fillText(`${it.price}c`, x + w - 26, ry + rowH / 2);
  }

  // Footer help
  ctx.textAlign = 'center';
  ctx.textBaseline = 'bottom';
  ctx.fillStyle = '#c8fff5';
  ctx.font = '12px monospace';
  ctx.fillText('Enter: Buy  •  Esc: Close  •  ↑/↓: Select', x + w / 2, y + h - 10);
  ctx.restore();
}

function cap(s: string): string { return s.charAt(0).toUpperCase() + s.slice(1); }

function drawSproutIcon(ctx: CanvasRenderingContext2D, x: number, y: number, s: number) {
  ctx.save();
  ctx.strokeStyle = '#6eff6e';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(x + s * 0.5, y + s);
  ctx.quadraticCurveTo(x + s * 0.55, y + s * 0.6, x + s * 0.5, y + s * 0.3);
  ctx.stroke();
  ctx.fillStyle = '#a4ff7a';
  ctx.beginPath();
  ctx.ellipse(x + s * 0.38, y + s * 0.42, s * 0.18, s * 0.10, -0.6, 0, Math.PI * 2);
  ctx.ellipse(x + s * 0.62, y + s * 0.40, s * 0.18, s * 0.10, 0.6, 0, Math.PI * 2);
  ctx.fill();
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
