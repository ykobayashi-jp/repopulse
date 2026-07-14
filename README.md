# RepoPulse

Repository activity → normalized events → routed to your notification channels.
GitHub App based: **install once, cover every repo** — no per-repository webhook setup.

> Status: **Phase 0** — GitHub source + Discord sink, config-file routing.

## Architecture

```
[Source Adapter]          Core                       [Sink Adapter]
GitHub App  ─┐                                        ┌─ Discord   ✅
GitLab      ─┼─►  normalize ─► filter/route ─► render ┼─ Slack     ✅
Azure DevOps─┘   CanonicalEvent      ▲                ├─ Teams     (planned)
                                      │                └─ LINE      ✅
                              rules (subscriptions.yaml)
```

- **Source** (`src/sources/*`): verify signature + map platform payload → `CanonicalEvent`.
- **Core** (`src/core/*`): the `CanonicalEvent` shape, the `Source`/`Sink` ports, and the rule matcher.
- **Sink** (`src/sinks/*`): render a `CanonicalEvent` into a platform message and deliver it.

Adding GitLab/Azure = one new Source. Adding Slack/Teams/LINE = one new Sink. The core never changes.

Supported GitHub events: push, pull_request, review, release, issue, discussion,
star, fork, workflow_run, deployment_status, secret_scanning / dependabot / code_scanning alerts.

## Quick start

```bash
npm install
cp .env.example .env                                  # fill in secrets
cp config/subscriptions.example.yaml config/subscriptions.yaml
npm run dev
```

Then create a **GitHub App** (Settings → Developer settings → GitHub Apps):
- Webhook URL: `https://<your-host>/webhooks/github`
- Webhook secret: same value as `GITHUB_WEBHOOK_SECRET`
- Subscribe to the events you want; install the App on your account/org.

For local testing, expose the port with a tunnel (e.g. `cloudflared` / `ngrok`)
and point the App's webhook URL at it.

## Scripts

- `npm run dev` — watch mode (tsx)
- `npm start` — run once
- `npm test` — unit tests (`node:test`, covers `normalize` + `router`)
- `npm run typecheck` — `tsc --noEmit`

## Roadmap

- Phase 0 ✅ GitHub App + CanonicalEvent + Discord sink
- Phase 1 — richer filters / per-target formatting
- Phase 2 — Slack ✅ / LINE ✅ / Teams sinks
- Phase 3 — GitLab / Azure DevOps sources
- Phase 4 — web dashboard, DB, multi-tenant, OAuth (SaaS)
- Phase 5 — GitHub Marketplace listing & billing
