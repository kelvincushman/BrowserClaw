/**
 * Native Messaging Host Handler
 *
 * Handles communication between bridge-server.py (Nova) and BrowserClaw
 * via Chrome's native messaging protocol.
 *
 * All tool_call messages are routed through callMcpTool() which dispatches
 * to the 112+ browser tool handlers.
 */

import { callMcpTool } from "~/mcp/index"
import { getAllTools } from "~/lib/services/tool-registry"

interface NativeMessage {
  id?: string;
  type: string;
  tool?: string;
  args?: any;
  command?: string;
  params?: any;
}

interface NativeResponse {
  id: string | null;
  type: string;
  success?: boolean;
  result?: any;
  data?: any;
  error?: string | null;
}

export class NativeMessagingHost {
  private port: chrome.runtime.Port | null = null;
  private readonly hostName = 'com.browserclaw.bridge';
  private isConnected = false;
  private reconnectAttempts = 0;
  private readonly maxReconnectAttempts = -1; // unlimited
  private reconnectTimeout: ReturnType<typeof setTimeout> | null = null;

  constructor() {
    this.connect();
  }

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

      // Notify bridge-server that we're connected
      this.sendRaw({ type: "connected" });

    } catch (error) {
      console.error('[NativeMessaging] Connection failed:', error);
      this.handleDisconnect();
    }
  }

  private handleDisconnect(): void {
    this.isConnected = false;
    this.port = null;

    const error = chrome.runtime.lastError;
    console.warn('[NativeMessaging] Disconnected:', error?.message || 'Unknown reason');

    // Always reconnect with exponential backoff (1s to 30s)
    this.reconnectAttempts++;
    const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts - 1), 30000);
    console.log(`[NativeMessaging] Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts})`);

    this.reconnectTimeout = setTimeout(() => {
      this.connect();
    }, delay);
  }

  private async handleMessage(message: NativeMessage): Promise<void> {
    const msgType = message.type || message.command;
    console.log('[NativeMessaging] Received:', msgType, message.id || '');

    try {
      switch (msgType) {
        case 'ping':
          this.sendRaw({ type: "pong", id: message.id || null });
          break;

        case 'tool_call':
          await this.handleToolCall(message);
          break;

        case 'list_tools':
          await this.handleListTools(message);
          break;

        default:
          console.warn('[NativeMessaging] Unknown message type:', msgType);
          if (message.id) {
            this.sendResponse(message.id, false, undefined, `Unknown message type: ${msgType}`);
          }
      }
    } catch (error) {
      console.error('[NativeMessaging] Handler error:', error);
      if (message.id) {
        this.sendResponse(message.id, false, undefined, error instanceof Error ? error.message : String(error));
      }
    }
  }

  private async handleListTools(message: NativeMessage): Promise<void> {
    try {
      const tools = getAllTools().map(t => ({
        name: t.name,
        description: t.description,
        inputSchema: t.inputSchema,
      }));
      this.sendRaw({
        id: message.id || null,
        type: "tool_list",
        success: true,
        result: { tools },
      });
    } catch (err: any) {
      this.sendRaw({
        id: message.id || null,
        type: "tool_list",
        success: false,
        result: null,
        error: err?.message || String(err),
      });
    }
  }

  private async handleToolCall(message: NativeMessage): Promise<void> {
    const { id, tool, args } = message;

    if (!id || !tool) {
      this.sendRaw({ id: id || null, type: "tool_result", success: false, error: "Missing id or tool" });
      return;
    }

    try {
      const result = await callMcpTool({ tool, args: args || {} } as any);

      this.sendRaw({
        id,
        type: "tool_result",
        success: result.success ?? true,
        result: result.data ?? result,
        error: result.error || null,
      });
    } catch (err: any) {
      this.sendRaw({
        id,
        type: "tool_result",
        success: false,
        result: null,
        error: err?.message || String(err),
      });
    }
  }

  private sendResponse(id: string, success: boolean, data?: any, error?: string): void {
    this.sendRaw({
      id,
      type: "tool_result",
      success,
      result: data,
      error: error || null,
    });
  }

  private sendRaw(msg: any): void {
    if (!this.port) {
      console.error('[NativeMessaging] Cannot send: not connected');
      return;
    }
    try {
      this.port.postMessage(msg);
    } catch (err) {
      console.error('[NativeMessaging] Send failed:', err);
    }
  }

  isHostConnected(): boolean {
    return this.isConnected;
  }

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

export function getNativeMessagingHost(): NativeMessagingHost {
  if (!nativeHostInstance) {
    nativeHostInstance = new NativeMessagingHost();
  }
  return nativeHostInstance;
}

export function initializeNativeMessaging(): void {
  console.log('[NativeMessaging] Initializing...');
  getNativeMessagingHost();
}
