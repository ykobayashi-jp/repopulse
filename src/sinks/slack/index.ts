import type { Sink } from "../../core/ports";
import { renderSlack } from "./render";

interface SlackTarget {
  webhookUrl: string;
  /** e.g. "<!here>", "<@U123>", "<!subteam^S123>". */
  mention?: string;
}

export function createSlackSink(): Sink {
  return {
    id: "slack",

    async deliver(event, target) {
      const t = target as unknown as SlackTarget;
      if (!t.webhookUrl) throw new Error("slack sink: webhookUrl missing");

      const res = await fetch(t.webhookUrl, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(renderSlack(event, { mention: t.mention })),
      });

      if (!res.ok) {
        const body = await res.text().catch(() => "");
        throw new Error(`slack webhook failed: ${res.status} ${body}`);
      }
    },
  };
}
