/**
 * Tool Registry
 *
 * Manages registration and execution of all MCP tools.
 * Provides a centralized system for tool management.
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import type { SessionManager } from './session-manager.js';
import type { NativeMessagingClient } from './native-messaging-client.js';
import { ErrorCode, type Platform } from '../types/index.js';

export class ToolRegistry {
  private toolCount = 0;

  constructor(
    private server: McpServer,
    private sessionManager: SessionManager,
    private nativeClient: NativeMessagingClient
  ) {}

  /**
   * Register all browser automation tools
   */
  registerAllTools(): void {
    console.error('[ToolRegistry] Registering tools...');

    // Tab Management Tools
    this.registerTabCreateTool();
    this.registerTabListTool();
    this.registerTabCloseTool();
    this.registerTabSwitchTool();
    this.registerTabNavigateTool();
    this.registerTabGetInfoTool();

    // Page Interaction Tools
    this.registerClickTool();
    this.registerFillTool();
    this.registerScreenshotTool();
    this.registerWaitTool();
    this.registerScrollTool();

    console.error(`[ToolRegistry] Registered ${this.toolCount} tools`);
  }

  /**
   * Register browser_tab_create tool
   */
  private registerTabCreateTool(): void {
    this.server.registerTool(
      'browser_tab_create',
      {
        title: 'Create Browser Tab',
        description: 'Create a new browser tab and optionally navigate to a URL',
        inputSchema: {
          url: z.string().url().optional().describe('URL to navigate to (optional)'),
          active: z.boolean().default(true).describe('Make tab active immediately'),
          background: z.boolean().default(false).describe('Open tab in background')
        },
        outputSchema: {
          tabId: z.string(),
          chromeTabId: z.number(),
          url: z.string(),
          title: z.string(),
          active: z.boolean()
        },
        annotations: {
          readOnlyHint: false,
          destructiveHint: false,
          idempotentHint: false
        }
      },
      async ({ url, active, background }) => {
        try {
          // Send command to extension to create tab
          const result = await this.nativeClient.sendCommand('createTab', {
            url: url || 'about:blank',
            active: active && !background
          });

          // Create session for the new tab
          const tabId = await this.sessionManager.createSession(
            result.chromeTabId
          );

          const session = this.sessionManager.getSession(tabId);

          return {
            content: [{
              type: 'text',
              text: `Created tab: ${tabId}${url ? ` at ${url}` : ''}`
            }],
            structuredContent: {
              tabId: session!.id,
              chromeTabId: session!.chromeTabId,
              url: session!.url,
              title: session!.title,
              active: session!.active
            }
          };
        } catch (error) {
          return {
            isError: true,
            content: [{
              type: 'text',
              text: `Failed to create tab: ${error instanceof Error ? error.message : String(error)}`
            }],
            structuredContent: {
              errorCode: ErrorCode.EXTENSION_ERROR,
              errorMessage: error instanceof Error ? error.message : String(error)
            }
          };
        }
      }
    );
    this.toolCount++;
  }

  /**
   * Register browser_tab_list tool
   */
  private registerTabListTool(): void {
    this.server.registerTool(
      'browser_tab_list',
      {
        title: 'List Browser Tabs',
        description: 'List all open browser tabs with optional filtering',
        inputSchema: {
          filter: z.object({
            platform: z.enum(['twitter', 'linkedin', 'instagram', 'facebook', 'reddit', 'tiktok', 'youtube']).optional(),
            requireLogin: z.boolean().optional(),
            urlPattern: z.string().optional()
          }).optional()
        },
        outputSchema: {
          tabs: z.array(z.object({
            tabId: z.string(),
            chromeTabId: z.number(),
            url: z.string(),
            title: z.string(),
            active: z.boolean(),
            platform: z.string().nullable(),
            isLoggedIn: z.boolean()
          })),
          totalCount: z.number()
        },
        annotations: {
          readOnlyHint: true,
          destructiveHint: false,
          idempotentHint: true
        }
      },
      async ({ filter }) => {
        try {
          // Sync sessions with actual tabs first
          await this.sessionManager.syncSessions();

          // Get filtered sessions
          let sessions;
          if (filter) {
            const filterObj: {
              platform?: Platform;
              requireLogin?: boolean;
              urlPattern?: string;
            } = {};
            if (filter.platform !== undefined) filterObj.platform = filter.platform as Platform;
            if (filter.requireLogin !== undefined) filterObj.requireLogin = filter.requireLogin;
            if (filter.urlPattern !== undefined) filterObj.urlPattern = filter.urlPattern;
            sessions = this.sessionManager.filterSessions(filterObj);
          } else {
            sessions = this.sessionManager.getAllSessions();
          }

          const tabs = sessions.map(session => ({
            tabId: session.id,
            chromeTabId: session.chromeTabId,
            url: session.url,
            title: session.title,
            active: session.active,
            platform: session.platform,
            isLoggedIn: session.isLoggedIn,
            accountInfo: session.accountInfo
          }));

          return {
            content: [{
              type: 'text',
              text: `Found ${tabs.length} tab${tabs.length !== 1 ? 's' : ''}${filter ? ' (filtered)' : ''}`
            }],
            structuredContent: {
              tabs,
              totalCount: tabs.length
            }
          };
        } catch (error) {
          return {
            isError: true,
            content: [{
              type: 'text',
              text: `Failed to list tabs: ${error instanceof Error ? error.message : String(error)}`
            }],
            structuredContent: {
              errorCode: ErrorCode.EXTENSION_ERROR,
              errorMessage: error instanceof Error ? error.message : String(error)
            }
          };
        }
      }
    );
    this.toolCount++;
  }

  /**
   * Register browser_tab_close tool
   */
  private registerTabCloseTool(): void {
    this.server.registerTool(
      'browser_tab_close',
      {
        title: 'Close Browser Tab',
        description: 'Close a browser tab',
        inputSchema: {
          tabId: z.string().describe('Tab ID to close')
        },
        outputSchema: {
          success: z.boolean(),
          closedTabId: z.string()
        },
        annotations: {
          readOnlyHint: false,
          destructiveHint: true,
          idempotentHint: true
        }
      },
      async ({ tabId }) => {
        try {
          const session = this.sessionManager.getSession(tabId);
          if (!session) {
            throw new Error(`Tab not found: ${tabId}`);
          }

          // Send command to extension to close tab
          await this.nativeClient.sendCommand('closeTab', {
            chromeTabId: session.chromeTabId
          });

          // Remove session
          this.sessionManager.removeSession(tabId);

          return {
            content: [{
              type: 'text',
              text: `Closed tab: ${tabId}`
            }],
            structuredContent: {
              success: true,
              closedTabId: tabId
            }
          };
        } catch (error) {
          return {
            isError: true,
            content: [{
              type: 'text',
              text: `Failed to close tab: ${error instanceof Error ? error.message : String(error)}`
            }],
            structuredContent: {
              errorCode: error instanceof Error && error.message.includes('not found')
                ? ErrorCode.TAB_NOT_FOUND
                : ErrorCode.EXTENSION_ERROR,
              errorMessage: error instanceof Error ? error.message : String(error)
            }
          };
        }
      }
    );
    this.toolCount++;
  }

  /**
   * Register browser_tab_switch tool
   */
  private registerTabSwitchTool(): void {
    this.server.registerTool(
      'browser_tab_switch',
      {
        title: 'Switch Browser Tab',
        description: 'Switch to a specific browser tab (make it active)',
        inputSchema: {
          tabId: z.string().describe('Tab ID to switch to')
        },
        outputSchema: {
          success: z.boolean(),
          activeTabId: z.string()
        },
        annotations: {
          readOnlyHint: false,
          destructiveHint: false,
          idempotentHint: true
        }
      },
      async ({ tabId }) => {
        try {
          const session = this.sessionManager.getSession(tabId);
          if (!session) {
            throw new Error(`Tab not found: ${tabId}`);
          }

          // Send command to extension to activate tab
          await this.nativeClient.sendCommand('activateTab', {
            chromeTabId: session.chromeTabId
          });

          // Update session activity
          this.sessionManager.updateActivity(tabId);

          return {
            content: [{
              type: 'text',
              text: `Switched to tab: ${tabId} (${session.title})`
            }],
            structuredContent: {
              success: true,
              activeTabId: tabId
            }
          };
        } catch (error) {
          return {
            isError: true,
            content: [{
              type: 'text',
              text: `Failed to switch tab: ${error instanceof Error ? error.message : String(error)}`
            }],
            structuredContent: {
              errorCode: error instanceof Error && error.message.includes('not found')
                ? ErrorCode.TAB_NOT_FOUND
                : ErrorCode.EXTENSION_ERROR,
              errorMessage: error instanceof Error ? error.message : String(error)
            }
          };
        }
      }
    );
    this.toolCount++;
  }

  /**
   * Register browser_tab_navigate tool
   */
  private registerTabNavigateTool(): void {
    this.server.registerTool(
      'browser_navigate',
      {
        title: 'Navigate to URL',
        description: 'Navigate to a URL in a specific tab',
        inputSchema: {
          tabId: z.string(),
          url: z.string().url(),
          waitForLoad: z.boolean().default(true),
          timeout: z.number().default(30000)
        },
        outputSchema: {
          success: z.boolean(),
          url: z.string(),
          title: z.string(),
          loadTime: z.number()
        },
        annotations: {
          readOnlyHint: false,
          destructiveHint: false,
          idempotentHint: false
        }
      },
      async ({ tabId, url, waitForLoad, timeout }) => {
        try {
          const session = this.sessionManager.getSession(tabId);
          if (!session) {
            throw new Error(`Tab not found: ${tabId}`);
          }

          const startTime = Date.now();

          // Send command to extension to navigate
          await this.nativeClient.sendCommand('navigate', {
            chromeTabId: session.chromeTabId,
            url,
            waitForLoad
          }, timeout);

          const loadTime = Date.now() - startTime;

          // Update session info
          await this.sessionManager.updateSessionInfo(tabId);

          const updatedSession = this.sessionManager.getSession(tabId);

          return {
            content: [{
              type: 'text',
              text: `Navigated to ${url} in ${loadTime}ms`
            }],
            structuredContent: {
              success: true,
              url: updatedSession!.url,
              title: updatedSession!.title,
              loadTime
            }
          };
        } catch (error) {
          return {
            isError: true,
            content: [{
              type: 'text',
              text: `Navigation failed: ${error instanceof Error ? error.message : String(error)}`
            }],
            structuredContent: {
              errorCode: error instanceof Error && error.message.includes('timed out')
                ? ErrorCode.TIMEOUT
                : error instanceof Error && error.message.includes('not found')
                ? ErrorCode.TAB_NOT_FOUND
                : ErrorCode.NAVIGATION_FAILED,
              errorMessage: error instanceof Error ? error.message : String(error)
            }
          };
        }
      }
    );
    this.toolCount++;
  }

  /**
   * Register browser_tab_get_info tool
   */
  private registerTabGetInfoTool(): void {
    this.server.registerTool(
      'browser_tab_get_info',
      {
        title: 'Get Tab Info',
        description: 'Get detailed information about a specific tab',
        inputSchema: {
          tabId: z.string()
        },
        outputSchema: {
          tabId: z.string(),
          chromeTabId: z.number(),
          url: z.string(),
          title: z.string(),
          active: z.boolean(),
          platform: z.string().nullable(),
          isLoggedIn: z.boolean()
        },
        annotations: {
          readOnlyHint: true,
          destructiveHint: false,
          idempotentHint: true
        }
      },
      async ({ tabId }) => {
        try {
          // Update session info to get latest data
          await this.sessionManager.updateSessionInfo(tabId);

          const session = this.sessionManager.getSession(tabId);
          if (!session) {
            throw new Error(`Tab not found: ${tabId}`);
          }

          return {
            content: [{
              type: 'text',
              text: `Tab: ${session.title} (${session.url})`
            }],
            structuredContent: {
              tabId: session.id,
              chromeTabId: session.chromeTabId,
              url: session.url,
              title: session.title,
              active: session.active,
              platform: session.platform,
              isLoggedIn: session.isLoggedIn,
              accountInfo: session.accountInfo,
              loadingState: session.loadingState,
              lastActivity: session.lastActivity
            }
          };
        } catch (error) {
          return {
            isError: true,
            content: [{
              type: 'text',
              text: `Failed to get tab info: ${error instanceof Error ? error.message : String(error)}`
            }],
            structuredContent: {
              errorCode: error instanceof Error && error.message.includes('not found')
                ? ErrorCode.TAB_NOT_FOUND
                : ErrorCode.EXTENSION_ERROR,
              errorMessage: error instanceof Error ? error.message : String(error)
            }
          };
        }
      }
    );
    this.toolCount++;
  }

  /**
   * Register browser_tab_click tool
   */
  private registerClickTool(): void {
    this.server.registerTool(
      'browser_tab_click',
      {
        title: 'Click Element',
        description: 'Click an element on the page with optional human-like behavior',
        inputSchema: {
          tabId: z.string(),
          selector: z.string().describe('CSS selector for element to click'),
          humanLike: z.boolean().default(true).describe('Use human-like mouse movement'),
          waitForNav: z.boolean().default(false).describe('Wait for navigation after click')
        },
        outputSchema: {
          success: z.boolean(),
          clicked: z.boolean(),
          element: z.object({
            tag: z.string(),
            text: z.string().optional(),
            href: z.string().optional()
          }).optional()
        },
        annotations: {
          readOnlyHint: false,
          destructiveHint: false,
          idempotentHint: false
        }
      },
      async ({ tabId, selector, humanLike, waitForNav }) => {
        try {
          const session = this.sessionManager.getSession(tabId);
          if (!session) {
            throw new Error(`Tab not found: ${tabId}`);
          }

          const result = await this.nativeClient.sendCommand('click', {
            chromeTabId: session.chromeTabId,
            selector,
            humanLike,
            waitForNav
          });

          this.sessionManager.updateActivity(tabId);

          return {
            content: [{
              type: 'text',
              text: `Clicked element: ${selector}`
            }],
            structuredContent: {
              success: true,
              ...result
            }
          };
        } catch (error) {
          return {
            isError: true,
            content: [{
              type: 'text',
              text: `Click failed: ${error instanceof Error ? error.message : String(error)}`
            }],
            structuredContent: {
              errorCode: ErrorCode.INTERACTION_FAILED,
              errorMessage: error instanceof Error ? error.message : String(error)
            }
          };
        }
      }
    );
    this.toolCount++;
  }

  /**
   * Register browser_tab_fill tool
   */
  private registerFillTool(): void {
    this.server.registerTool(
      'browser_tab_fill',
      {
        title: 'Fill Input Field',
        description: 'Fill an input field or textarea with text using realistic typing',
        inputSchema: {
          tabId: z.string(),
          selector: z.string().describe('CSS selector for input element'),
          text: z.string().describe('Text to type into the field'),
          humanLike: z.boolean().default(true).describe('Use human-like typing patterns'),
          submit: z.boolean().default(false).describe('Submit form after filling')
        },
        outputSchema: {
          success: z.boolean(),
          filled: z.boolean(),
          valueLength: z.number()
        },
        annotations: {
          readOnlyHint: false,
          destructiveHint: false,
          idempotentHint: false
        }
      },
      async ({ tabId, selector, text, humanLike, submit }) => {
        try {
          const session = this.sessionManager.getSession(tabId);
          if (!session) {
            throw new Error(`Tab not found: ${tabId}`);
          }

          const result = await this.nativeClient.sendCommand('fill', {
            chromeTabId: session.chromeTabId,
            selector,
            text,
            humanLike,
            submit
          }, 60000); // Longer timeout for typing

          this.sessionManager.updateActivity(tabId);

          return {
            content: [{
              type: 'text',
              text: `Filled field ${selector} with ${text.length} characters${submit ? ' and submitted' : ''}`
            }],
            structuredContent: {
              success: true,
              ...result
            }
          };
        } catch (error) {
          return {
            isError: true,
            content: [{
              type: 'text',
              text: `Fill failed: ${error instanceof Error ? error.message : String(error)}`
            }],
            structuredContent: {
              errorCode: ErrorCode.INTERACTION_FAILED,
              errorMessage: error instanceof Error ? error.message : String(error)
            }
          };
        }
      }
    );
    this.toolCount++;
  }

  /**
   * Register browser_tab_screenshot tool
   */
  private registerScreenshotTool(): void {
    this.server.registerTool(
      'browser_tab_screenshot',
      {
        title: 'Take Screenshot',
        description: 'Capture a screenshot of the tab or specific element',
        inputSchema: {
          tabId: z.string(),
          selector: z.string().optional().describe('CSS selector for element to capture'),
          fullPage: z.boolean().default(false).describe('Capture full page (not just visible area)')
        },
        outputSchema: {
          success: z.boolean(),
          dataUrl: z.string(),
          crop: z.object({
            x: z.number(),
            y: z.number(),
            width: z.number(),
            height: z.number()
          }).optional()
        },
        annotations: {
          readOnlyHint: true,
          destructiveHint: false,
          idempotentHint: true
        }
      },
      async ({ tabId, selector, fullPage }) => {
        try {
          const session = this.sessionManager.getSession(tabId);
          if (!session) {
            throw new Error(`Tab not found: ${tabId}`);
          }

          const result = await this.nativeClient.sendCommand('screenshot', {
            chromeTabId: session.chromeTabId,
            selector,
            fullPage
          });

          return {
            content: [{
              type: 'text',
              text: `Screenshot captured${selector ? ` of ${selector}` : ''}`
            }],
            structuredContent: {
              success: true,
              ...result
            }
          };
        } catch (error) {
          return {
            isError: true,
            content: [{
              type: 'text',
              text: `Screenshot failed: ${error instanceof Error ? error.message : String(error)}`
            }],
            structuredContent: {
              errorCode: ErrorCode.INTERACTION_FAILED,
              errorMessage: error instanceof Error ? error.message : String(error)
            }
          };
        }
      }
    );
    this.toolCount++;
  }

  /**
   * Register browser_tab_wait tool
   */
  private registerWaitTool(): void {
    this.server.registerTool(
      'browser_tab_wait',
      {
        title: 'Wait for Condition',
        description: 'Wait for a selector to appear, navigation to complete, or timeout',
        inputSchema: {
          tabId: z.string(),
          type: z.enum(['selector', 'timeout', 'navigation']).describe('Type of wait condition'),
          selector: z.string().optional().describe('CSS selector to wait for (required for type=selector)'),
          timeout: z.number().default(10000).describe('Maximum time to wait in milliseconds')
        },
        outputSchema: {
          success: z.boolean(),
          waited: z.boolean(),
          found: z.boolean().optional(),
          duration: z.number().optional(),
          status: z.string().optional()
        },
        annotations: {
          readOnlyHint: true,
          destructiveHint: false,
          idempotentHint: true
        }
      },
      async ({ tabId, type, selector, timeout }) => {
        try {
          const session = this.sessionManager.getSession(tabId);
          if (!session) {
            throw new Error(`Tab not found: ${tabId}`);
          }

          const result = await this.nativeClient.sendCommand('wait', {
            chromeTabId: session.chromeTabId,
            type,
            selector,
            timeout
          }, timeout + 5000); // Add buffer to command timeout

          return {
            content: [{
              type: 'text',
              text: `Wait completed: ${type}${selector ? ` (${selector})` : ''}`
            }],
            structuredContent: {
              success: true,
              ...result
            }
          };
        } catch (error) {
          return {
            isError: true,
            content: [{
              type: 'text',
              text: `Wait failed: ${error instanceof Error ? error.message : String(error)}`
            }],
            structuredContent: {
              errorCode: ErrorCode.TIMEOUT,
              errorMessage: error instanceof Error ? error.message : String(error)
            }
          };
        }
      }
    );
    this.toolCount++;
  }

  /**
   * Register browser_tab_scroll tool
   */
  private registerScrollTool(): void {
    this.server.registerTool(
      'browser_tab_scroll',
      {
        title: 'Scroll Page',
        description: 'Scroll the page with human-like behavior',
        inputSchema: {
          tabId: z.string(),
          direction: z.enum(['up', 'down']).default('down').describe('Scroll direction'),
          amount: z.number().default(500).describe('Amount to scroll in pixels'),
          toElement: z.string().optional().describe('CSS selector to scroll to'),
          humanLike: z.boolean().default(true).describe('Use human-like scrolling with pauses')
        },
        outputSchema: {
          success: z.boolean(),
          scrolled: z.boolean(),
          scrollY: z.number()
        },
        annotations: {
          readOnlyHint: false,
          destructiveHint: false,
          idempotentHint: false
        }
      },
      async ({ tabId, direction, amount, toElement, humanLike }) => {
        try {
          const session = this.sessionManager.getSession(tabId);
          if (!session) {
            throw new Error(`Tab not found: ${tabId}`);
          }

          const result = await this.nativeClient.sendCommand('scroll', {
            chromeTabId: session.chromeTabId,
            direction,
            amount,
            toElement,
            humanLike
          }, 30000); // Longer timeout for human-like scrolling

          this.sessionManager.updateActivity(tabId);

          return {
            content: [{
              type: 'text',
              text: `Scrolled ${direction} ${toElement ? `to ${toElement}` : `${amount}px`}`
            }],
            structuredContent: {
              success: true,
              ...result
            }
          };
        } catch (error) {
          return {
            isError: true,
            content: [{
              type: 'text',
              text: `Scroll failed: ${error instanceof Error ? error.message : String(error)}`
            }],
            structuredContent: {
              errorCode: ErrorCode.INTERACTION_FAILED,
              errorMessage: error instanceof Error ? error.message : String(error)
            }
          };
        }
      }
    );
    this.toolCount++;
  }
}
