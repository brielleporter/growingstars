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
}

export type LayerIndex = Record<string, TiledLayer>;

export class MapLoader {
  public async loadMap(mapPath: string): Promise<LoadedMap> {
    const map = await this.fetchJson<TiledMap>(mapPath);

    const baseDir = mapPath.substring(0, mapPath.lastIndexOf('/'));

    const tilesets: LoadedTileset[] = [];
    for (const tsRef of map.tilesets) {
      const tsPath = this.resolvePath(baseDir, tsRef.source);
      const tileset = await this.loadTileset(tsPath);
      tilesets.push({ firstgid: tsRef.firstgid, ...tileset });
    }

    // Ensure tilesets are sorted by firstgid ascending for lookup
    tilesets.sort((a, b) => a.firstgid - b.firstgid);

    const tileLayers = map.layers.filter(l => l.type === 'tilelayer' && l.visible);

    return {
      widthTiles: map.width,
      heightTiles: map.height,
      tileWidth: map.tilewidth,
      tileHeight: map.tileheight,
      layers: tileLayers as TiledLayer[],
      tilesets,
    };
  }

  private async loadTileset(tsPath: string): Promise<Omit<LoadedTileset, 'firstgid'>> {
    if (tsPath.endsWith('.tsj')) {
      // JSON tileset
      const ts = await this.fetchJson<any>(tsPath);
      const imagePath = this.resolvePath(tsPath.substring(0, tsPath.lastIndexOf('/')), ts.image);
      const image = await this.loadImage(imagePath);
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
      const imagePath = this.resolvePath(tsPath.substring(0, tsPath.lastIndexOf('/')), src);
      const image = await this.loadImage(imagePath);
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
}
