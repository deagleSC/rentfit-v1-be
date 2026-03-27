import { Router } from "express";
import mongoose from "mongoose";
import { Chat } from "../models/Chat";
import { requireAuth } from "../middleware/auth";
import { optionalAuth } from "../middleware/optionalAuth";
import { ErrorCodes } from "../http/errorCodes";
import { fail, ok } from "../http/response";
import { asyncHandler } from "../util/asyncHandler";

export const chatsRouter = Router();

/** Empty session for map+chat UI; first message streams via `POST /api/chat` with `chatId`. */
chatsRouter.post(
  "/",
  optionalAuth,
  asyncHandler(async (req, res) => {
    const chatDoc = await Chat.create({
      userId: req.auth?.userId
        ? new mongoose.Types.ObjectId(req.auth.userId)
        : undefined,
      title: "New chat",
      messages: [],
    });
    ok(res, 201, {
      chat: { id: chatDoc.id },
    });
  }),
);

chatsRouter.get(
  "/",
  requireAuth,
  asyncHandler(async (req, res) => {
    const docs = await Chat.find({
      userId: new mongoose.Types.ObjectId(req.auth!.userId),
    })
      .sort({ createdAt: -1 })
      .limit(50)
      .select("title createdAt lastCitySlug")
      .lean()
      .exec();

    ok(res, 200, {
      chats: docs.map((d) => ({
        id: (d as { _id: mongoose.Types.ObjectId })._id.toString(),
        title: (d as { title: string }).title,
        createdAt: (d as { createdAt: Date }).createdAt.toISOString(),
        lastCitySlug: (d as { lastCitySlug?: string }).lastCitySlug,
      })),
    });
  }),
);

chatsRouter.get(
  "/:id",
  optionalAuth,
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    if (!mongoose.isValidObjectId(id)) {
      fail(res, 400, ErrorCodes.VALIDATION_ERROR, "Invalid id");
      return;
    }
    const doc = await Chat.findById(id).exec();
    if (!doc) {
      fail(res, 404, ErrorCodes.NOT_FOUND, "Chat not found");
      return;
    }
    if (doc.userId && req.auth?.userId !== doc.userId.toString()) {
      fail(res, 403, ErrorCodes.FORBIDDEN, "Cannot access this chat");
      return;
    }
    ok(res, 200, {
      chat: {
        id: doc.id,
        title: doc.title,
        createdAt: doc.createdAt.toISOString(),
        userId: doc.userId?.toString(),
        lastCitySlug: doc.lastCitySlug,
        lastFilters: doc.lastFilters,
        lastListingIds: doc.lastListingIds?.map((x) => x.toString()),
        messages: doc.uiMessages ?? [],
      },
    });
  }),
);
