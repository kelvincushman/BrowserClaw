#!/usr/bin/env node

/**
 * AigentisBrowser MCP Server
 *
 * This MCP server connects Claude Code to the AigentisBrowser extension,
 * enabling AI-powered browser automation for social media management.
 *
 * Usage:
 *   npx @aigentis/mcp-server-browser
 *
 * Configuration in ~/.config/claude-code/mcp.json:
 * {
 *   "mcpServers": {
 *     "aigentis-browser": {
 *       "command": "npx",
 *       "args": ["-y", "@aigentis/mcp-server-browser"],
 *       "env": {
 *         "AIGENTIS_WS_PORT": "9222"
 *       }
 *     }
 *   }
 * }
 */

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  ListResourcesRequestSchema,
  ReadResourceRequestSchema,
  ErrorCode,
  McpError,
} from "@modelcontextprotocol/sdk/types.js";
import { BrowserBridge } from "./browser-bridge.js";
import { BROWSER_TOOLS, SOCIAL_MEDIA_TOOLS, TREND_TOOLS, CONTENT_TOOLS } from "./tools/registry.js";

// Configuration
const WS_PORT = parseInt(process.env.AIGENTIS_WS_PORT || "9222", 10);
const EXTENSION_ID = process.env.AIGENTIS_EXTENSION_ID || "";

class AigentisBrowserMcpServer {
  private server: Server;
  private browserBridge: BrowserBridge;

  constructor() {
    this.server = new Server(
      {
        name: "aigentis-browser",
        version: "1.0.0",
      },
      {
        capabilities: {
          tools: {},
          resources: {},
        },
      }
    );

    this.browserBridge = new BrowserBridge(WS_PORT, EXTENSION_ID);
    this.setupHandlers();
  }

  private setupHandlers(): void {
    // List available tools
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      const allTools = [
        ...BROWSER_TOOLS,
        ...SOCIAL_MEDIA_TOOLS,
        ...TREND_TOOLS,
        ...CONTENT_TOOLS,
      ];

      return {
        tools: allTools.map((tool) => ({
          name: tool.name,
          description: tool.description,
          inputSchema: tool.inputSchema,
        })),
      };
    });

    // Execute tool calls
    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;

      try {
        // Check if browser is connected
        if (!this.browserBridge.isConnected()) {
          await this.browserBridge.connect();
        }

        // Execute the tool via browser bridge
        const result = await this.browserBridge.callTool(name, args || {});

        return {
          content: [
            {
              type: "text",
              text: typeof result === "string" ? result : JSON.stringify(result, null, 2),
            },
          ],
        };
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        throw new McpError(ErrorCode.InternalError, `Tool execution failed: ${errorMessage}`);
      }
    });

    // List available resources
    this.server.setRequestHandler(ListResourcesRequestSchema, async () => {
      return {
        resources: [
          {
            uri: "aigentis://accounts",
            name: "Connected Social Media Accounts",
            description: "List of all connected social media accounts",
            mimeType: "application/json",
          },
          {
            uri: "aigentis://trends",
            name: "Current Trends",
            description: "Real-time trending topics across platforms",
            mimeType: "application/json",
          },
          {
            uri: "aigentis://queue",
            name: "Post Queue",
            description: "Scheduled and queued posts",
            mimeType: "application/json",
          },
          {
            uri: "aigentis://browser/tabs",
            name: "Browser Tabs",
            description: "Currently open browser tabs",
            mimeType: "application/json",
          },
        ],
      };
    });

    // Read resources
    this.server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
      const { uri } = request.params;

      try {
        if (!this.browserBridge.isConnected()) {
          await this.browserBridge.connect();
        }

        let result: unknown;

        switch (uri) {
          case "aigentis://accounts":
            result = await this.browserBridge.callTool("list_connected_accounts", {});
            break;
          case "aigentis://trends":
            result = await this.browserBridge.callTool("get_trending_topics", {
              platforms: ["twitter", "linkedin"],
              limit: 10,
            });
            break;
          case "aigentis://queue":
            result = await this.browserBridge.callTool("get_post_queue", {});
            break;
          case "aigentis://browser/tabs":
            result = await this.browserBridge.callTool("get_all_tabs", {});
            break;
          default:
            throw new McpError(ErrorCode.InvalidRequest, `Unknown resource: ${uri}`);
        }

        return {
          contents: [
            {
              uri,
              mimeType: "application/json",
              text: JSON.stringify(result, null, 2),
            },
          ],
        };
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        throw new McpError(ErrorCode.InternalError, `Resource read failed: ${errorMessage}`);
      }
    });
  }

  async run(): Promise<void> {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);

    // Log startup message to stderr (stdout is reserved for MCP protocol)
    console.error("AigentisBrowser MCP Server started");
    console.error(`WebSocket port: ${WS_PORT}`);
    console.error(`Extension ID: ${EXTENSION_ID || "(auto-detect)"}`);
  }
}

// Start the server
const server = new AigentisBrowserMcpServer();
server.run().catch((error) => {
  console.error("Failed to start MCP server:", error);
  process.exit(1);
});
