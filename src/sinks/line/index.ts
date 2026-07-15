import type { Sink } from "../../core/ports";
import { renderLine } from "./render";

const PUSH_ENDPOINT = "https://api.line.me/v2/bot/message/push";

interface LineTarget {
  /** Long-lived channel access token from the LINE Developers console. */
  channelAccessToken: string;
  /** Destination id: a user, group, or room id. */
  to: string;
  /** Override the API endpoint (testing / proxy). Defaults to LINE's push API. */
  endpoint?: string;
}

export function createLineSink(): Sink {
  return {
    id: "line",

    async deliver(event, target) {
      const t = target as unknown as LineTarget;
      if (!t.channelAccessToken) throw new Error("line sink: channelAccessToken missing");
      if (!t.to) throw new Error("line sink: 'to' missing");

      const { messages } = renderLine(event);
      const res = await fetch(t.endpoint ?? PUSH_ENDPOINT, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${t.channelAccessToken}`,
        },
        body: JSON.stringify({ to: t.to, messages }),
      });

      if (!res.ok) {
        const body = await res.text().catch(() => "");
        throw new Error(`line push failed: ${res.status} ${body}`);
      }
    },
  };
}
