/**
 * Mouse Movement Simulator
 *
 * Generates human-like mouse movements using Bezier curves
 * to evade bot detection systems.
 *
 * Key features:
 * - Smooth curved paths (not straight lines)
 * - Variable speed with acceleration/deceleration
 * - Natural overshooting and correction
 * - Random micro-movements
 */

export interface Point {
  x: number;
  y: number;
}

export interface MouseMovementOptions {
  /**
   * Movement speed profile: 'slow', 'normal', 'fast'
   */
  speed?: 'slow' | 'normal' | 'fast';

  /**
   * Whether to overshoot target and correct back
   */
  overshoot?: boolean;

  /**
   * Add small random movements during path
   */
  jitter?: boolean;

  /**
   * Pause duration at destination (ms)
   */
  pauseAtEnd?: number;
}

export class MouseSimulator {
  /**
   * Generate a smooth path from start to end using Bezier curves
   */
  static generatePath(
    start: Point,
    end: Point,
    options: MouseMovementOptions = {}
  ): Point[] {
    const { speed = 'normal', overshoot = true, jitter = true } = options;

    // Calculate distance for determining number of points
    const distance = Math.sqrt(
      Math.pow(end.x - start.x, 2) + Math.pow(end.y - start.y, 2)
    );

    // Determine number of points based on distance and speed
    const speedMultiplier = { slow: 0.5, normal: 1, fast: 1.5 }[speed];
    const basePoints = Math.max(10, Math.floor(distance / 5));
    const numPoints = Math.floor(basePoints / speedMultiplier);

    // Generate control points for Bezier curve
    const controlPoints = this.generateControlPoints(start, end, overshoot);

    // Generate path points along the Bezier curve
    const path: Point[] = [];
    for (let i = 0; i <= numPoints; i++) {
      const t = i / numPoints;
      const point = this.cubicBezier(
        start,
        controlPoints.cp1,
        controlPoints.cp2,
        end,
        t
      );

      // Add jitter for realism
      if (jitter && i > 0 && i < numPoints) {
        point.x += (Math.random() - 0.5) * 2;
        point.y += (Math.random() - 0.5) * 2;
      }

      path.push(point);
    }

    // Add overshoot correction if enabled
    if (overshoot && distance > 50) {
      const overshootPath = this.generateOvershootCorrection(end, speed);
      path.push(...overshootPath);
    }

    return path;
  }

  /**
   * Generate control points for cubic Bezier curve
   * Creates a natural curved path with optional overshoot
   */
  private static generateControlPoints(
    start: Point,
    end: Point,
    overshoot: boolean
  ): { cp1: Point; cp2: Point } {
    const dx = end.x - start.x;
    const dy = end.y - start.y;

    // Add randomness to control points for natural variation
    const randomFactor1 = 0.25 + Math.random() * 0.25; // 0.25-0.5
    const randomFactor2 = 0.5 + Math.random() * 0.25; // 0.5-0.75

    // Perpendicular offset for curve
    const perpX = -dy * (Math.random() * 0.3);
    const perpY = dx * (Math.random() * 0.3);

    const cp1: Point = {
      x: start.x + dx * randomFactor1 + perpX * 0.5,
      y: start.y + dy * randomFactor1 + perpY * 0.5
    };

    const cp2: Point = {
      x: start.x + dx * randomFactor2 + perpX,
      y: start.y + dy * randomFactor2 + perpY
    };

    // Add overshoot bias to second control point
    if (overshoot) {
      const overshootAmount = 5 + Math.random() * 10;
      const angle = Math.atan2(dy, dx);
      cp2.x += Math.cos(angle) * overshootAmount;
      cp2.y += Math.sin(angle) * overshootAmount;
    }

    return { cp1, cp2 };
  }

  /**
   * Calculate point on cubic Bezier curve
   * B(t) = (1-t)³P₀ + 3(1-t)²tP₁ + 3(1-t)t²P₂ + t³P₃
   */
  private static cubicBezier(
    p0: Point,
    p1: Point,
    p2: Point,
    p3: Point,
    t: number
  ): Point {
    const t2 = t * t;
    const t3 = t2 * t;
    const mt = 1 - t;
    const mt2 = mt * mt;
    const mt3 = mt2 * mt;

    return {
      x: mt3 * p0.x + 3 * mt2 * t * p1.x + 3 * mt * t2 * p2.x + t3 * p3.x,
      y: mt3 * p0.y + 3 * mt2 * t * p1.y + 3 * mt * t2 * p2.y + t3 * p3.y
    };
  }

  /**
   * Generate overshoot correction movement
   * Simulates slight overshoot and correction back to target
   */
  private static generateOvershootCorrection(
    target: Point,
    speed: 'slow' | 'normal' | 'fast'
  ): Point[] {
    const overshootDistance = speed === 'fast' ? 8 : speed === 'normal' ? 5 : 3;
    const angle = Math.random() * Math.PI * 2;

    const overshootPoint: Point = {
      x: target.x + Math.cos(angle) * overshootDistance,
      y: target.y + Math.sin(angle) * overshootDistance
    };

    // Generate a few points moving back to target
    const correctionPoints: Point[] = [];
    const steps = 3;

    for (let i = 1; i <= steps; i++) {
      const t = i / steps;
      correctionPoints.push({
        x: overshootPoint.x + (target.x - overshootPoint.x) * t,
        y: overshootPoint.y + (target.y - overshootPoint.y) * t
      });
    }

    return correctionPoints;
  }

  /**
   * Calculate timing for each point in the path
   * Creates variable speed with acceleration and deceleration
   */
  static calculateTimings(
    path: Point[],
    options: MouseMovementOptions = {}
  ): number[] {
    const { speed = 'normal' } = options;

    // Base duration in milliseconds
    const baseDuration = { slow: 800, normal: 500, fast: 300 }[speed];

    const timings: number[] = [];
    const totalPoints = path.length;

    for (let i = 0; i < totalPoints; i++) {
      const progress = i / (totalPoints - 1);

      // Ease in-out curve for natural acceleration/deceleration
      const eased = this.easeInOutCubic(progress);

      // Calculate interval with variation
      const baseInterval = (baseDuration * eased) / totalPoints;
      const variation = baseInterval * (0.8 + Math.random() * 0.4); // ±20%

      timings.push(Math.max(1, variation));
    }

    return timings;
  }

  /**
   * Ease in-out cubic function for smooth acceleration/deceleration
   */
  private static easeInOutCubic(t: number): number {
    return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
  }

  /**
   * Simulate mouse movement along a path
   * Returns a promise that resolves when movement is complete
   */
  static async simulateMovement(
    start: Point,
    end: Point,
    options: MouseMovementOptions = {}
  ): Promise<void> {
    const path = this.generatePath(start, end, options);
    const timings = this.calculateTimings(path, options);

    // Move mouse along path
    for (let i = 0; i < path.length; i++) {
      const point = path[i];

      // Dispatch mouse move event
      this.dispatchMouseEvent('mousemove', point);

      // Wait for timing interval
      if (i < timings.length) {
        await this.sleep(timings[i]);
      }
    }

    // Pause at end if specified
    if (options.pauseAtEnd) {
      await this.sleep(options.pauseAtEnd);
    }
  }

  /**
   * Dispatch a mouse event at the specified position
   */
  private static dispatchMouseEvent(type: string, point: Point): void {
    const element = document.elementFromPoint(point.x, point.y);
    if (!element) return;

    const event = new MouseEvent(type, {
      bubbles: true,
      cancelable: true,
      view: window,
      clientX: point.x,
      clientY: point.y,
      screenX: point.x + window.screenX,
      screenY: point.y + window.screenY
    });

    element.dispatchEvent(event);
  }

  /**
   * Sleep for specified milliseconds
   */
  private static sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Get current cursor position (if available)
   */
  static getCurrentPosition(): Point {
    // This would need to track mouse position via event listeners
    // For now, return center of viewport as fallback
    return {
      x: window.innerWidth / 2,
      y: window.innerHeight / 2
    };
  }

  /**
   * Calculate element center point
   */
  static getElementCenter(element: Element): Point {
    const rect = element.getBoundingClientRect();
    return {
      x: rect.left + rect.width / 2,
      y: rect.top + rect.height / 2
    };
  }

  /**
   * Add random offset to target point (within element bounds)
   * Humans don't click exactly in the center
   */
  static addRandomOffset(point: Point, element: Element): Point {
    const rect = element.getBoundingClientRect();

    // Random offset within 40% of element size from center
    const maxOffsetX = (rect.width * 0.4) / 2;
    const maxOffsetY = (rect.height * 0.4) / 2;

    return {
      x: point.x + (Math.random() - 0.5) * maxOffsetX,
      y: point.y + (Math.random() - 0.5) * maxOffsetY
    };
  }
}
