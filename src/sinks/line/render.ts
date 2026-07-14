import type { CanonicalEvent } from "../../core/events";

/** Category → LINE Flex header color (hex string). */
const COLORS: Record<string, string> = {
  push: "#5865f2",
  pull_request: "#2ecc71",
  review: "#9b59b6",
  release: "#f1c40f",
  issue: "#e67e22",
  discussion: "#1abc9c",
  star: "#f1c40f",
  fork: "#95a5a6",
  workflow: "#3498db",
  deployment: "#2ecc71",
  security: "#e74c3c",
  unknown: "#95a5a6",
};

function kv(label: string, value: string) {
  return {
    type: "box",
    layout: "baseline",
    spacing: "sm",
    contents: [
      { type: "text", text: label, color: "#8c8c8c", size: "sm", flex: 2 },
      { type: "text", text: value, wrap: true, size: "sm", flex: 5 },
    ],
  };
}

/** Build a LINE Messaging API push body (Flex bubble) from a canonical event. */
export function renderLine(event: CanonicalEvent) {
  const color = COLORS[event.category] ?? COLORS.unknown;

  const rows: unknown[] = [kv("Repo", event.repo.fullName)];
  if (event.actor) rows.push(kv("By", event.actor.login));
  if (event.branch) rows.push(kv("Branch", event.branch));
  if (event.severity) rows.push(kv("Severity", event.severity));
  if (event.labels && event.labels.length) rows.push(kv("Labels", event.labels.join(", ")));

  const bubble: Record<string, unknown> = {
    type: "bubble",
    header: {
      type: "box",
      layout: "vertical",
      backgroundColor: color,
      paddingAll: "12px",
      contents: [
        { type: "text", text: event.category.toUpperCase(), color: "#ffffff", weight: "bold", size: "sm" },
      ],
    },
    body: {
      type: "box",
      layout: "vertical",
      spacing: "md",
      contents: [
        { type: "text", text: event.title, weight: "bold", wrap: true, size: "md" },
        { type: "box", layout: "vertical", spacing: "sm", contents: rows },
      ],
    },
  };

  if (event.url) {
    bubble.footer = {
      type: "box",
      layout: "vertical",
      contents: [
        {
          type: "button",
          style: "link",
          height: "sm",
          action: { type: "uri", label: "Open", uri: event.url },
        },
      ],
    };
  }

  // altText is what shows in notifications / non-Flex clients (max 400 chars).
  return {
    messages: [{ type: "flex", altText: event.title.slice(0, 400), contents: bubble }],
  };
}
