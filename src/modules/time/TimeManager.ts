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
    const dayProgressRatio = this.state.secondsIntoDay / this.state.dayDurationSeconds; // 0-1
    const totalMinutesInCurrentDay = Math.floor(dayProgressRatio * 24 * 60);
    const currentHour = Math.floor(totalMinutesInCurrentDay / 60) % 24;
    const totalHoursFromDayOne = (this.state.day - 1) * 24 + currentHour;
    
    return { day: this.state.day, hour: currentHour, totalHours: totalHoursFromDayOne };
  }

  public updateTime(deltaTimeSeconds: number): void {
    this.state.secondsIntoDay += deltaTimeSeconds;
    
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

  public addListener(listenerCallback: (state: TimeState) => void): void {
    this.listeners.push(listenerCallback);
  }

  public removeListener(listenerCallback: (state: TimeState) => void): void {
    const listenerIndex = this.listeners.indexOf(listenerCallback);
    if (listenerIndex > -1) {
      this.listeners.splice(listenerIndex, 1);
    }
  }

  private notifyListeners(): void {
    const currentStateCopy = { ...this.state };
    this.listeners.forEach(listenerCallback => listenerCallback(currentStateCopy));
  }
}