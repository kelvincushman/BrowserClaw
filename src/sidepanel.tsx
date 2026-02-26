import React, { useState } from "react"
import ReactDOM from "react-dom/client"
import { I18nProvider } from "~/lib/i18n/context"
import ChatBot from "~/lib/components/chatbot"
import AgentChat from "~/lib/components/agent-chat"
// CSS is loaded directly in HTML for better HMR support
// import "~/tailwind.css"

type TabId = "chat" | "agent"

const TabButton = ({
  active,
  onClick,
  children,
}: {
  active: boolean
  onClick: () => void
  children: React.ReactNode
}) => (
  <button
    onClick={onClick}
    className={`flex-1 px-3 py-1.5 text-xs font-medium transition-colors ${
      active
        ? "border-b-2 border-blue-500 text-blue-600 dark:text-blue-400"
        : "text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
    }`}
  >
    {children}
  </button>
)

const SidepanelApp = () => {
  const [activeTab, setActiveTab] = useState<TabId>("chat")

  return (
    <I18nProvider>
      <div className="flex flex-col h-screen w-full overflow-hidden">
        {/* Tab bar */}
        <div className="flex border-b bg-background shrink-0">
          <TabButton active={activeTab === "chat"} onClick={() => setActiveTab("chat")}>
            Chat
          </TabButton>
          <TabButton active={activeTab === "agent"} onClick={() => setActiveTab("agent")}>
            Agent
          </TabButton>
        </div>

        {/* Tab content */}
        <div className="flex-1 overflow-hidden">
          {activeTab === "chat" ? <ChatBot /> : <AgentChat />}
        </div>
      </div>
    </I18nProvider>
  )
}

const root = document.getElementById("root")
if (root) {
  ReactDOM.createRoot(root).render(
    <React.StrictMode>
      <SidepanelApp />
    </React.StrictMode>
  )
}
