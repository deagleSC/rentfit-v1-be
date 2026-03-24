import mongoose, { type Document, Schema } from "mongoose";

export type ServiceCitySlug = "bangalore" | "mumbai" | "kolkata";
export type ServiceAreaKind = "city" | "neighborhood";

export interface IServiceArea extends Document {
  citySlug: ServiceCitySlug;
  kind: ServiceAreaKind;
  name: string;
  aliases: string[];
  location: { type: "Point"; coordinates: [number, number] };
  radiusMeters: number;
}

const serviceAreaSchema = new Schema<IServiceArea>(
  {
    citySlug: {
      type: String,
      enum: ["bangalore", "mumbai", "kolkata"],
      required: true,
      index: true,
    },
    kind: {
      type: String,
      enum: ["city", "neighborhood"],
      required: true,
      index: true,
    },
    name: { type: String, required: true },
    aliases: [{ type: String }],
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
      },
    },
    radiusMeters: { type: Number, required: true, min: 100 },
  },
  { timestamps: false },
);

serviceAreaSchema.index({ location: "2dsphere" });
serviceAreaSchema.index({ citySlug: 1, kind: 1 });

export const ServiceArea = mongoose.model<IServiceArea>(
  "ServiceArea",
  serviceAreaSchema,
);
