/**
 * Trend Dashboard Component
 *
 * Displays trending topics across social media platforms.
 * Allows users to generate content ideas from trends.
 */

import React, { useState, useEffect } from "react";
import { SocialPlatform } from "../../security/credential-store";

interface Trend {
  topic: string;
  volume?: number;
  change?: number;
  url?: string;
}

interface PlatformTrends {
  platform: SocialPlatform;
  trends: Trend[];
  lastUpdated: number;
}

interface TrendDashboardProps {
  onGenerateContent?: (trend: Trend, platform: SocialPlatform) => void;
  onTrendClick?: (trend: Trend, platform: SocialPlatform) => void;
}

const PLATFORM_NAMES: Record<SocialPlatform, string> = {
  twitter: "Twitter/X",
  linkedin: "LinkedIn",
  instagram: "Instagram",
  facebook: "Facebook",
  reddit: "Reddit",
};

const PLATFORM_ICONS: Record<SocialPlatform, string> = {
  twitter: "𝕏",
  linkedin: "in",
  instagram: "📷",
  facebook: "f",
  reddit: "🔴",
};

export const TrendDashboard: React.FC<TrendDashboardProps> = ({
  onGenerateContent,
  onTrendClick,
}) => {
  const [platformTrends, setPlatformTrends] = useState<PlatformTrends[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedPlatforms, setSelectedPlatforms] = useState<SocialPlatform[]>([
    "twitter",
    "linkedin",
  ]);
  const [refreshing, setRefreshing] = useState(false);
  const [category, setCategory] = useState<string>("all");

  useEffect(() => {
    fetchTrends();
  }, [selectedPlatforms, category]);

  const fetchTrends = async () => {
    setLoading(true);
    try {
      const response = await chrome.runtime.sendMessage({
        type: "mcp_tool_call",
        tool: "get_trending_topics",
        args: {
          platforms: selectedPlatforms,
          category,
          limit: 10,
        },
      });

      if (response?.success && response?.data?.trends) {
        const trends: PlatformTrends[] = Object.entries(response.data.trends).map(
          ([platform, trendList]) => ({
            platform: platform as SocialPlatform,
            trends: trendList as Trend[],
            lastUpdated: Date.now(),
          })
        );
        setPlatformTrends(trends);
      }
    } catch (error) {
      console.error("Failed to fetch trends:", error);
      // Set mock data for demo
      setPlatformTrends([
        {
          platform: "twitter",
          trends: [
            { topic: "#AIAgents", volume: 45000, change: 340 },
            { topic: "#TechNews", volume: 32000, change: 180 },
            { topic: "#Startups", volume: 28000, change: 95 },
            { topic: "#MachineLearning", volume: 24000, change: 67 },
            { topic: "#WebDev", volume: 19000, change: 45 },
          ],
          lastUpdated: Date.now(),
        },
        {
          platform: "linkedin",
          trends: [
            { topic: "Future of Remote Work", volume: 12000, change: 220 },
            { topic: "AI in Enterprise", volume: 9500, change: 156 },
            { topic: "Leadership Tips", volume: 8200, change: 89 },
            { topic: "Career Growth", volume: 7100, change: 62 },
            { topic: "Tech Hiring", volume: 5800, change: 41 },
          ],
          lastUpdated: Date.now(),
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchTrends();
    setRefreshing(false);
  };

  const togglePlatform = (platform: SocialPlatform) => {
    setSelectedPlatforms((prev) =>
      prev.includes(platform)
        ? prev.filter((p) => p !== platform)
        : [...prev, platform]
    );
  };

  const formatVolume = (volume?: number) => {
    if (!volume) return "";
    if (volume >= 1000000) return `${(volume / 1000000).toFixed(1)}M`;
    if (volume >= 1000) return `${(volume / 1000).toFixed(1)}K`;
    return volume.toString();
  };

  const formatChange = (change?: number) => {
    if (!change) return "";
    const sign = change >= 0 ? "+" : "";
    return `${sign}${change}%`;
  };

  const formatTime = (timestamp: number) => {
    const diff = Date.now() - timestamp;
    const minutes = Math.floor(diff / 60000);
    if (minutes < 1) return "Just now";
    if (minutes < 60) return `${minutes}m ago`;
    return `${Math.floor(minutes / 60)}h ago`;
  };

  return (
    <div className="trend-dashboard">
      <div className="trend-header">
        <div className="trend-title">
          <span className="fire-icon">🔥</span>
          <h3>Trending Now</h3>
        </div>
        <button
          className={`refresh-btn ${refreshing ? "spinning" : ""}`}
          onClick={handleRefresh}
          disabled={refreshing}
        >
          ↻
        </button>
      </div>

      {/* Platform Filter */}
      <div className="platform-filter">
        {(Object.keys(PLATFORM_NAMES) as SocialPlatform[]).map((platform) => (
          <button
            key={platform}
            className={`filter-chip ${selectedPlatforms.includes(platform) ? "active" : ""}`}
            onClick={() => togglePlatform(platform)}
          >
            <span className="chip-icon">{PLATFORM_ICONS[platform]}</span>
            {PLATFORM_NAMES[platform]}
          </button>
        ))}
      </div>

      {/* Category Filter */}
      <div className="category-filter">
        {["all", "technology", "business", "entertainment", "news"].map((cat) => (
          <button
            key={cat}
            className={`category-chip ${category === cat ? "active" : ""}`}
            onClick={() => setCategory(cat)}
          >
            {cat.charAt(0).toUpperCase() + cat.slice(1)}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="loading-state">
          <div className="pulse-loader">
            <div className="pulse-bar" />
            <div className="pulse-bar" />
            <div className="pulse-bar" />
          </div>
          <p>Fetching trends...</p>
        </div>
      ) : (
        <div className="trends-container">
          {platformTrends.map(({ platform, trends, lastUpdated }) => (
            <div key={platform} className="platform-section">
              <div className="platform-header">
                <span className="platform-icon">{PLATFORM_ICONS[platform]}</span>
                <span className="platform-name">{PLATFORM_NAMES[platform]}</span>
                <span className="last-updated">{formatTime(lastUpdated)}</span>
              </div>

              <div className="trends-list">
                {trends.map((trend, index) => (
                  <div
                    key={`${platform}-${index}`}
                    className="trend-item"
                    onClick={() => onTrendClick?.(trend, platform)}
                  >
                    <span className="trend-rank">{index + 1}</span>
                    <div className="trend-content">
                      <span className="trend-topic">{trend.topic}</span>
                      <div className="trend-meta">
                        {trend.volume && (
                          <span className="trend-volume">
                            {formatVolume(trend.volume)} posts
                          </span>
                        )}
                        {trend.change && (
                          <span
                            className={`trend-change ${trend.change >= 0 ? "up" : "down"}`}
                          >
                            📈 {formatChange(trend.change)}
                          </span>
                        )}
                      </div>
                    </div>
                    <button
                      className="generate-btn"
                      onClick={(e) => {
                        e.stopPropagation();
                        onGenerateContent?.(trend, platform);
                      }}
                      title="Generate content idea"
                    >
                      ✨
                    </button>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Quick Actions */}
      <div className="quick-actions">
        <button className="action-btn primary" onClick={() => onGenerateContent?.({ topic: "trending" }, "twitter")}>
          Generate Content Ideas →
        </button>
      </div>

      <style>{`
        .trend-dashboard {
          padding: 16px;
          background: var(--bg-primary, #1a1a1a);
          border-radius: 12px;
        }

        .trend-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 16px;
        }

        .trend-title {
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .fire-icon {
          font-size: 20px;
        }

        .trend-title h3 {
          margin: 0;
          font-size: 16px;
          color: var(--text-primary, #fff);
        }

        .refresh-btn {
          width: 32px;
          height: 32px;
          border-radius: 8px;
          border: 1px solid var(--border-color, #333);
          background: transparent;
          color: var(--text-secondary, #888);
          font-size: 16px;
          cursor: pointer;
          transition: all 0.2s;
        }

        .refresh-btn:hover {
          border-color: var(--accent-color, #3b82f6);
          color: var(--accent-color, #3b82f6);
        }

        .refresh-btn.spinning {
          animation: spin 0.8s linear infinite;
        }

        @keyframes spin {
          to { transform: rotate(360deg); }
        }

        .platform-filter {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
          margin-bottom: 12px;
        }

        .filter-chip {
          display: flex;
          align-items: center;
          gap: 6px;
          padding: 6px 12px;
          border-radius: 20px;
          border: 1px solid var(--border-color, #333);
          background: transparent;
          color: var(--text-secondary, #888);
          font-size: 12px;
          cursor: pointer;
          transition: all 0.2s;
        }

        .filter-chip:hover {
          border-color: var(--accent-color, #3b82f6);
        }

        .filter-chip.active {
          background: var(--accent-color, #3b82f6);
          border-color: var(--accent-color, #3b82f6);
          color: white;
        }

        .chip-icon {
          font-size: 12px;
        }

        .category-filter {
          display: flex;
          gap: 8px;
          margin-bottom: 16px;
          overflow-x: auto;
          padding-bottom: 4px;
        }

        .category-chip {
          padding: 4px 12px;
          border-radius: 4px;
          border: none;
          background: var(--bg-secondary, #252525);
          color: var(--text-secondary, #888);
          font-size: 11px;
          cursor: pointer;
          white-space: nowrap;
          transition: all 0.2s;
        }

        .category-chip:hover {
          color: var(--text-primary, #fff);
        }

        .category-chip.active {
          background: var(--accent-color, #3b82f6);
          color: white;
        }

        .loading-state {
          display: flex;
          flex-direction: column;
          align-items: center;
          padding: 40px 0;
        }

        .pulse-loader {
          display: flex;
          gap: 8px;
          margin-bottom: 16px;
        }

        .pulse-bar {
          width: 8px;
          height: 32px;
          background: var(--accent-color, #3b82f6);
          border-radius: 4px;
          animation: pulse 0.8s ease-in-out infinite;
        }

        .pulse-bar:nth-child(2) { animation-delay: 0.1s; }
        .pulse-bar:nth-child(3) { animation-delay: 0.2s; }

        @keyframes pulse {
          0%, 100% { transform: scaleY(0.5); opacity: 0.5; }
          50% { transform: scaleY(1); opacity: 1; }
        }

        .loading-state p {
          color: var(--text-secondary, #888);
          font-size: 13px;
        }

        .trends-container {
          display: flex;
          flex-direction: column;
          gap: 20px;
        }

        .platform-section {
          background: var(--bg-secondary, #252525);
          border-radius: 8px;
          overflow: hidden;
        }

        .platform-header {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 12px 16px;
          background: var(--bg-tertiary, #2a2a2a);
          border-bottom: 1px solid var(--border-color, #333);
        }

        .platform-icon {
          font-size: 14px;
        }

        .platform-name {
          font-weight: 500;
          color: var(--text-primary, #fff);
          font-size: 13px;
        }

        .last-updated {
          margin-left: auto;
          font-size: 11px;
          color: var(--text-muted, #666);
        }

        .trends-list {
          padding: 8px 0;
        }

        .trend-item {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 10px 16px;
          cursor: pointer;
          transition: background 0.2s;
        }

        .trend-item:hover {
          background: var(--bg-hover, #303030);
        }

        .trend-rank {
          width: 24px;
          height: 24px;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 50%;
          background: var(--bg-tertiary, #2a2a2a);
          color: var(--text-secondary, #888);
          font-size: 11px;
          font-weight: 500;
        }

        .trend-item:nth-child(-n+3) .trend-rank {
          background: linear-gradient(135deg, #f59e0b, #d97706);
          color: white;
        }

        .trend-content {
          flex: 1;
          min-width: 0;
        }

        .trend-topic {
          display: block;
          font-size: 13px;
          color: var(--text-primary, #fff);
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .trend-meta {
          display: flex;
          gap: 12px;
          margin-top: 2px;
        }

        .trend-volume {
          font-size: 11px;
          color: var(--text-muted, #666);
        }

        .trend-change {
          font-size: 11px;
        }

        .trend-change.up {
          color: #22c55e;
        }

        .trend-change.down {
          color: #ef4444;
        }

        .generate-btn {
          width: 28px;
          height: 28px;
          border-radius: 6px;
          border: none;
          background: transparent;
          cursor: pointer;
          opacity: 0;
          transition: all 0.2s;
          font-size: 14px;
        }

        .trend-item:hover .generate-btn {
          opacity: 1;
        }

        .generate-btn:hover {
          background: var(--accent-color, #3b82f6);
        }

        .quick-actions {
          margin-top: 16px;
          padding-top: 16px;
          border-top: 1px solid var(--border-color, #333);
        }

        .action-btn {
          width: 100%;
          padding: 12px;
          border-radius: 8px;
          border: none;
          font-size: 13px;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.2s;
        }

        .action-btn.primary {
          background: linear-gradient(135deg, var(--accent-color, #3b82f6), #8b5cf6);
          color: white;
        }

        .action-btn.primary:hover {
          transform: translateY(-1px);
          box-shadow: 0 4px 12px rgba(59, 130, 246, 0.3);
        }
      `}</style>
    </div>
  );
};

export default TrendDashboard;
