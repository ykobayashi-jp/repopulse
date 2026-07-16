import assert from "node:assert/strict";
import { test } from "node:test";
import type { CanonicalEvent } from "../src/core/events";
import { renderTeams } from "../src/sinks/teams/render";

function ev(over: Partial<CanonicalEvent> = {}): CanonicalEvent {
  return {
    id: "1",
    source: "github",
    category: "release",
    action: "published",
    title: "Release v1.2.0 published",
    url: "http://x/rel",
    repo: { fullName: "me/repo", url: "http://x" },
    timestamp: "2020-01-01T00:00:00Z",
    raw: {},
    ...over,
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const card = (e: CanonicalEvent) => renderTeams(e).attachments[0]!.content as any;

test("wraps an adaptive card in a Teams message", () => {
  const out = renderTeams(ev());
  assert.equal(out.type, "message");
  assert.equal(out.attachments[0]?.contentType, "application/vnd.microsoft.card.adaptive");
  assert.equal(card(ev()).type, "AdaptiveCard");
});

test("header shows the uppercased category and title", () => {
  const c = card(ev());
  assert.equal(c.body[0].text, "RELEASE");
  assert.equal(c.body[1].text, "Release v1.2.0 published");
});

test("high/critical severity forces the attention color", () => {
  assert.equal(card(ev({ category: "security", severity: "critical" })).body[0].color, "attention");
  assert.equal(card(ev({ category: "release", severity: "high" })).body[0].color, "attention");
});

test("OpenUrl action is present only with a url", () => {
  assert.equal(card(ev()).actions[0].url, "http://x/rel");
  assert.equal(card(ev({ url: undefined })).actions, undefined);
});
