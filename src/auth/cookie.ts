import type { CookieOptions, Response } from "express";
import { env } from "../config/env";

export function authCookieOptions(): CookieOptions {
  return {
    httpOnly: true,
    secure: env.nodeEnv === "production",
    sameSite: "lax",
    path: "/",
    maxAge: env.jwtExpiresInSec * 1000,
  };
}

export function clearAuthCookie(res: Response): void {
  res.clearCookie(env.authCookieName, {
    httpOnly: true,
    secure: env.nodeEnv === "production",
    sameSite: "lax",
    path: "/",
  });
}
