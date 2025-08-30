/**
 * Keyboard input handling system
 */

export class KeyboardInputManager {
  private pressedKeys = new Set<string>();
  private validKeys = [
    'w', 'a', 's', 'd', 'p', 'b', 'e', 'h', 'q',
    '1', '2', '3', '4'
  ];
  private boundDown?: (e: KeyboardEvent) => void;
  private boundUp?: (e: KeyboardEvent) => void;

  public initialize(): void {
    if (!this.boundDown) this.boundDown = this.handleKeyDown.bind(this);
    if (!this.boundUp) this.boundUp = this.handleKeyUp.bind(this);
    addEventListener('keydown', this.boundDown);
    addEventListener('keyup', this.boundUp);
  }

  public cleanup(): void {
    if (this.boundDown) removeEventListener('keydown', this.boundDown);
    if (this.boundUp) removeEventListener('keyup', this.boundUp);
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
