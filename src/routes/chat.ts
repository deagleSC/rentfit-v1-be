import {
  convertToModelMessages,
  stepCountIs,
  streamText,
  type UIMessage,
} from "ai";
import { Router } from "express";
import mongoose from "mongoose";
import { createChatModel } from "../ai/openrouter";
import { createRentfitTools } from "../ai/rentfitTools";
import { buildRentfitSystemPrompt } from "../ai/rentfitSystemPrompt";
import type { IChat } from "../models/Chat";
import { Chat } from "../models/Chat";
import { env } from "../config/env";
import { ErrorCodes } from "../http/errorCodes";
import { fail } from "../http/response";
import { optionalAuth } from "../middleware/optionalAuth";
import type { SearchListingsResult } from "../services/searchListingsForChat";
import { asyncHandler } from "../util/asyncHandler";

function shortTitleFromMessages(messages: UIMessage[]): string {
  for (const m of messages) {
    if (m.role === "user" && m.parts?.length) {
      const t = m.parts
        .filter((p): p is { type: "text"; text: string } => p.type === "text")
        .map((p) => p.text)
        .join(" ")
        .trim();
      if (t) return t.length > 80 ? `${t.slice(0, 77)}...` : t;
    }
  }
  return "New chat";
}

function extractLastSearchFromSteps(
  steps: Array<{ toolResults?: Array<{ toolName: string; output: unknown }> }>,
): SearchListingsResult | undefined {
  for (let i = steps.length - 1; i >= 0; i--) {
    const trs = steps[i].toolResults;
    if (!trs?.length) continue;
    for (let j = trs.length - 1; j >= 0; j--) {
      const tr = trs[j];
      if (
        tr.toolName === "search_listings" &&
        tr.output &&
        typeof tr.output === "object"
      ) {
        return tr.output as SearchListingsResult;
      }
    }
  }
  return undefined;
}

export const chatRouter = Router();

chatRouter.post(
  "/",
  optionalAuth,
  asyncHandler(async (req, res) => {
    if (!env.openRouter.apiKey) {
      fail(
        res,
        503,
        ErrorCodes.INTERNAL_ERROR,
        "OPENROUTER_API_KEY is not configured. Get a key at https://openrouter.ai/keys",
      );
      return;
    }

    const body = req.body as { messages?: unknown; chatId?: string };
    if (!Array.isArray(body.messages)) {
      fail(res, 400, ErrorCodes.VALIDATION_ERROR, "messages array is required");
      return;
    }

    const messages = body.messages as UIMessage[];

    let chatId = body.chatId?.trim();
    let chatDoc: IChat | null = null;

    if (chatId) {
      if (!mongoose.isValidObjectId(chatId)) {
        fail(res, 400, ErrorCodes.VALIDATION_ERROR, "Invalid chatId");
        return;
      }
      chatDoc = await Chat.findById(chatId).exec();
      if (!chatDoc) {
        fail(res, 404, ErrorCodes.NOT_FOUND, "Chat not found");
        return;
      }
      if (chatDoc.userId && req.auth?.userId !== chatDoc.userId.toString()) {
        fail(res, 403, ErrorCodes.FORBIDDEN, "Cannot access this chat");
        return;
      }
    } else {
      const title = shortTitleFromMessages(messages);
      chatDoc = await Chat.create({
        userId: req.auth?.userId
          ? new mongoose.Types.ObjectId(req.auth.userId)
          : undefined,
        title,
        messages: [],
      });
      chatId = chatDoc.id;
    }

    const tools = createRentfitTools();
    const modelMessages = await convertToModelMessages(messages, { tools });

    const result = streamText({
      model: createChatModel(),
      system: buildRentfitSystemPrompt({
        lastCitySlug: chatDoc?.lastCitySlug,
        lastFilters: chatDoc?.lastFilters,
      }),
      messages: modelMessages,
      tools,
      stopWhen: stepCountIs(12),
      onFinish: async ({ steps }) => {
        const search = extractLastSearchFromSteps(steps);
        if (!chatId || !search) return;
        await Chat.findByIdAndUpdate(chatId, {
          $set: {
            lastCitySlug: search.applied.citySlug,
            lastFilters: search.applied,
            lastListingIds: search.listings.map(
              (l) => new mongoose.Types.ObjectId(l.id),
            ),
          },
        });
      },
    });

    result.pipeUIMessageStreamToResponse(res, {
      headers: { "X-Chat-Id": chatId! },
      originalMessages: messages,
      onFinish: async ({ messages: uiMessages, isAborted }) => {
        if (isAborted || !chatId) return;
        await Chat.findByIdAndUpdate(chatId, {
          $set: { uiMessages: uiMessages as unknown[] },
        });
      },
    });
  }),
);
