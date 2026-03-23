import mongoose, { type Document, Schema, type Types } from "mongoose";

export type ChatMessageRole = "user" | "assistant" | "system" | "tool";

export interface IChatMessage {
  role: ChatMessageRole;
  content: string;
  createdAt: Date;
}

export interface IChat extends Document {
  userId: Types.ObjectId;
  title: string;
  messages: IChatMessage[];
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
      required: true,
      index: true,
    },
    title: { type: String, required: true },
    messages: { type: [chatMessageSchema], default: [] },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

chatSchema.index({ userId: 1, createdAt: -1 });

export const Chat = mongoose.model<IChat>("Chat", chatSchema);
