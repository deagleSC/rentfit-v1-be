import { Router } from "express";
import { User, type IUser, type UserRole } from "../models/User";
import type { ServiceCitySlug } from "../models/ServiceArea";
import { hashPassword, verifyPassword } from "../auth/password";
import { signAuthToken } from "../auth/jwt";
import { authCookieOptions, clearAuthCookie } from "../auth/cookie";
import { env } from "../config/env";
import { ErrorCodes } from "../http/errorCodes";
import { fail, ok } from "../http/response";
import { requireAuth } from "../middleware/auth";
import { asyncHandler } from "../util/asyncHandler";

const MIN_PASSWORD_LEN = 8;

function isValidEmail(s: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);
}

function parseRegisterRole(value: unknown): UserRole {
  if (value === "owner") return "owner";
  return "renter";
}

function isMongoDuplicateKey(err: unknown): boolean {
  return (
    typeof err === "object" &&
    err !== null &&
    "code" in err &&
    (err as { code: unknown }).code === 11000
  );
}

const SERVICE_CITY_SLUGS: ServiceCitySlug[] = [
  "bangalore",
  "mumbai",
  "kolkata",
];

function toPublicUser(user: IUser) {
  return {
    id: user.id,
    email: user.email,
    role: user.role,
    createdAt: user.createdAt,
    preferences: {
      defaultCity: user.preferences?.defaultCity,
    },
  };
}

function parseDefaultCityPatch(
  body: unknown,
): ServiceCitySlug | null | undefined {
  if (!body || typeof body !== "object" || !("defaultCity" in body)) {
    return undefined;
  }
  const raw = (body as { defaultCity: unknown }).defaultCity;
  if (raw === null) {
    return null;
  }
  if (typeof raw !== "string") {
    return undefined;
  }
  const slug = raw.trim().toLowerCase();
  if (slug === "") {
    return null;
  }
  if (!SERVICE_CITY_SLUGS.includes(slug as ServiceCitySlug)) {
    return undefined;
  }
  return slug as ServiceCitySlug;
}

export const authRouter = Router();

authRouter.get(
  "/me",
  requireAuth,
  asyncHandler(async (req, res) => {
    const user = await User.findById(req.auth!.userId).exec();
    if (!user) {
      fail(res, 401, ErrorCodes.UNAUTHORIZED, "Unauthorized");
      return;
    }
    ok(res, 200, { user: toPublicUser(user) });
  }),
);

authRouter.patch(
  "/me",
  requireAuth,
  asyncHandler(async (req, res) => {
    const user = await User.findById(req.auth!.userId).exec();
    if (!user) {
      fail(res, 401, ErrorCodes.UNAUTHORIZED, "Unauthorized");
      return;
    }

    const nextCity = parseDefaultCityPatch(req.body);
    if (nextCity === undefined && req.body && typeof req.body === "object") {
      const hasKey = "defaultCity" in req.body;
      if (
        hasKey &&
        (req.body as { defaultCity: unknown }).defaultCity !== undefined &&
        (req.body as { defaultCity: unknown }).defaultCity !== null &&
        (req.body as { defaultCity: unknown }).defaultCity !== ""
      ) {
        fail(
          res,
          400,
          ErrorCodes.VALIDATION_ERROR,
          `defaultCity must be one of: ${SERVICE_CITY_SLUGS.join(", ")}`,
        );
        return;
      }
    }

    if (nextCity !== undefined) {
      if (nextCity === null) {
        await User.updateOne(
          { _id: user._id },
          { $unset: { "preferences.defaultCity": 1 } },
        ).exec();
      } else {
        await User.updateOne(
          { _id: user._id },
          { $set: { "preferences.defaultCity": nextCity } },
        ).exec();
      }
    }

    const fresh = await User.findById(req.auth!.userId).exec();
    if (!fresh) {
      fail(res, 401, ErrorCodes.UNAUTHORIZED, "Unauthorized");
      return;
    }
    ok(res, 200, { user: toPublicUser(fresh) });
  }),
);

authRouter.post(
  "/register",
  asyncHandler(async (req, res) => {
    const emailRaw =
      typeof req.body?.email === "string"
        ? req.body.email.trim().toLowerCase()
        : "";
    const password =
      typeof req.body?.password === "string" ? req.body.password : "";
    const role = parseRegisterRole(req.body?.role);

    if (!emailRaw || !isValidEmail(emailRaw)) {
      fail(res, 400, ErrorCodes.VALIDATION_ERROR, "Valid email is required");
      return;
    }
    if (password.length < MIN_PASSWORD_LEN) {
      fail(
        res,
        400,
        ErrorCodes.VALIDATION_ERROR,
        `Password must be at least ${MIN_PASSWORD_LEN} characters`,
      );
      return;
    }

    try {
      const passwordHash = await hashPassword(password);
      const user = await User.create({
        email: emailRaw,
        passwordHash,
        role,
      });
      const token = signAuthToken({
        sub: user.id,
        email: user.email,
        role: user.role,
      });
      res.cookie(env.authCookieName, token, authCookieOptions());
      ok(res, 201, {
        user: toPublicUser(user),
      });
    } catch (err: unknown) {
      if (isMongoDuplicateKey(err)) {
        fail(res, 409, ErrorCodes.CONFLICT, "Email already registered");
        return;
      }
      throw err;
    }
  }),
);

authRouter.post(
  "/login",
  asyncHandler(async (req, res) => {
    const emailRaw =
      typeof req.body?.email === "string"
        ? req.body.email.trim().toLowerCase()
        : "";
    const password =
      typeof req.body?.password === "string" ? req.body.password : "";

    if (!emailRaw || password.length === 0) {
      fail(
        res,
        400,
        ErrorCodes.VALIDATION_ERROR,
        "Email and password are required",
      );
      return;
    }

    const user = await User.findOne({ email: emailRaw });
    if (!user || !(await verifyPassword(password, user.passwordHash))) {
      fail(res, 401, ErrorCodes.UNAUTHORIZED, "Invalid email or password");
      return;
    }

    const token = signAuthToken({
      sub: user.id,
      email: user.email,
      role: user.role,
    });
    res.cookie(env.authCookieName, token, authCookieOptions());
    ok(res, 200, {
      user: toPublicUser(user),
    });
  }),
);

authRouter.post("/logout", (_req, res) => {
  clearAuthCookie(res);
  ok(res, 200, null);
});
