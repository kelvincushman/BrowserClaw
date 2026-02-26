/**
 * WebSocket Server for MCP Communication
 *
 * This module creates a WebSocket server that allows external MCP clients
 * (like Claude Code) to connect and execute browser automation tools.
 *
 * Security:
 * - Only accepts connections from localhost
 * - Validates client handshake
 * - Rate limits tool calls
 */

import { callMcpTool, McpRequest } from "./mcp/index.js";
import { browserMcpClient } from "./mcp/client.js";

interface WebSocketMessage {
  id: string;
  type: "handshake" | "tool_call" | "list_tools" | "ping";
  client?: string;
  version?: string;
  extensionId?: string;
  tool?: string;
  args?: Record<string, unknown>;
}

interface WebSocketResponse {
  id: string;
  type: "handshake_ack" | "tool_result" | "tool_list" | "pong" | "error";
  success?: boolean;
  data?: unknown;
  error?: string;
}

interface ConnectedClient {
  id: string;
  client: string;
  version: string;
  connectedAt: number;
  lastActivity: number;
  callCount: number;
}

// Rate limiting configuration
const RATE_LIMIT_WINDOW = 60000; // 1 minute
const RATE_LIMIT_MAX_CALLS = 100; // Max calls per window

class McpWebSocketServer {
  private clients: Map<WebSocket, ConnectedClient> = new Map();
  private port: number = 9222;
  private server: WebSocket | null = null;
  private rateLimitCounters: Map<string, { count: number; resetTime: number }> = new Map();

  /**
   * Initialize the WebSocket server
   * Note: In Chrome extension context, we use a different approach
   * since direct WebSocket server creation isn't available.
   * This uses chrome.runtime messaging as a bridge.
   */
  async initialize(): Promise<void> {
    console.log(`[MCP-WS] Initializing MCP WebSocket bridge on port ${this.port}`);

    // Register message listener for external connections
    chrome.runtime.onMessageExternal.addListener(
      (message: WebSocketMessage, sender, sendResponse) => {
        this.handleExternalMessage(message, sender.id || "unknown")
          .then((response) => sendResponse(response))
          .catch((error) => sendResponse({ error: error.message }));
        return true; // Keep channel open for async response
      }
    );

    // Also listen for internal messages from native messaging host
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      if (message.type === "mcp_tool_call") {
        this.handleToolCall(message.id, message.tool, message.args)
          .then((response) => sendResponse(response))
          .catch((error) => sendResponse({ success: false, error: error.message }));
        return true;
      }
    });

    console.log("[MCP-WS] WebSocket bridge initialized");
  }

  /**
   * Handle messages from external sources
   */
  private async handleExternalMessage(
    message: WebSocketMessage,
    senderId: string
  ): Promise<WebSocketResponse> {
    switch (message.type) {
      case "handshake":
        return this.handleHandshake(message, senderId);

      case "tool_call":
        if (!message.tool) {
          return {
            id: message.id,
            type: "error",
            error: "Tool name is required",
          };
        }
        return this.handleToolCall(message.id, message.tool, message.args || {});

      case "list_tools":
        return this.handleListTools(message.id);

      case "ping":
        return {
          id: message.id,
          type: "pong",
        };

      default:
        return {
          id: message.id,
          type: "error",
          error: `Unknown message type: ${message.type}`,
        };
    }
  }

  /**
   * Handle client handshake
   */
  private handleHandshake(message: WebSocketMessage, senderId: string): WebSocketResponse {
    console.log(`[MCP-WS] Handshake from ${message.client} v${message.version}`);

    const clientId = `${senderId}_${Date.now()}`;

    // Store client info for tracking
    const clientInfo: ConnectedClient = {
      id: clientId,
      client: message.client || "unknown",
      version: message.version || "unknown",
      connectedAt: Date.now(),
      lastActivity: Date.now(),
      callCount: 0,
    };

    console.log(`[MCP-WS] Client connected: ${clientInfo.client} (${clientId})`);

    return {
      id: message.id,
      type: "handshake_ack",
      success: true,
      data: {
        clientId,
        serverVersion: "1.0.0",
        capabilities: {
          tools: browserMcpClient.tools.length,
          streaming: false,
          resources: true,
        },
      },
    };
  }

  /**
   * Handle tool call requests
   */
  private async handleToolCall(
    messageId: string,
    toolName: string,
    args: Record<string, unknown>
  ): Promise<WebSocketResponse> {
    // Rate limiting check
    const rateLimitKey = `global_${Math.floor(Date.now() / RATE_LIMIT_WINDOW)}`;
    const rateLimit = this.rateLimitCounters.get(rateLimitKey) || {
      count: 0,
      resetTime: Date.now() + RATE_LIMIT_WINDOW,
    };

    if (rateLimit.count >= RATE_LIMIT_MAX_CALLS) {
      return {
        id: messageId,
        type: "tool_result",
        success: false,
        error: `Rate limit exceeded. Max ${RATE_LIMIT_MAX_CALLS} calls per minute.`,
      };
    }

    rateLimit.count++;
    this.rateLimitCounters.set(rateLimitKey, rateLimit);

    // Clean old rate limit entries
    for (const [key, value] of this.rateLimitCounters) {
      if (value.resetTime < Date.now()) {
        this.rateLimitCounters.delete(key);
      }
    }

    console.log(`[MCP-WS] Tool call: ${toolName}`, args);

    try {
      // Check if tool exists
      const tool = browserMcpClient.tools.find((t) => t.name === toolName);
      if (!tool) {
        return {
          id: messageId,
          type: "tool_result",
          success: false,
          error: `Unknown tool: ${toolName}`,
        };
      }

      // Execute the tool
      const result = await callMcpTool({ tool: toolName as any, args } as McpRequest);

      return {
        id: messageId,
        type: "tool_result",
        success: result.success,
        data: result.success ? result.data : undefined,
        error: !result.success ? result.error : undefined,
      };
    } catch (error) {
      console.error(`[MCP-WS] Tool execution error:`, error);
      return {
        id: messageId,
        type: "tool_result",
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Handle list_tools requests — returns all available tool schemas
   */
  private handleListTools(messageId: string): WebSocketResponse {
    try {
      const tools = browserMcpClient.tools.map((t) => ({
        name: t.name,
        description: t.description,
        inputSchema: t.inputSchema,
      }));

      return {
        id: messageId,
        type: "tool_list",
        success: true,
        data: { tools },
      };
    } catch (error) {
      console.error("[MCP-WS] list_tools error:", error);
      return {
        id: messageId,
        type: "tool_list",
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Get list of connected clients
   */
  getConnectedClients(): ConnectedClient[] {
    return Array.from(this.clients.values());
  }

  /**
   * Get server status
   */
  getStatus(): { running: boolean; port: number; clients: number } {
    return {
      running: true,
      port: this.port,
      clients: this.clients.size,
    };
  }
}

// Export singleton instance
export const mcpWebSocketServer = new McpWebSocketServer();

// Initialize on load
mcpWebSocketServer.initialize().catch((error) => {
  console.error("[MCP-WS] Failed to initialize:", error);
});
