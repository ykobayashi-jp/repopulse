import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { loadConfig, loadDotenv } from "./config";
import type { Sink } from "./core/ports";
import { matchRules } from "./core/router";
import { createDiscordSink } from "./sinks/discord";
import { createSlackSink } from "./sinks/slack";
import { createGitHubSource } from "./sources/github";

loadDotenv();
const config = loadConfig();

const github = createGitHubSource(config.githubSecret);
const sinks: Record<string, Sink> = {
  discord: createDiscordSink(),
  slack: createSlackSink(),
};

const app = new Hono();

app.get("/", (c) =>
  c.json({ name: "RepoPulse", status: "ok", rules: config.rules.length }),
);
app.get("/healthz", (c) => c.text("ok"));

app.post("/webhooks/github", async (c) => {
  const rawBody = await c.req.text();
  const headers: Record<string, string> = {};
  c.req.raw.headers.forEach((v, k) => (headers[k.toLowerCase()] = v));

  const req = { headers, rawBody };
  if (!github.verify(req)) return c.text("invalid signature", 401);

  const events = github.normalize(req);
  if (events) {
    // Ack fast, deliver asynchronously so bursts don't block the webhook.
    queueMicrotask(() => dispatch(events));
  }
  return c.text("accepted", 202);
});

async function dispatch(events: import("./core/events").CanonicalEvent[]): Promise<void> {
  for (const event of events) {
    const matched = matchRules(event, config.rules);
    await Promise.allSettled(
      matched.map(async (rule) => {
        const sink = sinks[rule.sink];
        if (!sink) {
          console.warn(`[dispatch] unknown sink: ${rule.sink}`);
          return;
        }
        try {
          await sink.deliver(event, rule.target);
        } catch (e) {
          console.error(`[dispatch] ${sink.id} failed for ${event.id}:`, (e as Error).message);
        }
      }),
    );
  }
}

serve({ fetch: app.fetch, port: config.port }, (info) => {
  console.log(`RepoPulse listening on http://localhost:${info.port}`);
  console.log(`  GitHub webhook: POST /webhooks/github`);
  console.log(`  Loaded ${config.rules.length} routing rule(s)`);
});
