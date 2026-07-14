import type { CanonicalEvent, Severity } from "../../core/events";

/* eslint-disable @typescript-eslint/no-explicit-any */
type Gh = any;

/** Fields the normalizer fills; id/source/timestamp/raw are added by the Source. */
type Normalized = Omit<CanonicalEvent, "id" | "source" | "timestamp" | "raw">;

function actorOf(p: Gh): CanonicalEvent["actor"] {
  const s = p.sender;
  return s ? { login: s.login, url: s.html_url, avatarUrl: s.avatar_url } : undefined;
}

function repoOf(p: Gh): CanonicalEvent["repo"] {
  const r = p.repository;
  return r
    ? { fullName: r.full_name, url: r.html_url }
    : { fullName: "unknown", url: "" };
}

function coerceSeverity(v: unknown): Severity | undefined {
  switch (String(v ?? "").toLowerCase()) {
    case "low":
      return "low";
    case "moderate":
    case "medium":
      return "medium";
    case "high":
      return "high";
    case "critical":
      return "critical";
    default:
      return undefined;
  }
}

/**
 * Map a GitHub webhook (X-GitHub-Event name + payload) to the canonical shape.
 * Returns null for events/actions we intentionally ignore.
 */
export function normalizeGitHub(event: string, p: Gh): Normalized | null {
  const repo = repoOf(p);
  const actor = actorOf(p);

  switch (event) {
    case "push": {
      const branch = String(p.ref ?? "").replace("refs/heads/", "");
      const n = Array.isArray(p.commits) ? p.commits.length : 0;
      return {
        category: "push",
        action: "pushed",
        title: `${n} commit(s) pushed to ${branch}`,
        url: p.compare,
        repo,
        actor,
        branch,
      };
    }
    case "pull_request": {
      const pr = p.pull_request ?? {};
      const merged = p.action === "closed" && pr.merged;
      const action = merged ? "merged" : String(p.action);
      return {
        category: "pull_request",
        action,
        title: `PR #${pr.number} ${action}: ${pr.title ?? ""}`,
        url: pr.html_url,
        repo,
        actor,
        branch: pr.base?.ref,
        labels: (pr.labels ?? []).map((l: Gh) => l.name),
      };
    }
    case "pull_request_review": {
      const pr = p.pull_request ?? {};
      const review = p.review ?? {};
      return {
        category: "review",
        action: String(review.state ?? p.action),
        title: `Review ${review.state ?? p.action} on PR #${pr.number}`,
        url: review.html_url,
        repo,
        actor,
      };
    }
    case "release": {
      const r = p.release ?? {};
      return {
        category: "release",
        action: String(p.action),
        title: `Release ${r.tag_name ?? ""} ${p.action}`,
        url: r.html_url,
        repo,
        actor,
      };
    }
    case "issues": {
      const i = p.issue ?? {};
      return {
        category: "issue",
        action: String(p.action),
        title: `Issue #${i.number} ${p.action}: ${i.title ?? ""}`,
        url: i.html_url,
        repo,
        actor,
        labels: (i.labels ?? []).map((l: Gh) => l.name ?? l),
      };
    }
    case "discussion": {
      const d = p.discussion ?? {};
      return {
        category: "discussion",
        action: String(p.action),
        title: `Discussion ${p.action}: ${d.title ?? ""}`,
        url: d.html_url,
        repo,
        actor,
      };
    }
    case "star": {
      return {
        category: "star",
        action: String(p.action),
        title: `Repository ${p.action === "created" ? "starred" : "unstarred"}`,
        url: repo.url,
        repo,
        actor,
      };
    }
    case "fork": {
      const f = p.forkee ?? {};
      return {
        category: "fork",
        action: "created",
        title: `Forked to ${f.full_name ?? ""}`,
        url: f.html_url,
        repo,
        actor,
      };
    }
    case "workflow_run": {
      const w = p.workflow_run ?? {};
      if (p.action !== "completed") return null;
      return {
        category: "workflow",
        action: String(w.conclusion ?? "completed"),
        title: `Workflow "${w.name}" ${w.conclusion}`,
        url: w.html_url,
        repo,
        actor,
        branch: w.head_branch,
        severity: w.conclusion === "failure" ? "high" : undefined,
      };
    }
    case "deployment_status": {
      const d = p.deployment_status ?? {};
      return {
        category: "deployment",
        action: String(d.state),
        title: `Deployment ${d.state} (${p.deployment?.environment ?? "?"})`,
        url: d.target_url ?? d.log_url,
        repo,
        actor,
      };
    }
    case "secret_scanning_alert": {
      return {
        category: "security",
        action: String(p.action),
        title: `Secret scanning alert ${p.action}`,
        url: p.alert?.html_url,
        repo,
        actor,
        severity: "critical",
      };
    }
    case "dependabot_alert": {
      const adv = p.alert?.security_advisory ?? {};
      return {
        category: "security",
        action: String(p.action),
        title: `Dependabot alert ${p.action}: ${adv.summary ?? ""}`,
        url: p.alert?.html_url,
        repo,
        actor,
        severity: coerceSeverity(adv.severity) ?? "medium",
      };
    }
    case "code_scanning_alert": {
      return {
        category: "security",
        action: String(p.action),
        title: `Code scanning alert ${p.action}: ${p.alert?.rule?.description ?? ""}`,
        url: p.alert?.html_url,
        repo,
        actor,
        severity: coerceSeverity(p.alert?.rule?.security_severity_level) ?? "medium",
      };
    }
    default:
      return null;
  }
}
