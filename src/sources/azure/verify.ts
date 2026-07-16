import { timingSafeEqual } from "node:crypto";

/**
 * Azure DevOps Service Hooks have no HMAC signature; the common protection is
 * HTTP Basic auth configured on the subscription. We expect username "repopulse"
 * and the shared secret as the password. Compare in constant time.
 */
export function verifyAzureBasic(authHeader: string | undefined, secret: string): boolean {
  if (!authHeader || !secret) return false;
  const expected = "Basic " + Buffer.from(`repopulse:${secret}`).toString("base64");
  const a = Buffer.from(authHeader);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}
