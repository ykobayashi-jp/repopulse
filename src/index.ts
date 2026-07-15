import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { loadConfig, loadDotenv } from "./config";
import type { CanonicalEvent } from "./core/events";
import type { Sink, Source } from "./core/ports";
import { matchRules } from "./core/router";
import { createDiscordSink } from "./sinks/discord";
import { createLineSink } from "./sinks/line";
import { createSlackSink } from "./sinks/slack";
import { createGitHubSource } from "./sources/github";
import { createGitLabSource } from "./sources/gitlab";
import { Store, toMatchRule } from "./store/db";
import { registerWebRoutes } from "./web/routes";

loadDotenv();
const config = loadConfig();

const store = new Store(config.dbPath);
// First run: import any subscriptions.yaml rules as the initial ruleset.
if (store.countRules() === 0 && config.rules.length > 0) {
  const n = store.importRules(config.rules);
  console.log(`[store] imported ${n} rule(s) from subscriptions.yaml into ${config.dbPath}`);
}

const sources: Record<string, Source> = {
  github: createGitHubSource(config.githubSecret),
  gitlab: createGitLabSource(config.gitlabSecret),
};

const sinks: Record<string, Sink> = {
  discord: createDiscordSink(),
  slack: createSlackSink(),
  line: createLineSink(),
};

const app = new Hono();

app.get("/healthz", (c) => c.text("ok"));

// One webhook endpoint per source: POST /webhooks/<source id>.
for (const [path, source] of Object.entries(sources)) {
  app.post(`/webhooks/${path}`, async (c) => {
    const rawBody = await c.req.text();
    const headers: Record<string, string> = {};
    c.req.raw.headers.forEach((v, k) => (headers[k.toLowerCase()] = v));

    const req = { headers, rawBody };
    if (!source.verify(req)) return c.text("invalid signature", 401);

    const events = source.normalize(req);
    if (events) {
      // Ack fast, deliver asynchronously so bursts don't block the webhook.
      queueMicrotask(() => dispatch(events));
    }
    return c.text("accepted", 202);
  });
}

// Dashboard (server-rendered). Registered last so it owns "/".
registerWebRoutes(app, { store, sinks: Object.keys(sinks), sources: Object.keys(sources) });

async function dispatch(events: CanonicalEvent[]): Promise<void> {
  for (const event of events) {
    const base = {
      eventId: event.id,
      source: event.source,
      category: event.category,
      action: event.action,
      title: event.title,
      repo: event.repo.fullName,
      url: event.url,
    };

    const matched = matchRules(event, store.listEnabledRules().map(toMatchRule));
    if (matched.length === 0) {
      store.recordDelivery({ ...base, status: "no-match" });
      continue;
    }

    await Promise.allSettled(
      matched.map(async (rule) => {
        const sink = sinks[rule.sink];
        if (!sink) {
          console.warn(`[dispatch] unknown sink: ${rule.sink}`);
          store.recordDelivery({ ...base, sink: rule.sink, status: "failed", error: "unknown sink" });
          return;
        }
        try {
          await sink.deliver(event, rule.target);
          store.recordDelivery({ ...base, sink: sink.id, status: "ok" });
        } catch (e) {
          const msg = (e as Error).message;
          console.error(`[dispatch] ${sink.id} failed for ${event.id}:`, msg);
          store.recordDelivery({ ...base, sink: sink.id, status: "failed", error: msg });
        }
      }),
    );
  }
}

serve({ fetch: app.fetch, port: config.port }, (info) => {
  console.log(`RepoPulse listening on http://localhost:${info.port}`);
  console.log(`  Dashboard:  http://localhost:${info.port}/`);
  for (const path of Object.keys(sources)) {
    console.log(`  ${path} webhook: POST /webhooks/${path}`);
  }
  console.log(`  ${store.countRules()} rule(s) in ${config.dbPath}`);
});
