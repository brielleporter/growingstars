export class Camera {
  public x = 0;
  public y = 0;
  private viewportW = 0;
  private viewportH = 0;
  private worldW = 0;
  private worldH = 0;

  public setViewport(width: number, height: number): void {
    this.viewportW = width;
    this.viewportH = height;
    this.clamp();
  }

  public setWorldSize(width: number, height: number): void {
    this.worldW = width;
    this.worldH = height;
    this.clamp();
  }

  public follow(targetX: number, targetY: number): void {
    const halfW = Math.floor(this.viewportW / 2);
    const halfH = Math.floor(this.viewportH / 2);
    this.x = Math.floor(targetX - halfW);
    this.y = Math.floor(targetY - halfH);
    this.clamp();
  }

  private clamp(): void {
    const maxX = Math.max(0, this.worldW - this.viewportW);
    const maxY = Math.max(0, this.worldH - this.viewportH);
    this.x = Math.max(0, Math.min(maxX, this.x));
    this.y = Math.max(0, Math.min(maxY, this.y));
  }
}

