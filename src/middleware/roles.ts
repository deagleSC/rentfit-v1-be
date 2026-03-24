import type { NextFunction, Request, Response } from "express";
import { ErrorCodes } from "../http/errorCodes";
import { fail } from "../http/response";

/** Supply-side listing actions: `owner` or `admin` only. */
export function requireOwnerOrAdmin(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  if (!req.auth) {
    fail(res, 401, ErrorCodes.UNAUTHORIZED, "Unauthorized");
    return;
  }
  if (req.auth.role !== "owner" && req.auth.role !== "admin") {
    fail(
      res,
      403,
      ErrorCodes.FORBIDDEN,
      "Only property owners can perform this action",
    );
    return;
  }
  next();
}
