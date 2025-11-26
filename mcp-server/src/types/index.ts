/**
 * Type definitions for AigentisBrowser MCP Server
 */

/**
 * Supported social media platforms
 */
export type Platform =
  | 'twitter'
  | 'linkedin'
  | 'instagram'
  | 'facebook'
  | 'reddit'
  | 'tiktok'
  | 'youtube'
  | 'threads'
  | 'other';

/**
 * Tab session information
 */
export interface TabSession {
  /** MCP tab ID (e.g., "tab-abc123") */
  id: string;

  /** Chrome internal tab ID */
  chromeTabId: number;

  /** Current URL */
  url: string;

  /** Page title */
  title: string;

  /** Whether tab is active */
  active: boolean;

  /** Detected platform (if social media) */
  platform: Platform | null;

  /** Whether user is logged into the platform */
  isLoggedIn: boolean;

  /** Account information (if logged in) */
  accountInfo?: {
    username: string;
    displayName?: string;
    profileUrl?: string;
    avatarUrl?: string;
    verified?: boolean;
  };

  /** Tab creation timestamp */
  createdAt: number;

  /** Last interaction timestamp */
  lastActivity: number;

  /** Page loading state */
  loadingState: 'loading' | 'complete' | 'error';
}

/**
 * Native messaging message format
 */
export interface NativeMessage {
  /** Request ID for correlation */
  id: string;

  /** Command name */
  command: string;

  /** Command parameters */
  params: Record<string, any>;
}

/**
 * Native messaging response format
 */
export interface NativeResponse {
  /** Request ID (matches request) */
  id: string;

  /** Whether command succeeded */
  success: boolean;

  /** Response data (if successful) */
  data?: any;

  /** Error message (if failed) */
  error?: string;
}

/**
 * Point coordinates
 */
export interface Point {
  x: number;
  y: number;
}

/**
 * Bounding box dimensions
 */
export interface BoundingBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * Element information
 */
export interface ElementInfo {
  tagName: string;
  text?: string;
  attributes?: Record<string, string>;
  boundingBox?: BoundingBox;
}

/**
 * Human behavior profile
 */
export type BehaviorProfile = 'cautious' | 'normal' | 'confident' | 'mobile';

/**
 * Behavior profile configuration
 */
export interface BehaviorProfileConfig {
  /** Mouse movement curvature (0-1, higher = more curved) */
  mouseCurvature: number;

  /** Typing speed in words per minute */
  typingWPM: number;

  /** Error rate for typing (0-1) */
  errorRate: number;

  /** Scroll speed */
  scrollSpeed: 'slow' | 'normal' | 'fast';

  /** Reading speed in words per minute */
  readingSpeed: number;

  /** Pause probability during actions (0-1) */
  pauseProbability: number;
}

/**
 * Mouse movement options
 */
export interface MouseMovementOptions {
  /** Movement duration in milliseconds */
  duration?: number;

  /** Path curvature (0-1) */
  curvature?: number;

  /** Add slight overshoot */
  overshoot?: boolean;

  /** Random jitter amount (pixels) */
  jitter?: number;
}

/**
 * Typing pattern options
 */
export interface TypingOptions {
  /** Words per minute */
  wpm?: number;

  /** Error rate (0-1) */
  errorRate?: number;

  /** Behavior profile */
  profile?: BehaviorProfile;

  /** Pause probability between words (0-1) */
  pauseProbability?: number;
}

/**
 * Typing event
 */
export interface TypingEvent {
  /** Character to type */
  char: string;

  /** Delay before typing this character (ms) */
  delay: number;

  /** Whether this is a typo */
  isTypo: boolean;

  /** Whether this is a correction (backspace) */
  isCorrection: boolean;
}

/**
 * Scroll behavior options
 */
export interface ScrollOptions {
  /** Scroll speed */
  speed?: 'slow' | 'normal' | 'fast';

  /** Pause probability during scroll (0-1) */
  pauseProbability?: number;

  /** Easing function */
  easing?: 'linear' | 'ease-in' | 'ease-out' | 'ease-in-out';
}

/**
 * Scroll event
 */
export interface ScrollEvent {
  /** Scroll distance in pixels */
  distance: number;

  /** Delay before scrolling (ms) */
  delay: number;

  /** Whether this is a pause */
  isPause: boolean;
}

/**
 * Touch gesture type
 */
export type GestureType = 'tap' | 'double-tap' | 'long-press' | 'swipe' | 'pinch';

/**
 * Touch gesture event
 */
export interface TouchEvent {
  /** Touch position */
  position: Point;

  /** Timestamp */
  timestamp: number;

  /** Event type */
  type: 'start' | 'move' | 'end';

  /** Pressure (0-1) */
  pressure: number;
}

/**
 * Error codes for standardized error responses
 */
export enum ErrorCode {
  TAB_NOT_FOUND = 'TAB_NOT_FOUND',
  TAB_CLOSED = 'TAB_CLOSED',
  ELEMENT_NOT_FOUND = 'ELEMENT_NOT_FOUND',
  ELEMENT_NOT_VISIBLE = 'ELEMENT_NOT_VISIBLE',
  TIMEOUT = 'TIMEOUT',
  NAVIGATION_FAILED = 'NAVIGATION_FAILED',
  INTERACTION_FAILED = 'INTERACTION_FAILED',
  PERMISSION_DENIED = 'PERMISSION_DENIED',
  NOT_LOGGED_IN = 'NOT_LOGGED_IN',
  PLATFORM_NOT_DETECTED = 'PLATFORM_NOT_DETECTED',
  EXTENSION_ERROR = 'EXTENSION_ERROR',
  NATIVE_MESSAGING_ERROR = 'NATIVE_MESSAGING_ERROR',
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  UNKNOWN_ERROR = 'UNKNOWN_ERROR'
}

/**
 * Standardized error response
 */
export interface ErrorResponse {
  errorCode: ErrorCode;
  errorMessage: string;
  errorDetails?: Record<string, any>;
}

/**
 * MCP tool result format
 */
export interface ToolResult {
  isError?: boolean;
  content: Array<{
    type: 'text' | 'image' | 'resource';
    text?: string;
    data?: string;
    mimeType?: string;
  }>;
  structuredContent?: Record<string, any>;
}

/**
 * Platform detector result
 */
export interface PlatformDetectorResult {
  platform: Platform | null;
  confidence: number;
  indicators: string[];
}

/**
 * Login status check result
 */
export interface LoginStatusResult {
  isLoggedIn: boolean;
  accountInfo?: {
    username: string;
    displayName?: string;
  };
  indicators: string[];
}

/**
 * Session warmup action
 */
export interface WarmupAction {
  action: 'scroll' | 'read' | 'click_link' | 'hover' | 'move_mouse';
  timestamp: number;
  duration: number;
  target?: string;
}

/**
 * Form field information
 */
export interface FormField {
  name: string;
  type: string;
  value?: string;
  required: boolean;
  placeholder?: string;
  label?: string;
  options?: Array<{
    value: string;
    label: string;
  }>;
}

/**
 * Form information
 */
export interface FormInfo {
  id?: string;
  name?: string;
  action?: string;
  method: string;
  fields: FormField[];
}

/**
 * Link information
 */
export interface LinkInfo {
  href: string;
  text: string;
  title?: string;
  isExternal: boolean;
}

/**
 * Content metadata
 */
export interface ContentMetadata {
  title: string;
  url: string;
  description?: string;
  author?: string;
  publishedDate?: string;
  wordCount: number;
  images?: Array<{
    src: string;
    alt?: string;
  }>;
}

/**
 * Screenshot dimensions
 */
export interface ScreenshotDimensions {
  width: number;
  height: number;
}

/**
 * Screenshot result
 */
export interface ScreenshotResult {
  screenshot: string;
  format: 'png' | 'jpeg';
  dimensions: ScreenshotDimensions;
  fileSize: number;
}
