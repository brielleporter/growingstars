export function renderPromptAndNotifications(
  ctx: CanvasRenderingContext2D,
  prompt: string | null,
  notifications: string[],
  opts: { canvasWidth: number; aboveY: number }
) {
  const centerX = Math.floor(opts.canvasWidth / 2);
  let currentY = Math.max(0, opts.aboveY - 40);

  if (prompt) {
    const text = prompt;
    drawPanelText(ctx, text, centerX, currentY);
    currentY -= 36;
  }

  for (let i = 0; i < notifications.length; i++) {
    drawPanelText(ctx, notifications[i], centerX, currentY);
    currentY -= 32;
  }
}

function drawPanelText(ctx: CanvasRenderingContext2D, text: string, centerX: number, topY: number) {
  ctx.save();
  ctx.font = '14px monospace';
  const paddingX = 12;
  const w = Math.ceil(ctx.measureText(text).width) + paddingX * 2;
  const h = 26;
  const x = Math.floor(centerX - w / 2);
  const y = Math.floor(topY);
  // Soft solarpunk panel
  roundRectPath(ctx, x, y, w, h, 8);
  ctx.fillStyle = 'rgba(10, 18, 16, 0.85)';
  ctx.fill();
  ctx.lineWidth = 2;
  ctx.strokeStyle = '#43ffd9';
  ctx.shadowColor = '#43ffd9';
  ctx.shadowBlur = 10;
  ctx.stroke();
  ctx.shadowBlur = 0;
  // Text
  ctx.fillStyle = '#c8fff5';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, x + w / 2, y + h / 2 + 1);
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
