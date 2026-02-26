/**
 * OpenClaw Relay Client for BrowserClaw
 *
 * Connects to the OpenClaw gateway relay server via WebSocket and translates
 * CDP (Chrome DevTools Protocol) commands into Chrome Extension API calls.
 *
 * Unlike the original OpenClaw Browser Relay extension which uses
 * chrome.debugger (and suffers from automatic detachment on every page
 * navigation), this implementation uses chrome.tabs, chrome.scripting, etc.
 * which never detach.
 *
 * Protocol compatibility:
 *   - Same WebSocket URL: ws://127.0.0.1:{port}/extension?token={HMAC}
 *   - Same message format: forwardCDPCommand / forwardCDPEvent
 *   - Same session management: sessionId ↔ tabId mapping
 *   - Same keepalive: ping/pong
 */

import {
  dispatchCDP,
  buildTargetInfo,
  handleTargetCreateTarget,
} from "./cdp-translator";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface SessionInfo {
  tabId: number;
  targetId: string;
}

interface RelayConfig {
  port: number;
  gatewayToken: string;
}

type RelayStatus = "disconnected" | "connecting" | "connected";

type StatusChangeCallback = (status: RelayStatus) => void;

// ---------------------------------------------------------------------------
// Token derivation (matches background-utils.js deriveRelayToken)
// ---------------------------------------------------------------------------

async function deriveRelayToken(gatewayToken: string, port: number): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(gatewayToken),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign(
    "HMAC",
    key,
    enc.encode(`openclaw-extension-relay-v1:${port}`),
  );
  return [...new Uint8Array(sig)]
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

async function buildRelayWsUrl(port: number, gatewayToken: string): Promise<string> {
  const token = String(gatewayToken || "").trim();
  if (!token) {
    throw new Error("Missing gatewayToken — set it in extension storage");
  }
  const relayToken = await deriveRelayToken(token, port);
  return `ws://127.0.0.1:${port}/extension?token=${encodeURIComponent(relayToken)}`;
}

// ---------------------------------------------------------------------------
// OpenClawRelay class
// ---------------------------------------------------------------------------

export class OpenClawRelay {
  // WebSocket connection
  private ws: WebSocket | null = null;
  private status: RelayStatus = "disconnected";
  private onStatusChange: StatusChangeCallback | null = null;

  // Session management: sessionId ↔ tab info
  private sessions = new Map<string, SessionInfo>();
  private tabToSession = new Map<number, string>();
  private nextSession = 1;

  // Config
  private config: RelayConfig | null = null;

  // Reconnect state
  private reconnectAttempt = 0;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private intentionalDisconnect = false;

  // MV3 keepalive alarm
  private static readonly KEEPALIVE_ALARM = "openclaw-relay-keepalive";

  // Tab event listener refs (bound so we can remove them)
  private boundOnTabUpdated: (
    tabId: number,
    changeInfo: chrome.tabs.TabChangeInfo,
    tab: chrome.tabs.Tab,
  ) => void;
  private boundOnTabRemoved: (tabId: number, removeInfo: chrome.tabs.TabRemoveInfo) => void;
  private boundOnTabActivated: (activeInfo: chrome.tabs.TabActiveInfo) => void;

  constructor() {
    this.boundOnTabUpdated = this.onTabUpdated.bind(this);
    this.boundOnTabRemoved = this.onTabRemoved.bind(this);
    this.boundOnTabActivated = this.onTabActivated.bind(this);
  }

  // -----------------------------------------------------------------------
  // Public API
  // -----------------------------------------------------------------------

  /** Set callback for status changes. */
  setStatusCallback(cb: StatusChangeCallback): void {
    this.onStatusChange = cb;
  }

  /** Current connection status. */
  getStatus(): RelayStatus {
    return this.status;
  }

  /** Whether a specific tab is attached (has a session). */
  isTabAttached(tabId: number): boolean {
    return this.tabToSession.has(tabId);
  }

  /** Get the session map (read-only). */
  getSessions(): ReadonlyMap<string, SessionInfo> {
    return this.sessions;
  }

  /**
   * Connect to the OpenClaw relay server.
   * Reads config from chrome.storage.local if not provided.
   */
  async connect(config?: Partial<RelayConfig>): Promise<void> {
    if (this.status === "connected" || this.status === "connecting") {
      console.log("[OpenClawRelay] Already connected or connecting");
      return;
    }

    this.intentionalDisconnect = false;
    this.setStatus("connecting");

    try {
      // Load config from storage if not provided
      const stored = await chrome.storage.local.get(["relayPort", "gatewayToken"]);
      this.config = {
        port: config?.port || stored.relayPort || 18792,
        gatewayToken: config?.gatewayToken || stored.gatewayToken || "",
      };

      if (!this.config.gatewayToken) {
        throw new Error(
          "Missing gatewayToken. Set it in extension storage " +
            "(chrome.storage.local key: 'gatewayToken')",
        );
      }

      // Preflight check — make sure the relay server is up
      try {
        await fetch(`http://127.0.0.1:${this.config.port}/`, {
          signal: AbortSignal.timeout(2000),
        });
      } catch {
        // Preflight failure is non-fatal — the WS connection will fail anyway
        console.warn("[OpenClawRelay] Preflight check failed, trying WebSocket anyway");
      }

      const wsUrl = await buildRelayWsUrl(this.config.port, this.config.gatewayToken);
      console.log("[OpenClawRelay] Connecting to", wsUrl.replace(/token=[^&]+/, "token=***"));

      await this.openWebSocket(wsUrl);
    } catch (err) {
      console.error("[OpenClawRelay] Connection failed:", err);
      this.setStatus("disconnected");
      this.scheduleReconnect();
      throw err;
    }
  }

  /** Disconnect from the relay server. */
  disconnect(): void {
    this.intentionalDisconnect = true;
    this.cancelReconnect();
    this.removeTabListeners();
    this.cancelKeepaliveAlarm();

    // Send detach events for all sessions
    for (const [sessionId, info] of this.sessions) {
      this.trySendToRelay({
        method: "forwardCDPEvent",
        params: {
          method: "Target.detachedFromTarget",
          params: { sessionId, targetId: info.targetId, reason: "relay_disconnect" },
        },
      });
    }

    this.sessions.clear();
    this.tabToSession.clear();

    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.setStatus("disconnected");
    console.log("[OpenClawRelay] Disconnected");
  }

  /**
   * Toggle attachment for a specific tab.
   * If already attached → detach. If not → attach.
   */
  async toggleTab(tabId: number): Promise<void> {
    if (this.status !== "connected") {
      // If not connected, try to connect first, then attach
      await this.connect();
    }

    if (this.tabToSession.has(tabId)) {
      await this.detachTab(tabId, "toggle");
    } else {
      await this.attachTab(tabId);
    }
  }

  /**
   * Attach a tab — create a session and notify the gateway.
   */
  async attachTab(tabId: number): Promise<{ sessionId: string; targetId: string }> {
    const tab = await chrome.tabs.get(tabId);
    const targetId = `tab-${tabId}`;
    const sessionId = `cb-tab-${this.nextSession++}`;

    const info: SessionInfo = { tabId, targetId };
    this.sessions.set(sessionId, info);
    this.tabToSession.set(tabId, sessionId);

    const targetInfo = buildTargetInfo(tab, targetId);

    this.sendToRelay({
      method: "forwardCDPEvent",
      params: {
        method: "Target.attachedToTarget",
        params: {
          sessionId,
          targetInfo: { ...targetInfo, attached: true },
          waitingForDebugger: false,
        },
      },
    });

    this.setBadge(tabId, "on");
    console.log(`[OpenClawRelay] Attached tab ${tabId} as session ${sessionId}`);

    return { sessionId, targetId };
  }

  /**
   * Detach a tab — remove its session and notify the gateway.
   */
  async detachTab(tabId: number, reason: string): Promise<void> {
    const sessionId = this.tabToSession.get(tabId);
    if (!sessionId) return;

    const info = this.sessions.get(sessionId);
    const targetId = info?.targetId || `tab-${tabId}`;

    this.trySendToRelay({
      method: "forwardCDPEvent",
      params: {
        method: "Target.detachedFromTarget",
        params: { sessionId, targetId, reason },
      },
    });

    this.sessions.delete(sessionId);
    this.tabToSession.delete(tabId);
    this.setBadge(tabId, "off");
    console.log(`[OpenClawRelay] Detached tab ${tabId} (session ${sessionId}), reason: ${reason}`);
  }

  // -----------------------------------------------------------------------
  // WebSocket management
  // -----------------------------------------------------------------------

  private openWebSocket(url: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const ws = new WebSocket(url);
      const timeout = setTimeout(() => {
        ws.close();
        reject(new Error("WebSocket connection timeout (5s)"));
      }, 5000);

      ws.onopen = () => {
        clearTimeout(timeout);
        this.ws = ws;
        this.reconnectAttempt = 0;
        this.setStatus("connected");
        this.installTabListeners();
        this.setupKeepaliveAlarm();
        this.reannounceExistingSessions();
        console.log("[OpenClawRelay] WebSocket connected");
        resolve();
      };

      ws.onmessage = (event) => {
        this.handleMessage(String(event.data));
      };

      ws.onclose = () => {
        clearTimeout(timeout);
        if (this.status === "connecting") {
          reject(new Error("WebSocket closed during connect"));
          return;
        }
        this.handleWsClose();
      };

      ws.onerror = (err) => {
        console.error("[OpenClawRelay] WebSocket error:", err);
      };
    });
  }

  private handleWsClose(): void {
    this.ws = null;
    const wasConnected = this.status === "connected";
    this.setStatus("disconnected");

    if (wasConnected) {
      // Update badges for all attached tabs
      for (const [, info] of this.sessions) {
        this.setBadge(info.tabId, "connecting");
      }
    }

    if (!this.intentionalDisconnect) {
      this.scheduleReconnect();
    }
  }

  // -----------------------------------------------------------------------
  // Message handling
  // -----------------------------------------------------------------------

  private async handleMessage(text: string): Promise<void> {
    let msg: any;
    try {
      msg = JSON.parse(text);
    } catch {
      return;
    }

    // Ping/pong keepalive
    if (msg?.method === "ping") {
      this.trySendToRelay({ method: "pong" });
      return;
    }

    // Response to a request we sent (id + result/error) — we don't send
    // requests to the relay, so this shouldn't happen, but ignore gracefully.
    if (msg && typeof msg.id === "number" && (msg.result !== undefined || msg.error !== undefined)) {
      return;
    }

    // forwardCDPCommand — the main action
    if (msg && typeof msg.id === "number" && msg.method === "forwardCDPCommand") {
      try {
        const result = await this.handleForwardCDPCommand(msg);
        this.sendToRelay({ id: msg.id, result });
      } catch (err: any) {
        this.sendToRelay({
          id: msg.id,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }
  }

  private async handleForwardCDPCommand(msg: any): Promise<any> {
    const { method, params, sessionId } = msg.params || {};

    if (!method) {
      throw new Error("Missing CDP method in forwardCDPCommand");
    }

    // Resolve tab from session
    const tabId = this.resolveTabId(sessionId);

    // Special handling for Target.createTarget (needs session creation)
    if (method === "Target.createTarget") {
      const { tab, targetId } = await handleTargetCreateTarget(params);
      if (!tab.id) throw new Error("Failed to create tab");

      // Wait for tab to be ready
      await new Promise((r) => setTimeout(r, 200));

      // Auto-attach the new tab
      const newSessionId = `cb-tab-${this.nextSession++}`;
      this.sessions.set(newSessionId, { tabId: tab.id, targetId });
      this.tabToSession.set(tab.id, newSessionId);

      // Notify gateway about the new attached target
      const freshTab = await chrome.tabs.get(tab.id);
      this.sendToRelay({
        method: "forwardCDPEvent",
        params: {
          method: "Target.attachedToTarget",
          params: {
            sessionId: newSessionId,
            targetInfo: { ...buildTargetInfo(freshTab, targetId), attached: true },
            waitingForDebugger: false,
          },
        },
      });

      this.setBadge(tab.id, "on");
      return { targetId };
    }

    if (!tabId) {
      throw new Error(`No tab found for session: ${sessionId}`);
    }

    // Dispatch to the CDP translator
    return dispatchCDP(tabId, method, params || {}, this.sessions);
  }

  // -----------------------------------------------------------------------
  // Session helpers
  // -----------------------------------------------------------------------

  private resolveTabId(sessionId?: string): number | null {
    if (!sessionId) {
      // No session specified — try the most recently attached tab, or null
      if (this.sessions.size === 0) return null;
      // Return the first session's tabId as fallback
      return this.sessions.values().next().value?.tabId ?? null;
    }
    const info = this.sessions.get(sessionId);
    if (info) return info.tabId;
    return null;
  }

  /**
   * After reconnecting, re-announce all existing sessions so the gateway
   * knows about them.
   */
  private async reannounceExistingSessions(): Promise<void> {
    for (const [sessionId, info] of this.sessions) {
      try {
        const tab = await chrome.tabs.get(info.tabId);
        this.sendToRelay({
          method: "forwardCDPEvent",
          params: {
            method: "Target.attachedToTarget",
            params: {
              sessionId,
              targetInfo: { ...buildTargetInfo(tab, info.targetId), attached: true },
              waitingForDebugger: false,
            },
          },
        });
        this.setBadge(info.tabId, "on");
      } catch {
        // Tab no longer exists — clean up
        this.sessions.delete(sessionId);
        this.tabToSession.delete(info.tabId);
      }
    }
  }

  // -----------------------------------------------------------------------
  // Tab event listeners
  // -----------------------------------------------------------------------

  private installTabListeners(): void {
    chrome.tabs.onUpdated.addListener(this.boundOnTabUpdated);
    chrome.tabs.onRemoved.addListener(this.boundOnTabRemoved);
    chrome.tabs.onActivated.addListener(this.boundOnTabActivated);
  }

  private removeTabListeners(): void {
    chrome.tabs.onUpdated.removeListener(this.boundOnTabUpdated);
    chrome.tabs.onRemoved.removeListener(this.boundOnTabRemoved);
    chrome.tabs.onActivated.removeListener(this.boundOnTabActivated);
  }

  /**
   * Tab URL or title changed — send targetInfoChanged (NOT detach!).
   * This is the key difference from the CDP relay — navigation doesn't
   * break the session.
   */
  private onTabUpdated(
    tabId: number,
    changeInfo: chrome.tabs.TabChangeInfo,
    tab: chrome.tabs.Tab,
  ): void {
    const sessionId = this.tabToSession.get(tabId);
    if (!sessionId) return;

    const info = this.sessions.get(sessionId);
    if (!info) return;

    // Notify gateway of URL/title changes
    if (changeInfo.url || changeInfo.title || changeInfo.status === "complete") {
      const targetInfo = buildTargetInfo(tab, info.targetId);
      this.trySendToRelay({
        method: "forwardCDPEvent",
        params: {
          method: "Target.targetInfoChanged",
          params: { targetInfo: { ...targetInfo, attached: true } },
        },
      });
    }
  }

  /** Tab was closed — clean up session and notify gateway. */
  private onTabRemoved(tabId: number, _removeInfo: chrome.tabs.TabRemoveInfo): void {
    const sessionId = this.tabToSession.get(tabId);
    if (!sessionId) return;

    const info = this.sessions.get(sessionId);
    const targetId = info?.targetId || `tab-${tabId}`;

    this.trySendToRelay({
      method: "forwardCDPEvent",
      params: {
        method: "Target.detachedFromTarget",
        params: { sessionId, targetId, reason: "tab_closed" },
      },
    });

    this.sessions.delete(sessionId);
    this.tabToSession.delete(tabId);
  }

  /** Tab became active — no event needed, but useful for future extension. */
  private onTabActivated(_activeInfo: chrome.tabs.TabActiveInfo): void {
    // Currently no-op. Could send focus events in the future.
  }

  // -----------------------------------------------------------------------
  // WebSocket send helpers
  // -----------------------------------------------------------------------

  private sendToRelay(payload: any): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      throw new Error("Relay not connected");
    }
    this.ws.send(JSON.stringify(payload));
  }

  /** Send to relay, swallowing errors (for non-critical events). */
  private trySendToRelay(payload: any): void {
    try {
      this.sendToRelay(payload);
    } catch {
      // Relay may be down — non-critical
    }
  }

  // -----------------------------------------------------------------------
  // Reconnect logic
  // -----------------------------------------------------------------------

  private scheduleReconnect(): void {
    if (this.reconnectTimer) return;
    if (this.intentionalDisconnect) return;

    const delay = Math.min(
      1000 * Math.pow(2, this.reconnectAttempt),
      30000,
    ) + Math.random() * 1000;

    this.reconnectAttempt++;
    console.log(
      `[OpenClawRelay] Reconnecting in ${Math.round(delay)}ms (attempt ${this.reconnectAttempt})`,
    );

    this.reconnectTimer = setTimeout(async () => {
      this.reconnectTimer = null;
      try {
        await this.connect();
      } catch {
        // connect() already schedules the next retry on failure
      }
    }, delay);
  }

  private cancelReconnect(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    this.reconnectAttempt = 0;
  }

  // -----------------------------------------------------------------------
  // MV3 Keepalive alarm
  // -----------------------------------------------------------------------

  private setupKeepaliveAlarm(): void {
    chrome.alarms.create(OpenClawRelay.KEEPALIVE_ALARM, { periodInMinutes: 0.5 });
  }

  private cancelKeepaliveAlarm(): void {
    chrome.alarms.clear(OpenClawRelay.KEEPALIVE_ALARM);
  }

  /**
   * Called from the global alarms listener. Checks health and re-establishes
   * the connection if needed.
   */
  handleKeepaliveAlarm(): void {
    if (this.intentionalDisconnect) return;

    // Refresh badges
    for (const [, info] of this.sessions) {
      this.setBadge(info.tabId, this.status === "connected" ? "on" : "connecting");
    }

    // If WebSocket dropped, trigger reconnect
    if (
      this.ws?.readyState !== WebSocket.OPEN &&
      !this.reconnectTimer &&
      !this.intentionalDisconnect
    ) {
      console.log("[OpenClawRelay] Keepalive detected dropped connection, reconnecting");
      this.setStatus("disconnected");
      this.scheduleReconnect();
    }
  }

  // -----------------------------------------------------------------------
  // Badge / status helpers
  // -----------------------------------------------------------------------

  private setStatus(status: RelayStatus): void {
    this.status = status;
    this.onStatusChange?.(status);
  }

  private setBadge(tabId: number, state: "on" | "off" | "connecting" | "error"): void {
    const colorMap: Record<string, string> = {
      on: "#22c55e",       // green
      off: "#6b7280",      // gray
      connecting: "#f59e0b", // amber
      error: "#ef4444",    // red
    };
    const textMap: Record<string, string> = {
      on: "ON",
      off: "",
      connecting: "...",
      error: "ERR",
    };

    try {
      chrome.action.setBadgeBackgroundColor({ tabId, color: colorMap[state] || "#6b7280" });
      chrome.action.setBadgeText({ tabId, text: textMap[state] || "" });
    } catch {
      // Tab may no longer exist
    }
  }
}

// ---------------------------------------------------------------------------
// Singleton
// ---------------------------------------------------------------------------

let relayInstance: OpenClawRelay | null = null;

export function getOpenClawRelay(): OpenClawRelay {
  if (!relayInstance) {
    relayInstance = new OpenClawRelay();
  }
  return relayInstance;
}

/**
 * Ensure gateway token and relay settings are always in storage.
 * Safe to call multiple times — only writes if missing.
 */
async function ensureRelayConfig(): Promise<void> {
  const stored = await chrome.storage.local.get(["gatewayToken", "openclawRelayEnabled", "relayPort"]);
  const updates: Record<string, any> = {};
  if (!stored.gatewayToken) {
    updates.gatewayToken = "62b294b5d967f33d08be3f10f6092d37fe2b76d69e57c3a4";
  }
  if (stored.openclawRelayEnabled === undefined) {
    updates.openclawRelayEnabled = true;
  }
  if (!stored.relayPort) {
    updates.relayPort = 18792;
  }
  if (Object.keys(updates).length > 0) {
    await chrome.storage.local.set(updates);
    console.log("[OpenClawRelay] Seeded relay config:", Object.keys(updates).join(", "));
  }
}

/**
 * Initialize the OpenClaw relay from storage settings.
 * Call this from background.ts on extension startup.
 */
export async function initializeOpenClawRelay(): Promise<void> {
  // Always ensure config is present (handles reload/update, not just first install)
  await ensureRelayConfig();

  const stored = await chrome.storage.local.get(["openclawRelayEnabled", "gatewayToken"]);

  if (!stored.openclawRelayEnabled || !stored.gatewayToken) {
    console.log("[OpenClawRelay] Relay not enabled or no gateway token configured");
    return;
  }

  const relay = getOpenClawRelay();
  relay.setStatusCallback((status) => {
    console.log(`[OpenClawRelay] Status: ${status}`);
  });

  try {
    await relay.connect();
    console.log("[OpenClawRelay] Auto-connected on startup");
  } catch (err) {
    console.warn("[OpenClawRelay] Auto-connect failed (will retry):", err);
  }
}
