/**
 * Dashboard Components
 *
 * Export all dashboard components for the AI Social Media Agent.
 */

export { AccountHub } from "./AccountHub";
export { TrendDashboard } from "./TrendDashboard";
export { AutopilotControl } from "./AutopilotControl";
export { PostComposer } from "./PostComposer";

// Re-export types from credential store for convenience
export type { SocialAccount, SocialPlatform } from "../../security/credential-store";
