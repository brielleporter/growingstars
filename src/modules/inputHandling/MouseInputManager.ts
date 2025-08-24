/**
 * Mouse input handling system
 */

export interface ClickPosition {
  x: number;
  y: number;
}

export type ClickHandler = (position: ClickPosition) => void;

export class MouseInputManager {
  private canvas: HTMLCanvasElement;
  private clickHandlers: ClickHandler[] = [];

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
  }

  public initialize(): void {
    this.canvas.addEventListener('click', this.handleClick.bind(this));
  }

  public cleanup(): void {
    this.canvas.removeEventListener('click', this.handleClick.bind(this));
  }

  public addClickHandler(handler: ClickHandler): void {
    this.clickHandlers.push(handler);
  }

  public removeClickHandler(handler: ClickHandler): void {
    const index = this.clickHandlers.indexOf(handler);
    if (index > -1) {
      this.clickHandlers.splice(index, 1);
    }
  }

  private handleClick(event: MouseEvent): void {
    const canvasRectangle = this.canvas.getBoundingClientRect();
    const clickPosition: ClickPosition = {
      x: event.clientX - canvasRectangle.left,
      y: event.clientY - canvasRectangle.top,
    };

    this.clickHandlers.forEach(handler => handler(clickPosition));
  }
}