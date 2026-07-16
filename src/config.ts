import { readFileSync } from "node:fs";
import { parse as parseYaml } from "yaml";
import type { Rule } from "./core/router";

export interface AppConfig {
  port: number;
  githubSecret: string;
  gitlabSecret: string;
  azureSecret: string;
  dbPath: string;
  rules: Rule[];
}

/** Minimal .env loader (no dependency). Existing env vars win. */
export function loadDotenv(path = ".env"): void {
  let text: string;
  try {
    text = readFileSync(path, "utf8");
  } catch {
    return; // no .env file is fine
  }
  for (const line of text.split("\n")) {
    const m = line.match(/^\s*([A-Za-z0-9_]+)\s*=\s*(.*)\s*$/);
    if (!m) continue;
    const key = m[1];
    if (!key) continue;
    let val = (m[2] ?? "").trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    if (!(key in process.env)) process.env[key] = val;
  }
}

/** Expand ${ENV_VAR} references anywhere in a value tree. */
function resolveEnv(value: unknown): unknown {
  if (typeof value === "string") {
    return value.replace(/\$\{([A-Za-z0-9_]+)\}/g, (_, k) => process.env[k] ?? "");
  }
  if (Array.isArray(value)) return value.map(resolveEnv);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([k, v]) => [k, resolveEnv(v)]),
    );
  }
  return value;
}

export function loadConfig(path = "config/subscriptions.yaml"): AppConfig {
  let rules: Rule[] = [];
  try {
    const doc = (parseYaml(readFileSync(path, "utf8")) ?? {}) as { rules?: Rule[] };
    rules = (doc.rules ?? []).map((r) => ({
      ...r,
      target: resolveEnv(r.target) as Record<string, unknown>,
    }));
  } catch (e) {
    console.warn(
      `[config] could not load ${path}: ${(e as Error).message}. Using empty ruleset.`,
    );
  }

  return {
    port: Number(process.env.PORT ?? 3000),
    githubSecret: process.env.GITHUB_WEBHOOK_SECRET ?? "",
    gitlabSecret: process.env.GITLAB_WEBHOOK_SECRET ?? "",
    azureSecret: process.env.AZURE_WEBHOOK_SECRET ?? "",
    dbPath: process.env.DB_PATH ?? "data/repopulse.db",
    rules,
  };
}
