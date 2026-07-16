import { randomUUID } from "node:crypto";
import type { CanonicalEvent } from "../../core/events";
import type { IncomingRequest, Source } from "../../core/ports";
import { normalizeAzure } from "./normalize";
import { verifyAzureBasic } from "./verify";

export function createAzureSource(secret: string): Source {
  return {
    id: "azure",

    verify(req: IncomingRequest): boolean {
      return verifyAzureBasic(req.headers["authorization"], secret);
    },

    normalize(req: IncomingRequest): CanonicalEvent[] | null {
      let payload: unknown;
      try {
        payload = JSON.parse(req.rawBody);
      } catch {
        return null;
      }

      const eventType = (payload as { eventType?: string }).eventType;
      if (!eventType) return null;

      const base = normalizeAzure(eventType, payload);
      if (!base) return null;

      return [
        {
          ...base,
          id: (payload as { id?: string }).id ?? randomUUID(),
          source: "azure",
          timestamp: new Date().toISOString(),
          raw: payload,
        },
      ];
    },
  };
}
