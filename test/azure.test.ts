import assert from "node:assert/strict";
import { test } from "node:test";
import { normalizeAzure } from "../src/sources/azure/normalize";

test("git.push: branch and commit count (computed title)", () => {
  const e = normalizeAzure("git.push", {
    resource: {
      refUpdates: [{ name: "refs/heads/main" }],
      commits: [{}, {}],
      repository: { name: "app", remoteUrl: "http://az/app" },
      pushedBy: { displayName: "Me" },
    },
  });
  assert.equal(e?.category, "push");
  assert.equal(e?.branch, "main");
  assert.equal(e?.repo.fullName, "app");
  assert.match(e!.title, /2 commit/);
});

test("git.pullrequest.created → opened", () => {
  const e = normalizeAzure("git.pullrequest.created", {
    resource: {
      pullRequestId: 5, title: "Feature", targetRefName: "refs/heads/main",
      status: "active", createdBy: { displayName: "Me" }, repository: { name: "app" },
      _links: { web: { href: "http://az/pr/5" } },
    },
  });
  assert.equal(e?.action, "opened");
  assert.equal(e?.branch, "main");
  assert.equal(e?.url, "http://az/pr/5");
});

test("git.pullrequest.updated with completed status → merged", () => {
  const e = normalizeAzure("git.pullrequest.updated", {
    resource: { pullRequestId: 5, title: "Feature", status: "completed", repository: { name: "app" } },
  });
  assert.equal(e?.action, "merged");
});

test("build.complete failed → workflow, high severity", () => {
  const e = normalizeAzure("build.complete", {
    resource: { result: "failed", definition: { name: "CI" }, _links: { web: { href: "u" } } },
  });
  assert.equal(e?.category, "workflow");
  assert.equal(e?.severity, "high");
});

test("workitem.created → issue with title from fields", () => {
  const e = normalizeAzure("workitem.created", {
    resource: { id: 42, fields: { "System.Title": "Bug" }, _links: { html: { href: "u" } } },
  });
  assert.equal(e?.category, "issue");
  assert.match(e!.title, /Bug/);
});

test("uses message.text as the title when present", () => {
  const e = normalizeAzure("git.push", {
    message: { text: "Me pushed 3 commits to app" },
    resource: { refUpdates: [{ name: "refs/heads/dev" }], commits: [{}], repository: { name: "app" } },
  });
  assert.equal(e?.title, "Me pushed 3 commits to app");
});

test("unknown event returns null", () => {
  assert.equal(normalizeAzure("ms.vss-code.something", {}), null);
});
