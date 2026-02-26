#!/usr/bin/env python3
"""
BrowserClaw MCP Server

stdio-based MCP server that proxies tool calls to the BrowserClaw bridge server.
Designed for MCP clients like Claude Desktop that don't have a skill system.

Usage:
  python3 mcp-server/server.py
"""

import asyncio
import json
import logging
import os
import sys
import time

import httpx
from mcp.server import Server
from mcp.server.stdio import stdio_server
from mcp.types import TextContent, Tool

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------

_dir = os.path.dirname(os.path.abspath(__file__))


def _load_config() -> dict:
    config_path = os.path.join(_dir, "config.json")
    defaults = {
        "bridge_url": "http://localhost:9333",
        "bridge_token": "",
        "tool_cache_ttl_seconds": 300,
        "request_timeout_seconds": 30,
        "log_level": "INFO",
    }
    try:
        with open(config_path, "r") as f:
            cfg = json.load(f)
        defaults.update(cfg)
    except (FileNotFoundError, json.JSONDecodeError):
        pass
    # Env vars override config file
    if os.environ.get("BROWSERCLAW_BRIDGE_URL"):
        defaults["bridge_url"] = os.environ["BROWSERCLAW_BRIDGE_URL"]
    if os.environ.get("BROWSERCLAW_BRIDGE_TOKEN"):
        defaults["bridge_token"] = os.environ["BROWSERCLAW_BRIDGE_TOKEN"]
    if os.environ.get("BROWSERCLAW_LOG_LEVEL"):
        defaults["log_level"] = os.environ["BROWSERCLAW_LOG_LEVEL"]
    return defaults


CONFIG = _load_config()

logging.basicConfig(
    level=getattr(logging, CONFIG["log_level"].upper(), logging.INFO),
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    stream=sys.stderr,
)
log = logging.getLogger("browserclaw-mcp")


# ---------------------------------------------------------------------------
# Bridge Client
# ---------------------------------------------------------------------------


class BridgeClient:
    """Async HTTP client for the BrowserClaw bridge server."""

    def __init__(self, base_url: str, token: str, timeout: float = 30):
        self.base_url = base_url.rstrip("/")
        self.token = token
        self.timeout = timeout
        self._client: httpx.AsyncClient | None = None

    def _get_client(self) -> httpx.AsyncClient:
        if self._client is None or self._client.is_closed:
            headers = {"Content-Type": "application/json"}
            if self.token:
                headers["Authorization"] = f"Bearer {self.token}"
            self._client = httpx.AsyncClient(
                headers=headers,
                timeout=httpx.Timeout(self.timeout),
            )
        return self._client

    async def health(self) -> dict:
        client = self._get_client()
        resp = await client.get(f"{self.base_url}/health")
        resp.raise_for_status()
        return resp.json()

    async def list_tools(self) -> list[dict]:
        client = self._get_client()
        resp = await client.get(f"{self.base_url}/tools")
        resp.raise_for_status()
        data = resp.json()
        return data.get("tools", [])

    async def call_tool(self, tool: str, args: dict) -> dict:
        client = self._get_client()
        resp = await client.post(
            f"{self.base_url}/tool_call",
            json={"tool": tool, "args": args},
        )
        return resp.json()

    async def close(self):
        if self._client and not self._client.is_closed:
            await self._client.aclose()


# ---------------------------------------------------------------------------
# Tool Cache
# ---------------------------------------------------------------------------


class ToolCache:
    """TTL cache for the tool list."""

    def __init__(self, ttl: float = 300):
        self.ttl = ttl
        self._tools: list[dict] = []
        self._fetched_at: float = 0

    @property
    def expired(self) -> bool:
        return (time.time() - self._fetched_at) > self.ttl

    def get(self) -> list[dict] | None:
        if self.expired:
            return None
        return self._tools

    def set(self, tools: list[dict]):
        self._tools = tools
        self._fetched_at = time.time()

    def invalidate(self):
        self._fetched_at = 0


# ---------------------------------------------------------------------------
# MCP Server
# ---------------------------------------------------------------------------

bridge = BridgeClient(
    base_url=CONFIG["bridge_url"],
    token=CONFIG["bridge_token"],
    timeout=CONFIG["request_timeout_seconds"],
)
cache = ToolCache(ttl=CONFIG["tool_cache_ttl_seconds"])
server = Server("browserclaw")


@server.list_tools()
async def list_tools() -> list[Tool]:
    cached = cache.get()
    if cached is not None:
        return _to_mcp_tools(cached)

    try:
        raw_tools = await bridge.list_tools()
        cache.set(raw_tools)
        log.info("Fetched %d tools from bridge", len(raw_tools))
        return _to_mcp_tools(raw_tools)
    except Exception as e:
        log.error("Failed to fetch tools: %s", e)
        # Return cached even if expired, as fallback
        if cache._tools:
            return _to_mcp_tools(cache._tools)
        return []


@server.call_tool()
async def call_tool(name: str, arguments: dict) -> list[TextContent]:
    try:
        result = await bridge.call_tool(name, arguments)
        text = json.dumps(result, indent=2, ensure_ascii=False)
        return [TextContent(type="text", text=text)]
    except httpx.HTTPStatusError as e:
        return [TextContent(type="text", text=f"Bridge error: {e.response.status_code} {e.response.text}")]
    except Exception as e:
        return [TextContent(type="text", text=f"Error: {e}")]


def _to_mcp_tools(raw: list[dict]) -> list[Tool]:
    tools = []
    for t in raw:
        tools.append(
            Tool(
                name=t["name"],
                description=t.get("description", ""),
                inputSchema=t.get("inputSchema", {"type": "object", "properties": {}}),
            )
        )
    return tools


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------


async def main():
    log.info("BrowserClaw MCP server starting — bridge: %s", CONFIG["bridge_url"])
    async with stdio_server() as (read_stream, write_stream):
        await server.run(read_stream, write_stream, server.create_initialization_options())
    await bridge.close()


if __name__ == "__main__":
    asyncio.run(main())
