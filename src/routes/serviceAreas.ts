import { Router } from "express";
import mongoose from "mongoose";
import { ServiceArea } from "../models/ServiceArea";
import { ok } from "../http/response";
import { asyncHandler } from "../util/asyncHandler";

export const serviceAreasRouter = Router();

serviceAreasRouter.get(
  "/",
  asyncHandler(async (_req, res) => {
    const docs = await ServiceArea.find()
      .sort({ citySlug: 1, kind: -1, name: 1 })
      .lean()
      .exec();

    ok(res, 200, {
      areas: docs.map((a) => ({
        id: (a as { _id: mongoose.Types.ObjectId })._id.toString(),
        citySlug: a.citySlug,
        kind: a.kind,
        name: a.name,
        aliases: a.aliases,
        location: a.location,
        radiusMeters: a.radiusMeters,
      })),
    });
  }),
);
