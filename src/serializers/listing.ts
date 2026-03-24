import type { IListing } from "../models/Listing";

export type SerializedListing = {
  id: string;
  ownerId: string;
  title: string;
  description: string;
  price: number;
  type: string;
  location: { type: "Point"; coordinates: [number, number] };
  address: { text?: string; locality?: string; city?: string };
  amenities: string[];
  images: string[];
  aiInsights?: {
    pros: string[];
    cons: string[];
    trustScore: number;
    dealQuality: string;
  };
  status: string;
  createdAt: string;
};

export function serializeListing(doc: IListing): SerializedListing {
  return {
    id: doc.id,
    ownerId: doc.ownerId.toString(),
    title: doc.title,
    description: doc.description,
    price: doc.price,
    type: doc.type,
    location: {
      type: "Point",
      coordinates: [doc.location.coordinates[0], doc.location.coordinates[1]],
    },
    address: doc.address ?? {},
    amenities: doc.amenities ?? [],
    images: doc.images ?? [],
    aiInsights: doc.aiInsights
      ? {
          pros: doc.aiInsights.pros ?? [],
          cons: doc.aiInsights.cons ?? [],
          trustScore:
            typeof doc.aiInsights.trustScore === "number"
              ? doc.aiInsights.trustScore
              : 0,
          dealQuality: doc.aiInsights.dealQuality ?? "Fair",
        }
      : undefined,
    status: doc.status,
    createdAt: doc.createdAt.toISOString(),
  };
}
