import type { Sink } from "../../core/ports";
import { renderDiscord } from "./render";

interface DiscordTarget {
  webhookUrl: string;
  mention?: string;
  /** Post into an existing thread/forum post. */
  threadId?: string;
}

export function createDiscordSink(): Sink {
  return {
    id: "discord",

    async deliver(event, target) {
      const t = target as unknown as DiscordTarget;
      if (!t.webhookUrl) throw new Error("discord sink: webhookUrl missing");

      let url = t.webhookUrl;
      if (t.threadId) {
        url += (url.includes("?") ? "&" : "?") + `thread_id=${encodeURIComponent(t.threadId)}`;
      }

      const res = await fetch(url, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(renderDiscord(event, { mention: t.mention })),
      });

      if (!res.ok) {
        const body = await res.text().catch(() => "");
        throw new Error(`discord webhook failed: ${res.status} ${body}`);
      }
    },
  };
}
