import type { CanonicalEvent } from "../../core/events";

/** Category → Slack attachment color (hex string). */
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

export interface SlackRenderOptions {
  mention?: string;
}

/** Escape user text for Slack mrkdwn (leave our own link markup intact). */
function escapeSlack(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/** Build a Slack incoming-webhook payload from a canonical event. */
export function renderSlack(event: CanonicalEvent, opts: SlackRenderOptions = {}) {
  const title = escapeSlack(event.title);
  const titleText = event.url ? `<${event.url}|${title}>` : title;

  const context: string[] = [`*${escapeSlack(event.repo.fullName)}*`];
  if (event.actor) context.push(`by ${escapeSlack(event.actor.login)}`);
  if (event.branch) context.push(`branch \`${escapeSlack(event.branch)}\``);
  if (event.severity) context.push(`severity *${event.severity}*`);
  if (event.labels && event.labels.length) {
    context.push(event.labels.map((l) => `\`${escapeSlack(l)}\``).join(" "));
  }
  context.push(`RepoPulse · ${event.source} · ${event.category}`);

  const blocks = [
    { type: "section", text: { type: "mrkdwn", text: titleText } },
    { type: "context", elements: [{ type: "mrkdwn", text: context.join("  ·  ") }] },
  ];

  return {
    // Top-level text is the notification fallback and where mentions must live.
    text: [opts.mention, event.title].filter(Boolean).join(" "),
    attachments: [{ color: COLORS[event.category] ?? COLORS.unknown, blocks }],
  };
}
