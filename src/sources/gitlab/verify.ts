import { timingSafeEqual } from "node:crypto";

/**
 * GitLab sends the configured secret verbatim in X-Gitlab-Token (not an HMAC).
 * Compare in constant time.
 */
export function verifyGitLabToken(
  tokenHeader: string | undefined,
  secret: string,
): boolean {
  if (!tokenHeader || !secret) return false;
  const a = Buffer.from(tokenHeader);
  const b = Buffer.from(secret);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}
