import { randomUUID } from "node:crypto";
import type { CanonicalEvent } from "../../core/events";
import type { IncomingRequest, Source } from "../../core/ports";
import { verifyGitHubSignature } from "./verify";
import { normalizeGitHub } from "./normalize";

export function createGitHubSource(secret: string): Source {
  return {
    id: "github",

    verify(req: IncomingRequest): boolean {
      return verifyGitHubSignature(
        req.rawBody,
        req.headers["x-hub-signature-256"],
        secret,
      );
    },

    normalize(req: IncomingRequest): CanonicalEvent[] | null {
      const event = req.headers["x-github-event"];
      if (!event || event === "ping") return null;

      let payload: unknown;
      try {
        payload = JSON.parse(req.rawBody);
      } catch {
        return null;
      }

      const base = normalizeGitHub(event, payload);
      if (!base) return null;

      return [
        {
          ...base,
          id: req.headers["x-github-delivery"] ?? randomUUID(),
          source: "github",
          timestamp: new Date().toISOString(),
          raw: payload,
        },
      ];
    },
  };
}
