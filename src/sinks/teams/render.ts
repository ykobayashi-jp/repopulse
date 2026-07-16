import type { CanonicalEvent } from "../../core/events";

/** Category → Adaptive Card named color (not arbitrary hex). */
const HEADER_COLOR: Record<string, string> = {
  push: "accent",
  pull_request: "good",
  review: "accent",
  release: "good",
  issue: "warning",
  discussion: "accent",
  star: "warning",
  fork: "default",
  workflow: "accent",
  deployment: "good",
  security: "attention",
  unknown: "default",
};

/**
 * Build a Teams payload for a Workflows (Power Automate) incoming webhook:
 * a message wrapping an Adaptive Card. (The legacy Office 365 connector /
 * MessageCard format is being retired by Microsoft.)
 */
export function renderTeams(event: CanonicalEvent) {
  const color =
    event.severity === "critical" || event.severity === "high"
      ? "attention"
      : (HEADER_COLOR[event.category] ?? "default");

  const facts: { title: string; value: string }[] = [
    { title: "Repository", value: event.repo.fullName },
  ];
  if (event.actor) facts.push({ title: "By", value: event.actor.login });
  if (event.branch) facts.push({ title: "Branch", value: event.branch });
  if (event.severity) facts.push({ title: "Severity", value: event.severity });
  if (event.labels && event.labels.length) facts.push({ title: "Labels", value: event.labels.join(", ") });

  const card = {
    type: "AdaptiveCard",
    $schema: "http://adaptivecards.io/schemas/adaptive-card.json",
    version: "1.4",
    body: [
      { type: "TextBlock", text: event.category.toUpperCase(), weight: "Bolder", size: "Small", color, spacing: "None" },
      { type: "TextBlock", text: event.title, weight: "Bolder", size: "Medium", wrap: true },
      { type: "FactSet", facts },
    ],
    ...(event.url ? { actions: [{ type: "Action.OpenUrl", title: "Open", url: event.url }] } : {}),
  };

  return {
    type: "message",
    attachments: [{ contentType: "application/vnd.microsoft.card.adaptive", content: card }],
  };
}
