import assert from "node:assert/strict";
import { test } from "node:test";
import { normalizeGitHub } from "../src/sources/github/normalize";

const repo = { full_name: "me/repo", html_url: "http://x" };
const sender = { login: "me", html_url: "http://x/me" };

test("push: counts commits and strips the ref prefix", () => {
  const e = normalizeGitHub("push", {
    ref: "refs/heads/main",
    compare: "http://x/c",
    commits: [{}, {}, {}],
    repository: repo,
    sender,
  });
  assert.equal(e?.category, "push");
  assert.equal(e?.branch, "main");
  assert.match(e!.title, /3 commit/);
});

test("pull_request closed+merged normalizes action to 'merged'", () => {
  const e = normalizeGitHub("pull_request", {
    action: "closed",
    pull_request: {
      number: 7, title: "x", merged: true, html_url: "u", base: { ref: "main" }, labels: [],
    },
    repository: repo,
    sender,
  });
  assert.equal(e?.category, "pull_request");
  assert.equal(e?.action, "merged");
});

test("pull_request opened stays 'opened' and keeps the base branch", () => {
  const e = normalizeGitHub("pull_request", {
    action: "opened",
    pull_request: {
      number: 7, title: "x", merged: false, html_url: "u", base: { ref: "dev" }, labels: [],
    },
    repository: repo,
    sender,
  });
  assert.equal(e?.action, "opened");
  assert.equal(e?.branch, "dev");
});

test("dependabot_alert coerces 'moderate' severity to 'medium'", () => {
  const e = normalizeGitHub("dependabot_alert", {
    action: "created",
    alert: { html_url: "u", security_advisory: { summary: "s", severity: "moderate" } },
    repository: repo,
    sender,
  });
  assert.equal(e?.category, "security");
  assert.equal(e?.severity, "medium");
});

test("workflow_run: failure is high severity; non-completed is ignored", () => {
  const failed = normalizeGitHub("workflow_run", {
    action: "completed",
    workflow_run: { name: "CI", conclusion: "failure", html_url: "u", head_branch: "main" },
    repository: repo,
    sender,
  });
  assert.equal(failed?.severity, "high");

  const running = normalizeGitHub("workflow_run", {
    action: "requested",
    workflow_run: { name: "CI", conclusion: null },
    repository: repo,
    sender,
  });
  assert.equal(running, null);
});

test("unknown event returns null", () => {
  assert.equal(normalizeGitHub("membership", {}), null);
});
