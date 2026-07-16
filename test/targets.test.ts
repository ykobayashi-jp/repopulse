import assert from "node:assert/strict";
import { test } from "node:test";
import { buildSinkTarget } from "../src/sinks/targets";

const from = (obj: Record<string, string>) => (key: string) => obj[key];

test("discord: keeps required + present optional, omits empty optional", () => {
  const t = buildSinkTarget("discord", from({ webhookUrl: "http://x", mention: "<@1>", threadId: "" }));
  assert.deepEqual(t, { webhookUrl: "http://x", mention: "<@1>" });
});

test("line: requires token and destination", () => {
  const t = buildSinkTarget("line", from({ channelAccessToken: "tok", to: "U1" }));
  assert.deepEqual(t, { channelAccessToken: "tok", to: "U1" });
});

test("missing required field throws", () => {
  assert.throws(() => buildSinkTarget("discord", from({ webhookUrl: "" })), /Webhook URL/);
  assert.throws(() => buildSinkTarget("line", from({ channelAccessToken: "tok" })), /Destination/);
});

test("values are trimmed", () => {
  const t = buildSinkTarget("slack", from({ webhookUrl: "  http://x  " }));
  assert.deepEqual(t, { webhookUrl: "http://x" });
});

test("unknown sink returns null (caller falls back to raw JSON)", () => {
  assert.equal(buildSinkTarget("teams", from({})), null);
});
