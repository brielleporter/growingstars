import { TimeManager, GameTime } from '../time/TimeManager';

export interface StaminaState {
  current: number;
  maximum: number;
  lastSleepTime: number;
  hasSleptToday: boolean;
  showedSleepReminder: boolean;
  lastPenaltyDay: number; // Track which day we last applied penalty
  lastReminderDay: number; // Track which day we last showed sleep reminder
}

export interface StaminaConfig {
  maxStamina: number;
  depletionRate: number; // stamina per game hour
  sleepReminderHour: number; // hour to show sleep reminder (e.g., 23 for 11pm)
  midnightPenalty: number; // coins lost for staying up past midnight
}

export class StaminaSystem {
  private state: StaminaState;
  private config: StaminaConfig;
  private timeManager: TimeManager;
  private onCoinsPenalty?: (amount: number) => void;
  private onNotification?: (message: string) => void;

  constructor(
    timeManager: TimeManager,
    config: Partial<StaminaConfig> = {}
  ) {
    this.timeManager = timeManager;
    this.config = {
      maxStamina: 100,
      depletionRate: 100 / 17, // Fully depleted from 7am to midnight (17 hours) - used in continuous calculation
      sleepReminderHour: 22, // 10pm
      midnightPenalty: 10,
      ...config
    };
    
    this.state = {
      current: this.config.maxStamina,
      maximum: this.config.maxStamina,
      lastSleepTime: 7, // Start at 7am on day 1 (7 total hours)
      hasSleptToday: false,
      showedSleepReminder: false,
      lastPenaltyDay: 0, // No penalty applied yet
      lastReminderDay: 0 // No reminder shown yet
    };
  }

  public getState(): StaminaState {
    return { ...this.state };
  }

  public onCoinsChanged(callback: (amount: number) => void): void {
    this.onCoinsPenalty = callback;
  }

  public onNotificationRequested(callback: (message: string) => void): void {
    this.onNotification = callback;
  }

  public update(): void {
    const currentTime = this.timeManager.getCurrentGameTime();
    
    this.resetDailyFlags(currentTime);
    this.updateStaminaDepletion(currentTime);
    this.checkSleepReminder(currentTime);
    this.checkAutoSleep(currentTime);
  }

  public sleep(): void {
    const currentTime = this.timeManager.getCurrentGameTime();
    
    // Determine if we need to advance to next day
    const needsNextDay = currentTime.hour >= 7;
    
    // Set time to 7am
    this.timeManager.setTimeToHour(7, needsNextDay);
    
    // Restore stamina
    this.state.current = this.state.maximum;
    
    // Update sleep tracking with continuous time
    const newTimeState = this.timeManager.getState();
    const newDayProgress = newTimeState.secondsIntoDay / newTimeState.dayDurationSeconds;
    const newHourFloat = newDayProgress * 24;
    this.state.lastSleepTime = (newTimeState.day - 1) * 24 + newHourFloat;
    this.state.hasSleptToday = true;
    this.state.showedSleepReminder = false;
    
    this.onNotification?.('You wake up feeling refreshed at 7am!');
  }

  private resetDailyFlags(currentTime: GameTime): void {
    // Reset daily flags when a new day starts
    // Check if we've moved to a new day since last sleep
    const currentDay = currentTime.day;
    const lastSleepDay = Math.floor((this.state.lastSleepTime - 7) / 24) + 1; // Adjust for 7am start
    
    if (currentDay > lastSleepDay) {
      this.state.hasSleptToday = false;
      this.state.showedSleepReminder = false;
    }
  }

  private updateStaminaDepletion(currentTime: GameTime): void {
    // Get continuous time from TimeManager for smooth depletion
    const timeState = this.timeManager.getState();
    const currentDayProgress = timeState.secondsIntoDay / timeState.dayDurationSeconds; // 0-1
    const currentHourFloat = currentDayProgress * 24; // 0-24 with decimals
    const currentTotalHoursFloat = (timeState.day - 1) * 24 + currentHourFloat;
    
    // Deplete stamina based on continuous time since last sleep
    const hoursSinceLastSleep = currentTotalHoursFloat - this.state.lastSleepTime;
    const expectedStamina = Math.max(0, this.state.maximum - (hoursSinceLastSleep * (100 / 17))); // Back to hourly rate
    const newStamina = Math.max(0, Math.min(this.state.maximum, expectedStamina));
    
    this.state.current = newStamina;
  }

  private checkSleepReminder(currentTime: GameTime): void {
    // Show sleep reminder at configured hour if haven't slept today and haven't shown reminder today
    if (currentTime.hour === this.config.sleepReminderHour && 
        !this.state.hasSleptToday && 
        this.state.lastReminderDay < currentTime.day) {
      this.onNotification?.(`You should sleep soon! Staying up past midnight costs ${this.config.midnightPenalty} coins.`);
      this.state.lastReminderDay = currentTime.day;
      this.state.showedSleepReminder = true;
    }
  }

  private checkAutoSleep(currentTime: GameTime): void {
    // Auto-sleep when stamina hits 0
    if (this.state.current <= 0 && this.state.lastPenaltyDay < currentTime.day) {
      this.onCoinsPenalty?.(-this.config.midnightPenalty);
      this.onNotification?.(`You collapsed from exhaustion! Lost ${this.config.midnightPenalty} coins.`);
      this.state.lastPenaltyDay = currentTime.day; // Track that we applied penalty for this day
      
      // Auto-sleep: restore stamina and advance time to 7am
      this.autoSleep();
    }
  }

  private autoSleep(): void {
    // Determine if we need to advance to next day
    const currentTime = this.timeManager.getCurrentGameTime();
    const needsNextDay = currentTime.hour >= 7;
    
    // Set time to 7am
    this.timeManager.setTimeToHour(7, needsNextDay);
    
    // Restore stamina
    this.state.current = this.state.maximum;
    
    // Update sleep tracking with continuous time
    const newTimeState = this.timeManager.getState();
    const newDayProgress = newTimeState.secondsIntoDay / newTimeState.dayDurationSeconds;
    const newHourFloat = newDayProgress * 24;
    this.state.lastSleepTime = (newTimeState.day - 1) * 24 + newHourFloat;
    this.state.hasSleptToday = true;
    this.state.showedSleepReminder = false;
    
    this.onNotification?.('You wake up groggily at 7am after collapsing from exhaustion.');
  }
}