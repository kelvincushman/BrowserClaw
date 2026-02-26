/**
 * CDP-to-Chrome API Translator
 *
 * Translates Chrome DevTools Protocol (CDP) method calls into Chrome Extension
 * API calls. This allows AigenitsBrowser to serve as a drop-in replacement for
 * the OpenClaw Browser Relay extension, without using chrome.debugger (which
 * detaches on every navigation).
 *
 * Each handler receives a tabId and the CDP params, and returns a CDP-compatible
 * result object.
 */

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Decode CDP modifier bitmask into event init flags. */
function decodeModifiers(modifiers: number = 0) {
  return {
    altKey: !!(modifiers & 1),
    ctrlKey: !!(modifiers & 2),
    metaKey: !!(modifiers & 4),
    shiftKey: !!(modifiers & 8),
  };
}

/** Map CDP mouse button name to DOM button index. */
function mouseButtonIndex(button?: string): number {
  switch (button) {
    case "middle": return 1;
    case "right": return 2;
    case "back": return 3;
    case "forward": return 4;
    default: return 0; // "left" or "none"
  }
}

/** Map CDP mouse event type to DOM event type. */
function mouseEventType(cdpType: string): string {
  switch (cdpType) {
    case "mousePressed": return "mousedown";
    case "mouseReleased": return "mouseup";
    case "mouseMoved": return "mousemove";
    case "mouseWheel": return "wheel";
    default: return cdpType;
  }
}

/** Map CDP key event type to DOM event type. */
function keyEventType(cdpType: string): string {
  switch (cdpType) {
    case "keyDown":
    case "rawKeyDown": return "keydown";
    case "keyUp": return "keyup";
    case "char": return "keypress";
    default: return cdpType;
  }
}

/** Serialize a JS value into CDP RemoteObject format. */
function serializeRemoteObject(value: any): any {
  if (value === undefined) {
    return { type: "undefined" };
  }
  if (value === null) {
    return { type: "object", subtype: "null", value: null };
  }
  const t = typeof value;
  if (t === "string" || t === "number" || t === "boolean") {
    return { type: t, value, description: String(value) };
  }
  if (Array.isArray(value)) {
    return {
      type: "object",
      subtype: "array",
      className: "Array",
      description: `Array(${value.length})`,
      value,
    };
  }
  if (t === "object") {
    try {
      // Return a JSON-safe representation
      return {
        type: "object",
        className: value.constructor?.name || "Object",
        description: JSON.stringify(value).slice(0, 200),
        value,
      };
    } catch {
      return { type: "object", className: "Object", description: "[Object]" };
    }
  }
  return { type: t, description: String(value) };
}

// ---------------------------------------------------------------------------
// Runtime domain
// ---------------------------------------------------------------------------

export async function handleRuntimeEvaluate(tabId: number, params: any): Promise<any> {
  const { expression, returnByValue, awaitPromise } = params;

  const results = await chrome.scripting.executeScript({
    target: { tabId },
    func: (expr: string, shouldAwait: boolean) => {
      try {
        // Use indirect eval to evaluate in global scope
        const fn = new Function(`return (${expr})`);
        let result = fn();
        // If the caller wants us to await a Promise, wrap in an async IIFE
        if (shouldAwait && result && typeof result.then === "function") {
          return (result as Promise<any>).then(
            (v: any) => ({ ok: true, value: v, type: typeof v }),
            (e: any) => ({ ok: false, error: String(e?.message || e) }),
          );
        }
        return { ok: true, value: result, type: typeof result };
      } catch (e: any) {
        return { ok: false, error: String(e?.message || e) };
      }
    },
    args: [expression, !!awaitPromise],
    world: "MAIN" as any,
  });

  const res = results[0]?.result as any;
  if (!res || !res.ok) {
    return {
      result: serializeRemoteObject(undefined),
      exceptionDetails: {
        text: res?.error || "Evaluation failed",
        exception: { type: "object", subtype: "error", description: res?.error || "Evaluation failed" },
      },
    };
  }

  return {
    result: returnByValue
      ? serializeRemoteObject(res.value)
      : { ...serializeRemoteObject(res.value), value: res.value },
  };
}

export async function handleRuntimeCallFunctionOn(tabId: number, params: any): Promise<any> {
  const { functionDeclaration, arguments: args, returnByValue } = params;
  const argValues = (args || []).map((a: any) => a.value);

  const results = await chrome.scripting.executeScript({
    target: { tabId },
    func: (fnStr: string, fnArgs: any[]) => {
      try {
        const fn = new Function(`return (${fnStr})`)();
        const result = fn(...fnArgs);
        return { ok: true, value: result, type: typeof result };
      } catch (e: any) {
        return { ok: false, error: String(e?.message || e) };
      }
    },
    args: [functionDeclaration, argValues],
    world: "MAIN" as any,
  });

  const res = results[0]?.result as any;
  if (!res || !res.ok) {
    return {
      result: serializeRemoteObject(undefined),
      exceptionDetails: { text: res?.error || "Call failed" },
    };
  }

  return {
    result: returnByValue
      ? serializeRemoteObject(res.value)
      : { ...serializeRemoteObject(res.value), value: res.value },
  };
}

// ---------------------------------------------------------------------------
// Page domain
// ---------------------------------------------------------------------------

export async function handlePageNavigate(tabId: number, params: any): Promise<any> {
  const { url } = params;
  await chrome.tabs.update(tabId, { url });

  // Wait for the page to finish loading (onUpdated status: 'complete')
  await new Promise<void>((resolve) => {
    const listener = (updatedId: number, info: chrome.tabs.TabChangeInfo) => {
      if (updatedId === tabId && info.status === "complete") {
        chrome.tabs.onUpdated.removeListener(listener);
        resolve();
      }
    };
    chrome.tabs.onUpdated.addListener(listener);
    // Timeout so we don't hang forever
    setTimeout(() => {
      chrome.tabs.onUpdated.removeListener(listener);
      resolve();
    }, 30000);
  });

  return {
    frameId: String(tabId),
    loaderId: `loader-${Date.now()}`,
  };
}

export async function handlePageReload(tabId: number, _params: any): Promise<any> {
  await chrome.tabs.reload(tabId);
  return {};
}

export async function handlePageCaptureScreenshot(tabId: number, params: any): Promise<any> {
  const tab = await chrome.tabs.get(tabId);

  // Make the tab active so captureVisibleTab can see it
  if (!tab.active) {
    await chrome.tabs.update(tabId, { active: true });
    await new Promise((r) => setTimeout(r, 150));
  }

  // Focus the window
  await chrome.windows.update(tab.windowId, { focused: true });
  await new Promise((r) => setTimeout(r, 100));

  const format = params?.format === "jpeg" ? "jpeg" : "png";
  const quality = params?.quality ?? 90;

  const dataUrl = await chrome.tabs.captureVisibleTab(tab.windowId, {
    format,
    quality,
  });

  // Strip the data URL prefix to get raw base64
  const prefix = `data:image/${format};base64,`;
  const base64 = dataUrl.startsWith(prefix)
    ? dataUrl.slice(prefix.length)
    : dataUrl.replace(/^data:[^;]+;base64,/, "");

  return { data: base64 };
}

export async function handlePageGetFrameTree(tabId: number, _params: any): Promise<any> {
  const tab = await chrome.tabs.get(tabId);
  return {
    frameTree: {
      frame: {
        id: String(tabId),
        loaderId: `loader-${tabId}`,
        url: tab.url || "about:blank",
        domainAndRegistry: "",
        securityOrigin: tab.url ? new URL(tab.url).origin : "",
        mimeType: "text/html",
      },
      childFrames: [],
    },
  };
}

// ---------------------------------------------------------------------------
// DOM domain
// ---------------------------------------------------------------------------

export async function handleDOMGetDocument(tabId: number, params: any): Promise<any> {
  const depth = params?.depth ?? 1;

  const results = await chrome.scripting.executeScript({
    target: { tabId },
    func: (maxDepth: number) => {
      function serializeNode(node: Node, currentDepth: number): any {
        const base: any = {
          nodeId: Math.floor(Math.random() * 1000000),
          backendNodeId: Math.floor(Math.random() * 1000000),
          nodeType: node.nodeType,
          nodeName: node.nodeName,
          localName: (node as Element).localName || "",
          nodeValue: node.nodeValue || "",
          childNodeCount: node.childNodes.length,
        };
        if ((node as Element).attributes) {
          base.attributes = [];
          for (const attr of Array.from((node as Element).attributes || [])) {
            base.attributes.push(attr.name, attr.value);
          }
        }
        if (currentDepth < maxDepth && node.childNodes.length > 0) {
          base.children = Array.from(node.childNodes)
            .slice(0, 100) // limit children
            .map((child) => serializeNode(child, currentDepth + 1));
        }
        return base;
      }
      return { root: serializeNode(document, 0) };
    },
    args: [depth],
    world: "MAIN" as any,
  });

  return results[0]?.result || { root: { nodeId: 1, nodeType: 9, nodeName: "#document" } };
}

export async function handleDOMQuerySelector(tabId: number, params: any): Promise<any> {
  const { selector } = params;

  const results = await chrome.scripting.executeScript({
    target: { tabId },
    func: (sel: string) => {
      const el = document.querySelector(sel);
      if (!el) return { nodeId: 0 };
      return { nodeId: Math.floor(Math.random() * 1000000) };
    },
    args: [selector],
    world: "MAIN" as any,
  });

  return results[0]?.result || { nodeId: 0 };
}

export async function handleDOMQuerySelectorAll(tabId: number, params: any): Promise<any> {
  const { selector } = params;

  const results = await chrome.scripting.executeScript({
    target: { tabId },
    func: (sel: string) => {
      const els = document.querySelectorAll(sel);
      return {
        nodeIds: Array.from(els)
          .slice(0, 1000)
          .map(() => Math.floor(Math.random() * 1000000)),
      };
    },
    args: [selector],
    world: "MAIN" as any,
  });

  return results[0]?.result || { nodeIds: [] };
}

// ---------------------------------------------------------------------------
// Input domain
// ---------------------------------------------------------------------------

export async function handleInputDispatchMouseEvent(tabId: number, params: any): Promise<any> {
  const { type, x, y, button, clickCount, modifiers, deltaX, deltaY } = params;

  await chrome.scripting.executeScript({
    target: { tabId },
    func: (
      evtType: string,
      ex: number,
      ey: number,
      btn: number,
      clicks: number,
      mods: { altKey: boolean; ctrlKey: boolean; metaKey: boolean; shiftKey: boolean },
      dx: number,
      dy: number,
    ) => {
      const target = document.elementFromPoint(ex, ey) || document.body;

      if (evtType === "wheel") {
        target.dispatchEvent(
          new WheelEvent("wheel", {
            clientX: ex,
            clientY: ey,
            deltaX: dx || 0,
            deltaY: dy || 0,
            bubbles: true,
            cancelable: true,
            ...mods,
          }),
        );
        return;
      }

      const mouseEvt = new MouseEvent(evtType, {
        clientX: ex,
        clientY: ey,
        button: btn,
        buttons: btn === 0 ? 1 : btn === 2 ? 2 : 0,
        detail: clicks || 1,
        bubbles: true,
        cancelable: true,
        ...mods,
      });
      target.dispatchEvent(mouseEvt);

      // For mouseup after mousedown, also fire click
      if (evtType === "mouseup" && (clicks || 1) >= 1) {
        const clickEvt = new MouseEvent("click", {
          clientX: ex,
          clientY: ey,
          button: btn,
          detail: clicks || 1,
          bubbles: true,
          cancelable: true,
          ...mods,
        });
        target.dispatchEvent(clickEvt);

        if ((clicks || 0) >= 2) {
          target.dispatchEvent(
            new MouseEvent("dblclick", {
              clientX: ex,
              clientY: ey,
              button: btn,
              detail: 2,
              bubbles: true,
              cancelable: true,
              ...mods,
            }),
          );
        }
      }
    },
    args: [
      mouseEventType(type),
      x || 0,
      y || 0,
      mouseButtonIndex(button),
      clickCount || 1,
      decodeModifiers(modifiers),
      deltaX || 0,
      deltaY || 0,
    ],
    world: "MAIN" as any,
  });

  return {};
}

export async function handleInputDispatchKeyEvent(tabId: number, params: any): Promise<any> {
  const {
    type,
    key,
    code,
    text,
    modifiers,
    windowsVirtualKeyCode,
    nativeVirtualKeyCode,
  } = params;

  await chrome.scripting.executeScript({
    target: { tabId },
    func: (
      evtType: string,
      evtKey: string,
      evtCode: string,
      evtText: string,
      mods: { altKey: boolean; ctrlKey: boolean; metaKey: boolean; shiftKey: boolean },
      keyCode: number,
    ) => {
      const target = document.activeElement || document.body;
      const isInput =
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        (target as any).isContentEditable;

      const eventInit: KeyboardEventInit = {
        key: evtKey || evtText || "",
        code: evtCode || "",
        keyCode: keyCode || 0,
        which: keyCode || 0,
        bubbles: true,
        cancelable: true,
        composed: true,
        ...mods,
      };

      target.dispatchEvent(new KeyboardEvent(evtType, eventInit));

      // For "keypress"/"char" type on input elements, also insert the text
      if (evtType === "keypress" && evtText && isInput) {
        if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement) {
          // Insert text at cursor position
          const start = target.selectionStart ?? target.value.length;
          const end = target.selectionEnd ?? target.value.length;
          target.value = target.value.slice(0, start) + evtText + target.value.slice(end);
          target.selectionStart = target.selectionEnd = start + evtText.length;
          target.dispatchEvent(new Event("input", { bubbles: true }));
        } else if ((target as any).isContentEditable) {
          document.execCommand("insertText", false, evtText);
        }
      }

      // Also handle rawKeyDown/keyDown with text for input insertion
      if (evtType === "keydown" && evtText && evtText.length === 1 && isInput) {
        // Will be handled by keypress event
      }
    },
    args: [
      keyEventType(type),
      key || "",
      code || "",
      text || "",
      decodeModifiers(modifiers),
      windowsVirtualKeyCode || nativeVirtualKeyCode || 0,
    ],
    world: "MAIN" as any,
  });

  return {};
}

export async function handleInputInsertText(tabId: number, params: any): Promise<any> {
  const { text } = params;

  await chrome.scripting.executeScript({
    target: { tabId },
    func: (txt: string) => {
      const target = document.activeElement;
      if (!target) return;

      if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement) {
        const start = target.selectionStart ?? target.value.length;
        const end = target.selectionEnd ?? target.value.length;
        target.value = target.value.slice(0, start) + txt + target.value.slice(end);
        target.selectionStart = target.selectionEnd = start + txt.length;
        target.dispatchEvent(new Event("input", { bubbles: true }));
        target.dispatchEvent(new Event("change", { bubbles: true }));
      } else if ((target as any).isContentEditable) {
        document.execCommand("insertText", false, txt);
      }
    },
    args: [text || ""],
    world: "MAIN" as any,
  });

  return {};
}

// ---------------------------------------------------------------------------
// Target domain
// ---------------------------------------------------------------------------

/** Build a CDP-compatible targetInfo from a chrome.tabs.Tab. */
export function buildTargetInfo(tab: chrome.tabs.Tab, targetId: string) {
  return {
    targetId,
    type: "page",
    title: tab.title || "",
    url: tab.url || "",
    attached: true,
    canAccessOpener: false,
    browserContextId: "1",
  };
}

export async function handleTargetGetTargetInfo(tabId: number, _params: any): Promise<any> {
  const tab = await chrome.tabs.get(tabId);
  const targetId = `tab-${tabId}`;
  return {
    targetInfo: buildTargetInfo(tab, targetId),
  };
}

export async function handleTargetCreateTarget(params: any): Promise<{
  tab: chrome.tabs.Tab;
  targetId: string;
}> {
  const url = typeof params?.url === "string" ? params.url : "about:blank";
  const tab = await chrome.tabs.create({ url, active: false });
  if (!tab.id) throw new Error("Failed to create tab");
  const targetId = `tab-${tab.id}`;
  return { tab, targetId };
}

export async function handleTargetCloseTarget(
  params: any,
  sessionMap: Map<string, { tabId: number; targetId: string }>,
): Promise<any> {
  const target = typeof params?.targetId === "string" ? params.targetId : "";
  let tabId: number | null = null;

  // Find tabId by targetId
  for (const [, sess] of sessionMap) {
    if (sess.targetId === target) {
      tabId = sess.tabId;
      break;
    }
  }

  // If targetId looks like "tab-{id}", extract the tabId
  if (!tabId && target.startsWith("tab-")) {
    tabId = parseInt(target.slice(4), 10);
  }

  if (tabId) {
    await chrome.tabs.remove(tabId);
    return { success: true };
  }
  throw new Error(`No tab found for targetId: ${target}`);
}

export async function handleTargetActivateTarget(
  params: any,
  sessionMap: Map<string, { tabId: number; targetId: string }>,
): Promise<any> {
  const target = typeof params?.targetId === "string" ? params.targetId : "";
  let tabId: number | null = null;

  for (const [, sess] of sessionMap) {
    if (sess.targetId === target) {
      tabId = sess.tabId;
      break;
    }
  }

  if (!tabId && target.startsWith("tab-")) {
    tabId = parseInt(target.slice(4), 10);
  }

  if (tabId) {
    const tab = await chrome.tabs.get(tabId);
    await chrome.tabs.update(tabId, { active: true });
    await chrome.windows.update(tab.windowId, { focused: true });
    return {};
  }
  throw new Error(`No tab found for targetId: ${target}`);
}

// ---------------------------------------------------------------------------
// Browser domain
// ---------------------------------------------------------------------------

export async function handleBrowserGetVersion(): Promise<any> {
  return {
    protocolVersion: "1.3",
    product: "AigenitsBrowser/1.0",
    revision: "0",
    userAgent: navigator.userAgent,
    jsVersion: "",
  };
}

// ---------------------------------------------------------------------------
// Emulation domain
// ---------------------------------------------------------------------------

export async function handleEmulationSetDeviceMetricsOverride(_tabId: number, _params: any): Promise<any> {
  // No-op — we can't resize the viewport from an extension
  return {};
}

// ---------------------------------------------------------------------------
// No-op handlers (domains that need "enable" but have no extension equivalent)
// ---------------------------------------------------------------------------

const NOOP_METHODS = new Set([
  "Runtime.enable",
  "Runtime.disable",
  "Runtime.runIfWaitingForDebugger",
  "Page.enable",
  "Page.disable",
  "Page.setLifecycleEventsEnabled",
  "Network.enable",
  "Network.disable",
  "Network.setCacheDisabled",
  "Network.setExtraHTTPHeaders",
  "DOM.enable",
  "DOM.disable",
  "CSS.enable",
  "CSS.disable",
  "Log.enable",
  "Log.disable",
  "Performance.enable",
  "Performance.disable",
  "Security.enable",
  "Security.disable",
  "Target.setAutoAttach",
  "Target.setDiscoverTargets",
  "Emulation.setFocusEmulationEnabled",
  "Emulation.clearDeviceMetricsOverride",
]);

export function isNoopMethod(method: string): boolean {
  return NOOP_METHODS.has(method);
}

// ---------------------------------------------------------------------------
// Main dispatcher
// ---------------------------------------------------------------------------

/**
 * Dispatch a CDP method call to the appropriate Chrome API handler.
 *
 * @param tabId   - The Chrome tab to operate on
 * @param method  - CDP method name (e.g. "Runtime.evaluate")
 * @param params  - CDP method parameters
 * @param sessionMap - Current session map (for Target operations)
 * @returns CDP-compatible result object
 */
export async function dispatchCDP(
  tabId: number,
  method: string,
  params: any,
  sessionMap: Map<string, { tabId: number; targetId: string }>,
): Promise<any> {
  // No-ops return empty success
  if (isNoopMethod(method)) {
    return {};
  }

  switch (method) {
    // Runtime
    case "Runtime.evaluate":
      return handleRuntimeEvaluate(tabId, params);
    case "Runtime.callFunctionOn":
      return handleRuntimeCallFunctionOn(tabId, params);

    // Page
    case "Page.navigate":
      return handlePageNavigate(tabId, params);
    case "Page.reload":
      return handlePageReload(tabId, params);
    case "Page.captureScreenshot":
      return handlePageCaptureScreenshot(tabId, params);
    case "Page.getFrameTree":
      return handlePageGetFrameTree(tabId, params);

    // DOM
    case "DOM.getDocument":
      return handleDOMGetDocument(tabId, params);
    case "DOM.querySelector":
      return handleDOMQuerySelector(tabId, params);
    case "DOM.querySelectorAll":
      return handleDOMQuerySelectorAll(tabId, params);

    // Input
    case "Input.dispatchMouseEvent":
      return handleInputDispatchMouseEvent(tabId, params);
    case "Input.dispatchKeyEvent":
      return handleInputDispatchKeyEvent(tabId, params);
    case "Input.insertText":
      return handleInputInsertText(tabId, params);

    // Target
    case "Target.getTargetInfo":
      return handleTargetGetTargetInfo(tabId, params);
    case "Target.closeTarget":
      return handleTargetCloseTarget(params, sessionMap);
    case "Target.activateTarget":
      return handleTargetActivateTarget(params, sessionMap);
    // Target.createTarget is handled specially in the relay (needs session creation)

    // Browser
    case "Browser.getVersion":
      return handleBrowserGetVersion();

    // Emulation
    case "Emulation.setDeviceMetricsOverride":
      return handleEmulationSetDeviceMetricsOverride(tabId, params);

    default:
      console.warn(`[CDP-Translator] Unhandled CDP method: ${method} — returning empty result`);
      return {};
  }
}
