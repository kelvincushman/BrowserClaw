import {
  Conversation,
  ConversationContent,
  ConversationScrollButton,
} from "@/components/ai-elements/conversation";
import { Loader } from "@/components/ai-elements/loader";
import { Message, MessageContent } from "@/components/ai-elements/message";
import {
  PromptInput,
  PromptInputBody,
  PromptInputSubmit,
  PromptInputTextarea,
  PromptInputToolbar,
} from "@/components/ai-elements/prompt-input";
import { Response } from "@/components/ai-elements/response";
import {
  Tool,
  ToolContent,
  ToolHeader,
  ToolInput,
  ToolOutput,
} from "@/components/ai-elements/tool";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import type { ChatStatus } from "ai";
import { CopyIcon, RefreshCcwIcon, SettingsIcon, PlusIcon } from "lucide-react";
import { Fragment, useEffect, useRef, useState } from "react";
import { MessageHandler, type MessageHandlerConfig } from "~/lib/components/chatbot/message-handler";
import type { UIMessage } from "~/lib/components/chatbot/types";
import { Action, Actions } from "@/components/ai-elements/actions";
import { Reasoning, ReasoningContent, ReasoningTrigger } from "@/components/ai-elements/reasoning";
import { useStorage } from "~/lib/storage";
import { getAllTools } from "~/lib/services/tool-registry";

const formatToolOutput = (output: any) => {
  return `
  \`\`\`${typeof output === "string" ? "text" : "json"}
  ${typeof output === "string" ? output : JSON.stringify(output, null, 2)}
  \`\`\`
  `;
};

const AGENT_SYSTEM_PROMPT =
  "You are an AI agent with access to browser automation tools via BrowserClaw. " +
  "Use tools when available and provide clear next steps. Respond in the same language as the user.";

const AgentChat = () => {
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<UIMessage[]>([]);
  const [status, setStatus] = useState<"idle" | "submitted" | "streaming" | "error">("idle");
  const messageHandlerRef = useRef<MessageHandler | null>(null);

  // Agent-specific storage keys
  const [agentUrl, setAgentUrl, isLoadingUrl] = useStorage(
    "agentUrl",
    "http://localhost:18789/v1/chat/completions"
  );
  const [agentToken, setAgentToken, isLoadingToken] = useStorage("agentToken", "");
  const [agentModel, setAgentModel, isLoadingModel] = useStorage("agentModel", "main");
  const [agentId, setAgentId, isLoadingId] = useStorage("agentId", "");

  // Settings dialog state
  const [showSettings, setShowSettings] = useState(false);
  const [tempUrl, setTempUrl] = useState("");
  const [tempToken, setTempToken] = useState("");
  const [tempModel, setTempModel] = useState("");
  const [tempAgentId, setTempAgentId] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  // Track cleanup functions
  const unsubscribeFunctionsRef = useRef<(() => void)[]>([]);
  const isInitializedRef = useRef(false);

  // Initialize message handler ONCE on mount
  useEffect(() => {
    if (isLoadingUrl || isLoadingToken || isLoadingModel || isLoadingId) return;
    if (isInitializedRef.current || messageHandlerRef.current) return;

    const customHeaders: Record<string, string> = {};
    if (agentId) {
      customHeaders["x-openclaw-agent-id"] = agentId;
    }

    const config: MessageHandlerConfig = {
      initialModel: agentModel || "main",
      initialTools: getAllTools().map((tool) => ({
        type: "function",
        function: {
          name: tool.name,
          description: tool.description,
          parameters: tool.inputSchema,
        },
      })),
      initialAiHost: agentUrl || "http://localhost:18789/v1/chat/completions",
      initialAiToken: agentToken || "",
      customHeaders,
      initialMessages: [
        { role: "system", id: "system", parts: [{ type: "text", text: AGENT_SYSTEM_PROMPT }] },
      ],
    };

    messageHandlerRef.current = new MessageHandler(config);
    isInitializedRef.current = true;

    const unsubMessages = messageHandlerRef.current.subscribe("messages_updated", (m) => setMessages(m));
    const unsubStatus = messageHandlerRef.current.subscribe("status_changed", (s) => setStatus(s));

    unsubscribeFunctionsRef.current = [unsubMessages, unsubStatus];

    setMessages(messageHandlerRef.current.getMessages());
    setStatus(messageHandlerRef.current.getStatus());
  }, [isLoadingUrl, isLoadingToken, isLoadingModel, isLoadingId, agentUrl, agentToken, agentModel, agentId]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      unsubscribeFunctionsRef.current.forEach((fn) => fn());
      unsubscribeFunctionsRef.current = [];
      if (messageHandlerRef.current) {
        messageHandlerRef.current.destroy();
        messageHandlerRef.current = null;
      }
      isInitializedRef.current = false;
    };
  }, []);

  // Update config when settings change
  useEffect(() => {
    if (isLoadingUrl || isLoadingToken || isLoadingModel || isLoadingId || !messageHandlerRef.current) return;

    const customHeaders: Record<string, string> = {};
    if (agentId) {
      customHeaders["x-openclaw-agent-id"] = agentId;
    }

    messageHandlerRef.current.updateConfig({
      initialModel: agentModel || "main",
      initialAiHost: agentUrl || "http://localhost:18789/v1/chat/completions",
      initialAiToken: agentToken || "",
      customHeaders,
    });
  }, [agentUrl, agentToken, agentModel, agentId, isLoadingUrl, isLoadingToken, isLoadingModel, isLoadingId]);

  const handleSubmit = (message: any) => {
    const text = typeof message === "string" ? message : message?.text;
    if (!text?.trim()) return;
    messageHandlerRef.current?.sendMessage(text);
    setInput("");
  };

  const handleRegenerate = () => messageHandlerRef.current?.regenerate();
  const handleStop = () => messageHandlerRef.current?.stopStream();
  const handleCopy = (text: string) => navigator.clipboard.writeText(text);

  const handleNewChat = () => {
    if (messageHandlerRef.current) {
      messageHandlerRef.current.abort();
      messageHandlerRef.current.resetMessages();
    }
    setMessages([]);
    setInput("");
  };

  const handleOpenSettings = () => {
    setTempUrl(agentUrl || "");
    setTempToken(agentToken || "");
    setTempModel(agentModel || "");
    setTempAgentId(agentId || "");
    setShowSettings(true);
  };

  const handleSaveSettings = async () => {
    if (!tempModel?.trim()) return;
    setIsSaving(true);
    try {
      setAgentUrl(tempUrl);
      setAgentToken(tempToken);
      setAgentModel(tempModel);
      setAgentId(tempAgentId);
      setShowSettings(false);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className={cn("flex h-full w-full flex-col overflow-hidden rounded-lg border bg-background")}>
      {/* Header */}
      <div className="flex items-center justify-between border-b px-4 py-2">
        <Button variant="ghost" size="sm" onClick={handleOpenSettings} className="gap-2">
          <SettingsIcon className="size-4" />
          Settings
        </Button>
        <div className="text-sm font-medium">Agent</div>
        <Button variant="ghost" size="sm" onClick={handleNewChat} className="gap-2">
          <PlusIcon className="size-4" />
          New
        </Button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-hidden">
        <Conversation className="h-full">
          <ConversationContent>
            {messages.filter((m) => m.role !== "system").length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full p-8">
                <div className="text-center mb-6">
                  <h3 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-2">
                    Agent Chat
                  </h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    Chat with your AI agent. Configure the endpoint in Settings.
                  </p>
                </div>
              </div>
            ) : (
              messages
                .filter((m) => m.role !== "system")
                .map((message, messageIndex) => (
                  <div key={message.id}>
                    {message.parts.map((part, i) => {
                      switch (part.type) {
                        case "text":
                          const isLast =
                            messageIndex ===
                            messages.filter((m) => m.role !== "system").length - 1;
                          return (
                            <Fragment key={`${message.id}-${i}`}>
                              <Message from={message.role as "user" | "assistant" | "system"}>
                                <MessageContent>
                                  <Response>{part.text}</Response>
                                </MessageContent>
                              </Message>
                              {message.role === "assistant" && isLast && (
                                <Actions className="mt-2">
                                  <Action onClick={handleRegenerate} label="Retry">
                                    <RefreshCcwIcon className="size-3" />
                                  </Action>
                                  <Action onClick={() => handleCopy(part.text)} label="Copy">
                                    <CopyIcon className="size-3" />
                                  </Action>
                                </Actions>
                              )}
                            </Fragment>
                          );
                        case "tool":
                          return (
                            <Tool key={`${message.id}-${i}`} defaultOpen={false}>
                              <ToolHeader type={`tool-${part.toolName}`} state={part.state} />
                              <ToolContent>
                                <ToolInput input={part.input} />
                                <ToolOutput
                                  output={
                                    part.output ? (
                                      <Response>{formatToolOutput(part.output)}</Response>
                                    ) : undefined
                                  }
                                  errorText={part.errorText}
                                />
                              </ToolContent>
                            </Tool>
                          );
                        case "reasoning":
                          return (
                            <Reasoning
                              key={`${message.id}-${i}`}
                              className="w-full"
                              isStreaming={
                                status === "streaming" &&
                                i === message.parts.length - 1 &&
                                message.id === messages[messages.length - 1]?.id
                              }
                            >
                              <ReasoningTrigger />
                              <ReasoningContent>{part.text}</ReasoningContent>
                            </Reasoning>
                          );
                        default:
                          return null;
                      }
                    })}
                  </div>
                ))
            )}
            {status === "submitted" && <Loader />}
          </ConversationContent>
          <ConversationScrollButton />
        </Conversation>
      </div>

      {/* Input */}
      <div className="border-t p-4">
        <PromptInput onSubmit={handleSubmit} className="mt-4">
          <PromptInputBody>
            <PromptInputTextarea
              placeholder="Message your agent..."
              onChange={(e) => setInput(e.target.value)}
              value={input}
            />
          </PromptInputBody>
          <PromptInputToolbar>
            {(() => {
              const submitStatus: ChatStatus | undefined =
                status === "idle" ? undefined : (status as ChatStatus);
              return (
                <PromptInputSubmit
                  disabled={!input && !submitStatus}
                  status={submitStatus}
                  onClick={status === "streaming" ? handleStop : undefined}
                />
              );
            })()}
          </PromptInputToolbar>
        </PromptInput>
      </div>

      {/* Settings Dialog */}
      <Dialog open={showSettings} onOpenChange={setShowSettings}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Agent Settings</DialogTitle>
            <DialogDescription>Configure the AI agent endpoint.</DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Agent URL</label>
              <Input
                value={tempUrl}
                onChange={(e) => setTempUrl(e.target.value)}
                placeholder="http://localhost:18789/v1/chat/completions"
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Token</label>
              <Input
                type="password"
                value={tempToken}
                onChange={(e) => setTempToken(e.target.value)}
                placeholder="Bearer token..."
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Model</label>
              <Input
                value={tempModel}
                onChange={(e) => setTempModel(e.target.value)}
                placeholder="main"
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Agent ID</label>
              <Input
                value={tempAgentId}
                onChange={(e) => setTempAgentId(e.target.value)}
                placeholder="Optional — sent as x-openclaw-agent-id header"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowSettings(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveSettings} disabled={isSaving}>
              {isSaving ? "Saving..." : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AgentChat;
