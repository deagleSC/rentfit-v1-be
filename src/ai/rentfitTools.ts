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
        "Search active rental listings in MongoDB. Only citySlug values bangalore, mumbai, kolkata are supported. areaName is optional fuzzy text matched against addresses and listing title/description—if results are empty, retry with only citySlug (and price if the user gave a budget) before concluding nothing exists. Amenities use AND logic; omit amenities if the first call returns [].",
      inputSchema: z.object({
        citySlug: z.enum(["bangalore", "mumbai", "kolkata"]),
        areaName: z.string().optional(),
        priceMin: z.number().optional(),
        priceMax: z.number().optional(),
        type: z
          .string()
          .optional()
          .describe(
            "Listing layout in DB: 1BHK, 2BHK, 3BHK, Studio, PG, etc. Omit for generic asks (flats, apartments). Words like flat/apartment/rental are ignored as filters.",
          ),
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
