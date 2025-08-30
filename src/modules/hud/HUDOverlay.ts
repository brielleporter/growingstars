export type WeatherKind = 'clear' | 'cloud' | 'storm';

export interface HUDState {
  day: number;              // 1-based day count
  secondsIntoDay: number;   // simulated seconds since day start (0..dayDuration)
  dayDurationSeconds: number; // simulated seconds per full day (e.g., 40)
  seasonIndex: number;      // 0..3
  weather: WeatherKind;
}

export interface HUDOptions {
  canvasWidth: number;
  canvasHeight: number;
  margin?: number;          // distance from screen edges
  panelWidth?: number;
  panelHeight?: number;
  disableDarkening?: boolean; // if true, skip day/night overlay (e.g., indoors)
}

const SEASONS = ['Spring', 'Summer', 'Autumn', 'Winter'];

type RainDrop = { x: number; y: number; vx: number; vy: number; len: number; alpha: number };
let rainDrops: RainDrop[] = [];
let lastRenderTs = 0;
let lastCanvasW = 0, lastCanvasH = 0;

export function renderHUD(ctx: CanvasRenderingContext2D, state: HUDState, opts: HUDOptions): void {
  // Time step for procedural animations
  const now = performance.now();
  const dt = lastRenderTs ? Math.min(0.05, (now - lastRenderTs) / 1000) : 0; // clamp to 50ms
  lastRenderTs = now;
  const margin = opts.margin ?? 16;
  const panelW = opts.panelWidth ?? 240;
  const panelH = opts.panelHeight ?? 150;
  const x = Math.floor(opts.canvasWidth - panelW - margin);
  const y = Math.floor(margin);

  // Clear the whole HUD canvas each frame
  ctx.clearRect(0, 0, opts.canvasWidth, opts.canvasHeight);

  // Night/atmosphere overlay over the whole screen (procedural darkening)
  if (!opts.disableDarkening) {
    drawDayNightOverlay(ctx, state, opts);
  }

  // Procedural rain (storm only), render before panel so panel stays on top
  if (state.weather === 'storm') {
    ensureRainSystem(opts.canvasWidth, opts.canvasHeight);
    renderRain(ctx, dt, opts);
  }

  // Panel background (rounded, soft, solarpunk style)
  drawPanel(ctx, x, y, panelW, panelH);

  // Content padding
  const pad = 12;
  let cursorY = y + pad;

  // Segmented progress bar (24 segments = hours)
  const barX = x + pad;
  const barY = cursorY;
  const barW = panelW - pad * 2;
  const barH = 14;
  drawSegmentedDayBar(ctx, barX, barY, barW, barH, state);
  cursorY += barH + 12;

  // Digital clock (HH:MM) centered
  const tRatio = Math.max(0, Math.min(1, state.secondsIntoDay / state.dayDurationSeconds));
  const totalMinutes = Math.floor(tRatio * 24 * 60);
  const hh = Math.floor(totalMinutes / 60) % 24;
  const mm = totalMinutes % 60;
  const clock = `${hh.toString().padStart(2, '0')}:${mm.toString().padStart(2, '0')}`;
  ctx.save();
  ctx.fillStyle = '#c8fff5';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  ctx.font = 'bold 18px monospace';
  ctx.shadowColor = 'rgba(0,255,255,0.35)';
  ctx.shadowBlur = 6;
  ctx.fillText(clock, x + panelW / 2, cursorY);
  ctx.restore();
  cursorY += 24;

  // Day and Season line
  const season = SEASONS[Math.abs(state.seasonIndex) % SEASONS.length];
  const line = `Day ${state.day} • ${season}`;
  ctx.save();
  ctx.fillStyle = '#89ffe8';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  ctx.font = '12px monospace';
  ctx.globalAlpha = 0.9;
  ctx.fillText(line, x + panelW / 2, cursorY);
  ctx.restore();
  cursorY += 22;

  // Weather icon (right-aligned area); label left if needed
  const iconSize = 26;
  const iconX = x + panelW - pad - iconSize;
  const iconY = cursorY;
  drawWeatherIcon(ctx, iconX, iconY, iconSize, state.weather, hh);
}

function drawDayNightOverlay(ctx: CanvasRenderingContext2D, state: HUDState, opts: HUDOptions): void {
  const w = opts.canvasWidth, h = opts.canvasHeight;
  const t = Math.max(0, Math.min(1, state.secondsIntoDay / state.dayDurationSeconds));
  // Brightness peak at midday (cosine curve), darkest at midnight
  const brightness = 0.5 - 0.5 * Math.cos(t * Math.PI * 2);
  let alpha = Math.pow(1 - brightness, 1.5) * 0.65; // cap max darkness
  if (state.weather === 'storm') alpha = Math.min(0.85, alpha + 0.15);
  if (alpha < 0.01) return;
  ctx.save();
  // Very subtle magenta tint for night/storm vibe
  const tintR = 18, tintG = 0, tintB = 28;
  ctx.fillStyle = `rgba(${tintR},${tintG},${tintB},${alpha.toFixed(3)})`;
  ctx.fillRect(0, 0, w, h);
  ctx.restore();
}

function ensureRainSystem(w: number, h: number): void {
  if (w !== lastCanvasW || h !== lastCanvasH || rainDrops.length === 0) {
    lastCanvasW = w; lastCanvasH = h;
    const density = 0.00008; // reduced density for performance
    const target = Math.min(320, Math.max(80, Math.floor(w * h * density))); // cap
    rainDrops = [];
    for (let i = 0; i < target; i++) rainDrops.push(spawnDrop(w, h, Math.random() * h));
  }
}

function spawnDrop(w: number, h: number, yStart = -Math.random() * h * 0.3): RainDrop {
  // Slanted rain with slight variance
  const baseVy = 800 + Math.random() * 260; // px/s
  const baseVx = 150 + Math.random() * 80;  // px/s
  const len = 9 + Math.random() * 10;
  const alpha = 0.28 + Math.random() * 0.28;
  return {
    x: Math.random() * (w + 200) - 100, // spawn slightly offscreen horizontally
    y: yStart,
    vx: baseVx,
    vy: baseVy,
    len,
    alpha,
  };
}

function renderRain(ctx: CanvasRenderingContext2D, dt: number, opts: HUDOptions): void {
  const w = opts.canvasWidth, h = opts.canvasHeight;
  ctx.save();
  ctx.globalCompositeOperation = 'source-over';
  ctx.lineWidth = 1;
  for (let i = 0; i < rainDrops.length; i++) {
    const d = rainDrops[i];
    d.x += d.vx * dt;
    d.y += d.vy * dt;
    if (d.y - d.len > h || d.x - d.len > w + 120) {
      rainDrops[i] = spawnDrop(w, h);
      continue;
    }
    // Turquoise/cyan streaks (no per-drop blur for perf)
    ctx.strokeStyle = `rgba(137,255,232,${d.alpha.toFixed(3)})`;
    ctx.beginPath();
    // Line along motion vector
    const nx = d.x - (d.vx / d.vy) * d.len; // project proportionally to slope
    const ny = d.y - d.len;
    ctx.moveTo(nx, ny);
    ctx.lineTo(d.x, d.y);
    ctx.stroke();
  }
  ctx.restore();
}

function drawPanel(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number): void {
  // Soft background
  const radius = 12;
  ctx.save();
  roundRectPath(ctx, x, y, w, h, radius);
  const grad = ctx.createLinearGradient(x, y, x, y + h);
  grad.addColorStop(0, 'rgba(10, 25, 25, 0.85)');
  grad.addColorStop(1, 'rgba(10, 14, 18, 0.85)');
  ctx.fillStyle = grad;
  ctx.fill();

  // Glow stroke
  ctx.lineWidth = 2;
  ctx.strokeStyle = '#43ffd9';
  ctx.shadowColor = '#43ffd9';
  ctx.shadowBlur = 12;
  ctx.stroke();

  // Inner subtle stroke
  ctx.shadowBlur = 0;
  ctx.globalAlpha = 0.5;
  ctx.strokeStyle = 'rgba(67,255,217,0.35)';
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.restore();
}

function drawSegmentedDayBar(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, state: HUDState): void {
  const segments = 24;
  const gap = 2;
  const segW = (w - gap * (segments - 1)) / segments;
  const t = Math.max(0, Math.min(1, state.secondsIntoDay / state.dayDurationSeconds));
  const active = Math.floor(t * segments + 0.0001);
  for (let i = 0; i < segments; i++) {
    const sx = Math.round(x + i * (segW + gap));
    const isActive = i < active;
    const isNight = i < 6 || i >= 18; // 0-5 and 18-23
    const fill = isActive ? (isNight ? '#ff4bd7' : '#ffe56b') : 'rgba(180,255,235,0.15)';
    const stroke = isActive ? '#43ffd9' : 'rgba(67,255,217,0.35)';
    ctx.save();
    roundRectPath(ctx, sx, y, Math.max(1, segW), h, 3);
    ctx.fillStyle = fill;
    ctx.fill();
    ctx.lineWidth = 1;
    ctx.strokeStyle = stroke;
    ctx.stroke();
    ctx.restore();
  }
}

function drawWeatherIcon(ctx: CanvasRenderingContext2D, x: number, y: number, size: number, kind: WeatherKind, hour: number): void {
  ctx.save();
  ctx.translate(x, y);
  // Base tint for night
  const isNight = hour < 6 || hour >= 18;
  const nightAlpha = isNight ? 0.9 : 0.0;
  if (nightAlpha > 0) {
    ctx.globalAlpha = 0.15;
    ctx.fillStyle = '#ff4bd7';
    ctx.beginPath();
    ctx.arc(size * 0.5, size * 0.5, size * 0.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
  }

  if (kind === 'clear') {
    drawSun(ctx, size);
  } else if (kind === 'cloud') {
    drawCloud(ctx, size);
  } else {
    drawCloud(ctx, size);
    drawLightning(ctx, size);
  }
  ctx.restore();
}

function drawSun(ctx: CanvasRenderingContext2D, size: number): void {
  const cx = size * 0.5, cy = size * 0.5;
  const r = size * 0.28;
  // Core
  ctx.save();
  ctx.fillStyle = '#ffe56b';
  ctx.shadowColor = '#ffe56b';
  ctx.shadowBlur = 12;
  ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.fill();
  // Rays
  ctx.shadowBlur = 0;
  ctx.strokeStyle = '#ffe56b';
  ctx.lineWidth = 2;
  for (let i = 0; i < 8; i++) {
    const a = (Math.PI * 2 * i) / 8;
    const x1 = cx + Math.cos(a) * (r + 2);
    const y1 = cy + Math.sin(a) * (r + 2);
    const x2 = cx + Math.cos(a) * (r + 8);
    const y2 = cy + Math.sin(a) * (r + 8);
    ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
  }
  ctx.restore();
}

function drawCloud(ctx: CanvasRenderingContext2D, size: number): void {
  ctx.save();
  ctx.fillStyle = '#c8fff5';
  ctx.globalAlpha = 0.95;
  const baseY = size * 0.55;
  const r1 = size * 0.22, r2 = size * 0.18, r3 = size * 0.16;
  // three puffs
  ctx.beginPath();
  ctx.arc(size * 0.30, baseY, r1, 0, Math.PI * 2);
  ctx.arc(size * 0.55, baseY - 6, r2, 0, Math.PI * 2);
  ctx.arc(size * 0.75, baseY, r3, 0, Math.PI * 2);
  ctx.fill();
  // base
  ctx.beginPath();
  roundRectPath(ctx, size * 0.22, baseY - 6, size * 0.60, size * 0.24, 6);
  ctx.fill();
  ctx.restore();
}

function drawLightning(ctx: CanvasRenderingContext2D, size: number): void {
  ctx.save();
  ctx.fillStyle = '#ff4bd7';
  ctx.shadowColor = '#ff4bd7';
  ctx.shadowBlur = 8;
  const x = size * 0.48;
  const y = size * 0.35;
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(x - 6, y + 10);
  ctx.lineTo(x + 2, y + 10);
  ctx.lineTo(x - 4, y + 20);
  ctx.lineTo(x + 10, y + 6);
  ctx.lineTo(x + 2, y + 6);
  ctx.closePath();
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
