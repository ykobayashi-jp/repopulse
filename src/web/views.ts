import { html, raw } from "hono/html";
import type { HtmlEscapedString } from "hono/utils/html";
import type { DeliveryRow, StoredRule } from "../store/db";

let authEnabled = false;
export function setAuthEnabled(v: boolean): void {
  authEnabled = v;
}

const STYLE = `
  :root { color-scheme: light dark; --bg:#fff; --fg:#1a1a1a; --muted:#6b7280; --line:#e5e7eb; --card:#fafafa; --accent:#2563eb; }
  @media (prefers-color-scheme: dark) {
    :root { --bg:#0d1117; --fg:#e6edf3; --muted:#8b949e; --line:#30363d; --card:#161b22; --accent:#4c8dff; }
  }
  * { box-sizing: border-box; }
  body { margin:0; font:15px/1.5 system-ui,-apple-system,Segoe UI,sans-serif; background:var(--bg); color:var(--fg); }
  header { border-bottom:1px solid var(--line); padding:14px 24px; display:flex; align-items:center; gap:16px; }
  header h1 { font-size:17px; margin:0; }
  header nav a { color:var(--muted); text-decoration:none; margin-right:14px; }
  header nav a:hover { color:var(--fg); }
  main { max-width:1000px; margin:0 auto; padding:24px; }
  h2 { font-size:15px; text-transform:uppercase; letter-spacing:.04em; color:var(--muted); margin:28px 0 10px; }
  .stats { display:flex; gap:14px; flex-wrap:wrap; }
  .stat { background:var(--card); border:1px solid var(--line); border-radius:10px; padding:14px 18px; min-width:120px; }
  .stat b { font-size:26px; display:block; }
  .stat span { color:var(--muted); font-size:13px; }
  table { width:100%; border-collapse:collapse; font-size:14px; }
  th,td { text-align:left; padding:8px 10px; border-bottom:1px solid var(--line); vertical-align:top; }
  th { color:var(--muted); font-weight:600; font-size:12px; text-transform:uppercase; }
  .tag { display:inline-block; padding:1px 7px; border-radius:20px; border:1px solid var(--line); font-size:12px; color:var(--muted); }
  .ok { color:#16a34a; } .failed { color:#dc2626; } .nomatch { color:var(--muted); }
  a.btn, button.btn { display:inline-block; font:inherit; font-size:13px; padding:5px 11px; border-radius:7px;
    border:1px solid var(--line); background:var(--card); color:var(--fg); cursor:pointer; text-decoration:none; }
  a.btn.primary, button.btn.primary { background:var(--accent); color:#fff; border-color:var(--accent); }
  form.inline { display:inline; }
  .muted { color:var(--muted); }
  label { display:block; margin:14px 0 4px; font-size:13px; color:var(--muted); }
  input,select,textarea { width:100%; font:inherit; padding:8px 10px; border:1px solid var(--line);
    border-radius:7px; background:var(--bg); color:var(--fg); }
  textarea { min-height:88px; font-family:ui-monospace,monospace; font-size:13px; }
  .row { display:flex; gap:16px; flex-wrap:wrap; } .row > div { flex:1; min-width:180px; }
  .err { background:#fee2e2; color:#991b1b; padding:10px 14px; border-radius:8px; margin:12px 0; font-size:14px; }
  .code { font-family:ui-monospace,monospace; font-size:12px; color:var(--muted); }
`;

function layout(title: string, body: HtmlEscapedString | Promise<HtmlEscapedString>) {
  return html`<!doctype html>
    <html lang="en">
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>${title} · RepoPulse</title>
        <style>
          ${raw(STYLE)}
        </style>
      </head>
      <body>
        <header>
          <h1>📡 RepoPulse</h1>
          <nav>
            <a href="/">Dashboard</a>
            <a href="/rules">Rules</a>
            <a href="/deliveries">Deliveries</a>
          </nav>
          ${authEnabled ? html`<a href="/logout" style="margin-left:auto;color:var(--muted)">Logout</a>` : ""}
        </header>
        <main>${body}</main>
      </body>
    </html>`;
}

const list = (v?: string[]) => (v && v.length ? v.join(", ") : "—");

function statusClass(s: DeliveryRow["status"]) {
  return s === "ok" ? "ok" : s === "failed" ? "failed" : "nomatch";
}

export function dashboardPage(stats: { rules: number; enabled: number; deliveries: number }, recent: DeliveryRow[]) {
  return layout(
    "Dashboard",
    html`
      <div class="stats">
        <div class="stat"><b>${stats.enabled}</b><span>enabled rules</span></div>
        <div class="stat"><b>${stats.rules}</b><span>total rules</span></div>
        <div class="stat"><b>${stats.deliveries}</b><span>deliveries logged</span></div>
      </div>
      <h2>Recent deliveries</h2>
      ${deliveriesTable(recent)}
      <p style="margin-top:18px"><a class="btn primary" href="/rules">Manage rules</a></p>
    `,
  );
}

export function deliveriesPage(rows: DeliveryRow[]) {
  return layout("Deliveries", html`<h2>Delivery history</h2>${deliveriesTable(rows)}`);
}

function deliveriesTable(rows: DeliveryRow[]) {
  if (!rows.length) return html`<p class="muted">No deliveries yet.</p>`;
  return html`
    <table>
      <thead>
        <tr><th>When</th><th>Source</th><th>Event</th><th>Sink</th><th>Status</th></tr>
      </thead>
      <tbody>
        ${rows.map(
          (d) => html`
            <tr>
              <td class="code">${d.createdAt.replace("T", " ").slice(0, 19)}</td>
              <td><span class="tag">${d.source}</span></td>
              <td>${d.title}<br /><span class="code">${d.repo} · ${d.category}</span></td>
              <td>${d.sink ?? "—"}</td>
              <td class="${statusClass(d.status)}">
                ${d.status}${d.error ? html`<br /><span class="code">${d.error}</span>` : ""}
              </td>
            </tr>
          `,
        )}
      </tbody>
    </table>
  `;
}

export function rulesPage(rules: StoredRule[]) {
  return layout(
    "Rules",
    html`
      <div style="display:flex;justify-content:space-between;align-items:center">
        <h2 style="margin:0">Routing rules</h2>
        <a class="btn primary" href="/rules/new">+ New rule</a>
      </div>
      ${rules.length === 0
        ? html`<p class="muted" style="margin-top:16px">No rules yet. Create one to start routing events.</p>`
        : html`
            <table style="margin-top:12px">
              <thead>
                <tr><th>#</th><th>Sink</th><th>Filters</th><th>Enabled</th><th></th></tr>
              </thead>
              <tbody>
                ${rules.map(
                  (r) => html`
                    <tr>
                      <td>${r.id}</td>
                      <td><span class="tag">${r.sink}</span></td>
                      <td class="code">
                        src:${list(r.sources)} · cat:${list(r.categories)} · repo:${list(r.repos)} ·
                        branch:${list(r.branches)} · sev≥${r.minSeverity ?? "—"}
                      </td>
                      <td>${r.enabled ? "✓" : "✗"}</td>
                      <td style="white-space:nowrap">
                        <a class="btn" href="/rules/${r.id}/edit">Edit</a>
                        <form class="inline" method="post" action="/rules/${r.id}/toggle">
                          <button class="btn" type="submit">${r.enabled ? "Disable" : "Enable"}</button>
                        </form>
                        <form class="inline" method="post" action="/rules/${r.id}/delete"
                          onsubmit="return confirm('Delete rule ${r.id}?')">
                          <button class="btn" type="submit">Delete</button>
                        </form>
                      </td>
                    </tr>
                  `,
                )}
              </tbody>
            </table>
          `}
    `,
  );
}

export function ruleFormPage(
  opts: { rule?: StoredRule; sinks: string[]; sources: string[]; error?: string },
) {
  const r = opts.rule;
  const action = r ? `/rules/${r.id}` : "/rules";
  const sevs = ["", "low", "medium", "high", "critical"];
  const target = JSON.stringify(r?.target ?? { webhookUrl: "${DISCORD_WEBHOOK_URL}" }, null, 2);
  return layout(
    r ? `Edit rule ${r.id}` : "New rule",
    html`
      <h2>${r ? `Edit rule #${r.id}` : "New rule"}</h2>
      ${opts.error ? html`<div class="err">${opts.error}</div>` : ""}
      <form method="post" action="${action}">
        <div class="row">
          <div>
            <label>Sink</label>
            <select name="sink">
              ${opts.sinks.map(
                (s) => html`<option value="${s}" ${r?.sink === s ? "selected" : ""}>${s}</option>`,
              )}
            </select>
          </div>
          <div>
            <label>Minimum severity (optional)</label>
            <select name="minSeverity">
              ${sevs.map(
                (s) => html`<option value="${s}" ${(r?.minSeverity ?? "") === s ? "selected" : ""}>${s || "—"}</option>`,
              )}
            </select>
          </div>
        </div>
        <label>Target (JSON) — <span class="code">$&#123;ENV_VAR&#125; is expanded at delivery time</span></label>
        <textarea name="target">${target}</textarea>
        <div class="row">
          <div>
            <label>Sources (comma-separated, blank = all) — e.g. ${opts.sources.join(", ")}</label>
            <input name="sources" value="${list(r?.sources) === "—" ? "" : (r?.sources ?? []).join(", ")}" />
          </div>
          <div>
            <label>Categories (comma-separated, blank = all)</label>
            <input name="categories" value="${(r?.categories ?? []).join(", ")}" />
          </div>
        </div>
        <div class="row">
          <div>
            <label>Repos (globs, comma-separated)</label>
            <input name="repos" value="${(r?.repos ?? []).join(", ")}" placeholder="your-org/*" />
          </div>
          <div>
            <label>Branches (comma-separated)</label>
            <input name="branches" value="${(r?.branches ?? []).join(", ")}" placeholder="main" />
          </div>
        </div>
        <label><input type="checkbox" name="enabled" style="width:auto" ${!r || r.enabled ? "checked" : ""} /> Enabled</label>
        <p style="margin-top:18px">
          <button class="btn primary" type="submit">${r ? "Save" : "Create"}</button>
          <a class="btn" href="/rules">Cancel</a>
        </p>
      </form>
    `,
  );
}
