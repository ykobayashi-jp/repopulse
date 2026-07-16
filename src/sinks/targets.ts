/**
 * Declarative description of each sink's `target` fields. Shared by the
 * dashboard form (rendering) and the route handler (parsing/validation) so the
 * two never drift. Adding a sink = add its field list here.
 */

export interface SinkTargetField {
  key: string;
  label: string;
  required?: boolean;
  placeholder?: string;
}

export const SINK_TARGET_FIELDS: Record<string, SinkTargetField[]> = {
  discord: [
    { key: "webhookUrl", label: "Webhook URL", required: true, placeholder: "${DISCORD_WEBHOOK_URL}" },
    { key: "mention", label: "Mention (optional)", placeholder: "<@&ROLE_ID> / <@USER_ID> / @everyone" },
    { key: "threadId", label: "Thread ID (optional)", placeholder: "post into a thread / forum" },
  ],
  slack: [
    { key: "webhookUrl", label: "Webhook URL", required: true, placeholder: "${SLACK_WEBHOOK_URL}" },
    { key: "mention", label: "Mention (optional)", placeholder: "<!here> / <@U123> / <!subteam^S123>" },
  ],
  line: [
    { key: "channelAccessToken", label: "Channel access token", required: true, placeholder: "${LINE_CHANNEL_ACCESS_TOKEN}" },
    { key: "to", label: "Destination id (user / group / room)", required: true, placeholder: "${LINE_TO}" },
  ],
};

/**
 * Build a sink target from posted field values. `get(key)` returns the raw
 * string for a field. Throws when a required field is missing. Empty optional
 * fields are omitted. Returns null when the sink has no field definition (the
 * caller can fall back to a raw-JSON field).
 */
export function buildSinkTarget(
  sink: string,
  get: (key: string) => string | undefined,
): Record<string, unknown> | null {
  const fields = SINK_TARGET_FIELDS[sink];
  if (!fields) return null;

  const target: Record<string, unknown> = {};
  const missing: string[] = [];
  for (const f of fields) {
    const v = (get(f.key) ?? "").trim();
    if (v) target[f.key] = v;
    else if (f.required) missing.push(f.label);
  }
  if (missing.length) throw new Error(`Missing required field(s): ${missing.join(", ")}`);
  return target;
}
