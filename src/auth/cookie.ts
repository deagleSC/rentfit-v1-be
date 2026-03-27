import type { CookieOptions, Response } from "express";
import { env } from "../config/env";

/**
 * Cross-origin SPA (e.g. app.vercel.app) calling API (api.vercel.app) requires
 * SameSite=None; Secure so the browser sends the session cookie on credentialed fetch.
 * Override with AUTH_COOKIE_SAMESITE=lax if API and app share one origin.
 */
function authCookieShape(): Pick<
  CookieOptions,
  "httpOnly" | "secure" | "sameSite" | "path"
> {
  const isProd = env.nodeEnv === "production";
  const raw = process.env.AUTH_COOKIE_SAMESITE?.trim().toLowerCase();
  const sameSite: CookieOptions["sameSite"] =
    raw === "lax" || raw === "strict" || raw === "none"
      ? raw
      : isProd
        ? "none"
        : "lax";
  const secure = isProd;
  return {
    httpOnly: true,
    secure,
    sameSite,
    path: "/",
  };
}

export function authCookieOptions(): CookieOptions {
  return {
    ...authCookieShape(),
    maxAge: env.jwtExpiresInSec * 1000,
  };
}

export function clearAuthCookie(res: Response): void {
  res.clearCookie(env.authCookieName, authCookieShape());
}
