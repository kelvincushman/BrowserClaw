/**
 * Scroll Behavior Simulator
 *
 * Simulates natural human scrolling behavior with:
 * - Variable speed and acceleration
 * - Natural pauses while reading
 * - Scroll momentum and easing
 * - Occasional reverse scrolling (re-reading)
 */

export interface ScrollOptions {
  /**
   * Scroll speed profile: 'slow', 'normal', 'fast'
   */
  speed?: 'slow' | 'normal' | 'fast';

  /**
   * Add reading pauses during scroll
   */
  withReadingPauses?: boolean;

  /**
   * Simulate occasional reverse scrolling
   */
  reverseScrolling?: boolean;

  /**
   * Scroll behavior: 'smooth' or 'auto'
   */
  behavior?: ScrollBehavior;
}

export interface ScrollToOptions extends ScrollOptions {
  /**
   * Target scroll position (pixels from top)
   */
  targetY: number;

  /**
   * Element to scroll (default: window)
   */
  element?: Element | Window;
}

export interface ScrollByOptions extends ScrollOptions {
  /**
   * Amount to scroll (positive = down, negative = up)
   */
  deltaY: number;

  /**
   * Element to scroll (default: window)
   */
  element?: Element | Window;
}

export class ScrollSimulator {
  /**
   * Scroll to a specific position with human-like behavior
   */
  static async scrollTo(options: ScrollToOptions): Promise<void> {
    const {
      targetY,
      element = window,
      speed = 'normal',
      withReadingPauses = true,
      reverseScrolling = true,
      behavior = 'smooth'
    } = options;

    const currentY = this.getCurrentScrollY(element);
    const distance = targetY - currentY;
    const direction = distance > 0 ? 1 : -1;

    // If distance is small, just scroll directly
    if (Math.abs(distance) < 100) {
      this.scrollElement(element, targetY, behavior);
      return;
    }

    // Break scroll into chunks with pauses
    const chunkSize = this.getChunkSize(speed);
    const numChunks = Math.ceil(Math.abs(distance) / chunkSize);

    let scrolled = 0;

    for (let i = 0; i < numChunks; i++) {
      const isLastChunk = i === numChunks - 1;
      const chunkDistance = isLastChunk
        ? distance - scrolled
        : chunkSize * direction;

      // Scroll this chunk
      const newY = currentY + scrolled + chunkDistance;
      this.scrollElement(element, newY, behavior);
      scrolled += chunkDistance;

      // Reading pause
      if (withReadingPauses && !isLastChunk) {
        const pauseDuration = this.getReadingPauseDuration(speed);
        await this.sleep(pauseDuration);
      }

      // Occasional reverse scrolling (re-reading)
      if (
        reverseScrolling &&
        i > 0 &&
        !isLastChunk &&
        Math.random() < 0.15 // 15% chance
      ) {
        const reverseDistance = chunkSize * 0.3 * direction * -1;
        const reverseY = currentY + scrolled + reverseDistance;

        await this.sleep(200 + Math.random() * 300);
        this.scrollElement(element, reverseY, behavior);

        await this.sleep(500 + Math.random() * 800);

        // Scroll back down
        this.scrollElement(element, currentY + scrolled, behavior);
        await this.sleep(300 + Math.random() * 400);
      }

      // Variable pause between chunks
      if (!isLastChunk) {
        const chunkPause = 100 + Math.random() * 200;
        await this.sleep(chunkPause);
      }
    }
  }

  /**
   * Scroll by a relative amount with human-like behavior
   */
  static async scrollBy(options: ScrollByOptions): Promise<void> {
    const { deltaY, element = window, ...restOptions } = options;

    const currentY = this.getCurrentScrollY(element);
    const targetY = currentY + deltaY;

    await this.scrollTo({
      targetY,
      element,
      ...restOptions
    });
  }

  /**
   * Scroll to an element with human-like behavior
   */
  static async scrollToElement(
    targetElement: Element,
    options: ScrollOptions = {}
  ): Promise<void> {
    const rect = targetElement.getBoundingClientRect();
    const currentY = window.scrollY || window.pageYOffset;

    // Calculate target position (element top + current scroll - some offset for visibility)
    const offset = 100; // Keep element 100px from top for natural viewing
    const targetY = currentY + rect.top - offset;

    await this.scrollTo({
      targetY,
      element: window,
      ...options
    });
  }

  /**
   * Simulate reading a page by scrolling from top to bottom
   */
  static async readPage(options: ScrollOptions = {}): Promise<void> {
    const {
      speed = 'normal',
      withReadingPauses = true,
      reverseScrolling = true
    } = options;

    const documentHeight = Math.max(
      document.body.scrollHeight,
      document.body.offsetHeight,
      document.documentElement.clientHeight,
      document.documentElement.scrollHeight,
      document.documentElement.offsetHeight
    );

    const viewportHeight = window.innerHeight;
    const maxScroll = documentHeight - viewportHeight;

    // Scroll to top first
    window.scrollTo({ top: 0, behavior: 'smooth' });
    await this.sleep(500);

    // Scroll in sections
    const sectionSize = viewportHeight * 0.7; // 70% of viewport per section
    const numSections = Math.ceil(maxScroll / sectionSize);

    for (let i = 0; i < numSections; i++) {
      const targetY = Math.min((i + 1) * sectionSize, maxScroll);

      await this.scrollTo({
        targetY,
        speed,
        withReadingPauses,
        reverseScrolling: reverseScrolling && i > 0
      });

      // Longer pause at end of each section (reading time)
      if (i < numSections - 1) {
        const readingTime = this.getReadingPauseDuration(speed) * 2;
        await this.sleep(readingTime);
      }
    }

    // Final pause at bottom
    await this.sleep(1000 + Math.random() * 1000);
  }

  /**
   * Simulate infinite scroll behavior (load more content)
   */
  static async infiniteScroll(
    options: ScrollOptions & {
      maxScrolls?: number;
      onNearBottom?: () => Promise<void>;
    } = {}
  ): Promise<void> {
    const {
      speed = 'normal',
      maxScrolls = 5,
      onNearBottom,
      ...scrollOptions
    } = options;

    let scrollCount = 0;

    while (scrollCount < maxScrolls) {
      // Scroll near bottom (90%)
      const documentHeight = document.documentElement.scrollHeight;
      const viewportHeight = window.innerHeight;
      const targetY = documentHeight - viewportHeight * 1.1;

      await this.scrollTo({
        targetY,
        speed,
        ...scrollOptions
      });

      // Trigger load more callback
      if (onNearBottom) {
        await onNearBottom();
      }

      // Wait for content to load
      await this.sleep(1500 + Math.random() * 1500);

      scrollCount++;
    }
  }

  /**
   * Get chunk size based on speed
   */
  private static getChunkSize(speed: 'slow' | 'normal' | 'fast'): number {
    const chunkSizes = {
      slow: 200,
      normal: 350,
      fast: 500
    };
    return chunkSizes[speed];
  }

  /**
   * Get reading pause duration based on speed
   */
  private static getReadingPauseDuration(
    speed: 'slow' | 'normal' | 'fast'
  ): number {
    const baseDurations = {
      slow: 2000,
      normal: 1200,
      fast: 600
    };

    const baseDuration = baseDurations[speed];

    // Add random variation (±30%)
    return baseDuration * (0.7 + Math.random() * 0.6);
  }

  /**
   * Get current scroll position
   */
  private static getCurrentScrollY(element: Element | Window): number {
    if (element === window) {
      return window.scrollY || window.pageYOffset;
    } else {
      return (element as Element).scrollTop;
    }
  }

  /**
   * Scroll element to position
   */
  private static scrollElement(
    element: Element | Window,
    y: number,
    behavior: ScrollBehavior = 'smooth'
  ): void {
    if (element === window) {
      window.scrollTo({ top: y, behavior });
    } else {
      (element as Element).scrollTo({ top: y, behavior });
    }
  }

  /**
   * Calculate reading time based on content length
   */
  static estimateReadingTime(
    contentLength: number,
    wordsPerMinute: number = 200
  ): number {
    // Estimate words (avg 5 chars per word)
    const estimatedWords = contentLength / 5;

    // Calculate reading time in milliseconds
    const readingTimeMs = (estimatedWords / wordsPerMinute) * 60 * 1000;

    return readingTimeMs;
  }

  /**
   * Check if element is in viewport
   */
  static isInViewport(element: Element): boolean {
    const rect = element.getBoundingClientRect();
    return (
      rect.top >= 0 &&
      rect.left >= 0 &&
      rect.bottom <=
        (window.innerHeight || document.documentElement.clientHeight) &&
      rect.right <= (window.innerWidth || document.documentElement.clientWidth)
    );
  }

  /**
   * Wait for element to be scrolled into view
   */
  static async waitForElementInView(
    element: Element,
    timeout: number = 10000
  ): Promise<boolean> {
    const startTime = Date.now();

    while (Date.now() - startTime < timeout) {
      if (this.isInViewport(element)) {
        return true;
      }
      await this.sleep(100);
    }

    return false;
  }

  /**
   * Simulate mouse wheel scrolling (more granular than scrollTo)
   */
  static async wheelScroll(
    deltaY: number,
    options: ScrollOptions = {}
  ): Promise<void> {
    const { speed = 'normal' } = options;

    // Break into wheel events
    const wheelDelta = 100; // Pixels per wheel event
    const numWheels = Math.ceil(Math.abs(deltaY) / wheelDelta);
    const direction = deltaY > 0 ? 1 : -1;

    for (let i = 0; i < numWheels; i++) {
      const isLastWheel = i === numWheels - 1;
      const thisDelta = isLastWheel
        ? Math.abs(deltaY) - i * wheelDelta
        : wheelDelta;

      // Dispatch wheel event
      const wheelEvent = new WheelEvent('wheel', {
        deltaY: thisDelta * direction,
        deltaMode: 0,
        bubbles: true,
        cancelable: true
      });
      document.dispatchEvent(wheelEvent);

      // Actual scroll
      window.scrollBy({
        top: thisDelta * direction,
        behavior: 'smooth'
      });

      // Delay between wheel events
      const delays = { slow: 150, normal: 80, fast: 40 };
      const delay = delays[speed] + Math.random() * 50;
      await this.sleep(delay);
    }
  }

  /**
   * Sleep for specified milliseconds
   */
  private static sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
