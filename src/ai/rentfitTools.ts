import { tool } from "ai";
import { z } from "zod";
import mongoose from "mongoose";
import { Listing } from "../models/Listing";
import {
  searchListingsForChat,
  type SearchListingsResult,
} from "../services/searchListingsForChat";
import { serializeListing } from "../serializers/listing";

export function createRentfitTools() {
  return {
    search_listings: tool({
      description:
        "Search active rental listings in MongoDB. Only citySlug values bangalore, mumbai, kolkata are supported. Use areaName for a neighborhood (e.g. Indiranagar, Bandra).",
      inputSchema: z.object({
        citySlug: z.enum(["bangalore", "mumbai", "kolkata"]),
        areaName: z.string().optional(),
        priceMin: z.number().optional(),
        priceMax: z.number().optional(),
        type: z.string().optional(),
        amenities: z.array(z.string()).optional(),
        limit: z.number().int().min(1).max(25).optional(),
      }),
      execute: async (input): Promise<SearchListingsResult> => {
        return searchListingsForChat(input);
      },
    }),

    get_listing_details: tool({
      description:
        "Load full details for one listing by id (from search_listings results) for deeper questions.",
      inputSchema: z.object({
        listingId: z.string(),
      }),
      execute: async ({ listingId }) => {
        if (!mongoose.isValidObjectId(listingId)) {
          return { error: "invalid_id" as const };
        }
        const doc = await Listing.findById(listingId).exec();
        if (!doc) return { error: "not_found" as const };
        return { listing: serializeListing(doc) };
      },
    }),
  };
}

export type RentfitTools = ReturnType<typeof createRentfitTools>;
