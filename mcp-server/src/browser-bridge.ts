/**
 * Browser Bridge
 *
 * Handles communication between the MCP server and the AigentisBrowser extension
 * via WebSocket connection.
 */

import WebSocket from "ws";

interface ToolCallMessage {
  id: string;
  type: "tool_call";
  tool: string;
  args: Record<string, unknown>;
}

interface ToolResultMessage {
  id: string;
  type: "tool_result";
  success: boolean;
  data?: unknown;
  error?: string;
}

interface PendingCall {
  resolve: (value: unknown) => void;
  reject: (error: Error) => void;
  timeout: NodeJS.Timeout;
}

export class BrowserBridge {
  private ws: WebSocket | null = null;
  private port: number;
  private extensionId: string;
  private pendingCalls: Map<string, PendingCall> = new Map();
  private messageIdCounter = 0;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 1000;

  constructor(port: number = 9222, extensionId: string = "") {
    this.port = port;
    this.extensionId = extensionId;
  }

  /**
   * Check if connected to the browser extension
   */
  isConnected(): boolean {
    return this.ws !== null && this.ws.readyState === WebSocket.OPEN;
  }

  /**
   * Connect to the browser extension WebSocket server
   */
  async connect(): Promise<void> {
    if (this.isConnected()) {
      return;
    }

    return new Promise((resolve, reject) => {
      const wsUrl = `ws://localhost:${this.port}/aigentis`;

      console.error(`Connecting to AigentisBrowser at ${wsUrl}...`);

      this.ws = new WebSocket(wsUrl);

      this.ws.on("open", () => {
        console.error("Connected to AigentisBrowser extension");
        this.reconnectAttempts = 0;

        // Send handshake
        this.ws?.send(
          JSON.stringify({
            type: "handshake",
            client: "mcp-server",
            version: "1.0.0",
            extensionId: this.extensionId,
          })
        );

        resolve();
      });

      this.ws.on("message", (data) => {
        this.handleMessage(data.toString());
      });

      this.ws.on("close", () => {
        console.error("Disconnected from AigentisBrowser extension");
        this.ws = null;
        this.handleDisconnect();
      });

      this.ws.on("error", (error) => {
        console.error("WebSocket error:", error.message);

        if (!this.isConnected()) {
          reject(
            new Error(
              `Failed to connect to AigentisBrowser. ` +
                `Make sure the extension is installed and the WebSocket server is running on port ${this.port}. ` +
                `Error: ${error.message}`
            )
          );
        }
      });

      // Connection timeout
      setTimeout(() => {
        if (!this.isConnected()) {
          this.ws?.close();
          reject(new Error(`Connection timeout after 10 seconds`));
        }
      }, 10000);
    });
  }

  /**
   * Handle incoming WebSocket messages
   */
  private handleMessage(data: string): void {
    try {
      const message = JSON.parse(data) as ToolResultMessage;

      if (message.type === "tool_result" && message.id) {
        const pending = this.pendingCalls.get(message.id);

        if (pending) {
          clearTimeout(pending.timeout);
          this.pendingCalls.delete(message.id);

          if (message.success) {
            pending.resolve(message.data);
          } else {
            pending.reject(new Error(message.error || "Tool call failed"));
          }
        }
      }
    } catch (error) {
      console.error("Failed to parse message:", error);
    }
  }

  /**
   * Handle disconnection and attempt reconnection
   */
  private handleDisconnect(): void {
    // Reject all pending calls
    for (const [id, pending] of this.pendingCalls) {
      clearTimeout(pending.timeout);
      pending.reject(new Error("Connection lost"));
      this.pendingCalls.delete(id);
    }

    // Attempt reconnection
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++;
      const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1);

      console.error(
        `Attempting reconnection in ${delay}ms (attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts})`
      );

      setTimeout(() => {
        this.connect().catch((error) => {
          console.error("Reconnection failed:", error.message);
        });
      }, delay);
    }
  }

  /**
   * Generate a unique message ID
   */
  private generateId(): string {
    return `mcp_${Date.now()}_${++this.messageIdCounter}`;
  }

  /**
   * Call a tool on the browser extension
   */
  async callTool(name: string, args: Record<string, unknown>): Promise<unknown> {
    if (!this.isConnected()) {
      throw new Error("Not connected to AigentisBrowser extension");
    }

    return new Promise((resolve, reject) => {
      const id = this.generateId();
      const timeout = setTimeout(() => {
        this.pendingCalls.delete(id);
        reject(new Error(`Tool call timeout after 30 seconds: ${name}`));
      }, 30000);

      this.pendingCalls.set(id, { resolve, reject, timeout });

      const message: ToolCallMessage = {
        id,
        type: "tool_call",
        tool: name,
        args,
      };

      this.ws?.send(JSON.stringify(message));
    });
  }

  /**
   * Close the connection
   */
  close(): void {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }
}
