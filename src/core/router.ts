import type { CanonicalEvent, EventCategory, Severity } from "./events";

const SEVERITY_ORDER: Record<Severity, number> = {
  low: 1,
  medium: 2,
  high: 3,
  critical: 4,
};

/**
 * A subscription: "when an event matches these filters, deliver it to this
 * sink target". This is the notification-filter feature, declaratively.
 */
export interface Rule {
  sink: string;
  target: Record<string, unknown>;
  sources?: string[];
  categories?: EventCategory[];
  /** full_name glob(s), e.g. "your-org/*". */
  repos?: string[];
  branches?: string[];
  minSeverity?: Severity;
}

export function matchRules(event: CanonicalEvent, rules: Rule[]): Rule[] {
  return rules.filter((r) => ruleMatches(event, r));
}

function ruleMatches(event: CanonicalEvent, r: Rule): boolean {
  if (r.sources && !r.sources.includes(event.source)) return false;
  if (r.categories && !r.categories.includes(event.category)) return false;
  if (r.repos && !r.repos.some((p) => globMatch(p, event.repo.fullName))) return false;
  if (r.branches) {
    if (!event.branch) return false;
    if (!r.branches.some((p) => globMatch(p, event.branch!))) return false;
  }
  if (r.minSeverity) {
    if (!event.severity) return false;
    if (SEVERITY_ORDER[event.severity] < SEVERITY_ORDER[r.minSeverity]) return false;
  }
  return true;
}

function globMatch(pattern: string, value: string): boolean {
  if (pattern === "*") return true;
  const re = new RegExp("^" + pattern.split("*").map(escapeRegex).join(".*") + "$");
  return re.test(value);
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
