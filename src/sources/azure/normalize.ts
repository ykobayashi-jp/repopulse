import type { CanonicalEvent } from "../../core/events";

/* eslint-disable @typescript-eslint/no-explicit-any */
type Az = any;

type Normalized = Omit<CanonicalEvent, "id" | "source" | "timestamp" | "raw">;

function repoOf(r: Az): CanonicalEvent["repo"] {
  const repo = r?.repository;
  if (repo) return { fullName: repo.name ?? "azure", url: repo.remoteUrl ?? repo.url ?? "" };
  return { fullName: "azure", url: "" };
}

function actorOf(r: Az): CanonicalEvent["actor"] {
  const who = r?.pushedBy ?? r?.createdBy ?? r?.requestedFor ?? r?.author;
  return who?.displayName ? { login: who.displayName } : undefined;
}

const stripRef = (s: unknown) => String(s ?? "").replace(/^refs\/heads\//, "");

/**
 * Map an Azure DevOps Service Hook (payload.eventType + resource) to the
 * canonical shape. Azure includes a human summary in `message.text`, which we
 * use as a robust title fallback. Returns null for events we ignore.
 */
export function normalizeAzure(eventType: string, p: Az): Normalized | null {
  const r = p?.resource ?? {};
  const repo = repoOf(r);
  const actor = actorOf(r);
  const summary = p?.message?.text as string | undefined;

  switch (eventType) {
    case "git.push": {
      const branch = stripRef(r.refUpdates?.[0]?.name);
      const n = Array.isArray(r.commits) ? r.commits.length : 0;
      return {
        category: "push",
        action: "pushed",
        title: summary ?? `${n} commit(s) pushed to ${branch}`,
        url: repo.url,
        repo,
        actor,
        branch,
      };
    }
    case "git.pullrequest.created":
    case "git.pullrequest.updated":
    case "git.pullrequest.merged": {
      const suffix = eventType.split(".").pop();
      const completed = r.status === "completed";
      const action =
        suffix === "created" ? "opened" : suffix === "merged" || completed ? "merged" : "updated";
      return {
        category: "pull_request",
        action,
        title: summary ?? `PR ${r.pullRequestId} ${action}: ${r.title ?? ""}`,
        url: r._links?.web?.href ?? repo.url,
        repo,
        actor,
        branch: stripRef(r.targetRefName),
      };
    }
    case "build.complete": {
      const result = String(r.result ?? r.status ?? "");
      return {
        category: "workflow",
        action: result,
        title: summary ?? `Build ${r.definition?.name ?? ""} ${result}`,
        url: r._links?.web?.href,
        repo,
        actor,
        severity: result === "failed" ? "high" : undefined,
      };
    }
    case "ms.vss-release.deployment-completed-event":
    case "ms.vss-release.deployment-completed": {
      const status = String(r.deployment?.deploymentStatus ?? r.status ?? "");
      return {
        category: "deployment",
        action: status,
        title: summary ?? `Deployment ${status}`,
        url: r._links?.web?.href,
        repo,
        actor,
        severity: status === "failed" ? "high" : undefined,
      };
    }
    case "workitem.created":
    case "workitem.updated": {
      const action = eventType.split(".").pop();
      const fields = r.fields ?? r.revision?.fields ?? {};
      const title = fields["System.Title"] ?? r.id;
      return {
        category: "issue",
        action: String(action),
        title: summary ?? `Work item ${r.id} ${action}: ${title}`,
        url: r._links?.html?.href ?? r._links?.web?.href,
        repo,
        actor,
      };
    }
    default:
      return null;
  }
}
