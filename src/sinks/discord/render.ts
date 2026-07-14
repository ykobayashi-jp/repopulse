import type { CanonicalEvent } from "../../core/events";

const COLORS: Record<string, number> = {
  push: 0x5865f2,
  pull_request: 0x2ecc71,
  review: 0x9b59b6,
  release: 0xf1c40f,
  issue: 0xe67e22,
  discussion: 0x1abc9c,
  star: 0xf1c40f,
  fork: 0x95a5a6,
  workflow: 0x3498db,
  deployment: 0x2ecc71,
  security: 0xe74c3c,
  unknown: 0x95a5a6,
};

export interface DiscordRenderOptions {
  mention?: string;
}

/** Build a Discord webhook payload (embed) from a canonical event. */
export function renderDiscord(event: CanonicalEvent, opts: DiscordRenderOptions = {}) {
  const fields = [
    { name: "Repository", value: `[${event.repo.fullName}](${event.repo.url})`, inline: true },
    ...(event.branch ? [{ name: "Branch", value: event.branch, inline: true }] : []),
    ...(event.severity ? [{ name: "Severity", value: event.severity, inline: true }] : []),
    ...(event.labels && event.labels.length
      ? [{ name: "Labels", value: event.labels.join(", ").slice(0, 1024), inline: false }]
      : []),
  ];

  const embed = {
    title: event.title.slice(0, 256),
    url: event.url || undefined,
    description: event.body ? event.body.slice(0, 4000) : undefined,
    color: COLORS[event.category] ?? COLORS.unknown,
    author: event.actor
      ? { name: event.actor.login, url: event.actor.url, icon_url: event.actor.avatarUrl }
      : undefined,
    fields,
    timestamp: event.timestamp,
    footer: { text: `RepoPulse · ${event.source} · ${event.category}` },
  };

  return {
    content: opts.mention || undefined,
    embeds: [embed],
    allowed_mentions: { parse: ["roles", "users", "everyone"] as const },
  };
}
