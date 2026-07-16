import type { Sink } from "../../core/ports";
import { renderTeams } from "./render";

interface TeamsTarget {
  /** Teams Workflows (Power Automate) incoming webhook URL. */
  webhookUrl: string;
}

export function createTeamsSink(): Sink {
  return {
    id: "teams",

    async deliver(event, target) {
      const t = target as unknown as TeamsTarget;
      if (!t.webhookUrl) throw new Error("teams sink: webhookUrl missing");

      const res = await fetch(t.webhookUrl, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(renderTeams(event)),
      });

      if (!res.ok) {
        const body = await res.text().catch(() => "");
        throw new Error(`teams webhook failed: ${res.status} ${body}`);
      }
    },
  };
}
