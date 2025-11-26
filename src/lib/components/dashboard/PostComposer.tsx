/**
 * Post Composer Component
 *
 * Create, edit, and schedule social media posts.
 * Supports multi-platform posting with AI assistance.
 */

import React, { useState, useEffect, useRef } from "react";
import { SocialPlatform, SocialAccount } from "../../security/credential-store";

interface PostComposerProps {
  selectedAccount?: SocialAccount;
  initialContent?: string;
  initialPlatform?: SocialPlatform;
  onPost?: (post: PostData) => void;
  onSchedule?: (post: PostData, scheduledTime: Date) => void;
  onClose?: () => void;
}

interface PostData {
  content: string;
  platform: SocialPlatform;
  accountId?: string;
  hashtags: string[];
  mediaUrls: string[];
}

const PLATFORM_LIMITS: Record<SocialPlatform, number> = {
  twitter: 280,
  linkedin: 3000,
  instagram: 2200,
  facebook: 63206,
  reddit: 40000,
};

const PLATFORM_CONFIG: Record<SocialPlatform, { icon: string; name: string; color: string }> = {
  twitter: { icon: "𝕏", name: "Twitter/X", color: "#000000" },
  linkedin: { icon: "in", name: "LinkedIn", color: "#0A66C2" },
  instagram: { icon: "📷", name: "Instagram", color: "#E4405F" },
  facebook: { icon: "f", name: "Facebook", color: "#1877F2" },
  reddit: { icon: "🔴", name: "Reddit", color: "#FF4500" },
};

export const PostComposer: React.FC<PostComposerProps> = ({
  selectedAccount,
  initialContent = "",
  initialPlatform = "twitter",
  onPost,
  onSchedule,
  onClose,
}) => {
  const [content, setContent] = useState(initialContent);
  const [platform, setPlatform] = useState<SocialPlatform>(initialPlatform);
  const [hashtags, setHashtags] = useState<string[]>([]);
  const [suggestedHashtags, setSuggestedHashtags] = useState<string[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [showScheduler, setShowScheduler] = useState(false);
  const [scheduledDate, setScheduledDate] = useState("");
  const [scheduledTime, setScheduledTime] = useState("");
  const [mediaUrls, setMediaUrls] = useState<string[]>([]);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const charLimit = PLATFORM_LIMITS[platform];
  const charCount = content.length;
  const isOverLimit = charCount > charLimit;
  const charPercentage = Math.min((charCount / charLimit) * 100, 100);

  useEffect(() => {
    if (selectedAccount) {
      setPlatform(selectedAccount.platform);
    }
  }, [selectedAccount]);

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
    }
  }, [content]);

  const handleGenerateContent = async () => {
    setIsGenerating(true);
    try {
      const response = await chrome.runtime.sendMessage({
        type: "mcp_tool_call",
        tool: "generate_post_draft",
        args: {
          topic: content || "trending topic",
          platform,
          tone: "professional",
          includeHashtags: true,
        },
      });

      if (response?.success && response?.data?.content) {
        setContent(response.data.content);
        if (response.data.hashtags) {
          setHashtags(response.data.hashtags);
        }
      }
    } catch (error) {
      console.error("Failed to generate content:", error);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleSuggestHashtags = async () => {
    try {
      const response = await chrome.runtime.sendMessage({
        type: "mcp_tool_call",
        tool: "optimize_hashtags",
        args: {
          content,
          platform,
          count: 5,
          style: "balanced",
        },
      });

      if (response?.success && response?.data?.hashtags) {
        setSuggestedHashtags(response.data.hashtags);
      } else {
        // Mock suggestions for demo
        setSuggestedHashtags(["#AI", "#Technology", "#Innovation", "#Future", "#Tech"]);
      }
    } catch (error) {
      console.error("Failed to suggest hashtags:", error);
      setSuggestedHashtags(["#AI", "#Technology", "#Innovation"]);
    }
  };

  const addHashtag = (tag: string) => {
    const cleanTag = tag.startsWith("#") ? tag : `#${tag}`;
    if (!hashtags.includes(cleanTag)) {
      setHashtags([...hashtags, cleanTag]);
    }
    setSuggestedHashtags(suggestedHashtags.filter((t) => t !== tag));
  };

  const removeHashtag = (tag: string) => {
    setHashtags(hashtags.filter((t) => t !== tag));
  };

  const handlePost = () => {
    if (isOverLimit || !content.trim()) return;

    const postData: PostData = {
      content: content + (hashtags.length > 0 ? "\n\n" + hashtags.join(" ") : ""),
      platform,
      accountId: selectedAccount?.id,
      hashtags,
      mediaUrls,
    };

    onPost?.(postData);
  };

  const handleSchedule = () => {
    if (isOverLimit || !content.trim() || !scheduledDate || !scheduledTime) return;

    const scheduledDateTime = new Date(`${scheduledDate}T${scheduledTime}`);

    const postData: PostData = {
      content: content + (hashtags.length > 0 ? "\n\n" + hashtags.join(" ") : ""),
      platform,
      accountId: selectedAccount?.id,
      hashtags,
      mediaUrls,
    };

    onSchedule?.(postData, scheduledDateTime);
    setShowScheduler(false);
  };

  const handleImprove = async () => {
    if (!content.trim()) return;

    setIsGenerating(true);
    try {
      const response = await chrome.runtime.sendMessage({
        type: "mcp_tool_call",
        tool: "improve_content",
        args: {
          content,
          platform,
          goal: "engagement",
        },
      });

      if (response?.success && response?.data?.improved) {
        setContent(response.data.improved);
      }
    } catch (error) {
      console.error("Failed to improve content:", error);
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="post-composer">
      {/* Header */}
      <div className="composer-header">
        <h3>Create Post</h3>
        {onClose && (
          <button className="close-btn" onClick={onClose}>
            ×
          </button>
        )}
      </div>

      {/* Platform Selector */}
      <div className="platform-selector">
        {(Object.entries(PLATFORM_CONFIG) as [SocialPlatform, typeof PLATFORM_CONFIG.twitter][]).map(
          ([key, config]) => (
            <button
              key={key}
              className={`platform-btn ${platform === key ? "active" : ""}`}
              onClick={() => setPlatform(key)}
              style={{ "--platform-color": config.color } as React.CSSProperties}
            >
              <span className="platform-icon">{config.icon}</span>
              <span className="platform-name">{config.name}</span>
            </button>
          )
        )}
      </div>

      {/* Content Area */}
      <div className="content-area">
        <textarea
          ref={textareaRef}
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder={`What's on your mind? Write something for ${PLATFORM_CONFIG[platform].name}...`}
          className={isOverLimit ? "over-limit" : ""}
        />

        {/* Character Counter */}
        <div className="char-counter">
          <div
            className="char-progress"
            style={{
              width: `${charPercentage}%`,
              backgroundColor: isOverLimit ? "#dc2626" : charPercentage > 80 ? "#f59e0b" : "#22c55e",
            }}
          />
          <span className={`char-count ${isOverLimit ? "over" : ""}`}>
            {charCount} / {charLimit}
          </span>
        </div>
      </div>

      {/* AI Actions */}
      <div className="ai-actions">
        <button
          className="ai-btn"
          onClick={handleGenerateContent}
          disabled={isGenerating}
        >
          {isGenerating ? "✨ Generating..." : "✨ Generate"}
        </button>
        <button
          className="ai-btn"
          onClick={handleImprove}
          disabled={isGenerating || !content.trim()}
        >
          🔧 Improve
        </button>
        <button
          className="ai-btn"
          onClick={handleSuggestHashtags}
          disabled={!content.trim()}
        >
          #️⃣ Hashtags
        </button>
      </div>

      {/* Suggested Hashtags */}
      {suggestedHashtags.length > 0 && (
        <div className="suggested-hashtags">
          <span className="label">Suggested:</span>
          {suggestedHashtags.map((tag) => (
            <button key={tag} className="hashtag-btn" onClick={() => addHashtag(tag)}>
              {tag}
            </button>
          ))}
        </div>
      )}

      {/* Selected Hashtags */}
      {hashtags.length > 0 && (
        <div className="selected-hashtags">
          <span className="label">Selected:</span>
          {hashtags.map((tag) => (
            <span key={tag} className="hashtag-tag">
              {tag}
              <button onClick={() => removeHashtag(tag)}>×</button>
            </span>
          ))}
        </div>
      )}

      {/* Schedule Panel */}
      {showScheduler && (
        <div className="schedule-panel">
          <div className="schedule-inputs">
            <input
              type="date"
              value={scheduledDate}
              onChange={(e) => setScheduledDate(e.target.value)}
              min={new Date().toISOString().split("T")[0]}
            />
            <input
              type="time"
              value={scheduledTime}
              onChange={(e) => setScheduledTime(e.target.value)}
            />
          </div>
          <div className="schedule-actions">
            <button className="cancel-btn" onClick={() => setShowScheduler(false)}>
              Cancel
            </button>
            <button
              className="confirm-btn"
              onClick={handleSchedule}
              disabled={!scheduledDate || !scheduledTime}
            >
              Confirm Schedule
            </button>
          </div>
        </div>
      )}

      {/* Action Buttons */}
      <div className="composer-actions">
        <button
          className="schedule-btn"
          onClick={() => setShowScheduler(!showScheduler)}
        >
          🕐 Schedule
        </button>
        <button
          className="post-btn"
          onClick={handlePost}
          disabled={isOverLimit || !content.trim()}
        >
          Post to {PLATFORM_CONFIG[platform].name}
        </button>
      </div>

      <style>{`
        .post-composer {
          background: var(--bg-primary, #1a1a1a);
          border-radius: 12px;
          padding: 20px;
        }

        .composer-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 16px;
        }

        .composer-header h3 {
          margin: 0;
          font-size: 18px;
          color: var(--text-primary, #fff);
        }

        .close-btn {
          width: 32px;
          height: 32px;
          border-radius: 50%;
          border: none;
          background: var(--bg-secondary, #333);
          color: var(--text-secondary, #888);
          font-size: 20px;
          cursor: pointer;
          transition: all 0.2s;
        }

        .close-btn:hover {
          background: var(--bg-danger, #dc2626);
          color: white;
        }

        .platform-selector {
          display: flex;
          gap: 8px;
          margin-bottom: 16px;
          overflow-x: auto;
          padding-bottom: 4px;
        }

        .platform-btn {
          display: flex;
          align-items: center;
          gap: 6px;
          padding: 8px 12px;
          border: 1px solid var(--border-color, #333);
          border-radius: 8px;
          background: var(--bg-secondary, #252525);
          color: var(--text-secondary, #888);
          font-size: 12px;
          cursor: pointer;
          transition: all 0.2s;
          white-space: nowrap;
        }

        .platform-btn:hover {
          border-color: var(--platform-color);
          color: var(--text-primary, #fff);
        }

        .platform-btn.active {
          background: var(--platform-color);
          border-color: var(--platform-color);
          color: white;
        }

        .platform-icon {
          font-size: 14px;
          font-weight: bold;
        }

        .content-area {
          position: relative;
          margin-bottom: 16px;
        }

        .content-area textarea {
          width: 100%;
          min-height: 120px;
          padding: 16px;
          border: 1px solid var(--border-color, #333);
          border-radius: 12px;
          background: var(--bg-secondary, #252525);
          color: var(--text-primary, #fff);
          font-size: 15px;
          line-height: 1.5;
          resize: none;
          transition: border-color 0.2s;
        }

        .content-area textarea:focus {
          outline: none;
          border-color: var(--accent-color, #3b82f6);
        }

        .content-area textarea.over-limit {
          border-color: #dc2626;
        }

        .content-area textarea::placeholder {
          color: var(--text-muted, #666);
        }

        .char-counter {
          position: absolute;
          bottom: 12px;
          right: 12px;
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .char-progress {
          width: 60px;
          height: 4px;
          border-radius: 2px;
          transition: all 0.3s;
        }

        .char-count {
          font-size: 12px;
          color: var(--text-muted, #666);
        }

        .char-count.over {
          color: #dc2626;
          font-weight: 600;
        }

        .ai-actions {
          display: flex;
          gap: 8px;
          margin-bottom: 16px;
        }

        .ai-btn {
          padding: 8px 16px;
          border: 1px solid var(--border-color, #333);
          border-radius: 8px;
          background: var(--bg-secondary, #252525);
          color: var(--text-primary, #fff);
          font-size: 13px;
          cursor: pointer;
          transition: all 0.2s;
        }

        .ai-btn:hover:not(:disabled) {
          border-color: var(--accent-color, #3b82f6);
          background: var(--bg-accent, #1e3a5f);
        }

        .ai-btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .suggested-hashtags,
        .selected-hashtags {
          display: flex;
          flex-wrap: wrap;
          align-items: center;
          gap: 8px;
          margin-bottom: 12px;
        }

        .label {
          font-size: 12px;
          color: var(--text-secondary, #888);
        }

        .hashtag-btn {
          padding: 4px 10px;
          border: 1px dashed var(--accent-color, #3b82f6);
          border-radius: 16px;
          background: transparent;
          color: var(--accent-color, #3b82f6);
          font-size: 12px;
          cursor: pointer;
          transition: all 0.2s;
        }

        .hashtag-btn:hover {
          background: var(--accent-color, #3b82f6);
          color: white;
          border-style: solid;
        }

        .hashtag-tag {
          display: flex;
          align-items: center;
          gap: 4px;
          padding: 4px 10px;
          background: var(--accent-color, #3b82f6);
          border-radius: 16px;
          font-size: 12px;
          color: white;
        }

        .hashtag-tag button {
          background: none;
          border: none;
          color: white;
          cursor: pointer;
          font-size: 14px;
          opacity: 0.7;
          padding: 0;
          margin-left: 2px;
        }

        .hashtag-tag button:hover {
          opacity: 1;
        }

        .schedule-panel {
          background: var(--bg-secondary, #252525);
          border-radius: 8px;
          padding: 16px;
          margin-bottom: 16px;
        }

        .schedule-inputs {
          display: flex;
          gap: 12px;
          margin-bottom: 12px;
        }

        .schedule-inputs input {
          flex: 1;
          padding: 10px 12px;
          border: 1px solid var(--border-color, #333);
          border-radius: 6px;
          background: var(--bg-primary, #1a1a1a);
          color: var(--text-primary, #fff);
          font-size: 14px;
        }

        .schedule-actions {
          display: flex;
          gap: 8px;
          justify-content: flex-end;
        }

        .schedule-actions button {
          padding: 8px 16px;
          border: none;
          border-radius: 6px;
          font-size: 13px;
          cursor: pointer;
          transition: all 0.2s;
        }

        .cancel-btn {
          background: var(--bg-tertiary, #333);
          color: var(--text-primary, #fff);
        }

        .confirm-btn {
          background: var(--accent-color, #3b82f6);
          color: white;
        }

        .confirm-btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .composer-actions {
          display: flex;
          gap: 12px;
        }

        .schedule-btn {
          padding: 12px 20px;
          border: 1px solid var(--border-color, #333);
          border-radius: 8px;
          background: transparent;
          color: var(--text-primary, #fff);
          font-size: 14px;
          cursor: pointer;
          transition: all 0.2s;
        }

        .schedule-btn:hover {
          border-color: var(--accent-color, #3b82f6);
        }

        .post-btn {
          flex: 1;
          padding: 12px 24px;
          border: none;
          border-radius: 8px;
          background: linear-gradient(135deg, var(--accent-color, #3b82f6), #8b5cf6);
          color: white;
          font-size: 14px;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.2s;
        }

        .post-btn:hover:not(:disabled) {
          transform: translateY(-1px);
          box-shadow: 0 4px 12px rgba(59, 130, 246, 0.3);
        }

        .post-btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
          transform: none;
          box-shadow: none;
        }
      `}</style>
    </div>
  );
};

export default PostComposer;
