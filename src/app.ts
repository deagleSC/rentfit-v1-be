import cookieParser from "cookie-parser";
import cors from "cors";
import express, {
  type NextFunction,
  type Request,
  type Response,
} from "express";
import helmet from "helmet";
import { env } from "./config/env";
import { registerSwagger } from "./docs/registerSwagger";
import { ErrorCodes } from "./http/errorCodes";
import { fail, ok } from "./http/response";
import { authRouter } from "./routes/auth";
import { chatRouter } from "./routes/chat";
import { chatsRouter } from "./routes/chats";
import { listingsRouter, mapRouter } from "./routes/listings";
import { serviceAreasRouter } from "./routes/serviceAreas";

export function createApp() {
  const app = express();

  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'"],
          imgSrc: ["'self'", "data:", "https://validator.swagger.io"],
          connectSrc: ["'self'"],
        },
      },
    }),
  );
  app.use(
    cors({
      origin: env.corsOrigin,
      credentials: true,
    }),
  );
  app.use(express.json({ limit: "1mb" }));
  app.use(cookieParser());

  app.get("/health", (_req, res) => {
    ok(res, 200, { service: "rentfit-v1-be" });
  });

  app.get("/api", (_req, res) => {
    ok(res, 200, { name: "rentfit-v1-be", version: "0.1.0" });
  });

  app.use("/api/auth", authRouter);
  app.use("/api/chat", chatRouter);
  app.use("/api/chats", chatsRouter);
  app.use("/api/service-areas", serviceAreasRouter);
  app.use("/api/listings", listingsRouter);
  app.use("/api/map", mapRouter);

  registerSwagger(app);

  app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
    console.error(err);
    fail(res, 500, ErrorCodes.INTERNAL_ERROR, "Internal server error");
  });

  return app;
}
