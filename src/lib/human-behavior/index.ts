/**
 * Human Behavior Simulation
 *
 * Exports all human behavior simulation modules for anti-bot detection evasion.
 *
 * Usage:
 * ```typescript
 * import { MouseSimulator, TypingSimulator, ScrollSimulator, TimingRandomizer } from '~/lib/human-behavior';
 *
 * // Simulate human-like mouse movement
 * await MouseSimulator.simulateMovement(start, end, { speed: 'normal', overshoot: true });
 *
 * // Simulate human-like typing
 * await TypingSimulator.typeIntoElement(input, 'Hello world', { simulateTypos: true });
 *
 * // Simulate natural scrolling
 * await ScrollSimulator.scrollTo({ targetY: 1000, withReadingPauses: true });
 *
 * // Add randomized delays
 * await TimingRandomizer.wait('click', { speed: 'normal' });
 * ```
 */

export { MouseSimulator, type Point, type MouseMovementOptions } from './mouse-simulator';
export { TypingSimulator, type TypingOptions } from './typing-simulator';
export {
  ScrollSimulator,
  type ScrollOptions,
  type ScrollToOptions,
  type ScrollByOptions
} from './scroll-simulator';
export {
  TimingRandomizer,
  type ActionType,
  type TimingProfile
} from './timing-randomizer';
