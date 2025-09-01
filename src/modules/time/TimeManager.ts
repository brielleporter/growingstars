export interface TimeState {
  day: number;
  secondsIntoDay: number;
  dayDurationSeconds: number;
  seasonIndex: number;
  weather: 'clear' | 'cloud' | 'storm';
}

export interface GameTime {
  day: number;
  hour: number;
  totalHours: number;
}

export class TimeManager {
  private state: TimeState;
  private listeners: Array<(state: TimeState) => void> = [];

  constructor(initialState: TimeState) {
    this.state = { ...initialState };
  }

  public getState(): TimeState {
    return { ...this.state };
  }

  public getCurrentGameTime(): GameTime {
    const tRatio = this.state.secondsIntoDay / this.state.dayDurationSeconds; // 0-1
    const totalMinutes = Math.floor(tRatio * 24 * 60);
    const hour = Math.floor(totalMinutes / 60) % 24;
    const totalHours = (this.state.day - 1) * 24 + hour;
    
    return { day: this.state.day, hour, totalHours };
  }

  public updateTime(deltaTime: number): void {
    this.state.secondsIntoDay += deltaTime;
    
    // Handle day rollover
    if (this.state.secondsIntoDay >= this.state.dayDurationSeconds) {
      this.state.day += 1;
      this.state.secondsIntoDay = 0;
      
      // Update season every 10 days
      this.state.seasonIndex = Math.floor((this.state.day - 1) / 10) % 4;
    }
    
    this.notifyListeners();
  }

  public setTimeToHour(targetHour: number, nextDay: boolean = false): void {
    if (nextDay) {
      this.state.day += 1;
    }
    
    // Set time to specific hour (0-23)
    this.state.secondsIntoDay = (targetHour / 24) * this.state.dayDurationSeconds;
    
    // Update season if day changed
    this.state.seasonIndex = Math.floor((this.state.day - 1) / 10) % 4;
    
    this.notifyListeners();
  }

  public setWeather(weather: 'clear' | 'cloud' | 'storm'): void {
    this.state.weather = weather;
    this.notifyListeners();
  }

  public addListener(callback: (state: TimeState) => void): void {
    this.listeners.push(callback);
  }

  public removeListener(callback: (state: TimeState) => void): void {
    const index = this.listeners.indexOf(callback);
    if (index > -1) {
      this.listeners.splice(index, 1);
    }
  }

  private notifyListeners(): void {
    const stateCopy = { ...this.state };
    this.listeners.forEach(listener => listener(stateCopy));
  }
}