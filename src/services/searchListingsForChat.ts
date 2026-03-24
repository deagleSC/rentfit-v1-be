import type { FilterQuery } from "mongoose";
import { Listing, type IListing } from "../models/Listing";
import { ServiceArea, type ServiceCitySlug } from "../models/ServiceArea";

export type SearchListingsArgs = {
  citySlug: ServiceCitySlug;
  /** Optional neighborhood / locality name; matched against seeded areas or address text. */
  areaName?: string;
  priceMin?: number;
  priceMax?: number;
  type?: string;
  amenities?: string[];
  limit?: number;
};

export type SearchListingsResult = {
  listings: Array<{
    id: string;
    title: string;
    price: number;
    type: string;
    locality?: string;
    city?: string;
    lng: number;
    lat: number;
  }>;
  applied: {
    citySlug: ServiceCitySlug;
    areaLabel: string;
    priceMin?: number;
    priceMax?: number;
    type?: string;
    amenities?: string[];
  };
  note?: string;
};

const EARTH_RADIUS_M = 6378100;
const DEFAULT_LIMIT = 15;
const MAX_LIMIT = 25;

function toRadians(meters: number): number {
  return meters / EARTH_RADIUS_M;
}

function normalize(s: string): string {
  return s.trim().toLowerCase();
}

async function resolveArea(
  citySlug: ServiceCitySlug,
  areaName: string | undefined,
): Promise<{
  lng: number;
  lat: number;
  radiusM: number;
  areaLabel: string;
  localityRegex?: RegExp;
}> {
  const city = await ServiceArea.findOne({ citySlug, kind: "city" }).exec();
  if (!city) {
    throw new Error(`City not configured: ${citySlug}`);
  }
  const [lng, lat] = city.location.coordinates;

  if (!areaName?.trim()) {
    return {
      lng,
      lat,
      radiusM: city.radiusMeters,
      areaLabel: city.name,
    };
  }

  const n = normalize(areaName);
  const hoods = await ServiceArea.find({
    citySlug,
    kind: "neighborhood",
  }).exec();
  const match = hoods.find(
    (h) =>
      normalize(h.name).includes(n) ||
      n.includes(normalize(h.name)) ||
      h.aliases.some(
        (a) => normalize(a).includes(n) || n.includes(normalize(a)),
      ),
  );

  if (match) {
    const [hlng, hlat] = match.location.coordinates;
    return {
      lng: hlng,
      lat: hlat,
      radiusM: match.radiusMeters,
      areaLabel: match.name,
    };
  }

  return {
    lng,
    lat,
    radiusM: city.radiusMeters,
    areaLabel: city.name,
    localityRegex: new RegExp(
      areaName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"),
      "i",
    ),
  };
}

export async function searchListingsForChat(
  args: SearchListingsArgs,
): Promise<SearchListingsResult> {
  const limit = Math.min(Math.max(1, args.limit ?? DEFAULT_LIMIT), MAX_LIMIT);

  const geo = await resolveArea(args.citySlug, args.areaName);
  const radiusRad = toRadians(geo.radiusM);

  const match: FilterQuery<IListing> = {
    status: "active",
    location: {
      $geoWithin: {
        $centerSphere: [[geo.lng, geo.lat], radiusRad],
      },
    },
  };

  if (args.priceMin != null || args.priceMax != null) {
    match.price = {};
    if (args.priceMin != null) match.price.$gte = args.priceMin;
    if (args.priceMax != null) match.price.$lte = args.priceMax;
  }

  if (args.type?.trim()) {
    match.type = new RegExp(`^${escapeRegex(args.type.trim())}$`, "i");
  }

  if (args.amenities?.length) {
    match.amenities = { $all: args.amenities };
  }

  if (geo.localityRegex) {
    match.$or = [
      { "address.locality": geo.localityRegex },
      { "address.text": geo.localityRegex },
      { "address.city": geo.localityRegex },
    ];
  }

  const docs = await Listing.find(match)
    .sort({ createdAt: -1 })
    .limit(limit)
    .exec();

  const listings = docs.map((d) => {
    const [dlng, dlat] = d.location.coordinates;
    return {
      id: d.id,
      title: d.title,
      price: d.price,
      type: d.type,
      locality: d.address?.locality,
      city: d.address?.city,
      lng: dlng,
      lat: dlat,
    };
  });

  const applied = {
    citySlug: args.citySlug,
    areaLabel: geo.areaLabel,
    priceMin: args.priceMin,
    priceMax: args.priceMax,
    type: args.type,
    amenities: args.amenities,
  };

  const note =
    geo.localityRegex && docs.length === 0
      ? `No exact neighborhood match in DB for "${args.areaName}"; broadened to ${geo.areaLabel} with a text filter — try another area or widen price/type.`
      : geo.localityRegex && docs.length > 0
        ? `Matched locality "${args.areaName}" via text search within ${geo.areaLabel}.`
        : undefined;

  return { listings, applied, note };
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
