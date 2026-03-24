import type { NextFunction, Request, Response } from "express";
import { verifyAuthToken } from "../auth/jwt";
import { env } from "../config/env";

/** Sets `req.auth` when a valid session cookie is present; otherwise continues without auth. */
export function optionalAuth(
  req: Request,
  _res: Response,
  next: NextFunction,
): void {
  const token = req.cookies?.[env.authCookieName] as string | undefined;
  if (!token) {
    next();
    return;
  }
  try {
    const payload = verifyAuthToken(token);
    req.auth = {
      userId: payload.sub,
      email: payload.email,
      role: payload.role,
    };
  } catch {
    // ignore invalid token for optional auth
  }
  next();
}
