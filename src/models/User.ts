import mongoose, { type Document, Schema, type Types } from "mongoose";

export type UserRole = "renter" | "owner" | "admin";

export interface IUserPreferences {
  savedListings: Types.ObjectId[];
  defaultCity?: string;
}

export interface IUser extends Document {
  email: string;
  passwordHash: string;
  role: UserRole;
  preferences: IUserPreferences;
  createdAt: Date;
  updatedAt: Date;
}

const preferencesSchema = new Schema<IUserPreferences>(
  {
    savedListings: [{ type: Schema.Types.ObjectId, ref: "Listing" }],
    defaultCity: { type: String },
  },
  { _id: false },
);

const userSchema = new Schema<IUser>(
  {
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      index: true,
    },
    passwordHash: { type: String, required: true },
    role: {
      type: String,
      enum: ["renter", "owner", "admin"],
      required: true,
    },
    preferences: {
      type: preferencesSchema,
      default: () => ({ savedListings: [] }),
    },
  },
  { timestamps: true },
);

export const User = mongoose.model<IUser>("User", userSchema);
