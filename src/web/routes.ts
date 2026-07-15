import type { Hono } from "hono";
import type { EventCategory, Severity } from "../core/events";
import type { RuleInput, Store } from "../store/db";
import { dashboardPage, deliveriesPage, ruleFormPage, rulesPage } from "./views";

interface WebDeps {
  store: Store;
  sinks: string[];
  sources: string[];
}

/** Parse a comma-separated field into a trimmed array, or undefined when blank. */
function csv(value: unknown): string[] | undefined {
  const arr = String(value ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  return arr.length ? arr : undefined;
}

/** Build a RuleInput from posted form fields. Throws on invalid target JSON. */
function parseRuleForm(body: Record<string, unknown>): RuleInput {
  let target: Record<string, unknown>;
  try {
    target = JSON.parse(String(body.target ?? "{}"));
  } catch {
    throw new Error("Target must be valid JSON.");
  }
  if (typeof target !== "object" || target === null || Array.isArray(target)) {
    throw new Error("Target must be a JSON object.");
  }
  const sink = String(body.sink ?? "").trim();
  if (!sink) throw new Error("Sink is required.");

  const minSeverity = String(body.minSeverity ?? "").trim() || undefined;

  return {
    sink,
    target,
    sources: csv(body.sources),
    categories: csv(body.categories) as EventCategory[] | undefined,
    repos: csv(body.repos),
    branches: csv(body.branches),
    minSeverity: minSeverity as Severity | undefined,
    enabled: body.enabled === "on" || body.enabled === "true",
  };
}

export function registerWebRoutes(app: Hono, deps: WebDeps): void {
  const { store, sinks, sources } = deps;

  app.get("/", (c) =>
    c.html(
      dashboardPage(
        { rules: store.countRules(), enabled: store.listEnabledRules().length, deliveries: store.countDeliveries() },
        store.listDeliveries(15),
      ),
    ),
  );

  app.get("/deliveries", (c) => c.html(deliveriesPage(store.listDeliveries(100))));

  app.get("/rules", (c) => c.html(rulesPage(store.listRules())));

  app.get("/rules/new", (c) => c.html(ruleFormPage({ sinks, sources })));

  app.post("/rules", async (c) => {
    const body = await c.req.parseBody();
    try {
      store.createRule(parseRuleForm(body));
    } catch (e) {
      return c.html(ruleFormPage({ sinks, sources, error: (e as Error).message }), 400);
    }
    return c.redirect("/rules");
  });

  app.get("/rules/:id/edit", (c) => {
    const rule = store.getRule(Number(c.req.param("id")));
    if (!rule) return c.text("not found", 404);
    return c.html(ruleFormPage({ rule, sinks, sources }));
  });

  app.post("/rules/:id", async (c) => {
    const id = Number(c.req.param("id"));
    const rule = store.getRule(id);
    if (!rule) return c.text("not found", 404);
    const body = await c.req.parseBody();
    try {
      store.updateRule(id, parseRuleForm(body));
    } catch (e) {
      return c.html(ruleFormPage({ rule, sinks, sources, error: (e as Error).message }), 400);
    }
    return c.redirect("/rules");
  });

  app.post("/rules/:id/toggle", (c) => {
    const id = Number(c.req.param("id"));
    const rule = store.getRule(id);
    if (rule) store.setRuleEnabled(id, !rule.enabled);
    return c.redirect("/rules");
  });

  app.post("/rules/:id/delete", (c) => {
    store.deleteRule(Number(c.req.param("id")));
    return c.redirect("/rules");
  });
}
