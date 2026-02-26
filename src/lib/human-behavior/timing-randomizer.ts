/**
 * Timing Randomization System
 *
 * Provides human-like timing delays between actions to evade bot detection.
 * Includes:
 * - Random delays with configurable ranges
 * - Context-aware timing (different delays for different actions)
 * - Gaussian distribution for natural variation
 * - Activity rhythm patterns (fatigue simulation)
 */

export type ActionType =
  | 'page_load'
  | 'click'
  | 'type'
  | 'scroll'
  | 'navigation'
  | 'form_submit'
  | 'hover'
  | 'focus'
  | 'blur'
  | 'read'
  | 'think';

export interface TimingProfile {
  /**
   * Speed profile: affects all delays
   */
  speed: 'slow' | 'normal' | 'fast';

  /**
   * Variability: how much random variation (0-1)
   */
  variability: number;

  /**
   * Simulate fatigue: gradually increase delays over time
   */
  simulateFatigue: boolean;
}

export class TimingRandomizer {
  private static sessionStartTime: number = Date.now();
  private static actionCount: number = 0;

  /**
   * Default timing ranges for different action types (in milliseconds)
   */
  private static readonly ACTION_DELAYS: Record<
    ActionType,
    { min: number; avg: number; max: number }
  > = {
    page_load: { min: 500, avg: 1500, max: 3000 },
    click: { min: 100, avg: 300, max: 800 },
    type: { min: 50, avg: 120, max: 300 },
    scroll: { min: 300, avg: 800, max: 2000 },
    navigation: { min: 500, avg: 1200, max: 2500 },
    form_submit: { min: 300, avg: 800, max: 1500 },
    hover: { min: 50, avg: 200, max: 500 },
    focus: { min: 50, avg: 150, max: 400 },
    blur: { min: 20, avg: 100, max: 300 },
    read: { min: 1000, avg: 3000, max: 8000 },
    think: { min: 500, avg: 1500, max: 4000 }
  };

  /**
   * Get a randomized delay for an action type
   */
  static getDelay(
    actionType: ActionType,
    profile: Partial<TimingProfile> = {}
  ): number {
    const {
      speed = 'normal',
      variability = 0.3,
      simulateFatigue = false
    } = profile;

    const delays = this.ACTION_DELAYS[actionType];

    // Get base delay using Gaussian distribution
    const baseDelay = this.gaussianRandom(delays.avg, delays.min, delays.max);

    // Apply speed multiplier
    const speedMultiplier = { slow: 1.5, normal: 1, fast: 0.6 }[speed];
    let delay = baseDelay * speedMultiplier;

    // Apply variability
    const variabilityFactor = 1 + (Math.random() - 0.5) * variability * 2;
    delay *= variabilityFactor;

    // Apply fatigue if enabled
    if (simulateFatigue) {
      delay *= this.getFatigueMultiplier();
    }

    // Ensure within reasonable bounds
    delay = Math.max(
      delays.min * speedMultiplier * 0.5,
      Math.min(delay, delays.max * speedMultiplier * 1.5)
    );

    // Increment action count
    this.actionCount++;

    return Math.floor(delay);
  }

  /**
   * Generate random delay with Gaussian distribution
   * More natural than uniform random
   */
  private static gaussianRandom(mean: number, min: number, max: number): number {
    // Box-Muller transform for Gaussian distribution
    let u = 0;
    let v = 0;
    while (u === 0) u = Math.random();
    while (v === 0) v = Math.random();

    const gaussian = Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);

    // Scale to mean and standard deviation
    const stdDev = (max - min) / 6; // 99.7% within min-max range
    const value = mean + gaussian * stdDev;

    // Clamp to min-max range
    return Math.max(min, Math.min(max, value));
  }

  /**
   * Calculate fatigue multiplier based on session duration and action count
   * Simulates user getting slightly slower over time
   */
  private static getFatigueMultiplier(): number {
    const sessionDuration = Date.now() - this.sessionStartTime;
    const minutesActive = sessionDuration / (1000 * 60);

    // Gradual increase: 1.0 at start, up to 1.3 after 30 minutes
    const durationFactor = 1 + Math.min(minutesActive / 100, 0.3);

    // Action count factor: slight increase every 50 actions
    const actionFactor = 1 + Math.min(this.actionCount / 500, 0.2);

    return durationFactor * actionFactor;
  }

  /**
   * Wait for a randomized delay
   */
  static async wait(
    actionType: ActionType,
    profile?: Partial<TimingProfile>
  ): Promise<void> {
    const delay = this.getDelay(actionType, profile);
    await this.sleep(delay);
  }

  /**
   * Get delay between consecutive actions
   */
  static getActionInterval(profile: Partial<TimingProfile> = {}): number {
    // Random interval between any two actions
    return this.getDelay('think', {
      ...profile,
      variability: 0.5 // Higher variability for inter-action delays
    });
  }

  /**
   * Wait between two consecutive actions
   */
  static async waitBetweenActions(
    profile?: Partial<TimingProfile>
  ): Promise<void> {
    const delay = this.getActionInterval(profile);
    await this.sleep(delay);
  }

  /**
   * Get reading time delay based on content length
   */
  static getReadingDelay(
    contentLength: number,
    wordsPerMinute: number = 200
  ): number {
    // Estimate words (avg 5 characters per word)
    const words = contentLength / 5;

    // Calculate base reading time
    const baseTime = (words / wordsPerMinute) * 60 * 1000;

    // Add variation (±20%)
    const variation = baseTime * (0.8 + Math.random() * 0.4);

    return Math.floor(variation);
  }

  /**
   * Wait for reading time
   */
  static async waitForReading(
    contentLength: number,
    wordsPerMinute?: number
  ): Promise<void> {
    const delay = this.getReadingDelay(contentLength, wordsPerMinute);
    await this.sleep(delay);
  }

  /**
   * Get thinking/decision delay
   * Used before important actions (submit, navigate, etc.)
   */
  static getThinkingDelay(profile?: Partial<TimingProfile>): number {
    return this.getDelay('think', {
      ...profile,
      variability: 0.6 // High variability for thinking time
    });
  }

  /**
   * Wait for thinking time
   */
  static async waitForThinking(profile?: Partial<TimingProfile>): Promise<void> {
    const delay = this.getThinkingDelay(profile);
    await this.sleep(delay);
  }

  /**
   * Create a delay pattern for a sequence of actions
   * Returns array of delays between each action
   */
  static createActionSequenceDelays(
    actionTypes: ActionType[],
    profile?: Partial<TimingProfile>
  ): number[] {
    const delays: number[] = [];

    for (let i = 0; i < actionTypes.length - 1; i++) {
      // Delay after current action
      const delay = this.getDelay(actionTypes[i], profile);
      delays.push(delay);
    }

    return delays;
  }

  /**
   * Execute a sequence of actions with randomized timing
   */
  static async executeSequence(
    actions: Array<() => Promise<void> | void>,
    actionTypes: ActionType[],
    profile?: Partial<TimingProfile>
  ): Promise<void> {
    if (actions.length !== actionTypes.length) {
      throw new Error('Actions and actionTypes arrays must have same length');
    }

    for (let i = 0; i < actions.length; i++) {
      // Execute action
      await actions[i]();

      // Wait before next action (except after last action)
      if (i < actions.length - 1) {
        await this.wait(actionTypes[i], profile);
      }
    }
  }

  /**
   * Get delay range for an action type
   */
  static getDelayRange(actionType: ActionType): {
    min: number;
    avg: number;
    max: number;
  } {
    return this.ACTION_DELAYS[actionType];
  }

  /**
   * Simulate "burst" activity: multiple quick actions
   * Used for rapid interactions like clicking through a carousel
   */
  static async burstActivity(
    actions: Array<() => Promise<void> | void>,
    profile?: Partial<TimingProfile>
  ): Promise<void> {
    const burstProfile = {
      ...profile,
      speed: 'fast' as const,
      variability: 0.2 // Lower variability for burst
    };

    for (let i = 0; i < actions.length; i++) {
      await actions[i]();

      if (i < actions.length - 1) {
        // Very short delays in burst mode
        const delay = this.gaussianRandom(100, 50, 200);
        await this.sleep(delay);
      }
    }

    // Pause after burst
    await this.wait('think', profile);
  }

  /**
   * Reset session timing (call when starting a new session)
   */
  static resetSession(): void {
    this.sessionStartTime = Date.now();
    this.actionCount = 0;
  }

  /**
   * Get session statistics
   */
  static getSessionStats(): {
    duration: number;
    actionCount: number;
    actionsPerMinute: number;
    fatigueMultiplier: number;
  } {
    const duration = Date.now() - this.sessionStartTime;
    const minutes = duration / (1000 * 60);
    const actionsPerMinute = minutes > 0 ? this.actionCount / minutes : 0;

    return {
      duration,
      actionCount: this.actionCount,
      actionsPerMinute,
      fatigueMultiplier: this.getFatigueMultiplier()
    };
  }

  /**
   * Add random "micro-pause" (very short hesitation)
   * Used within complex actions
   */
  static async microPause(): Promise<void> {
    const delay = this.gaussianRandom(50, 10, 150);
    await this.sleep(delay);
  }

  /**
   * Sleep for specified milliseconds
   */
  private static sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Get a random boolean with specified probability
   */
  static randomBool(probability: number = 0.5): boolean {
    return Math.random() < probability;
  }

  /**
   * Get random integer in range [min, max]
   */
  static randomInt(min: number, max: number): number {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }

  /**
   * Get random float in range [min, max]
   */
  static randomFloat(min: number, max: number): number {
    return Math.random() * (max - min) + min;
  }

  /**
   * Pick random element from array
   */
  static randomChoice<T>(array: T[]): T {
    return array[Math.floor(Math.random() * array.length)];
  }

  /**
   * Shuffle array (Fisher-Yates algorithm)
   */
  static shuffle<T>(array: T[]): T[] {
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  }
}
