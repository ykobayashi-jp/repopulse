import assert from "node:assert/strict";
import { test } from "node:test";
import type { AuthConfig } from "../src/web/auth";
import { signSession, verifySession } from "../src/web/auth";

const cfg: AuthConfig = {
  clientId: "id",
  clientSecret: "secret",
  sessionSecret: "super-secret-key",
  allowedLogins: ["me"],
  baseUrl: "http://localhost:3000",
  secureCookies: false,
};

test("signed session round-trips the login", () => {
  const token = signSession(cfg, "octocat");
  assert.equal(verifySession(cfg, token), "octocat");
});

test("tampered signature is rejected", () => {
  const token = signSession(cfg, "octocat");
  const tampered = token.slice(0, -1) + (token.at(-1) === "a" ? "b" : "a");
  assert.equal(verifySession(cfg, tampered), null);
});

test("token signed with a different secret is rejected", () => {
  const token = signSession({ ...cfg, sessionSecret: "other" }, "octocat");
  assert.equal(verifySession(cfg, token), null);
});

test("malformed token is rejected", () => {
  assert.equal(verifySession(cfg, "not-a-token"), null);
  assert.equal(verifySession(cfg, ""), null);
});
