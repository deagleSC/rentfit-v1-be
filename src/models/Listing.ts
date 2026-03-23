import mongoose, { type Document, Schema, type Types } from "mongoose";

export type ListingType = "1BHK" | "2BHK" | "3BHK" | "PG" | "Studio" | string;
export type ListingStatus = "active" | "rented" | "pending";
export type DealQuality = "Great" | "Fair" | "Overpriced";

export interface IGeoPoint {
  type: "Point";
  coordinates: [number, number]; // [longitude, latitude]
}

export interface IAddress {
  text?: string;
  locality?: string;
  city?: string;
}

export interface IAiInsights {
  pros: string[];
  cons: string[];
  trustScore: number; // 0–100
  dealQuality: DealQuality;
}

export interface IListing extends Document {
  ownerId: Types.ObjectId;
  title: string;
  description: string;
  price: number;
  type: ListingType;
  location: IGeoPoint;
  address: IAddress;
  amenities: string[];
  images: string[];
  aiInsights?: IAiInsights;
  status: ListingStatus;
  createdAt: Date;
}

const aiInsightsSchema = new Schema<IAiInsights>(
  {
    pros: [{ type: String }],
    cons: [{ type: String }],
    trustScore: { type: Number, min: 0, max: 100 },
    dealQuality: {
      type: String,
      enum: ["Great", "Fair", "Overpriced"],
    },
  },
  { _id: false },
);

const addressSchema = new Schema<IAddress>(
  {
    text: { type: String },
    locality: { type: String },
    city: { type: String },
  },
  { _id: false },
);

const listingSchema = new Schema<IListing>(
  {
    ownerId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    title: { type: String, required: true },
    description: { type: String, required: true },
    price: { type: Number, required: true, index: true },
    type: { type: String, required: true, index: true },
    location: {
      type: {
        type: String,
        enum: ["Point"],
        default: "Point",
        required: true,
      },
      coordinates: {
        type: [Number],
        required: true,
        validate: {
          validator(v: number[]) {
            return (
              Array.isArray(v) &&
              v.length === 2 &&
              typeof v[0] === "number" &&
              typeof v[1] === "number"
            );
          },
          message: "coordinates must be [longitude, latitude]",
        },
      },
    },
    address: { type: addressSchema, default: () => ({}) },
    amenities: [{ type: String }],
    images: [{ type: String }],
    aiInsights: { type: aiInsightsSchema },
    status: {
      type: String,
      enum: ["active", "rented", "pending"],
      default: "active",
      index: true,
    },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

listingSchema.index({ location: "2dsphere" });
listingSchema.index({ price: 1, type: 1, status: 1 });

export const Listing = mongoose.model<IListing>("Listing", listingSchema);
