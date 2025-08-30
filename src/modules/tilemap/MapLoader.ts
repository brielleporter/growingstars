/**
 * Loads Tiled maps (.tmj) and external tilesets (.tsj/.tsx) for rendering.
 */

export interface TiledLayer {
  id: number;
  name: string;
  type: 'tilelayer' | string;
  data: number[];
  width: number;
  height: number;
  visible: boolean;
}

export interface TiledTilesetRef {
  firstgid: number;
  source: string; // relative path to .tsj/.tsx
}

export interface TiledMap {
  width: number; // in tiles
  height: number; // in tiles
  tilewidth: number;
  tileheight: number;
  layers: TiledLayer[];
  tilesets: TiledTilesetRef[];
}

export interface LoadedTileset {
  firstgid: number;
  columns: number;
  tilewidth: number;
  tileheight: number;
  image: HTMLImageElement;
}

export interface LoadedMap {
  widthTiles: number;
  heightTiles: number;
  tileWidth: number; // source tile size in tileset
  tileHeight: number;
  layers: TiledLayer[]; // tile layers only
  tilesets: LoadedTileset[];
  // For TMX infinite maps, the stitched layer indices start at (originX, originY)
  // which represent the global Tiled coordinates of the (0,0) tile in our arrays.
  originX?: number;
  originY?: number;
}

export type LayerIndex = Record<string, TiledLayer>;

export class MapLoader {
  public async loadMap(mapPath: string): Promise<LoadedMap> {
    if (mapPath.endsWith('.tmj') || mapPath.endsWith('.json')) {
      return this.loadJsonMap(mapPath);
    }
    if (mapPath.endsWith('.tmx') || mapPath.endsWith('.xml')) {
      return this.loadXmlMap(mapPath);
    }
    throw new Error('Unsupported map format: ' + mapPath);
  }

  private async loadJsonMap(mapPath: string): Promise<LoadedMap> {
    const map = await this.fetchJson<TiledMap>(mapPath);
    const baseDir = mapPath.substring(0, mapPath.lastIndexOf('/'));
    const tilesets: LoadedTileset[] = [];
    for (const tsRef of map.tilesets) {
      const tsPath = this.resolvePath(baseDir, tsRef.source);
      const tileset = await this.loadTileset(tsPath);
      tilesets.push({ firstgid: tsRef.firstgid, ...tileset });
    }
    tilesets.sort((a, b) => a.firstgid - b.firstgid);
    const tileLayers = map.layers.filter(l => l.type === 'tilelayer' && (l as any).visible !== false);
    return {
      widthTiles: map.width,
      heightTiles: map.height,
      tileWidth: map.tilewidth,
      tileHeight: map.tileheight,
      layers: tileLayers as TiledLayer[],
      tilesets,
      originX: 0,
      originY: 0,
    };
  }

  private async loadXmlMap(mapPath: string): Promise<LoadedMap> {
    const text = await this.fetchText(mapPath);
    const doc = new DOMParser().parseFromString(text, 'application/xml');
    const mapEl = doc.querySelector('map');
    if (!mapEl) throw new Error('Invalid TMX map: ' + mapPath);

    const tilewidth = Number(mapEl.getAttribute('tilewidth'));
    const tileheight = Number(mapEl.getAttribute('tileheight'));

    // Load tilesets: inline or external
    const baseDir = mapPath.substring(0, mapPath.lastIndexOf('/'));
    const tilesets: LoadedTileset[] = [];
    const tsEls = Array.from(mapEl.querySelectorAll('tileset'));
    for (const tsEl of tsEls) {
      const firstgid = Number(tsEl.getAttribute('firstgid') || '1');
      const src = tsEl.getAttribute('source');
      if (src) {
        // external TSX
        const tsPath = this.resolvePath(baseDir, src);
        const loaded = await this.loadTileset(tsPath);
        tilesets.push({ firstgid, ...loaded });
      } else {
        // inline tileset with <image>
        const imageEl = tsEl.querySelector('image');
        if (!imageEl) continue;
        const columns = Number(tsEl.getAttribute('columns') || '1');
        const tw = Number(tsEl.getAttribute('tilewidth') || String(tilewidth));
        const th = Number(tsEl.getAttribute('tileheight') || String(tileheight));
        const srcAttr = imageEl.getAttribute('source') || '';
        const imagePath = this.resolveImagePath(baseDir, srcAttr);
        const image = await this.loadImageWithFallbacks(imagePath);
        tilesets.push({ firstgid, columns, tilewidth: tw, tileheight: th, image });
      }
    }
    tilesets.sort((a, b) => a.firstgid - b.firstgid);

    // Layers (support finite CSV and infinite chunked CSV)
    const layers: TiledLayer[] = [];
    const layerEls = Array.from(mapEl.querySelectorAll('layer'));

    // First pass: compute global extents across all chunked layers
    let globalMinX = 0, globalMinY = 0, globalMaxX = 0, globalMaxY = 0;
    let sawChunks = false;
    for (const layEl of layerEls) {
      const dataEl = layEl.querySelector('data');
      if (!dataEl) continue;
      const chunks = Array.from(dataEl.querySelectorAll('chunk'));
      if (chunks.length === 0) continue;
      sawChunks = true;
      for (const ch of chunks) {
        const cx = Number(ch.getAttribute('x') || '0');
        const cy = Number(ch.getAttribute('y') || '0');
        const cw = Number(ch.getAttribute('width') || '0');
        const chh = Number(ch.getAttribute('height') || '0');
        globalMinX = Math.min(globalMinX, cx);
        globalMinY = Math.min(globalMinY, cy);
        globalMaxX = Math.max(globalMaxX, cx + cw);
        globalMaxY = Math.max(globalMaxY, cy + chh);
      }
    }

    let finalWidth = 0;
    let finalHeight = 0;
    if (sawChunks) {
      finalWidth = Math.max(0, globalMaxX - globalMinX);
      finalHeight = Math.max(0, globalMaxY - globalMinY);
    }

    for (const layEl of layerEls) {
      const type = 'tilelayer';
      const visible = (layEl.getAttribute('visible') ?? '1') !== '0';
      const id = Number(layEl.getAttribute('id') || '0');
      const name = layEl.getAttribute('name') || `Layer ${id}`;
      const dataEl = layEl.querySelector('data');
      if (!dataEl) continue;
      const chunks = Array.from(dataEl.querySelectorAll('chunk'));
      if (chunks.length === 0) {
        // Finite map
        const width = Number(layEl.getAttribute('width'));
        const height = Number(layEl.getAttribute('height'));
        const csv = (dataEl.textContent || '').trim();
        const arr = this.parseCsv(csv);
        layers.push({ id, name, type, data: arr, width, height, visible });
        if (!sawChunks) {
          finalWidth = Math.max(finalWidth, width);
          finalHeight = Math.max(finalHeight, height);
        }
      } else {
        // Chunked (infinite) map. Compute extents and stitch.
        type Chunk = { x: number; y: number; width: number; height: number; data: number[] };
        const parsed: Chunk[] = chunks.map(ch => ({
          x: Number(ch.getAttribute('x') || '0'),
          y: Number(ch.getAttribute('y') || '0'),
          width: Number(ch.getAttribute('width') || '0'),
          height: Number(ch.getAttribute('height') || '0'),
          data: this.parseCsv((ch.textContent || '').trim()),
        }));
        const minX = sawChunks ? globalMinX : Math.min(...parsed.map(p => p.x));
        const minY = sawChunks ? globalMinY : Math.min(...parsed.map(p => p.y));
        const maxX = sawChunks ? globalMaxX : Math.max(...parsed.map(p => p.x + p.width));
        const maxY = sawChunks ? globalMaxY : Math.max(...parsed.map(p => p.y + p.height));
        const width = Math.max(0, maxX - minX);
        const height = Math.max(0, maxY - minY);
        const stitched = new Array(width * height).fill(0);
        for (const c of parsed) {
          for (let ty = 0; ty < c.height; ty++) {
            for (let tx = 0; tx < c.width; tx++) {
              const srcIdx = ty * c.width + tx;
              const dstX = (c.x - minX) + tx;
              const dstY = (c.y - minY) + ty;
              const dstIdx = dstY * width + dstX;
              stitched[dstIdx] = c.data[srcIdx] | 0;
            }
          }
        }
        layers.push({ id, name, type, data: stitched, width, height, visible });
        finalWidth = Math.max(finalWidth, width);
        finalHeight = Math.max(finalHeight, height);
      }
    }

    return {
      widthTiles: finalWidth,
      heightTiles: finalHeight,
      tileWidth: tilewidth,
      tileHeight: tileheight,
      layers: layers.filter(l => l.visible),
      tilesets,
      originX: sawChunks ? globalMinX : 0,
      originY: sawChunks ? globalMinY : 0,
    };
  }

  private async loadTileset(tsPath: string): Promise<Omit<LoadedTileset, 'firstgid'>> {
    if (tsPath.endsWith('.tsj')) {
      // JSON tileset
      const ts = await this.fetchJson<any>(tsPath);
      const imagePath = this.resolveImagePath(tsPath.substring(0, tsPath.lastIndexOf('/')), ts.image);
      const image = await this.loadImageWithFallbacks(imagePath);
      return {
        columns: ts.columns,
        tilewidth: ts.tilewidth,
        tileheight: ts.tileheight,
        image,
      };
    } else if (tsPath.endsWith('.tsx') || tsPath.endsWith('.xml')) {
      // XML tileset
      const text = await this.fetchText(tsPath);
      const parser = new DOMParser();
      const doc = parser.parseFromString(text, 'application/xml');
      const tilesetEl = doc.querySelector('tileset');
      const imageEl = doc.querySelector('image');
      if (!tilesetEl || !imageEl) throw new Error('Invalid TSX tileset: ' + tsPath);
      const tilewidth = Number(tilesetEl.getAttribute('tilewidth'));
      const tileheight = Number(tilesetEl.getAttribute('tileheight'));
      const columns = Number(tilesetEl.getAttribute('columns'));
      const src = imageEl.getAttribute('source') || '';
      const imagePath = this.resolveImagePath(tsPath.substring(0, tsPath.lastIndexOf('/')), src);
      const image = await this.loadImageWithFallbacks(imagePath);
      return { columns, tilewidth, tileheight, image };
    } else {
      throw new Error('Unsupported tileset format: ' + tsPath);
    }
  }

  private resolvePath(baseDir: string, rel: string): string {
    // Normalize ../
    const stack: string[] = baseDir.split('/');
    for (const part of rel.split('/')) {
      if (part === '..') stack.pop();
      else if (part === '.') continue;
      else stack.push(part);
    }
    return stack.join('/');
  }

  private resolveImagePath(baseDir: string, rel: string): string {
    // If rel is absolute (starts with '/'), use as-is
    if (rel.startsWith('/')) return rel;
    // Common case: Tiled files placed in /src/assets/maps referencing sibling /tilesets
    const direct = this.resolvePath(baseDir, rel);
    if (baseDir.endsWith('/maps')) {
      const file = rel.split('/').pop() || rel;
      const tilesetGuess = baseDir.replace(/\/maps$/,'/tilesets') + '/' + file;
      return direct + '|' + tilesetGuess; // pack multiple candidates; loader will split
    }
    return direct;
  }

  private async fetchJson<T>(path: string): Promise<T> {
    const res = await fetch(path);
    if (!res.ok) throw new Error(`Failed to fetch ${path}: ${res.status}`);
    return res.json() as Promise<T>;
  }

  private async fetchText(path: string): Promise<string> {
    const res = await fetch(path);
    if (!res.ok) throw new Error(`Failed to fetch ${path}: ${res.status}`);
    return res.text();
    
  }

  private loadImage(src: string): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error('Failed to load image: ' + src));
      img.src = src;
    });
  }

  private async loadImageWithFallbacks(primary: string): Promise<HTMLImageElement> {
    // Support a packed list of candidates separated by '|'
    const candidates: string[] = [];
    primary.split('|').forEach(p => candidates.push(p));
    const last = candidates[candidates.length - 1];
    const file = (last.split('/').pop() || last);
    // Add global guesses
    candidates.push(`/src/assets/tilesets/${file}`);
    candidates.push(`/src/assets/farm/${file}`);
    // Try sequentially
    let lastErr: any;
    for (const c of candidates) {
      try { return await this.loadImage(c); } catch (e) { lastErr = e; }
    }
    throw lastErr ?? new Error('Failed to load image: ' + primary);
  }

  private parseCsv(csv: string): number[] {
    if (!csv) return [];
    return csv
      .split(/\s*[,\n\r]+\s*/)
      .filter(Boolean)
      .map(v => Number(v) | 0);
  }
}
