import type { CanonicalEvent } from "../../core/events";

/* eslint-disable @typescript-eslint/no-explicit-any */
type Gl = any;

type Normalized = Omit<CanonicalEvent, "id" | "source" | "timestamp" | "raw">;

function repoOf(p: Gl): CanonicalEvent["repo"] {
  const pr = p.project ?? {};
  return { fullName: pr.path_with_namespace ?? "unknown", url: pr.web_url ?? "" };
}

function actorOf(p: Gl): CanonicalEvent["actor"] {
  if (p.user && (p.user.username || p.user.name)) {
    return { login: p.user.username ?? p.user.name, avatarUrl: p.user.avatar_url };
  }
  if (p.user_username || p.user_name) {
    return { login: p.user_username ?? p.user_name, avatarUrl: p.user_avatar };
  }
  return undefined;
}

/** GitLab MR/issue actions → GitHub-style verbs so filters read the same. */
function normalizeAction(a: string): string {
  switch (a) {
    case "open":
      return "opened";
    case "close":
      return "closed";
    case "reopen":
      return "reopened";
    case "merge":
      return "merged";
    default:
      return a;
  }
}

function labelsOf(p: Gl): string[] {
  return (p.labels ?? []).map((l: Gl) => l.title ?? l.name).filter(Boolean);
}

/**
 * Map a GitLab webhook (object_kind + payload) to the canonical shape.
 * Returns null for kinds we intentionally ignore.
 */
export function normalizeGitLab(objectKind: string, p: Gl): Normalized | null {
  const repo = repoOf(p);
  const actor = actorOf(p);

  switch (objectKind) {
    case "push": {
      const branch = String(p.ref ?? "").replace("refs/heads/", "");
      const n = p.total_commits_count ?? (Array.isArray(p.commits) ? p.commits.length : 0);
      return {
        category: "push",
        action: "pushed",
        title: `${n} commit(s) pushed to ${branch}`,
        url: repo.url,
        repo,
        actor,
        branch,
      };
    }
    case "merge_request": {
      const o = p.object_attributes ?? {};
      const action = normalizeAction(String(o.action ?? ""));
      return {
        category: "pull_request",
        action,
        title: `MR !${o.iid} ${action}: ${o.title ?? ""}`,
        url: o.url,
        repo,
        actor,
        branch: o.target_branch,
        labels: labelsOf(p),
      };
    }
    case "issue": {
      const o = p.object_attributes ?? {};
      const action = normalizeAction(String(o.action ?? ""));
      return {
        category: "issue",
        action,
        title: `Issue #${o.iid} ${action}: ${o.title ?? ""}`,
        url: o.url,
        repo,
        actor,
        labels: labelsOf(p),
      };
    }
    case "release": {
      const action = String(p.action ?? "");
      return {
        category: "release",
        action,
        title: `Release ${p.tag ?? ""} ${action}`,
        url: p.url,
        repo,
        actor,
      };
    }
    case "pipeline": {
      const o = p.object_attributes ?? {};
      const status = String(o.status ?? "");
      return {
        category: "workflow",
        action: status,
        title: `Pipeline ${status} on ${o.ref ?? ""}`,
        url: o.url,
        repo,
        actor,
        branch: o.ref,
        severity: status === "failed" ? "high" : undefined,
      };
    }
    case "deployment": {
      const status = String(p.status ?? "");
      return {
        category: "deployment",
        action: status,
        title: `Deployment ${status} (${p.environment ?? "?"})`,
        url: p.deployable_url,
        repo,
        actor,
        severity: status === "failed" ? "high" : undefined,
      };
    }
    default:
      return null;
  }
}
