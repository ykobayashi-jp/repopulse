import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { DatabaseSync } from "node:sqlite";
import type { EventCategory, Severity } from "../core/events";
import type { Rule } from "../core/router";

export interface StoredRule {
  id: number;
  sink: string;
  target: Record<string, unknown>;
  sources?: string[];
  categories?: EventCategory[];
  repos?: string[];
  branches?: string[];
  minSeverity?: Severity;
  enabled: boolean;
  createdAt: string;
}

export type RuleInput = Omit<StoredRule, "id" | "createdAt">;

export interface DeliveryInput {
  eventId: string;
  source: string;
  category: string;
  action: string;
  title: string;
  repo: string;
  url?: string;
  /** null when no rule matched. */
  sink?: string;
  status: "ok" | "failed" | "no-match";
  error?: string;
}

export interface DeliveryRow extends DeliveryInput {
  id: number;
  createdAt: string;
}

const toJson = (v: unknown): string | null => (v == null ? null : JSON.stringify(v));
function fromJson<T>(v: unknown): T | undefined {
  return v == null ? undefined : (JSON.parse(String(v)) as T);
}

function mapRule(row: Record<string, unknown>): StoredRule {
  return {
    id: Number(row.id),
    sink: String(row.sink),
    target: fromJson<Record<string, unknown>>(row.target) ?? {},
    sources: fromJson<string[]>(row.sources),
    categories: fromJson<EventCategory[]>(row.categories),
    repos: fromJson<string[]>(row.repos),
    branches: fromJson<string[]>(row.branches),
    minSeverity: (row.min_severity as Severity | null) ?? undefined,
    enabled: Number(row.enabled) === 1,
    createdAt: String(row.created_at),
  };
}

/** Drop DB-only fields so the router sees a plain matching Rule. */
export function toMatchRule(r: StoredRule): Rule {
  return {
    sink: r.sink,
    target: r.target,
    sources: r.sources,
    categories: r.categories,
    repos: r.repos,
    branches: r.branches,
    minSeverity: r.minSeverity,
  };
}

export class Store {
  private db: DatabaseSync;

  constructor(path: string) {
    if (path !== ":memory:") mkdirSync(dirname(path), { recursive: true });
    this.db = new DatabaseSync(path);
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS rules (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        sink TEXT NOT NULL,
        target TEXT NOT NULL,
        sources TEXT,
        categories TEXT,
        repos TEXT,
        branches TEXT,
        min_severity TEXT,
        enabled INTEGER NOT NULL DEFAULT 1,
        created_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS deliveries (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        event_id TEXT NOT NULL,
        source TEXT NOT NULL,
        category TEXT NOT NULL,
        action TEXT NOT NULL,
        title TEXT NOT NULL,
        repo TEXT NOT NULL,
        url TEXT,
        sink TEXT,
        status TEXT NOT NULL,
        error TEXT,
        created_at TEXT NOT NULL
      );
    `);
  }

  countRules(): number {
    const row = this.db.prepare("SELECT COUNT(*) AS c FROM rules").get() as { c: number };
    return Number(row.c);
  }

  listRules(): StoredRule[] {
    const rows = this.db.prepare("SELECT * FROM rules ORDER BY id").all() as Record<string, unknown>[];
    return rows.map(mapRule);
  }

  listEnabledRules(): StoredRule[] {
    const rows = this.db
      .prepare("SELECT * FROM rules WHERE enabled = 1 ORDER BY id")
      .all() as Record<string, unknown>[];
    return rows.map(mapRule);
  }

  getRule(id: number): StoredRule | undefined {
    const row = this.db.prepare("SELECT * FROM rules WHERE id = ?").get(id) as
      | Record<string, unknown>
      | undefined;
    return row ? mapRule(row) : undefined;
  }

  createRule(input: RuleInput): StoredRule {
    const res = this.db
      .prepare(
        `INSERT INTO rules (sink, target, sources, categories, repos, branches, min_severity, enabled, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        input.sink,
        toJson(input.target),
        toJson(input.sources),
        toJson(input.categories),
        toJson(input.repos),
        toJson(input.branches),
        input.minSeverity ?? null,
        input.enabled ? 1 : 0,
        new Date().toISOString(),
      );
    return this.getRule(Number(res.lastInsertRowid))!;
  }

  updateRule(id: number, input: RuleInput): void {
    this.db
      .prepare(
        `UPDATE rules SET sink = ?, target = ?, sources = ?, categories = ?, repos = ?,
         branches = ?, min_severity = ?, enabled = ? WHERE id = ?`,
      )
      .run(
        input.sink,
        toJson(input.target),
        toJson(input.sources),
        toJson(input.categories),
        toJson(input.repos),
        toJson(input.branches),
        input.minSeverity ?? null,
        input.enabled ? 1 : 0,
        id,
      );
  }

  setRuleEnabled(id: number, enabled: boolean): void {
    this.db.prepare("UPDATE rules SET enabled = ? WHERE id = ?").run(enabled ? 1 : 0, id);
  }

  deleteRule(id: number): void {
    this.db.prepare("DELETE FROM rules WHERE id = ?").run(id);
  }

  /** Seed rules (e.g. imported once from subscriptions.yaml). */
  importRules(rules: Rule[]): number {
    let n = 0;
    for (const r of rules) {
      this.createRule({ ...r, enabled: true });
      n++;
    }
    return n;
  }

  recordDelivery(d: DeliveryInput): void {
    this.db
      .prepare(
        `INSERT INTO deliveries (event_id, source, category, action, title, repo, url, sink, status, error, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        d.eventId,
        d.source,
        d.category,
        d.action,
        d.title,
        d.repo,
        d.url ?? null,
        d.sink ?? null,
        d.status,
        d.error ?? null,
        new Date().toISOString(),
      );
  }

  listDeliveries(limit = 50): DeliveryRow[] {
    const rows = this.db
      .prepare("SELECT * FROM deliveries ORDER BY id DESC LIMIT ?")
      .all(limit) as Record<string, unknown>[];
    return rows.map((row) => ({
      id: Number(row.id),
      eventId: String(row.event_id),
      source: String(row.source),
      category: String(row.category),
      action: String(row.action),
      title: String(row.title),
      repo: String(row.repo),
      url: (row.url as string | null) ?? undefined,
      sink: (row.sink as string | null) ?? undefined,
      status: row.status as DeliveryRow["status"],
      error: (row.error as string | null) ?? undefined,
      createdAt: String(row.created_at),
    }));
  }

  countDeliveries(): number {
    const row = this.db.prepare("SELECT COUNT(*) AS c FROM deliveries").get() as { c: number };
    return Number(row.c);
  }
}
