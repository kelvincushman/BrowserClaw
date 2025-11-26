/**
 * Typing Simulator
 *
 * Simulates human typing patterns with:
 * - Variable delays between keystrokes
 * - Occasional typos and corrections
 * - Natural rhythm and pauses
 * - Keyboard event sequences (keydown, keypress, input, keyup)
 */

export interface TypingOptions {
  /**
   * Typing speed profile: 'slow', 'normal', 'fast'
   */
  speed?: 'slow' | 'normal' | 'fast';

  /**
   * Whether to simulate occasional typos
   */
  simulateTypos?: boolean;

  /**
   * Typo frequency (0-1, default 0.02 = 2%)
   */
  typoRate?: number;

  /**
   * Add natural pauses (thinking time)
   */
  naturalPauses?: boolean;

  /**
   * Delay before starting to type (ms)
   */
  initialDelay?: number;
}

export class TypingSimulator {
  /**
   * Type text into an input element with human-like behavior
   */
  static async typeIntoElement(
    element: HTMLInputElement | HTMLTextAreaElement,
    text: string,
    options: TypingOptions = {}
  ): Promise<void> {
    const {
      speed = 'normal',
      simulateTypos = true,
      typoRate = 0.02,
      naturalPauses = true,
      initialDelay = 100
    } = options;

    // Focus element first
    element.focus();

    // Initial thinking delay
    if (initialDelay > 0) {
      await this.sleep(initialDelay + Math.random() * 200);
    }

    // Clear existing value
    element.value = '';

    // Type each character
    let currentText = '';
    for (let i = 0; i < text.length; i++) {
      const char = text[i];

      // Simulate typo occasionally
      if (simulateTypos && Math.random() < typoRate && i > 0) {
        // Type wrong character
        const wrongChar = this.getTypoCharacter(char);
        await this.typeCharacter(element, wrongChar, speed);
        currentText += wrongChar;

        // Realize mistake after a delay
        await this.sleep(200 + Math.random() * 300);

        // Backspace to delete typo
        await this.pressBackspace(element);
        currentText = currentText.slice(0, -1);

        // Small pause before typing correct character
        await this.sleep(50 + Math.random() * 100);
      }

      // Type the actual character
      await this.typeCharacter(element, char, speed);
      currentText += char;

      // Natural pause after punctuation or spaces
      if (naturalPauses) {
        if (char === '.' || char === '!' || char === '?') {
          // Longer pause after sentences
          await this.sleep(300 + Math.random() * 400);
        } else if (char === ',' || char === ';') {
          // Medium pause after clauses
          await this.sleep(150 + Math.random() * 200);
        } else if (char === ' ') {
          // Short pause after words
          await this.sleep(50 + Math.random() * 100);
        }
      }
    }
  }

  /**
   * Type a single character with proper event sequence
   */
  private static async typeCharacter(
    element: HTMLInputElement | HTMLTextAreaElement,
    char: string,
    speed: 'slow' | 'normal' | 'fast'
  ): Promise<void> {
    const keyCode = char.charCodeAt(0);

    // Dispatch keydown event
    const keydownEvent = new KeyboardEvent('keydown', {
      key: char,
      code: this.getKeyCode(char),
      keyCode,
      which: keyCode,
      bubbles: true,
      cancelable: true
    });
    element.dispatchEvent(keydownEvent);

    // Small delay between keydown and keypress
    await this.sleep(1 + Math.random() * 2);

    // Dispatch keypress event (for printable characters)
    if (char.length === 1 && char !== '\n') {
      const keypressEvent = new KeyboardEvent('keypress', {
        key: char,
        keyCode,
        which: keyCode,
        bubbles: true,
        cancelable: true
      });
      element.dispatchEvent(keypressEvent);
    }

    // Update element value
    const newValue = element.value + char;
    element.value = newValue;

    // Dispatch input event
    const inputEvent = new InputEvent('input', {
      data: char,
      inputType: 'insertText',
      bubbles: true,
      cancelable: false
    });
    element.dispatchEvent(inputEvent);

    // Calculate keystroke delay based on speed
    const delay = this.getKeystrokeDelay(char, speed);
    await this.sleep(delay);

    // Dispatch keyup event
    const keyupEvent = new KeyboardEvent('keyup', {
      key: char,
      code: this.getKeyCode(char),
      keyCode,
      which: keyCode,
      bubbles: true,
      cancelable: true
    });
    element.dispatchEvent(keyupEvent);
  }

  /**
   * Simulate backspace key press
   */
  private static async pressBackspace(
    element: HTMLInputElement | HTMLTextAreaElement
  ): Promise<void> {
    const keyCode = 8; // Backspace

    // Keydown
    const keydownEvent = new KeyboardEvent('keydown', {
      key: 'Backspace',
      code: 'Backspace',
      keyCode,
      which: keyCode,
      bubbles: true,
      cancelable: true
    });
    element.dispatchEvent(keydownEvent);

    await this.sleep(20);

    // Update value
    const newValue = element.value.slice(0, -1);
    element.value = newValue;

    // Input event
    const inputEvent = new InputEvent('input', {
      inputType: 'deleteContentBackward',
      bubbles: true,
      cancelable: false
    });
    element.dispatchEvent(inputEvent);

    await this.sleep(50 + Math.random() * 50);

    // Keyup
    const keyupEvent = new KeyboardEvent('keyup', {
      key: 'Backspace',
      code: 'Backspace',
      keyCode,
      which: keyCode,
      bubbles: true,
      cancelable: true
    });
    element.dispatchEvent(keyupEvent);
  }

  /**
   * Get keystroke delay based on character and speed
   */
  private static getKeystrokeDelay(
    char: string,
    speed: 'slow' | 'normal' | 'fast'
  ): number {
    // Base delays in milliseconds
    const baseDelays = {
      slow: 180,
      normal: 120,
      fast: 60
    };

    const baseDelay = baseDelays[speed];

    // Add variation based on character type
    let multiplier = 1;

    // Numbers and special characters are slightly slower
    if (/[0-9]/.test(char)) {
      multiplier = 1.1;
    } else if (/[^a-zA-Z0-9\s]/.test(char)) {
      multiplier = 1.2;
    }
    // Capital letters (shift key) slightly slower
    else if (/[A-Z]/.test(char)) {
      multiplier = 1.15;
    }
    // Spaces are faster
    else if (char === ' ') {
      multiplier = 0.8;
    }

    // Add random variation (±30%)
    const variation = 0.7 + Math.random() * 0.6;

    return Math.floor(baseDelay * multiplier * variation);
  }

  /**
   * Get a typo character (nearby key on keyboard)
   */
  private static getTypoCharacter(intendedChar: string): string {
    // Keyboard layout proximity map (QWERTY)
    const proximityMap: Record<string, string[]> = {
      a: ['s', 'q', 'w', 'z'],
      b: ['v', 'g', 'h', 'n'],
      c: ['x', 'd', 'f', 'v'],
      d: ['s', 'e', 'r', 'f', 'c', 'x'],
      e: ['w', 'r', 'd', 's'],
      f: ['d', 'r', 't', 'g', 'v', 'c'],
      g: ['f', 't', 'y', 'h', 'b', 'v'],
      h: ['g', 'y', 'u', 'j', 'n', 'b'],
      i: ['u', 'o', 'k', 'j'],
      j: ['h', 'u', 'i', 'k', 'm', 'n'],
      k: ['j', 'i', 'o', 'l', 'm'],
      l: ['k', 'o', 'p'],
      m: ['n', 'j', 'k'],
      n: ['b', 'h', 'j', 'm'],
      o: ['i', 'p', 'l', 'k'],
      p: ['o', 'l'],
      q: ['w', 'a'],
      r: ['e', 't', 'f', 'd'],
      s: ['a', 'w', 'e', 'd', 'x', 'z'],
      t: ['r', 'y', 'g', 'f'],
      u: ['y', 'i', 'j', 'h'],
      v: ['c', 'f', 'g', 'b'],
      w: ['q', 'e', 's', 'a'],
      x: ['z', 's', 'd', 'c'],
      y: ['t', 'u', 'h', 'g'],
      z: ['a', 's', 'x']
    };

    const lowerChar = intendedChar.toLowerCase();
    const nearbyKeys = proximityMap[lowerChar];

    if (nearbyKeys && nearbyKeys.length > 0) {
      const typo = nearbyKeys[Math.floor(Math.random() * nearbyKeys.length)];
      // Preserve case
      return intendedChar === intendedChar.toUpperCase()
        ? typo.toUpperCase()
        : typo;
    }

    // Fallback: return a random letter
    const randomLetter = String.fromCharCode(97 + Math.floor(Math.random() * 26));
    return intendedChar === intendedChar.toUpperCase()
      ? randomLetter.toUpperCase()
      : randomLetter;
  }

  /**
   * Get keyboard code for character
   */
  private static getKeyCode(char: string): string {
    const keyCodeMap: Record<string, string> = {
      ' ': 'Space',
      Enter: 'Enter',
      Tab: 'Tab',
      Backspace: 'Backspace'
    };

    if (keyCodeMap[char]) {
      return keyCodeMap[char];
    }

    // Letter keys
    if (/[a-zA-Z]/.test(char)) {
      return `Key${char.toUpperCase()}`;
    }

    // Number keys
    if (/[0-9]/.test(char)) {
      return `Digit${char}`;
    }

    // Default
    return char;
  }

  /**
   * Simulate pressing Enter key
   */
  static async pressEnter(
    element: HTMLInputElement | HTMLTextAreaElement
  ): Promise<void> {
    const keyCode = 13;

    const keydownEvent = new KeyboardEvent('keydown', {
      key: 'Enter',
      code: 'Enter',
      keyCode,
      which: keyCode,
      bubbles: true,
      cancelable: true
    });
    element.dispatchEvent(keydownEvent);

    await this.sleep(50);

    const keypressEvent = new KeyboardEvent('keypress', {
      key: 'Enter',
      code: 'Enter',
      keyCode,
      which: keyCode,
      bubbles: true,
      cancelable: true
    });
    element.dispatchEvent(keypressEvent);

    await this.sleep(50);

    const keyupEvent = new KeyboardEvent('keyup', {
      key: 'Enter',
      code: 'Enter',
      keyCode,
      which: keyCode,
      bubbles: true,
      cancelable: true
    });
    element.dispatchEvent(keyupEvent);
  }

  /**
   * Calculate total typing duration for text
   */
  static estimateTypingDuration(
    text: string,
    options: TypingOptions = {}
  ): number {
    const { speed = 'normal', simulateTypos = true, naturalPauses = true } = options;

    const baseDelays = {
      slow: 180,
      normal: 120,
      fast: 60
    };

    let totalDuration = baseDelays[speed] * text.length;

    // Add typo corrections
    if (simulateTypos) {
      const expectedTypos = Math.floor(text.length * 0.02);
      totalDuration += expectedTypos * 700; // Typo + correction time
    }

    // Add pause durations
    if (naturalPauses) {
      const punctuation = (text.match(/[.!?]/g) || []).length;
      const commas = (text.match(/[,;]/g) || []).length;
      const spaces = (text.match(/ /g) || []).length;

      totalDuration += punctuation * 500;
      totalDuration += commas * 250;
      totalDuration += spaces * 100;
    }

    return totalDuration;
  }

  /**
   * Sleep for specified milliseconds
   */
  private static sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
