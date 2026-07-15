import { randomUUID } from "node:crypto";
import type { CanonicalEvent } from "../../core/events";
import type { IncomingRequest, Source } from "../../core/ports";
import { normalizeGitLab } from "./normalize";
import { verifyGitLabToken } from "./verify";

export function createGitLabSource(secret: string): Source {
  return {
    id: "gitlab",

    verify(req: IncomingRequest): boolean {
      return verifyGitLabToken(req.headers["x-gitlab-token"], secret);
    },

    normalize(req: IncomingRequest): CanonicalEvent[] | null {
      const event = req.headers["x-gitlab-event"];
      if (!event) return null;

      let payload: unknown;
      try {
        payload = JSON.parse(req.rawBody);
      } catch {
        return null;
      }

      const kind = (payload as { object_kind?: string }).object_kind ?? "";
      const base = normalizeGitLab(kind, payload);
      if (!base) return null;

      return [
        {
          ...base,
          id: req.headers["x-gitlab-event-uuid"] ?? randomUUID(),
          source: "gitlab",
          timestamp: new Date().toISOString(),
          raw: payload,
        },
      ];
    },
  };
}
