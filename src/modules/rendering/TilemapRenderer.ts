import { LoadedMap, LoadedTileset, TiledLayer } from '../tilemap/MapLoader';
import { TILE_CONFIG } from '../../configuration/gameConstants';

export class TilemapRenderer {
  private ctx: CanvasRenderingContext2D;

  constructor(ctx: CanvasRenderingContext2D) {
    this.ctx = ctx;
  }

  public render(map: LoadedMap, cameraOffset?: { x: number; y: number }, originOffset?: { x: number; y: number }): void {
    const displayTile = TILE_CONFIG.tileSize;
    const scaleX = displayTile / map.tileWidth;
    const scaleY = displayTile / map.tileHeight;

    this.ctx.save();
    if (cameraOffset) {
      this.ctx.translate(-cameraOffset.x, -cameraOffset.y);
    }
    if (originOffset) {
      this.ctx.translate(originOffset.x, originOffset.y);
    }
    for (const layer of map.layers) {
      this.renderLayer(layer, map.tilesets, scaleX, scaleY, displayTile, displayTile);
    }
    this.ctx.restore();
  }

  public renderFiltered(
    map: LoadedMap,
    layerNames: string[],
    cameraOffset?: { x: number; y: number },
    originOffset?: { x: number; y: number }
  ): void {
    const displayTile = TILE_CONFIG.tileSize;
    const scaleX = displayTile / map.tileWidth;
    const scaleY = displayTile / map.tileHeight;

    const set = new Set(layerNames);
    this.ctx.save();
    if (cameraOffset) {
      this.ctx.translate(-cameraOffset.x, -cameraOffset.y);
    }
    if (originOffset) {
      this.ctx.translate(originOffset.x, originOffset.y);
    }
    for (const layer of map.layers) {
      if (!set.has(layer.name)) continue;
      this.renderLayer(layer, map.tilesets, scaleX, scaleY, displayTile, displayTile);
    }
    this.ctx.restore();
  }

  public renderFilteredWithVariation(
    map: LoadedMap,
    layerNames: string[],
    variation: { randomizedLayers: Record<string, { density: number; flipHChance?: number; flipVChance?: number; rotate90Chance?: number; rotate180Chance?: number; jitterPx?: number }>; seed?: number },
    cameraOffset?: { x: number; y: number },
    originOffset?: { x: number; y: number }
  ): void {
    const displayTile = TILE_CONFIG.tileSize;
    const scaleX = displayTile / map.tileWidth;
    const scaleY = displayTile / map.tileHeight;

    const set = new Set(layerNames);
    const originTileX = Math.floor((originOffset?.x ?? 0) / displayTile);
    const originTileY = Math.floor((originOffset?.y ?? 0) / displayTile);

    this.ctx.save();
    if (cameraOffset) this.ctx.translate(-cameraOffset.x, -cameraOffset.y);
    if (originOffset) this.ctx.translate(originOffset.x, originOffset.y);

    for (const layer of map.layers) {
      if (!set.has(layer.name)) continue;
      this.renderLayer(
        layer,
        map.tilesets,
        scaleX,
        scaleY,
        displayTile,
        displayTile,
        {
          layerName: layer.name,
          originTileX,
          originTileY,
          variation,
        }
      );
    }

    this.ctx.restore();
  }

  private renderLayer(
    layer: TiledLayer,
    tilesets: LoadedTileset[],
    scaleX: number,
    scaleY: number,
    drawTileW: number,
    drawTileH: number,
    options?: {
      layerName?: string;
      originTileX?: number;
      originTileY?: number;
      variation?: { randomizedLayers: Record<string, { density: number; flipHChance?: number; flipVChance?: number; rotate90Chance?: number; rotate180Chance?: number; jitterPx?: number }>; seed?: number };
    }
  ): void {
    const { data, width, height } = layer;
    const name = options?.layerName ?? layer.name;
    const originTileX = options?.originTileX ?? 0;
    const originTileY = options?.originTileY ?? 0;

    // Tiled sets flip flags in top 3 bits; extract flags and clear them to get raw gid
    const GID_MASK = 0x1fffffff;
    const FLIP_H = 0x80000000;
    const FLIP_V = 0x40000000;
    const FLIP_D = 0x20000000;

    for (let ty = 0; ty < height; ty++) {
      for (let tx = 0; tx < width; tx++) {
        const idx = ty * width + tx;
        const gid = data[idx] | 0;
        const rawGid = gid & GID_MASK;
        if (rawGid === 0) continue;

        // Variation: optionally skip or flip deterministically per tile
        if (options?.variation) {
          const cfg = options.variation.randomizedLayers[name];
          if (cfg) {
            const r1 = this.rand01(originTileX + tx, originTileY + ty, options.variation.seed ?? 0, this.hashStr(name));
            if (r1 > cfg.density) {
              continue; // skip this decorative tile
            }
          }
        }

        const ts = this.findTilesetForGid(tilesets, rawGid);
        if (!ts) continue;
        const localId = rawGid - ts.firstgid; // 0-based
        const sx = (localId % ts.columns) * ts.tilewidth;
        const sy = Math.floor(localId / ts.columns) * ts.tileheight;
        const sw = ts.tilewidth;
        const sh = ts.tileheight;
        const dx = Math.floor(tx * drawTileW);
        const dy = Math.floor(ty * drawTileH);
        const dw = Math.floor(sw * scaleX);
        const dh = Math.floor(sh * scaleY);

        let flipH = (gid & FLIP_H) !== 0;
        let flipV = (gid & FLIP_V) !== 0;
        const flipD = (gid & FLIP_D) !== 0;

        if (options?.variation) {
          const cfg = options.variation.randomizedLayers[name];
          if (cfg) {
            const r2 = this.rand01(originTileX + tx + 7, originTileY + ty + 13, (options.variation.seed ?? 0) ^ 0x9e3779b9, this.hashStr(name) ^ 0x85ebca6b);
            const r3 = this.rand01(originTileX + tx + 17, originTileY + ty + 5, (options.variation.seed ?? 0) ^ 0xc2b2ae35, this.hashStr(name) ^ 0x27d4eb2f);
            const fh = cfg.flipHChance ?? 0;
            const fv = cfg.flipVChance ?? 0;
            if (fh > 0 && r2 < fh) flipH = !flipH;
            if (fv > 0 && r3 < fv) flipV = !flipV;
            // Rotation and jitter
            const r4 = this.rand01(originTileX + tx + 11, originTileY + ty + 19, (options.variation.seed ?? 0) ^ 0xa1b2c3d4, this.hashStr(name) ^ 0x165667b1);
            const r5 = this.rand01(originTileX + tx + 23, originTileY + ty + 29, (options.variation.seed ?? 0) ^ 0x31415926, this.hashStr(name) ^ 0xd3a2646c);
            var rotateDeg = 0;
            const rot90 = cfg.rotate90Chance ?? 0;
            const rot180 = cfg.rotate180Chance ?? 0;
            if (rot90 > 0 && r4 < rot90) rotateDeg = 90;
            if (rot180 > 0 && r5 < rot180) rotateDeg = (rotateDeg + 180) % 360; // allow combine
            const jitterMax = cfg.jitterPx ?? 0;
            var jitterX = 0, jitterY = 0;
            if (jitterMax > 0) {
              const rjx = this.rand01(originTileX + tx + 3, originTileY + ty + 31, (options.variation.seed ?? 0) ^ 0x9e3779b1, this.hashStr(name) ^ 0x7f4a7c15);
              const rjy = this.rand01(originTileX + tx + 41, originTileY + ty + 37, (options.variation.seed ?? 0) ^ 0x517cc1b7, this.hashStr(name) ^ 0x85ebca77);
              jitterX = Math.floor((rjx * 2 - 1) * jitterMax);
              jitterY = Math.floor((rjy * 2 - 1) * jitterMax);
            }

            // Render with combined transforms (flip + rotate + jitter)
            if (!flipD && (flipH || flipV || rotateDeg !== 0 || jitterMax > 0)) {
              this.ctx.save();
              this.ctx.translate(dx, dy);
              // Rotate around tile center first
              if (rotateDeg !== 0) {
                this.ctx.translate(dw / 2, dh / 2);
                this.ctx.rotate((Math.PI / 180) * rotateDeg);
                this.ctx.translate(-dw / 2, -dh / 2);
              }
              // Apply flips
              if (flipH) { this.ctx.translate(dw, 0); this.ctx.scale(-1, 1); }
              if (flipV) { this.ctx.translate(0, dh); this.ctx.scale(1, -1); }
              // Jitter last
              if (jitterX !== 0 || jitterY !== 0) this.ctx.translate(jitterX, jitterY);
              this.ctx.drawImage(ts.image, sx, sy, sw, sh, 0, 0, dw, dh);
              this.ctx.restore();
              continue;
            }
          }
        }

        if (!flipH && !flipV && !flipD) {
          this.ctx.drawImage(ts.image, sx, sy, sw, sh, dx, dy, dw, dh);
        } else if (!flipD) {
          // Handle simple horizontal/vertical flips
          this.ctx.save();
          this.ctx.translate(dx, dy);
          if (flipH) { this.ctx.translate(dw, 0); this.ctx.scale(-1, 1); }
          if (flipV) { this.ctx.translate(0, dh); this.ctx.scale(1, -1); }
          this.ctx.drawImage(ts.image, sx, sy, sw, sh, 0, 0, dw, dh);
          this.ctx.restore();
        } else {
          // Diagonal (anti-diagonal) flip not yet supported; draw without flipping for now
          this.ctx.drawImage(ts.image, sx, sy, sw, sh, dx, dy, dw, dh);
        }
      }
    }
  }

  private findTilesetForGid(tilesets: LoadedTileset[], gid: number): LoadedTileset | undefined {
    // Tilesets are applied in order of firstgid; pick the last one whose firstgid <= gid
    let candidate: LoadedTileset | undefined;
    for (const ts of tilesets) {
      if (gid >= ts.firstgid) candidate = ts; else break;
    }
    return candidate;
  }

  // Deterministic pseudo-random in [0,1) from tile + seed
  private rand01(x: number, y: number, seed: number, salt: number): number {
    let h = (x | 0) * 374761393 + (y | 0) * 668265263 + (seed | 0) * 0x27d4eb2d + (salt | 0);
    h = (h ^ (h >>> 13)) * 1274126177;
    h ^= h >>> 16;
    // Convert to [0,1)
    return ((h >>> 0) % 1000003) / 1000003;
  }

  private hashStr(s: string): number {
    let h = 2166136261;
    for (let i = 0; i < s.length; i++) {
      h ^= s.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return h | 0;
  }
}
