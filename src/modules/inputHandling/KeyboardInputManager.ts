/**
 * Keyboard input handling system
 */

export class KeyboardInputManager {
  private pressedKeys = new Set<string>();
  private validKeys = [
    'w', 'a', 's', 'd', 'p', 'b',
    '1', '2', '3', '4'
  ];

  public initialize(): void {
    addEventListener('keydown', this.handleKeyDown.bind(this));
    addEventListener('keyup', this.handleKeyUp.bind(this));
  }

  public cleanup(): void {
    removeEventListener('keydown', this.handleKeyDown.bind(this));
    removeEventListener('keyup', this.handleKeyUp.bind(this));
  }

  public isKeyPressed(key: string): boolean {
    return this.pressedKeys.has(key.toLowerCase());
  }

  public getPressedKeys(): Set<string> {
    return new Set(this.pressedKeys);
  }

  private handleKeyDown(event: KeyboardEvent): void {
    const keyPressed = event.key.toLowerCase();
    
    if (this.validKeys.includes(keyPressed)) {
      this.pressedKeys.add(keyPressed);
      event.preventDefault();
    }
  }

  private handleKeyUp(event: KeyboardEvent): void {
    this.pressedKeys.delete(event.key.toLowerCase());
  }
}