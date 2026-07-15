import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import type { Hono } from "hono";
import { deleteCookie, getCookie, setCookie } from "hono/cookie";

export interface AuthConfig {
  clientId: string;
  clientSecret: string;
  sessionSecret: string;
  allowedLogins: string[];
  baseUrl: string;
  /** Set secure cookies when the base URL is https. */
  secureCookies: boolean;
}

const SESSION_COOKIE = "rp_session";
const STATE_COOKIE = "rp_oauth_state";
const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * Build auth config from the environment, or return null when auth is not
 * configured (dev mode — the dashboard is then left open, with a warning).
 */
export function loadAuthConfig(port: number): AuthConfig | null {
  const clientId = process.env.GITHUB_CLIENT_ID ?? "";
  const clientSecret = process.env.GITHUB_CLIENT_SECRET ?? "";
  const sessionSecret = process.env.SESSION_SECRET ?? "";
  if (!clientId || !clientSecret || !sessionSecret) return null;

  const baseUrl = process.env.BASE_URL ?? `http://localhost:${port}`;
  const allowedLogins = (process.env.GITHUB_ALLOWED_LOGINS ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  return {
    clientId,
    clientSecret,
    sessionSecret,
    allowedLogins,
    baseUrl,
    secureCookies: baseUrl.startsWith("https://"),
  };
}

function hmac(secret: string, data: string): string {
  return createHmac("sha256", secret).update(data).digest("hex");
}

function safeEqualHex(a: string, b: string): boolean {
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);
  return ba.length === bb.length && timingSafeEqual(ba, bb);
}

export function signSession(cfg: AuthConfig, login: string): string {
  const payload = `${login}:${Date.now() + SESSION_TTL_MS}`;
  const body = Buffer.from(payload).toString("base64url");
  return `${body}.${hmac(cfg.sessionSecret, payload)}`;
}

/** Return the login if the session token is valid and unexpired, else null. */
export function verifySession(cfg: AuthConfig, token: string): string | null {
  const dot = token.lastIndexOf(".");
  if (dot < 0) return null;
  const body = token.slice(0, dot);
  const sig = token.slice(dot + 1);
  let payload: string;
  try {
    payload = Buffer.from(body, "base64url").toString("utf8");
  } catch {
    return null;
  }
  if (!safeEqualHex(sig, hmac(cfg.sessionSecret, payload))) return null;

  const sep = payload.lastIndexOf(":");
  const login = payload.slice(0, sep);
  const exp = Number(payload.slice(sep + 1));
  if (!login || !Number.isFinite(exp) || Date.now() > exp) return null;
  return login;
}

async function exchangeCodeForLogin(cfg: AuthConfig, code: string): Promise<string | null> {
  const tokenRes = await fetch("https://github.com/login/oauth/access_token", {
    method: "POST",
    headers: { "content-type": "application/json", accept: "application/json" },
    body: JSON.stringify({
      client_id: cfg.clientId,
      client_secret: cfg.clientSecret,
      code,
      redirect_uri: `${cfg.baseUrl}/auth/callback`,
    }),
  });
  const tokenJson = (await tokenRes.json().catch(() => ({}))) as { access_token?: string };
  if (!tokenJson.access_token) return null;

  const userRes = await fetch("https://api.github.com/user", {
    headers: {
      authorization: `Bearer ${tokenJson.access_token}`,
      "user-agent": "RepoPulse",
      accept: "application/vnd.github+json",
    },
  });
  const user = (await userRes.json().catch(() => ({}))) as { login?: string };
  return user.login ?? null;
}

/** Register /login, /auth/callback, /logout and the guard middleware. */
export function registerAuth(app: Hono, cfg: AuthConfig): void {
  app.get("/login", (c) => {
    const state = randomBytes(16).toString("hex");
    setCookie(c, STATE_COOKIE, state, {
      httpOnly: true,
      sameSite: "Lax",
      path: "/",
      secure: cfg.secureCookies,
      maxAge: 600,
    });
    const url = new URL("https://github.com/login/oauth/authorize");
    url.searchParams.set("client_id", cfg.clientId);
    url.searchParams.set("redirect_uri", `${cfg.baseUrl}/auth/callback`);
    url.searchParams.set("state", state);
    return c.redirect(url.toString());
  });

  app.get("/auth/callback", async (c) => {
    const code = c.req.query("code");
    const state = c.req.query("state");
    const expected = getCookie(c, STATE_COOKIE);
    deleteCookie(c, STATE_COOKIE, { path: "/" });
    if (!code || !state || !expected || state !== expected) {
      return c.text("invalid oauth state", 400);
    }

    const login = await exchangeCodeForLogin(cfg, code);
    if (!login) return c.text("github authentication failed", 401);
    if (cfg.allowedLogins.length && !cfg.allowedLogins.includes(login)) {
      return c.text(`user ${login} is not allowed`, 403);
    }

    setCookie(c, SESSION_COOKIE, signSession(cfg, login), {
      httpOnly: true,
      sameSite: "Lax",
      path: "/",
      secure: cfg.secureCookies,
      maxAge: SESSION_TTL_MS / 1000,
    });
    return c.redirect("/");
  });

  app.get("/logout", (c) => {
    deleteCookie(c, SESSION_COOKIE, { path: "/" });
    return c.redirect("/login");
  });

  // Guard everything registered after this point (the dashboard routes).
  app.use("*", async (c, next) => {
    const token = getCookie(c, SESSION_COOKIE);
    const login = token ? verifySession(cfg, token) : null;
    if (!login) return c.redirect("/login");
    await next();
  });
}
