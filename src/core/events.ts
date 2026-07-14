/**
 * The single normalized event shape that every Source produces and every Sink
 * consumes. Adding GitLab/Azure DevOps = a new Source that emits this. Adding
 * Slack/Teams/LINE = a new Sink that renders this. The core never knows about
 * platform-specific payloads.
 */

export type EventCategory =
  | "push"
  | "pull_request"
  | "review"
  | "release"
  | "issue"
  | "discussion"
  | "star"
  | "fork"
  | "workflow"
  | "deployment"
  | "security"
  | "unknown";

export type Severity = "low" | "medium" | "high" | "critical";

export interface Actor {
  login: string;
  url?: string;
  avatarUrl?: string;
}

export interface RepoRef {
  fullName: string;
  url: string;
}

export interface CanonicalEvent {
  /** Stable delivery id (used for dedupe/logging). */
  id: string;
  /** Originating platform: "github" | "gitlab" | "azure" | ... */
  source: string;
  category: EventCategory;
  /** Platform action, already normalized where it matters ("merged", "published"). */
  action: string;
  /** One-line human summary. */
  title: string;
  body?: string;
  /** Link to the thing that happened. */
  url?: string;
  repo: RepoRef;
  actor?: Actor;
  branch?: string;
  labels?: string[];
  severity?: Severity;
  timestamp: string;
  /** Original untouched payload, for debugging / future fields. */
  raw: unknown;
}
