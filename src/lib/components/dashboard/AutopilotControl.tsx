/**
 * Autopilot Control Component
 *
 * Configure and manage automated social media engagement.
 * Controls auto-reply settings, posting frequency, and content filters.
 */

import React, { useState, useEffect } from "react";
import { SocialPlatform } from "../../security/credential-store";

interface AutopilotSettings {
  enabled: boolean;
  platforms: SocialPlatform[];
  replySettings: {
    replyToMentions: boolean;
    replyToComments: boolean;
    replyToTrending: boolean;
    replyToCompetitors: boolean;
  };
  frequency: {
    repliesPerHour: number;
    postsPerDay: number;
  };
  tone: "professional" | "casual" | "friendly" | "humorous";
  topics: string[];
  avoidTopics: string[];
  workingHours: {
    enabled: boolean;
    start: string;
    end: string;
    timezone: string;
  };
}

interface QueuedAction {
  id: string;
  type: "reply" | "post" | "like";
  platform: SocialPlatform;
  content: string;
  targetUrl?: string;
  scheduledTime: number;
  status: "pending" | "approved" | "rejected";
}

interface AutopilotControlProps {
  onSettingsChange?: (settings: AutopilotSettings) => void;
  onApproveAction?: (actionId: string) => void;
  onRejectAction?: (actionId: string) => void;
}

const DEFAULT_SETTINGS: AutopilotSettings = {
  enabled: false,
  platforms: ["twitter", "linkedin"],
  replySettings: {
    replyToMentions: true,
    replyToComments: true,
    replyToTrending: false,
    replyToCompetitors: false,
  },
  frequency: {
    repliesPerHour: 5,
    postsPerDay: 2,
  },
  tone: "professional",
  topics: ["AI", "Technology", "Startups"],
  avoidTopics: ["Politics", "Controversy"],
  workingHours: {
    enabled: true,
    start: "09:00",
    end: "18:00",
    timezone: "UTC",
  },
};

const TONE_OPTIONS = [
  { value: "professional", label: "Professional", emoji: "💼" },
  { value: "casual", label: "Casual", emoji: "😊" },
  { value: "friendly", label: "Friendly", emoji: "🤗" },
  { value: "humorous", label: "Humorous", emoji: "😄" },
];

export const AutopilotControl: React.FC<AutopilotControlProps> = ({
  onSettingsChange,
  onApproveAction,
  onRejectAction,
}) => {
  const [settings, setSettings] = useState<AutopilotSettings>(DEFAULT_SETTINGS);
  const [queue, setQueue] = useState<QueuedAction[]>([]);
  const [activeTab, setActiveTab] = useState<"settings" | "queue">("settings");
  const [newTopic, setNewTopic] = useState("");
  const [newAvoidTopic, setNewAvoidTopic] = useState("");

  useEffect(() => {
    loadSettings();
    loadQueue();
  }, []);

  const loadSettings = async () => {
    try {
      const stored = await chrome.storage.local.get("autopilot_settings");
      if (stored.autopilot_settings) {
        setSettings(stored.autopilot_settings);
      }
    } catch (error) {
      console.error("Failed to load autopilot settings:", error);
    }
  };

  const loadQueue = async () => {
    // Mock queue data for demo
    setQueue([
      {
        id: "1",
        type: "reply",
        platform: "twitter",
        content: "Great insights! AI agents are definitely transforming how we work. What's your take on human oversight?",
        targetUrl: "https://twitter.com/user/status/123",
        scheduledTime: Date.now() + 300000,
        status: "pending",
      },
      {
        id: "2",
        type: "reply",
        platform: "linkedin",
        content: "This resonates with my experience in the industry. Remote work has fundamentally changed team dynamics.",
        targetUrl: "https://linkedin.com/posts/123",
        scheduledTime: Date.now() + 600000,
        status: "pending",
      },
    ]);
  };

  const saveSettings = async (newSettings: AutopilotSettings) => {
    setSettings(newSettings);
    await chrome.storage.local.set({ autopilot_settings: newSettings });
    onSettingsChange?.(newSettings);
  };

  const toggleAutopilot = () => {
    saveSettings({ ...settings, enabled: !settings.enabled });
  };

  const updateReplySetting = (key: keyof AutopilotSettings["replySettings"]) => {
    saveSettings({
      ...settings,
      replySettings: {
        ...settings.replySettings,
        [key]: !settings.replySettings[key],
      },
    });
  };

  const updateFrequency = (key: keyof AutopilotSettings["frequency"], value: number) => {
    saveSettings({
      ...settings,
      frequency: {
        ...settings.frequency,
        [key]: value,
      },
    });
  };

  const addTopic = () => {
    if (newTopic.trim() && !settings.topics.includes(newTopic.trim())) {
      saveSettings({
        ...settings,
        topics: [...settings.topics, newTopic.trim()],
      });
      setNewTopic("");
    }
  };

  const removeTopic = (topic: string) => {
    saveSettings({
      ...settings,
      topics: settings.topics.filter((t) => t !== topic),
    });
  };

  const addAvoidTopic = () => {
    if (newAvoidTopic.trim() && !settings.avoidTopics.includes(newAvoidTopic.trim())) {
      saveSettings({
        ...settings,
        avoidTopics: [...settings.avoidTopics, newAvoidTopic.trim()],
      });
      setNewAvoidTopic("");
    }
  };

  const removeAvoidTopic = (topic: string) => {
    saveSettings({
      ...settings,
      avoidTopics: settings.avoidTopics.filter((t) => t !== topic),
    });
  };

  const handleApprove = (actionId: string) => {
    setQueue((prev) =>
      prev.map((a) => (a.id === actionId ? { ...a, status: "approved" as const } : a))
    );
    onApproveAction?.(actionId);
  };

  const handleReject = (actionId: string) => {
    setQueue((prev) => prev.filter((a) => a.id !== actionId));
    onRejectAction?.(actionId);
  };

  const formatScheduledTime = (timestamp: number) => {
    const diff = timestamp - Date.now();
    const minutes = Math.floor(diff / 60000);
    if (minutes < 60) return `in ${minutes}m`;
    return `in ${Math.floor(minutes / 60)}h ${minutes % 60}m`;
  };

  return (
    <div className="autopilot-control">
      {/* Header with main toggle */}
      <div className="autopilot-header">
        <div className="header-left">
          <span className="robot-icon">🤖</span>
          <h3>Autopilot Mode</h3>
        </div>
        <button
          className={`toggle-switch ${settings.enabled ? "on" : "off"}`}
          onClick={toggleAutopilot}
        >
          <span className="toggle-slider" />
          <span className="toggle-label">{settings.enabled ? "ON" : "OFF"}</span>
        </button>
      </div>

      {/* Tab Navigation */}
      <div className="tab-nav">
        <button
          className={`tab-btn ${activeTab === "settings" ? "active" : ""}`}
          onClick={() => setActiveTab("settings")}
        >
          Settings
        </button>
        <button
          className={`tab-btn ${activeTab === "queue" ? "active" : ""}`}
          onClick={() => setActiveTab("queue")}
        >
          Review Queue
          {queue.filter((a) => a.status === "pending").length > 0 && (
            <span className="badge">
              {queue.filter((a) => a.status === "pending").length}
            </span>
          )}
        </button>
      </div>

      {activeTab === "settings" ? (
        <div className="settings-panel">
          {/* Reply Settings */}
          <div className="settings-section">
            <h4>Auto-Reply Settings</h4>
            <div className="checkbox-group">
              {[
                { key: "replyToMentions", label: "Reply to mentions" },
                { key: "replyToComments", label: "Reply to comments" },
                { key: "replyToTrending", label: "Reply to trending posts" },
                { key: "replyToCompetitors", label: "Reply to competitor mentions" },
              ].map(({ key, label }) => (
                <label key={key} className="checkbox-item">
                  <input
                    type="checkbox"
                    checked={settings.replySettings[key as keyof typeof settings.replySettings]}
                    onChange={() => updateReplySetting(key as keyof typeof settings.replySettings)}
                  />
                  <span className="checkmark" />
                  {label}
                </label>
              ))}
            </div>
          </div>

          {/* Frequency Settings */}
          <div className="settings-section">
            <h4>Frequency</h4>
            <div className="slider-group">
              <div className="slider-item">
                <label>Replies per hour</label>
                <div className="slider-control">
                  <input
                    type="range"
                    min="1"
                    max="20"
                    value={settings.frequency.repliesPerHour}
                    onChange={(e) => updateFrequency("repliesPerHour", parseInt(e.target.value))}
                  />
                  <span className="slider-value">{settings.frequency.repliesPerHour}</span>
                </div>
              </div>
              <div className="slider-item">
                <label>Posts per day</label>
                <div className="slider-control">
                  <input
                    type="range"
                    min="0"
                    max="10"
                    value={settings.frequency.postsPerDay}
                    onChange={(e) => updateFrequency("postsPerDay", parseInt(e.target.value))}
                  />
                  <span className="slider-value">{settings.frequency.postsPerDay}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Tone Selection */}
          <div className="settings-section">
            <h4>Response Tone</h4>
            <div className="tone-grid">
              {TONE_OPTIONS.map(({ value, label, emoji }) => (
                <button
                  key={value}
                  className={`tone-btn ${settings.tone === value ? "active" : ""}`}
                  onClick={() => saveSettings({ ...settings, tone: value as AutopilotSettings["tone"] })}
                >
                  <span className="tone-emoji">{emoji}</span>
                  <span className="tone-label">{label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Topics */}
          <div className="settings-section">
            <h4>Topics to Engage With</h4>
            <div className="tags-container">
              {settings.topics.map((topic) => (
                <span key={topic} className="tag">
                  {topic}
                  <button onClick={() => removeTopic(topic)}>×</button>
                </span>
              ))}
            </div>
            <div className="add-tag">
              <input
                type="text"
                placeholder="Add topic..."
                value={newTopic}
                onChange={(e) => setNewTopic(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && addTopic()}
              />
              <button onClick={addTopic}>+</button>
            </div>
          </div>

          {/* Avoid Topics */}
          <div className="settings-section">
            <h4>Topics to Avoid</h4>
            <div className="tags-container avoid">
              {settings.avoidTopics.map((topic) => (
                <span key={topic} className="tag avoid">
                  {topic}
                  <button onClick={() => removeAvoidTopic(topic)}>×</button>
                </span>
              ))}
            </div>
            <div className="add-tag">
              <input
                type="text"
                placeholder="Add topic to avoid..."
                value={newAvoidTopic}
                onChange={(e) => setNewAvoidTopic(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && addAvoidTopic()}
              />
              <button onClick={addAvoidTopic}>+</button>
            </div>
          </div>
        </div>
      ) : (
        <div className="queue-panel">
          {queue.filter((a) => a.status === "pending").length === 0 ? (
            <div className="empty-queue">
              <span className="empty-icon">📭</span>
              <p>No pending actions to review</p>
            </div>
          ) : (
            <div className="queue-list">
              {queue
                .filter((a) => a.status === "pending")
                .map((action) => (
                  <div key={action.id} className="queue-item">
                    <div className="queue-item-header">
                      <span className={`platform-badge ${action.platform}`}>
                        {action.platform}
                      </span>
                      <span className="action-type">{action.type}</span>
                      <span className="scheduled-time">
                        {formatScheduledTime(action.scheduledTime)}
                      </span>
                    </div>
                    <div className="queue-item-content">
                      <p>{action.content}</p>
                      {action.targetUrl && (
                        <a href={action.targetUrl} target="_blank" rel="noopener" className="target-link">
                          View original →
                        </a>
                      )}
                    </div>
                    <div className="queue-item-actions">
                      <button
                        className="approve-btn"
                        onClick={() => handleApprove(action.id)}
                      >
                        ✓ Approve
                      </button>
                      <button
                        className="reject-btn"
                        onClick={() => handleReject(action.id)}
                      >
                        ✕ Reject
                      </button>
                      <button className="edit-btn">✎ Edit</button>
                    </div>
                  </div>
                ))}
            </div>
          )}
        </div>
      )}

      <style>{`
        .autopilot-control {
          padding: 16px;
          background: var(--bg-primary, #1a1a1a);
          border-radius: 12px;
        }

        .autopilot-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 16px;
        }

        .header-left {
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .robot-icon {
          font-size: 20px;
        }

        .autopilot-header h3 {
          margin: 0;
          font-size: 16px;
          color: var(--text-primary, #fff);
        }

        .toggle-switch {
          position: relative;
          width: 64px;
          height: 32px;
          border-radius: 16px;
          border: none;
          cursor: pointer;
          transition: all 0.3s;
          background: var(--bg-secondary, #333);
        }

        .toggle-switch.on {
          background: linear-gradient(135deg, #22c55e, #16a34a);
        }

        .toggle-slider {
          position: absolute;
          top: 4px;
          left: 4px;
          width: 24px;
          height: 24px;
          border-radius: 50%;
          background: white;
          transition: transform 0.3s;
        }

        .toggle-switch.on .toggle-slider {
          transform: translateX(32px);
        }

        .toggle-label {
          position: absolute;
          right: 8px;
          color: white;
          font-size: 10px;
          font-weight: 600;
        }

        .toggle-switch.on .toggle-label {
          right: auto;
          left: 8px;
        }

        .tab-nav {
          display: flex;
          gap: 4px;
          margin-bottom: 16px;
          background: var(--bg-secondary, #252525);
          padding: 4px;
          border-radius: 8px;
        }

        .tab-btn {
          flex: 1;
          padding: 8px 16px;
          border: none;
          border-radius: 6px;
          background: transparent;
          color: var(--text-secondary, #888);
          font-size: 13px;
          cursor: pointer;
          transition: all 0.2s;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
        }

        .tab-btn:hover {
          color: var(--text-primary, #fff);
        }

        .tab-btn.active {
          background: var(--bg-primary, #1a1a1a);
          color: var(--text-primary, #fff);
        }

        .badge {
          padding: 2px 8px;
          background: var(--accent-color, #3b82f6);
          border-radius: 10px;
          font-size: 11px;
          color: white;
        }

        .settings-section {
          margin-bottom: 20px;
        }

        .settings-section h4 {
          margin: 0 0 12px;
          font-size: 13px;
          color: var(--text-secondary, #888);
          font-weight: 500;
        }

        .checkbox-group {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .checkbox-item {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 8px 12px;
          background: var(--bg-secondary, #252525);
          border-radius: 6px;
          cursor: pointer;
          font-size: 13px;
          color: var(--text-primary, #fff);
        }

        .checkbox-item input {
          display: none;
        }

        .checkmark {
          width: 18px;
          height: 18px;
          border: 2px solid var(--border-color, #444);
          border-radius: 4px;
          transition: all 0.2s;
        }

        .checkbox-item input:checked + .checkmark {
          background: var(--accent-color, #3b82f6);
          border-color: var(--accent-color, #3b82f6);
        }

        .checkbox-item input:checked + .checkmark::after {
          content: "✓";
          display: flex;
          align-items: center;
          justify-content: center;
          color: white;
          font-size: 12px;
        }

        .slider-group {
          display: flex;
          flex-direction: column;
          gap: 16px;
        }

        .slider-item label {
          display: block;
          font-size: 13px;
          color: var(--text-primary, #fff);
          margin-bottom: 8px;
        }

        .slider-control {
          display: flex;
          align-items: center;
          gap: 12px;
        }

        .slider-control input[type="range"] {
          flex: 1;
          height: 4px;
          border-radius: 2px;
          background: var(--bg-secondary, #333);
          appearance: none;
        }

        .slider-control input[type="range"]::-webkit-slider-thumb {
          appearance: none;
          width: 16px;
          height: 16px;
          border-radius: 50%;
          background: var(--accent-color, #3b82f6);
          cursor: pointer;
        }

        .slider-value {
          min-width: 24px;
          text-align: center;
          font-size: 14px;
          font-weight: 600;
          color: var(--accent-color, #3b82f6);
        }

        .tone-grid {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 8px;
        }

        .tone-btn {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 12px;
          border: 1px solid var(--border-color, #333);
          border-radius: 8px;
          background: var(--bg-secondary, #252525);
          color: var(--text-primary, #fff);
          cursor: pointer;
          transition: all 0.2s;
        }

        .tone-btn:hover {
          border-color: var(--accent-color, #3b82f6);
        }

        .tone-btn.active {
          border-color: var(--accent-color, #3b82f6);
          background: var(--bg-accent, #1e3a5f);
        }

        .tone-emoji {
          font-size: 18px;
        }

        .tone-label {
          font-size: 13px;
        }

        .tags-container {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
          margin-bottom: 12px;
        }

        .tag {
          display: flex;
          align-items: center;
          gap: 6px;
          padding: 6px 10px;
          background: var(--accent-color, #3b82f6);
          border-radius: 16px;
          font-size: 12px;
          color: white;
        }

        .tag.avoid {
          background: #dc2626;
        }

        .tag button {
          background: none;
          border: none;
          color: white;
          cursor: pointer;
          font-size: 14px;
          opacity: 0.7;
        }

        .tag button:hover {
          opacity: 1;
        }

        .add-tag {
          display: flex;
          gap: 8px;
        }

        .add-tag input {
          flex: 1;
          padding: 8px 12px;
          border: 1px solid var(--border-color, #333);
          border-radius: 6px;
          background: var(--bg-secondary, #252525);
          color: var(--text-primary, #fff);
          font-size: 13px;
        }

        .add-tag button {
          padding: 8px 16px;
          border: none;
          border-radius: 6px;
          background: var(--accent-color, #3b82f6);
          color: white;
          cursor: pointer;
        }

        .empty-queue {
          text-align: center;
          padding: 40px 20px;
        }

        .empty-icon {
          font-size: 48px;
          display: block;
          margin-bottom: 16px;
        }

        .empty-queue p {
          color: var(--text-secondary, #888);
        }

        .queue-list {
          display: flex;
          flex-direction: column;
          gap: 12px;
        }

        .queue-item {
          background: var(--bg-secondary, #252525);
          border-radius: 8px;
          padding: 16px;
        }

        .queue-item-header {
          display: flex;
          align-items: center;
          gap: 8px;
          margin-bottom: 12px;
        }

        .platform-badge {
          padding: 4px 8px;
          border-radius: 4px;
          font-size: 11px;
          font-weight: 500;
          text-transform: uppercase;
        }

        .platform-badge.twitter { background: #000; color: #fff; }
        .platform-badge.linkedin { background: #0A66C2; color: #fff; }

        .action-type {
          font-size: 12px;
          color: var(--text-secondary, #888);
        }

        .scheduled-time {
          margin-left: auto;
          font-size: 11px;
          color: var(--text-muted, #666);
        }

        .queue-item-content p {
          margin: 0 0 8px;
          font-size: 13px;
          color: var(--text-primary, #fff);
          line-height: 1.5;
        }

        .target-link {
          font-size: 12px;
          color: var(--accent-color, #3b82f6);
          text-decoration: none;
        }

        .queue-item-actions {
          display: flex;
          gap: 8px;
          margin-top: 12px;
          padding-top: 12px;
          border-top: 1px solid var(--border-color, #333);
        }

        .queue-item-actions button {
          flex: 1;
          padding: 8px;
          border: none;
          border-radius: 6px;
          font-size: 12px;
          cursor: pointer;
          transition: all 0.2s;
        }

        .approve-btn {
          background: #22c55e;
          color: white;
        }

        .reject-btn {
          background: #dc2626;
          color: white;
        }

        .edit-btn {
          background: var(--bg-tertiary, #333);
          color: var(--text-primary, #fff);
        }
      `}</style>
    </div>
  );
};

export default AutopilotControl;
