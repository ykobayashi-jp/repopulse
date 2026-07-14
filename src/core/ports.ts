import type { CanonicalEvent } from "./events";

/** Raw inbound HTTP request, framework-agnostic. */
export interface IncomingRequest {
  headers: Record<string, string>;
  rawBody: string;
}

/** A platform that emits events (GitHub, GitLab, Azure DevOps, ...). */
export interface Source {
  readonly id: string;
  /** Verify the request signature. Return false to reject. */
  verify(req: IncomingRequest): boolean;
  /** Convert a verified request into 0+ canonical events. null = ignore. */
  normalize(req: IncomingRequest): CanonicalEvent[] | null;
}

/** A destination that delivers events (Discord, Slack, Teams, LINE, ...). */
export interface Sink {
  readonly id: string;
  deliver(event: CanonicalEvent, target: Record<string, unknown>): Promise<void>;
}
