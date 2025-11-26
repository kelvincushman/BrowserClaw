/**
 * Native Messaging Host Handler
 *
 * Handles communication between the Chrome extension and the MCP server
 * via Chrome's native messaging protocol.
 */

interface NativeMessage {
  id: string;
  command: string;
  params: any;
}

interface NativeResponse {
  id: string;
  success: boolean;
  data?: any;
  error?: string;
}

export class NativeMessagingHost {
  private port: chrome.runtime.Port | null = null;
  private readonly hostName = 'com.aigentis.browser';
  private isConnected = false;
  private reconnectAttempts = 0;
  private readonly maxReconnectAttempts = 5;
  private reconnectTimeout: NodeJS.Timeout | null = null;

  constructor() {
    this.connect();
  }

  /**
   * Connect to the native messaging host
   */
  private connect(): void {
    try {
      console.log('[NativeMessaging] Connecting to host:', this.hostName);

      this.port = chrome.runtime.connectNative(this.hostName);

      this.port.onMessage.addListener((message: NativeMessage) => {
        this.handleMessage(message);
      });

      this.port.onDisconnect.addListener(() => {
        this.handleDisconnect();
      });

      this.isConnected = true;
      this.reconnectAttempts = 0;
      console.log('[NativeMessaging] Connected successfully');

    } catch (error) {
      console.error('[NativeMessaging] Connection failed:', error);
      this.handleDisconnect();
    }
  }

  /**
   * Handle disconnection from native host
   */
  private handleDisconnect(): void {
    this.isConnected = false;
    this.port = null;

    const error = chrome.runtime.lastError;
    console.error('[NativeMessaging] Disconnected:', error?.message || 'Unknown reason');

    // Attempt to reconnect
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++;
      const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts - 1), 30000);

      console.log(`[NativeMessaging] Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts})`);

      this.reconnectTimeout = setTimeout(() => {
        this.connect();
      }, delay);
    } else {
      console.error('[NativeMessaging] Max reconnect attempts reached. Native messaging unavailable.');
    }
  }

  /**
   * Handle incoming message from MCP server
   */
  private async handleMessage(message: NativeMessage): Promise<void> {
    console.log('[NativeMessaging] Received command:', message.command);

    try {
      let result: any;

      switch (message.command) {
        case 'ping':
          result = { pong: true };
          break;

        case 'createTab':
          result = await this.handleCreateTab(message.params);
          break;

        case 'closeTab':
          result = await this.handleCloseTab(message.params);
          break;

        case 'activateTab':
          result = await this.handleActivateTab(message.params);
          break;

        case 'navigate':
          result = await this.handleNavigate(message.params);
          break;

        case 'getTabInfo':
          result = await this.handleGetTabInfo(message.params);
          break;

        case 'listTabs':
          result = await this.handleListTabs(message.params);
          break;

        case 'checkLoginStatus':
          result = await this.handleCheckLoginStatus(message.params);
          break;

        case 'click':
          result = await this.handleClick(message.params);
          break;

        case 'fill':
          result = await this.handleFill(message.params);
          break;

        case 'screenshot':
          result = await this.handleScreenshot(message.params);
          break;

        case 'wait':
          result = await this.handleWait(message.params);
          break;

        case 'scroll':
          result = await this.handleScroll(message.params);
          break;

        default:
          throw new Error(`Unknown command: ${message.command}`);
      }

      this.sendResponse(message.id, true, result);

    } catch (error) {
      console.error('[NativeMessaging] Command error:', error);
      this.sendResponse(message.id, false, undefined, error instanceof Error ? error.message : String(error));
    }
  }

  /**
   * Send response back to MCP server
   */
  private sendResponse(id: string, success: boolean, data?: any, error?: string): void {
    if (!this.port) {
      console.error('[NativeMessaging] Cannot send response: not connected');
      return;
    }

    const response: NativeResponse = {
      id,
      success,
      data,
      error
    };

    try {
      this.port.postMessage(response);
    } catch (err) {
      console.error('[NativeMessaging] Failed to send response:', err);
    }
  }

  /**
   * Handle createTab command
   */
  private async handleCreateTab(params: { url: string; active: boolean }): Promise<any> {
    const tab = await chrome.tabs.create({
      url: params.url,
      active: params.active
    });

    return {
      chromeTabId: tab.id,
      url: tab.url,
      title: tab.title,
      active: tab.active
    };
  }

  /**
   * Handle closeTab command
   */
  private async handleCloseTab(params: { chromeTabId: number }): Promise<any> {
    await chrome.tabs.remove(params.chromeTabId);
    return { success: true };
  }

  /**
   * Handle activateTab command
   */
  private async handleActivateTab(params: { chromeTabId: number }): Promise<any> {
    await chrome.tabs.update(params.chromeTabId, { active: true });
    return { success: true };
  }

  /**
   * Handle navigate command
   */
  private async handleNavigate(params: { chromeTabId: number; url: string; waitForLoad: boolean }): Promise<any> {
    const tab = await chrome.tabs.update(params.chromeTabId, { url: params.url });

    if (params.waitForLoad) {
      // Wait for the tab to finish loading
      await new Promise<void>((resolve) => {
        const listener = (tabId: number, changeInfo: chrome.tabs.TabChangeInfo) => {
          if (tabId === params.chromeTabId && changeInfo.status === 'complete') {
            chrome.tabs.onUpdated.removeListener(listener);
            resolve();
          }
        };
        chrome.tabs.onUpdated.addListener(listener);

        // Timeout after 30 seconds
        setTimeout(() => {
          chrome.tabs.onUpdated.removeListener(listener);
          resolve();
        }, 30000);
      });
    }

    return {
      url: tab.url,
      title: tab.title
    };
  }

  /**
   * Handle getTabInfo command
   */
  private async handleGetTabInfo(params: { chromeTabId: number }): Promise<any> {
    const tab = await chrome.tabs.get(params.chromeTabId);

    return {
      chromeTabId: tab.id,
      url: tab.url,
      title: tab.title,
      active: tab.active
    };
  }

  /**
   * Handle listTabs command
   */
  private async handleListTabs(_params: any): Promise<any> {
    const tabs = await chrome.tabs.query({});

    return tabs.map(tab => ({
      id: tab.id,
      url: tab.url,
      title: tab.title,
      active: tab.active
    }));
  }

  /**
   * Handle checkLoginStatus command
   */
  private async handleCheckLoginStatus(params: { chromeTabId: number; platform: string }): Promise<any> {
    try {
      // Execute script in the tab to check for login indicators
      const results = await chrome.scripting.executeScript({
        target: { tabId: params.chromeTabId },
        func: (platform: string) => {
          // Platform-specific login detection
          switch (platform) {
            case 'twitter':
              const twitterProfile = document.querySelector('[data-testid="AppTabBar_Profile_Link"]');
              if (twitterProfile) {
                const username = twitterProfile.getAttribute('href')?.replace('/', '');
                return {
                  isLoggedIn: true,
                  accountInfo: { username }
                };
              }
              break;

            case 'linkedin':
              const linkedinPhoto = document.querySelector('.global-nav__me-photo');
              if (linkedinPhoto) {
                const profileLink = linkedinPhoto.closest('a');
                const username = profileLink?.getAttribute('href')?.split('/in/')[1]?.replace('/', '');
                return {
                  isLoggedIn: true,
                  accountInfo: { username }
                };
              }
              break;

            case 'instagram':
              const instagramPost = document.querySelector('[aria-label*="New post"]');
              if (instagramPost) {
                return {
                  isLoggedIn: true,
                  accountInfo: {}
                };
              }
              break;

            case 'facebook':
              const facebookMenu = document.querySelector('[aria-label="Account"]');
              if (facebookMenu) {
                return {
                  isLoggedIn: true,
                  accountInfo: {}
                };
              }
              break;
          }

          return {
            isLoggedIn: false
          };
        },
        args: [params.platform]
      });

      return results[0]?.result || { isLoggedIn: false };

    } catch (error) {
      console.error('[NativeMessaging] Login check failed:', error);
      return { isLoggedIn: false };
    }
  }

  /**
   * Handle click command
   */
  private async handleClick(params: {
    chromeTabId: number;
    selector: string;
    humanLike?: boolean;
    waitForNav?: boolean;
  }): Promise<any> {
    const results = await chrome.scripting.executeScript({
      target: { tabId: params.chromeTabId },
      func: async (selector: string, humanLike: boolean, waitForNav: boolean) => {
        const element = document.querySelector(selector);
        if (!element) {
          throw new Error(`Element not found: ${selector}`);
        }

        // Import human behavior simulator if needed
        if (humanLike) {
          // @ts-ignore - Dynamic import
          const { MouseSimulator, TimingRandomizer } = await import(chrome.runtime.getURL('lib/human-behavior/index.js'));

          // Get current cursor position (or use fallback)
          const start = MouseSimulator.getCurrentPosition();

          // Get element center with random offset
          const center = MouseSimulator.getElementCenter(element);
          const end = MouseSimulator.addRandomOffset(center, element);

          // Simulate mouse movement
          await MouseSimulator.simulateMovement(start, end, {
            speed: 'normal',
            overshoot: true,
            jitter: true,
            pauseAtEnd: 50 + Math.random() * 100
          });

          // Add thinking delay before click
          await TimingRandomizer.wait('click');
        }

        // Perform click
        const rect = element.getBoundingClientRect();
        const x = rect.left + rect.width / 2;
        const y = rect.top + rect.height / 2;

        // Dispatch mouse events
        const mousedownEvent = new MouseEvent('mousedown', {
          bubbles: true,
          cancelable: true,
          view: window,
          clientX: x,
          clientY: y
        });
        element.dispatchEvent(mousedownEvent);

        await new Promise(r => setTimeout(r, 50 + Math.random() * 100));

        const mouseupEvent = new MouseEvent('mouseup', {
          bubbles: true,
          cancelable: true,
          view: window,
          clientX: x,
          clientY: y
        });
        element.dispatchEvent(mouseupEvent);

        const clickEvent = new MouseEvent('click', {
          bubbles: true,
          cancelable: true,
          view: window,
          clientX: x,
          clientY: y
        });
        element.dispatchEvent(clickEvent);

        // Handle navigation wait
        if (waitForNav) {
          await new Promise(r => setTimeout(r, 1000));
        }

        return {
          clicked: true,
          element: {
            tag: element.tagName,
            text: (element as HTMLElement).innerText?.substring(0, 100),
            href: (element as HTMLAnchorElement).href
          }
        };
      },
      args: [params.selector, params.humanLike ?? true, params.waitForNav ?? false]
    });

    return results[0]?.result || { clicked: false };
  }

  /**
   * Handle fill command
   */
  private async handleFill(params: {
    chromeTabId: number;
    selector: string;
    text: string;
    humanLike?: boolean;
    submit?: boolean;
  }): Promise<any> {
    const results = await chrome.scripting.executeScript({
      target: { tabId: params.chromeTabId },
      func: async (selector: string, text: string, humanLike: boolean, submit: boolean) => {
        const element = document.querySelector(selector) as HTMLInputElement | HTMLTextAreaElement;
        if (!element) {
          throw new Error(`Element not found: ${selector}`);
        }

        if (element.tagName !== 'INPUT' && element.tagName !== 'TEXTAREA') {
          throw new Error(`Element is not an input or textarea: ${selector}`);
        }

        // Import human behavior simulator if needed
        if (humanLike) {
          // @ts-ignore - Dynamic import
          const { TypingSimulator, TimingRandomizer } = await import(chrome.runtime.getURL('lib/human-behavior/index.js'));

          // Add delay before focusing
          await TimingRandomizer.wait('focus');

          // Type with human-like behavior
          await TypingSimulator.typeIntoElement(element, text, {
            speed: 'normal',
            simulateTypos: true,
            naturalPauses: true
          });

          // Handle submit
          if (submit) {
            await TimingRandomizer.wait('form_submit');
            await TypingSimulator.pressEnter(element);
          }
        } else {
          // Simple fill without simulation
          element.focus();
          element.value = text;
          element.dispatchEvent(new Event('input', { bubbles: true }));
          element.dispatchEvent(new Event('change', { bubbles: true }));

          if (submit) {
            const form = element.closest('form');
            if (form) {
              form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
            }
          }
        }

        return {
          filled: true,
          valueLength: element.value.length
        };
      },
      args: [params.selector, params.text, params.humanLike ?? true, params.submit ?? false]
    });

    return results[0]?.result || { filled: false };
  }

  /**
   * Handle screenshot command
   */
  private async handleScreenshot(params: {
    chromeTabId: number;
    selector?: string;
    fullPage?: boolean;
  }): Promise<any> {
    try {
      // Capture visible tab
      const dataUrl = await chrome.tabs.captureVisibleTab(undefined, {
        format: 'png'
      });

      // If selector specified, crop to element
      if (params.selector) {
        const results = await chrome.scripting.executeScript({
          target: { tabId: params.chromeTabId },
          func: (selector: string) => {
            const element = document.querySelector(selector);
            if (!element) {
              throw new Error(`Element not found: ${selector}`);
            }
            const rect = element.getBoundingClientRect();
            return {
              x: rect.left,
              y: rect.top,
              width: rect.width,
              height: rect.height
            };
          },
          args: [params.selector]
        });

        const rect = results[0]?.result;
        if (rect) {
          return {
            dataUrl,
            crop: rect
          };
        }
      }

      return {
        dataUrl,
        fullPage: params.fullPage ?? false
      };
    } catch (error) {
      console.error('[NativeMessaging] Screenshot failed:', error);
      throw error;
    }
  }

  /**
   * Handle wait command
   */
  private async handleWait(params: {
    chromeTabId: number;
    type: 'selector' | 'timeout' | 'navigation';
    selector?: string;
    timeout?: number;
  }): Promise<any> {
    if (params.type === 'timeout') {
      await new Promise(resolve => setTimeout(resolve, params.timeout || 1000));
      return { waited: true, duration: params.timeout };
    }

    if (params.type === 'selector' && params.selector) {
      const results = await chrome.scripting.executeScript({
        target: { tabId: params.chromeTabId },
        func: async (selector: string, timeout: number) => {
          const startTime = Date.now();
          const maxWait = timeout || 10000;

          while (Date.now() - startTime < maxWait) {
            const element = document.querySelector(selector);
            if (element) {
              return {
                found: true,
                duration: Date.now() - startTime
              };
            }
            await new Promise(r => setTimeout(r, 100));
          }

          return {
            found: false,
            duration: Date.now() - startTime
          };
        },
        args: [params.selector, params.timeout || 10000]
      });

      return results[0]?.result || { found: false };
    }

    if (params.type === 'navigation') {
      // Wait for page load
      const tab = await chrome.tabs.get(params.chromeTabId);
      if (tab.status === 'complete') {
        return { waited: true, status: 'complete' };
      }

      // Wait for loading to complete
      return new Promise((resolve) => {
        const listener = (tabId: number, changeInfo: chrome.tabs.TabChangeInfo) => {
          if (tabId === params.chromeTabId && changeInfo.status === 'complete') {
            chrome.tabs.onUpdated.removeListener(listener);
            resolve({ waited: true, status: 'complete' });
          }
        };
        chrome.tabs.onUpdated.addListener(listener);

        // Timeout after 30 seconds
        setTimeout(() => {
          chrome.tabs.onUpdated.removeListener(listener);
          resolve({ waited: true, status: 'timeout' });
        }, 30000);
      });
    }

    throw new Error(`Invalid wait type: ${params.type}`);
  }

  /**
   * Handle scroll command
   */
  private async handleScroll(params: {
    chromeTabId: number;
    direction?: 'up' | 'down';
    amount?: number;
    toElement?: string;
    humanLike?: boolean;
  }): Promise<any> {
    const results = await chrome.scripting.executeScript({
      target: { tabId: params.chromeTabId },
      func: async (
        direction: string,
        amount: number,
        toElement: string | undefined,
        humanLike: boolean
      ) => {
        // Import human behavior simulator if needed
        if (humanLike) {
          // @ts-ignore - Dynamic import
          const { ScrollSimulator } = await import(chrome.runtime.getURL('lib/human-behavior/index.js'));

          if (toElement) {
            const element = document.querySelector(toElement);
            if (!element) {
              throw new Error(`Element not found: ${toElement}`);
            }
            await ScrollSimulator.scrollToElement(element, {
              speed: 'normal',
              withReadingPauses: true
            });
          } else {
            const deltaY = direction === 'down' ? amount : -amount;
            await ScrollSimulator.scrollBy({
              deltaY,
              speed: 'normal',
              withReadingPauses: true
            });
          }
        } else {
          // Simple scroll without simulation
          if (toElement) {
            const element = document.querySelector(toElement);
            if (element) {
              element.scrollIntoView({ behavior: 'smooth' });
            }
          } else {
            const deltaY = direction === 'down' ? amount : -amount;
            window.scrollBy({ top: deltaY, behavior: 'smooth' });
          }
        }

        return {
          scrolled: true,
          scrollY: window.scrollY
        };
      },
      args: [
        params.direction || 'down',
        params.amount || 500,
        params.toElement,
        params.humanLike ?? true
      ]
    });

    return results[0]?.result || { scrolled: false };
  }

  /**
   * Check if connected to native host
   */
  isHostConnected(): boolean {
    return this.isConnected;
  }

  /**
   * Disconnect from native host
   */
  disconnect(): void {
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }

    if (this.port) {
      this.port.disconnect();
      this.port = null;
    }

    this.isConnected = false;
  }
}

// Singleton instance
let nativeHostInstance: NativeMessagingHost | null = null;

/**
 * Get the native messaging host instance
 */
export function getNativeMessagingHost(): NativeMessagingHost {
  if (!nativeHostInstance) {
    nativeHostInstance = new NativeMessagingHost();
  }
  return nativeHostInstance;
}

/**
 * Initialize native messaging on extension startup
 */
export function initializeNativeMessaging(): void {
  console.log('[NativeMessaging] Initializing...');
  getNativeMessagingHost();
}
