import assert from "node:assert/strict";
import { test } from "node:test";
import { Store, toMatchRule } from "../src/store/db";

function freshStore() {
  return new Store(":memory:");
}

test("create / list / get rules round-trips JSON fields", () => {
  const s = freshStore();
  const created = s.createRule({
    sink: "discord",
    target: { webhookUrl: "http://x" },
    categories: ["release", "security"],
    repos: ["me/*"],
    minSeverity: "high",
    enabled: true,
  });
  assert.ok(created.id > 0);

  const got = s.getRule(created.id);
  assert.equal(got?.sink, "discord");
  assert.deepEqual(got?.categories, ["release", "security"]);
  assert.deepEqual(got?.repos, ["me/*"]);
  assert.equal(got?.minSeverity, "high");
  assert.equal(got?.enabled, true);
  assert.equal(s.countRules(), 1);
});

test("toMatchRule drops db-only fields", () => {
  const s = freshStore();
  const r = s.createRule({ sink: "slack", target: { webhookUrl: "u" }, enabled: true });
  const m = toMatchRule(r);
  assert.deepEqual(Object.keys(m).sort(), ["branches", "categories", "minSeverity", "repos", "sink", "sources", "target"].sort());
  assert.equal((m as unknown as Record<string, unknown>).id, undefined);
});

test("toggle enable and enabled-only listing", () => {
  const s = freshStore();
  const r = s.createRule({ sink: "discord", target: {}, enabled: true });
  assert.equal(s.listEnabledRules().length, 1);
  s.setRuleEnabled(r.id, false);
  assert.equal(s.listEnabledRules().length, 0);
  assert.equal(s.listRules().length, 1);
});

test("update and delete rules", () => {
  const s = freshStore();
  const r = s.createRule({ sink: "discord", target: {}, enabled: true });
  s.updateRule(r.id, { sink: "line", target: { to: "U1" }, enabled: true });
  assert.equal(s.getRule(r.id)?.sink, "line");
  s.deleteRule(r.id);
  assert.equal(s.getRule(r.id), undefined);
});

test("importRules seeds and records deliveries", () => {
  const s = freshStore();
  const n = s.importRules([{ sink: "discord", target: { webhookUrl: "u" } }]);
  assert.equal(n, 1);
  assert.equal(s.countRules(), 1);

  s.recordDelivery({
    eventId: "e1", source: "github", category: "release", action: "published",
    title: "Release v1", repo: "me/repo", sink: "discord", status: "ok",
  });
  s.recordDelivery({
    eventId: "e2", source: "github", category: "push", action: "pushed",
    title: "push", repo: "me/repo", status: "no-match",
  });
  assert.equal(s.countDeliveries(), 2);
  const rows = s.listDeliveries();
  assert.equal(rows[0]?.eventId, "e2"); // newest first
  assert.equal(rows[0]?.sink, undefined);
  assert.equal(rows[1]?.status, "ok");
});
