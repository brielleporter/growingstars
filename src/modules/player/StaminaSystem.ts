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
  private staminaState: StaminaState;
  private staminaConfig: StaminaConfig;
  private timeManager: TimeManager;
  private onCoinsPenaltyCallback?: (amount: number) => void;
  private onNotificationCallback?: (message: string) => void;

  constructor(
    timeManager: TimeManager,
    configurationOverrides: Partial<StaminaConfig> = {}
  ) {
    this.timeManager = timeManager;
    this.staminaConfig = {
      maxStamina: 100,
      depletionRate: 100 / 17, // Fully depleted from 7am to midnight (17 hours) - used in continuous calculation
      sleepReminderHour: 22, // 10pm
      midnightPenalty: 10,
      ...configurationOverrides
    };
    
    this.staminaState = {
      current: this.staminaConfig.maxStamina,
      maximum: this.staminaConfig.maxStamina,
      lastSleepTime: 7, // Start at 7am on day 1 (7 total hours)
      hasSleptToday: false,
      showedSleepReminder: false,
      lastPenaltyDay: 0, // No penalty applied yet
      lastReminderDay: 0 // No reminder shown yet
    };
  }

  public getState(): StaminaState {
    return { ...this.staminaState };
  }

  public onCoinsChanged(coinsChangeCallback: (amount: number) => void): void {
    this.onCoinsPenaltyCallback = coinsChangeCallback;
  }

  public onNotificationRequested(notificationCallback: (message: string) => void): void {
    this.onNotificationCallback = notificationCallback;
  }

  public update(): void {
    const currentGameTime = this.timeManager.getCurrentGameTime();
    
<<<<<<< HEAD
    this.resetDailyFlags(currentGameTime);
    this.updateStaminaDepletion(currentGameTime);
    this.checkSleepReminder(currentGameTime);
    this.checkAutoSleep(currentGameTime);
=======
    this.resetDailyFlags(currentTime);
    this.updateStaminaDepletion();
    this.checkSleepReminder(currentTime);
    this.checkAutoSleep(currentTime);
>>>>>>> bca5842 (feat(hoe): 3x3 patch placement, autotile edges/corners; respect existing center dirt; fix corner orientation; expand retile radius; add hoe tool icon and usage)
  }

  public sleep(): void {
    const currentGameTime = this.timeManager.getCurrentGameTime();
    
    // Determine if we need to advance to next day
    const shouldAdvanceToNextDay = currentGameTime.hour >= 7;
    
    // Set time to 7am
    this.timeManager.setTimeToHour(7, shouldAdvanceToNextDay);
    
    // Restore stamina
    this.staminaState.current = this.staminaState.maximum;
    
    // Update sleep tracking with continuous time
    const updatedTimeState = this.timeManager.getState();
    const newDayProgressRatio = updatedTimeState.secondsIntoDay / updatedTimeState.dayDurationSeconds;
    const newHourAsFloat = newDayProgressRatio * 24;
    this.staminaState.lastSleepTime = (updatedTimeState.day - 1) * 24 + newHourAsFloat;
    this.staminaState.hasSleptToday = true;
    this.staminaState.showedSleepReminder = false;
    
    this.onNotificationCallback?.('You wake up feeling refreshed at 7am!');
  }

  private resetDailyFlags(currentGameTime: GameTime): void {
    // Reset daily flags when a new day starts
    // Check if we've moved to a new day since last sleep
    const currentDayNumber = currentGameTime.day;
    const lastSleepDayNumber = Math.floor((this.staminaState.lastSleepTime - 7) / 24) + 1; // Adjust for 7am start
    
    if (currentDayNumber > lastSleepDayNumber) {
      this.staminaState.hasSleptToday = false;
      this.staminaState.showedSleepReminder = false;
    }
  }

<<<<<<< HEAD
  private updateStaminaDepletion(_currentGameTime: GameTime): void {
=======
  private updateStaminaDepletion(): void {
>>>>>>> bca5842 (feat(hoe): 3x3 patch placement, autotile edges/corners; respect existing center dirt; fix corner orientation; expand retile radius; add hoe tool icon and usage)
    // Get continuous time from TimeManager for smooth depletion
    const currentTimeState = this.timeManager.getState();
    const currentDayProgressRatio = currentTimeState.secondsIntoDay / currentTimeState.dayDurationSeconds; // 0-1
    const currentHourAsFloat = currentDayProgressRatio * 24; // 0-24 with decimals
    const totalHoursSinceGameStart = (currentTimeState.day - 1) * 24 + currentHourAsFloat;
    
    // Deplete stamina based on continuous time since last sleep
    const hoursAwakeSinceLastSleep = totalHoursSinceGameStart - this.staminaState.lastSleepTime;
    const staminaDepletionRate = 100 / 17; // 100 stamina over 17 hours (7am to midnight)
    const expectedCurrentStamina = Math.max(0, this.staminaState.maximum - (hoursAwakeSinceLastSleep * staminaDepletionRate));
    const clampedStaminaValue = Math.max(0, Math.min(this.staminaState.maximum, expectedCurrentStamina));
    
    this.staminaState.current = clampedStaminaValue;
  }

  private checkSleepReminder(currentGameTime: GameTime): void {
    // Show sleep reminder at configured hour if haven't slept today and haven't shown reminder today
    if (currentGameTime.hour === this.staminaConfig.sleepReminderHour && 
        !this.staminaState.hasSleptToday && 
        this.staminaState.lastReminderDay < currentGameTime.day) {
      this.onNotificationCallback?.(`You should sleep soon! Staying up past midnight costs ${this.staminaConfig.midnightPenalty} coins.`);
      this.staminaState.lastReminderDay = currentGameTime.day;
      this.staminaState.showedSleepReminder = true;
    }
  }

  private checkAutoSleep(currentGameTime: GameTime): void {
    // Auto-sleep when stamina hits 0
    if (this.staminaState.current <= 0 && this.staminaState.lastPenaltyDay < currentGameTime.day) {
      this.onCoinsPenaltyCallback?.(-this.staminaConfig.midnightPenalty);
      this.onNotificationCallback?.(`You collapsed from exhaustion! Lost ${this.staminaConfig.midnightPenalty} coins.`);
      this.staminaState.lastPenaltyDay = currentGameTime.day; // Track that we applied penalty for this day
      
      // Auto-sleep: restore stamina and advance time to 7am
      this.performAutoSleep();
    }
  }

  private performAutoSleep(): void {
    // Determine if we need to advance to next day
    const currentGameTime = this.timeManager.getCurrentGameTime();
    const shouldAdvanceToNextDay = currentGameTime.hour >= 7;
    
    // Set time to 7am
    this.timeManager.setTimeToHour(7, shouldAdvanceToNextDay);
    
    // Restore stamina
    this.staminaState.current = this.staminaState.maximum;
    
    // Update sleep tracking with continuous time
    const updatedTimeState = this.timeManager.getState();
    const newDayProgressRatio = updatedTimeState.secondsIntoDay / updatedTimeState.dayDurationSeconds;
    const newHourAsFloat = newDayProgressRatio * 24;
    this.staminaState.lastSleepTime = (updatedTimeState.day - 1) * 24 + newHourAsFloat;
    this.staminaState.hasSleptToday = true;
    this.staminaState.showedSleepReminder = false;
    
    this.onNotificationCallback?.('You wake up groggily at 7am after collapsing from exhaustion.');
  }
}