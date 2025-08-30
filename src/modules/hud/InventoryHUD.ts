export type InventoryItem = ({ kind: 'seed'; plantType: 'eye' | 'tentacle' | 'jaws' | 'spike' | 'orb' | 'mushroom'; count: number } | { kind: 'tool'; count: number }) | null;

export function renderInventory(
  ctx: CanvasRenderingContext2D,
  items: InventoryItem[],
  selectedIndex: number,
  opts?: { slotSize?: number; spacing?: number; marginBottom?: number },
  drawIcon?: (ctx: CanvasRenderingContext2D, x: number, y: number, size: number, item: NonNullable<InventoryItem>) => void
) {
  const slotSize = opts?.slotSize ?? 32;
  const spacing = opts?.spacing ?? 8;
  const marginBottom = opts?.marginBottom ?? 16;
  const totalW = items.length * slotSize + (items.length - 1) * spacing;
  const x0 = Math.floor((ctx.canvas.width - totalW) / 2);
  const y0 = ctx.canvas.height - marginBottom - slotSize - 10; // add slight offset above bottom

  for (let i = 0; i < items.length; i++) {
    const x = x0 + i * (slotSize + spacing);
    const y = y0;
    const selected = i === selectedIndex;
    drawSlot(ctx, x, y, slotSize, selected);
    const it = items[i];
    if (it && it.count > 0) {
      if (drawIcon) drawIcon(ctx, x, y, slotSize, it);
      else drawItemIcon(ctx, x, y, slotSize, it);
      drawCount(ctx, x, y, slotSize, it.count);
    }
  }
}

function drawSlot(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, selected: boolean) {
  ctx.save();
  // Background panel
  ctx.fillStyle = 'rgba(10, 18, 16, 0.8)';
  roundRectPath(ctx, x, y, s, s, 6);
  ctx.fill();
  // Border
  ctx.lineWidth = selected ? 2 : 1;
  ctx.strokeStyle = selected ? '#43ffd9' : 'rgba(67,255,217,0.35)';
  if (selected) { ctx.shadowColor = '#43ffd9'; ctx.shadowBlur = 10; }
  ctx.stroke();
  ctx.shadowBlur = 0;
  ctx.restore();
}

function drawItemIcon(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, item: NonNullable<InventoryItem>) {
  if (item.kind === 'seed') {
    drawSproutIcon(ctx, x + s * 0.16, y + s * 0.14, Math.min(18, s * 0.70));
  } else {
    // simple tool: wrench-like glyph
    ctx.save();
    ctx.strokeStyle = '#89ffe8';
    ctx.lineWidth = 2;
    const cx = x + s * 0.5, cy = y + s * 0.5;
    ctx.beginPath();
    ctx.arc(cx - 4, cy - 6, 5, Math.PI * 0.3, Math.PI * 1.7);
    ctx.moveTo(cx - 1, cy - 2);
    ctx.lineTo(cx + 6, cy + 6);
    ctx.stroke();
    ctx.restore();
  }
}

function drawCount(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, count: number) {
  ctx.save();
  ctx.fillStyle = '#c8fff5';
  ctx.font = '11px monospace';
  ctx.textAlign = 'right';
  ctx.textBaseline = 'alphabetic';
  ctx.fillText(`x${count}`, x + s - 3, y + s - 2);
  ctx.restore();
}

function drawSproutIcon(ctx: CanvasRenderingContext2D, x: number, y: number, size: number): void {
  ctx.save();
  // Stem
  ctx.strokeStyle = '#6eff6e';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(x + size * 0.5, y + size);
  ctx.quadraticCurveTo(x + size * 0.55, y + size * 0.6, x + size * 0.5, y + size * 0.3);
  ctx.stroke();
  // Leaves
  ctx.fillStyle = '#a4ff7a';
  ctx.beginPath();
  ctx.ellipse(x + size * 0.38, y + size * 0.42, size * 0.18, size * 0.10, -0.6, 0, Math.PI * 2);
  ctx.ellipse(x + size * 0.62, y + size * 0.40, size * 0.18, size * 0.10, 0.6, 0, Math.PI * 2);
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
