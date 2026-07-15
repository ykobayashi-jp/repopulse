# RepoPulse

Repository activity → normalized events → routed to your notification channels.
GitHub App based: **install once, cover every repo** — no per-repository webhook setup.

> Status: **Phase 0** — GitHub source + Discord sink, config-file routing.

## Architecture

```
[Source Adapter]          Core                       [Sink Adapter]
GitHub App  ✅ ─┐                                     ┌─ Discord   ✅
GitLab      ✅ ─┼─► normalize ─► filter/route ─► render┼─ Slack     ✅
Azure DevOps ─┘    CanonicalEvent      ▲              ├─ Teams     (planned)
                                        │              └─ LINE      ✅
                               rules (subscriptions.yaml)
```

- **Source** (`src/sources/*`): verify signature + map platform payload → `CanonicalEvent`.
- **Core** (`src/core/*`): the `CanonicalEvent` shape, the `Source`/`Sink` ports, and the rule matcher.
- **Sink** (`src/sinks/*`): render a `CanonicalEvent` into a platform message and deliver it.
- **Store** (`src/store/*`): SQLite (`node:sqlite`, no native build) holding rules and delivery history.
- **Web** (`src/web/*`): server-rendered dashboard to view/edit rules and inspect deliveries.

Adding GitLab/Azure = one new Source. Adding Slack/Teams/LINE = one new Sink. The core never changes.
Each source gets its own endpoint: `POST /webhooks/github`, `POST /webhooks/gitlab`.

Supported GitHub events: push, pull_request, review, release, issue, discussion,
star, fork, workflow_run, deployment_status, secret_scanning / dependabot / code_scanning alerts.
Supported GitLab events: push, merge_request, issue, release, pipeline, deployment
(MR/issue actions are mapped to GitHub-style verbs so filters read the same).

## Quick start

```bash
npm install
cp .env.example .env                                  # fill in secrets
cp config/subscriptions.example.yaml config/subscriptions.yaml   # optional: seeds rules on first run
npm run dev
```

Open the **dashboard** at `http://localhost:3000/` to add/edit routing rules and inspect
delivery history. Rules live in SQLite (`DB_PATH`, default `data/repopulse.db`); on first run
any `subscriptions.yaml` rules are imported as the initial set.

### Dashboard auth

The dashboard supports **GitHub login** via your GitHub App's OAuth credentials. Set
`GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET`, `SESSION_SECRET`, `BASE_URL`, and
`GITHUB_ALLOWED_LOGINS`, and add `<BASE_URL>/auth/callback` as a callback URL in the App
settings. When all three secrets are set, every dashboard route requires a signed-cookie
session and an allow-listed login; webhooks stay open (they are signature-verified).

If those secrets are **unset**, auth is disabled and the dashboard runs **open** — intended
for localhost development only. (Per-tenant data isolation is a later phase; today all data is
shared across whoever can log in.)

Then create a **GitHub App** (Settings → Developer settings → GitHub Apps):
- Webhook URL: `https://<your-host>/webhooks/github`
- Webhook secret: same value as `GITHUB_WEBHOOK_SECRET`
- Subscribe to the events you want; install the App on your account/org.

For local testing, expose the port with a tunnel (e.g. `cloudflared` / `ngrok`)
and point the App's webhook URL at it.

## Scripts

- `npm run dev` — watch mode (tsx)
- `npm start` — run once
- `npm test` — unit tests (`node:test`, covers normalize, router, and store)
- `npm run typecheck` — `tsc --noEmit`

## Roadmap

- Phase 0 ✅ GitHub App + CanonicalEvent + Discord sink
- Phase 1 — richer filters / per-target formatting
- Phase 2 — Slack ✅ / LINE ✅ / Teams sinks
- Phase 3 — GitLab ✅ / Azure DevOps sources
- Phase 4 — web dashboard ✅ + SQLite ✅ + GitHub login gate ✅ · multi-tenant isolation (next)
- Phase 5 — GitHub Marketplace listing & billing
