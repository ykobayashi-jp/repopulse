import assert from "node:assert/strict";
import { test } from "node:test";
import type { CanonicalEvent } from "../src/core/events";
import { renderLine } from "../src/sinks/line/render";

function ev(over: Partial<CanonicalEvent> = {}): CanonicalEvent {
  return {
    id: "1",
    source: "github",
    category: "security",
    action: "created",
    title: "Dependabot alert created: lodash",
    url: "http://x/alert/1",
    repo: { fullName: "me/repo", url: "http://x" },
    severity: "high",
    timestamp: "2020-01-01T00:00:00Z",
    raw: {},
    ...over,
  };
}

test("renders a single flex message with altText = title", () => {
  const out = renderLine(ev());
  assert.equal(out.messages.length, 1);
  assert.equal(out.messages[0]?.type, "flex");
  assert.equal(out.messages[0]?.altText, "Dependabot alert created: lodash");
});

test("header shows the uppercased category", () => {
  const bubble = renderLine(ev()).messages[0]?.contents as any;
  assert.equal(bubble.header.contents[0].text, "SECURITY");
});

test("footer button is present only when the event has a url", () => {
  const withUrl = renderLine(ev()).messages[0]?.contents as any;
  assert.ok(withUrl.footer);
  assert.equal(withUrl.footer.contents[0].action.uri, "http://x/alert/1");

  const noUrl = renderLine(ev({ url: undefined })).messages[0]?.contents as any;
  assert.equal(noUrl.footer, undefined);
});
