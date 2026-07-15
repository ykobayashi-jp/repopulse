import assert from "node:assert/strict";
import { test } from "node:test";
import { normalizeGitLab } from "../src/sources/gitlab/normalize";

const project = { path_with_namespace: "me/repo", web_url: "http://gl/me/repo" };
const user = { username: "me", name: "Me", avatar_url: "http://gl/a.png" };

test("push: counts commits and strips the ref prefix", () => {
  const e = normalizeGitLab("push", {
    ref: "refs/heads/main",
    total_commits_count: 4,
    project,
    user_username: "me",
  });
  assert.equal(e?.category, "push");
  assert.equal(e?.branch, "main");
  assert.match(e!.title, /4 commit/);
});

test("merge_request 'merge' action normalizes to 'merged'", () => {
  const e = normalizeGitLab("merge_request", {
    object_attributes: { iid: 9, title: "Feature", action: "merge", url: "u", target_branch: "main" },
    project,
    user,
  });
  assert.equal(e?.category, "pull_request");
  assert.equal(e?.action, "merged");
  assert.equal(e?.branch, "main");
});

test("issue 'open' action normalizes to 'opened' and reads labels", () => {
  const e = normalizeGitLab("issue", {
    object_attributes: { iid: 3, title: "Bug", action: "open", url: "u" },
    labels: [{ title: "bug" }, { title: "p1" }],
    project,
    user,
  });
  assert.equal(e?.category, "issue");
  assert.equal(e?.action, "opened");
  assert.deepEqual(e?.labels, ["bug", "p1"]);
});

test("pipeline failed maps to workflow with high severity", () => {
  const e = normalizeGitLab("pipeline", {
    object_attributes: { status: "failed", ref: "main", url: "u" },
    project,
    user,
  });
  assert.equal(e?.category, "workflow");
  assert.equal(e?.severity, "high");
});

test("release maps to the release category", () => {
  const e = normalizeGitLab("release", {
    action: "create",
    tag: "v2.0.0",
    url: "http://gl/rel",
    project,
  });
  assert.equal(e?.category, "release");
  assert.match(e!.title, /v2\.0\.0/);
});

test("unknown object_kind returns null", () => {
  assert.equal(normalizeGitLab("wiki_page", {}), null);
});
