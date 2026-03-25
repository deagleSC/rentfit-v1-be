import mongoose, { type Document, Schema, type Types } from "mongoose";

export type ChatMessageRole = "user" | "assistant" | "system" | "tool";

export interface IChatMessage {
  role: ChatMessageRole;
  content: string;
  createdAt: Date;
}

export interface IChat extends Document {
  userId?: Types.ObjectId;
  title: string;
  messages: IChatMessage[];
  /** Full UI messages for `useChat` replay (Vercel AI SDK shape). */
  uiMessages?: unknown[];
  /** Last successful search_listings city (for refinement context). */
  lastCitySlug?: string;
  /** Opaque filter snapshot from the last tool call (JSON-serializable). */
  lastFilters?: Record<string, unknown>;
  lastListingIds?: Types.ObjectId[];
  createdAt: Date;
}

const chatMessageSchema = new Schema<IChatMessage>(
  {
    role: {
      type: String,
      enum: ["user", "assistant", "system", "tool"],
      required: true,
    },
    content: { type: String, required: true },
    createdAt: { type: Date, default: Date.now },
  },
  { _id: false },
);

const chatSchema = new Schema<IChat>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: false,
      index: true,
    },
    title: { type: String, required: true },
    messages: { type: [chatMessageSchema], default: [] },
    uiMessages: { type: [Schema.Types.Mixed], default: [] },
    lastCitySlug: { type: String },
    lastFilters: { type: Schema.Types.Mixed },
    lastListingIds: [{ type: Schema.Types.ObjectId }],
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

chatSchema.index({ userId: 1, createdAt: -1 });

export const Chat = mongoose.model<IChat>("Chat", chatSchema);
