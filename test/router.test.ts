import assert from "node:assert/strict";
import { test } from "node:test";
import type { CanonicalEvent } from "../src/core/events";
import { matchRules, type Rule } from "../src/core/router";

function ev(over: Partial<CanonicalEvent> = {}): CanonicalEvent {
  return {
    id: "1",
    source: "github",
    category: "pull_request",
    action: "opened",
    title: "t",
    repo: { fullName: "org/app", url: "u" },
    timestamp: "2020-01-01T00:00:00Z",
    raw: {},
    ...over,
  };
}

const target = { webhookUrl: "u" };

test("an empty rule matches everything", () => {
  const rules: Rule[] = [{ sink: "discord", target }];
  assert.equal(matchRules(ev(), rules).length, 1);
});

test("category filter", () => {
  const rules: Rule[] = [{ sink: "discord", target, categories: ["release"] }];
  assert.equal(matchRules(ev({ category: "pull_request" }), rules).length, 0);
  assert.equal(matchRules(ev({ category: "release" }), rules).length, 1);
});

test("repo glob", () => {
  const rules: Rule[] = [{ sink: "discord", target, repos: ["org/*"] }];
  assert.equal(matchRules(ev({ repo: { fullName: "org/app", url: "u" } }), rules).length, 1);
  assert.equal(matchRules(ev({ repo: { fullName: "other/app", url: "u" } }), rules).length, 0);
});

test("branch filter requires a branch on the event", () => {
  const rules: Rule[] = [{ sink: "discord", target, branches: ["main"] }];
  assert.equal(matchRules(ev({ branch: "main" }), rules).length, 1);
  assert.equal(matchRules(ev({ branch: "dev" }), rules).length, 0);
  assert.equal(matchRules(ev({ branch: undefined }), rules).length, 0);
});

test("minSeverity gates by threshold and requires a severity", () => {
  const rules: Rule[] = [{ sink: "discord", target, minSeverity: "high" }];
  assert.equal(matchRules(ev({ severity: "critical" }), rules).length, 1);
  assert.equal(matchRules(ev({ severity: "high" }), rules).length, 1);
  assert.equal(matchRules(ev({ severity: "medium" }), rules).length, 0);
  assert.equal(matchRules(ev({ severity: undefined }), rules).length, 0);
});
