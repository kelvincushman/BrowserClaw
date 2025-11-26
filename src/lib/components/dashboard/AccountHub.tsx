/**
 * Account Hub Component
 *
 * Displays and manages connected social media accounts.
 * Allows users to connect, disconnect, and switch between accounts.
 */

import React, { useState, useEffect } from "react";
import { SocialAccount, SocialPlatform } from "../../security/credential-store";

interface AccountHubProps {
  onAccountSelect?: (account: SocialAccount) => void;
  onConnectAccount?: (platform: SocialPlatform) => void;
}

// Platform icons and colors
const PLATFORM_CONFIG: Record<
  SocialPlatform,
  { icon: string; color: string; name: string }
> = {
  twitter: { icon: "𝕏", color: "#000000", name: "Twitter/X" },
  linkedin: { icon: "in", color: "#0A66C2", name: "LinkedIn" },
  instagram: { icon: "📷", color: "#E4405F", name: "Instagram" },
  facebook: { icon: "f", color: "#1877F2", name: "Facebook" },
  reddit: { icon: "🔴", color: "#FF4500", name: "Reddit" },
};

export const AccountHub: React.FC<AccountHubProps> = ({
  onAccountSelect,
  onConnectAccount,
}) => {
  const [accounts, setAccounts] = useState<SocialAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedAccountId, setSelectedAccountId] = useState<string | null>(null);
  const [showConnectModal, setShowConnectModal] = useState(false);

  // Fetch accounts on mount
  useEffect(() => {
    fetchAccounts();
  }, []);

  const fetchAccounts = async () => {
    setLoading(true);
    try {
      // Call the MCP tool to get accounts
      const response = await chrome.runtime.sendMessage({
        type: "mcp_tool_call",
        tool: "list_connected_accounts",
        args: {},
      });

      if (response?.success && response?.data?.accounts) {
        setAccounts(response.data.accounts);
      }
    } catch (error) {
      console.error("Failed to fetch accounts:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleAccountClick = (account: SocialAccount) => {
    setSelectedAccountId(account.id);
    onAccountSelect?.(account);
  };

  const handleConnectClick = (platform: SocialPlatform) => {
    setShowConnectModal(false);
    onConnectAccount?.(platform);
  };

  const handleDisconnect = async (accountId: string) => {
    if (!confirm("Are you sure you want to disconnect this account?")) return;

    try {
      const response = await chrome.runtime.sendMessage({
        type: "mcp_tool_call",
        tool: "disconnect_account",
        args: { accountId },
      });

      if (response?.success) {
        setAccounts((prev) => prev.filter((a) => a.id !== accountId));
      }
    } catch (error) {
      console.error("Failed to disconnect account:", error);
    }
  };

  const formatLastUsed = (timestamp: number) => {
    const diff = Date.now() - timestamp;
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    return `${days}d ago`;
  };

  if (loading) {
    return (
      <div className="account-hub loading">
        <div className="spinner" />
        <p>Loading accounts...</p>
      </div>
    );
  }

  return (
    <div className="account-hub">
      <div className="account-hub-header">
        <h3>Connected Accounts</h3>
        <button
          className="add-account-btn"
          onClick={() => setShowConnectModal(true)}
          title="Add Account"
        >
          +
        </button>
      </div>

      {accounts.length === 0 ? (
        <div className="no-accounts">
          <p>No accounts connected yet.</p>
          <button
            className="connect-first-btn"
            onClick={() => setShowConnectModal(true)}
          >
            Connect Your First Account
          </button>
        </div>
      ) : (
        <div className="accounts-list">
          {accounts.map((account) => {
            const config = PLATFORM_CONFIG[account.platform];
            const isSelected = account.id === selectedAccountId;

            return (
              <div
                key={account.id}
                className={`account-card ${isSelected ? "selected" : ""}`}
                onClick={() => handleAccountClick(account)}
              >
                <div
                  className="account-icon"
                  style={{ backgroundColor: config.color }}
                >
                  {config.icon}
                </div>

                <div className="account-info">
                  <div className="account-name">
                    {account.displayName || account.username}
                  </div>
                  <div className="account-handle">@{account.username}</div>
                  <div className="account-meta">
                    <span className={`status ${account.isActive ? "active" : "inactive"}`}>
                      {account.isActive ? "● Active" : "○ Inactive"}
                    </span>
                    <span className="last-used">
                      Last used: {formatLastUsed(account.lastUsed)}
                    </span>
                  </div>
                </div>

                <div className="account-actions">
                  <button
                    className="disconnect-btn"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDisconnect(account.id);
                    }}
                    title="Disconnect"
                  >
                    ✕
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Connect Account Modal */}
      {showConnectModal && (
        <div className="modal-overlay" onClick={() => setShowConnectModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h3>Connect Account</h3>
            <p>Select a platform to connect:</p>

            <div className="platform-grid">
              {(Object.entries(PLATFORM_CONFIG) as [SocialPlatform, typeof PLATFORM_CONFIG.twitter][]).map(
                ([platform, config]) => (
                  <button
                    key={platform}
                    className="platform-btn"
                    style={{ borderColor: config.color }}
                    onClick={() => handleConnectClick(platform)}
                  >
                    <span
                      className="platform-icon"
                      style={{ backgroundColor: config.color }}
                    >
                      {config.icon}
                    </span>
                    <span className="platform-name">{config.name}</span>
                  </button>
                )
              )}
            </div>

            <button
              className="cancel-btn"
              onClick={() => setShowConnectModal(false)}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      <style>{`
        .account-hub {
          padding: 16px;
          background: var(--bg-primary, #1a1a1a);
          border-radius: 12px;
        }

        .account-hub.loading {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          min-height: 200px;
        }

        .spinner {
          width: 24px;
          height: 24px;
          border: 2px solid var(--border-color, #333);
          border-top-color: var(--accent-color, #3b82f6);
          border-radius: 50%;
          animation: spin 0.8s linear infinite;
        }

        @keyframes spin {
          to { transform: rotate(360deg); }
        }

        .account-hub-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 16px;
        }

        .account-hub-header h3 {
          margin: 0;
          font-size: 16px;
          color: var(--text-primary, #fff);
        }

        .add-account-btn {
          width: 28px;
          height: 28px;
          border-radius: 50%;
          border: 1px dashed var(--border-color, #444);
          background: transparent;
          color: var(--text-secondary, #888);
          font-size: 18px;
          cursor: pointer;
          transition: all 0.2s;
        }

        .add-account-btn:hover {
          border-color: var(--accent-color, #3b82f6);
          color: var(--accent-color, #3b82f6);
        }

        .no-accounts {
          text-align: center;
          padding: 32px 16px;
          color: var(--text-secondary, #888);
        }

        .connect-first-btn {
          margin-top: 16px;
          padding: 12px 24px;
          background: var(--accent-color, #3b82f6);
          border: none;
          border-radius: 8px;
          color: white;
          font-weight: 500;
          cursor: pointer;
          transition: opacity 0.2s;
        }

        .connect-first-btn:hover {
          opacity: 0.9;
        }

        .accounts-list {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .account-card {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 12px;
          background: var(--bg-secondary, #252525);
          border: 1px solid var(--border-color, #333);
          border-radius: 8px;
          cursor: pointer;
          transition: all 0.2s;
        }

        .account-card:hover {
          border-color: var(--accent-color, #3b82f6);
        }

        .account-card.selected {
          border-color: var(--accent-color, #3b82f6);
          background: var(--bg-accent, #1e3a5f);
        }

        .account-icon {
          width: 40px;
          height: 40px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          color: white;
          font-weight: bold;
          font-size: 16px;
        }

        .account-info {
          flex: 1;
          min-width: 0;
        }

        .account-name {
          font-weight: 500;
          color: var(--text-primary, #fff);
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .account-handle {
          font-size: 12px;
          color: var(--text-secondary, #888);
        }

        .account-meta {
          display: flex;
          gap: 12px;
          margin-top: 4px;
          font-size: 11px;
        }

        .status {
          color: var(--text-secondary, #888);
        }

        .status.active {
          color: #22c55e;
        }

        .last-used {
          color: var(--text-muted, #666);
        }

        .account-actions {
          display: flex;
          gap: 8px;
        }

        .disconnect-btn {
          width: 24px;
          height: 24px;
          border-radius: 4px;
          border: none;
          background: transparent;
          color: var(--text-secondary, #888);
          cursor: pointer;
          opacity: 0;
          transition: all 0.2s;
        }

        .account-card:hover .disconnect-btn {
          opacity: 1;
        }

        .disconnect-btn:hover {
          background: var(--bg-danger, #dc2626);
          color: white;
        }

        .modal-overlay {
          position: fixed;
          inset: 0;
          background: rgba(0, 0, 0, 0.7);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 1000;
        }

        .modal-content {
          background: var(--bg-primary, #1a1a1a);
          border: 1px solid var(--border-color, #333);
          border-radius: 16px;
          padding: 24px;
          width: 90%;
          max-width: 400px;
        }

        .modal-content h3 {
          margin: 0 0 8px;
          color: var(--text-primary, #fff);
        }

        .modal-content p {
          margin: 0 0 20px;
          color: var(--text-secondary, #888);
        }

        .platform-grid {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 12px;
          margin-bottom: 20px;
        }

        .platform-btn {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 8px;
          padding: 16px;
          background: var(--bg-secondary, #252525);
          border: 2px solid var(--border-color, #333);
          border-radius: 12px;
          cursor: pointer;
          transition: all 0.2s;
        }

        .platform-btn:hover {
          transform: translateY(-2px);
        }

        .platform-icon {
          width: 40px;
          height: 40px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          color: white;
          font-weight: bold;
        }

        .platform-name {
          color: var(--text-primary, #fff);
          font-size: 13px;
        }

        .cancel-btn {
          width: 100%;
          padding: 12px;
          background: transparent;
          border: 1px solid var(--border-color, #444);
          border-radius: 8px;
          color: var(--text-secondary, #888);
          cursor: pointer;
          transition: all 0.2s;
        }

        .cancel-btn:hover {
          background: var(--bg-secondary, #252525);
        }
      `}</style>
    </div>
  );
};

export default AccountHub;
