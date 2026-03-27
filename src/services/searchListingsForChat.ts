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

/** User/model often passes generic words; DB types are 1BHK, 2BHK, 3BHK, Studio, PG, etc. */
const GENERIC_PROPERTY_TYPE_TERMS = new Set([
  "flat",
  "flats",
  "apartment",
  "apartments",
  "apt",
  "rental",
  "rentals",
  "house",
  "houses",
  "home",
  "homes",
  "property",
  "properties",
  "unit",
  "units",
  "listing",
  "listings",
  "place",
  "places",
  "accommodation",
]);

function isGenericPropertyTypeTerm(type: string | undefined): boolean {
  if (!type?.trim()) return false;
  return GENERIC_PROPERTY_TYPE_TERMS.has(normalize(type));
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function addCommonListingFilters(
  base: FilterQuery<IListing>,
  args: SearchListingsArgs,
): FilterQuery<IListing> {
  const m: FilterQuery<IListing> = { ...base };
  if (args.priceMin != null || args.priceMax != null) {
    m.price = {};
    if (args.priceMin != null) m.price.$gte = args.priceMin;
    if (args.priceMax != null) m.price.$lte = args.priceMax;
  }
  if (args.type?.trim() && !isGenericPropertyTypeTerm(args.type)) {
    m.type = new RegExp(`^${escapeRegex(args.type.trim())}$`, "i");
  }
  if (args.amenities?.length) {
    m.amenities = { $all: args.amenities };
  }
  return m;
}

function stripBranchAmenities(b: FilterQuery<IListing>): FilterQuery<IListing> {
  if (!("amenities" in b)) return b;
  const { amenities: _drop, ...rest } = b;
  return rest;
}

function stripBranchType(b: FilterQuery<IListing>): FilterQuery<IListing> {
  if (!("type" in b)) return b;
  const { type: _drop, ...rest } = b;
  return rest;
}

function stripOrTreeAmenities(m: FilterQuery<IListing>): FilterQuery<IListing> {
  if ("$or" in m && Array.isArray(m.$or)) {
    return {
      $or: m.$or.map((branch) =>
        stripBranchAmenities(branch as FilterQuery<IListing>),
      ),
    };
  }
  return stripBranchAmenities(m);
}

function stripOrTreeType(m: FilterQuery<IListing>): FilterQuery<IListing> {
  if ("$or" in m && Array.isArray(m.$or)) {
    return {
      $or: m.$or.map((branch) =>
        stripBranchType(branch as FilterQuery<IListing>),
      ),
    };
  }
  return stripBranchType(m);
}

function queryHasAmenityFilter(m: FilterQuery<IListing>): boolean {
  if ("amenities" in m) return true;
  if ("$or" in m && Array.isArray(m.$or)) {
    return m.$or.some(
      (b) => typeof b === "object" && b !== null && "amenities" in b,
    );
  }
  return false;
}

function queryHasTypeFilter(m: FilterQuery<IListing>): boolean {
  if ("type" in m) return true;
  if ("$or" in m && Array.isArray(m.$or)) {
    return m.$or.some(
      (b) => typeof b === "object" && b !== null && "type" in b,
    );
  }
  return false;
}

function cityTextFallbackTokens(citySlug: ServiceCitySlug): string[] {
  if (citySlug === "kolkata") return ["Kolkota", "West Bengal"];
  return [];
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
  /** City-wide queries can union `citySlug` on listings with geo (see search). */
  scope: "city" | "neighborhood" | "fuzzy_text";
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
      scope: "city",
    };
  }

  const n = normalize(areaName);
  const cityNameNorm = normalize(city.name);
  const matchesCityWideName =
    n === cityNameNorm || city.aliases.some((a) => normalize(a) === n);
  if (matchesCityWideName) {
    return {
      lng,
      lat,
      radiusM: city.radiusMeters,
      areaLabel: city.name,
      scope: "city",
    };
  }

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
      scope: "neighborhood",
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
    scope: "fuzzy_text",
  };
}

export async function searchListingsForChat(
  args: SearchListingsArgs,
): Promise<SearchListingsResult> {
  const limit = Math.min(Math.max(1, args.limit ?? DEFAULT_LIMIT), MAX_LIMIT);

  const geo = await resolveArea(args.citySlug, args.areaName);
  const radiusRad = toRadians(geo.radiusM);

  const sort = { createdAt: -1 as const };
  const findLimited = (q: FilterQuery<IListing>) =>
    Listing.find(q).sort(sort).limit(limit).exec();

  const notes: string[] = [];
  let currentMatch: FilterQuery<IListing>;
  let docs: IListing[];

  const stripLocalityOr = (m: FilterQuery<IListing>): FilterQuery<IListing> => {
    if (!("$or" in m)) return m;
    const { $or: _drop, ...rest } = m;
    return rest;
  };

  const stripAmenities = (m: FilterQuery<IListing>): FilterQuery<IListing> => {
    if (!("amenities" in m)) return m;
    const { amenities: _drop, ...rest } = m;
    return rest;
  };

  const stripType = (m: FilterQuery<IListing>): FilterQuery<IListing> => {
    if (!("type" in m)) return m;
    const { type: _drop, ...rest } = m;
    return rest;
  };

  if (geo.scope === "city") {
    const slugPart = addCommonListingFilters(
      { status: "active", citySlug: args.citySlug },
      args,
    );
    const geoPart = addCommonListingFilters(
      {
        status: "active",
        location: {
          $geoWithin: {
            $centerSphere: [[geo.lng, geo.lat], radiusRad],
          },
        },
      },
      args,
    );
    currentMatch = { $or: [slugPart, geoPart] };
    docs = await findLimited(currentMatch);

    if (
      docs.length === 0 &&
      args.amenities?.length &&
      queryHasAmenityFilter(currentMatch)
    ) {
      currentMatch = stripOrTreeAmenities(currentMatch);
      docs = await findLimited(currentMatch);
      if (docs.length > 0) {
        notes.push(
          "No listings matched all requested amenities; results shown without the amenity filter.",
        );
      }
    }

    if (
      docs.length === 0 &&
      args.type?.trim() &&
      !isGenericPropertyTypeTerm(args.type) &&
      queryHasTypeFilter(currentMatch)
    ) {
      currentMatch = stripOrTreeType(currentMatch);
      docs = await findLimited(currentMatch);
      if (docs.length > 0) {
        notes.push(
          "No listings matched the exact property type; results shown without the type filter.",
        );
      }
    }
  } else {
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

    if (args.type?.trim() && !isGenericPropertyTypeTerm(args.type)) {
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
        { title: geo.localityRegex },
        { description: geo.localityRegex },
      ];
    }

    currentMatch = match;
    docs = await findLimited(currentMatch);

    if (docs.length === 0 && geo.localityRegex && "$or" in currentMatch) {
      currentMatch = stripLocalityOr(currentMatch);
      docs = await findLimited(currentMatch);
      if (docs.length > 0) {
        notes.push(
          `The area phrase "${args.areaName}" did not match saved address or title text closely enough; showing active listings in the ${geo.areaLabel} map region instead (same geo search, no text filter).`,
        );
      }
    }

    if (
      docs.length === 0 &&
      args.amenities?.length &&
      "amenities" in currentMatch
    ) {
      currentMatch = stripAmenities(currentMatch);
      docs = await findLimited(currentMatch);
      if (docs.length > 0) {
        notes.push(
          "No listings matched all requested amenities; results shown without the amenity filter.",
        );
      }
    }

    if (
      docs.length === 0 &&
      args.type?.trim() &&
      !isGenericPropertyTypeTerm(args.type) &&
      "type" in currentMatch
    ) {
      currentMatch = stripType(currentMatch);
      docs = await findLimited(currentMatch);
      if (docs.length > 0) {
        notes.push(
          "No listings matched the exact property type; results shown without the type filter.",
        );
      }
    }
  }

  /**
   * Listings may carry the city in text or `citySlug` while coordinates sit outside the disk.
   */
  if (docs.length === 0) {
    const cityRow = await ServiceArea.findOne({
      citySlug: args.citySlug,
      kind: "city",
    }).exec();
    if (cityRow) {
      const textTokens = [
        cityRow.name,
        ...cityRow.aliases,
        ...cityTextFallbackTokens(args.citySlug),
      ];
      const pattern = new RegExp(textTokens.map(escapeRegex).join("|"), "i");
      const slugOrText: FilterQuery<IListing>[] = [
        { citySlug: args.citySlug },
        { "address.city": pattern },
        { "address.locality": pattern },
        { "address.text": pattern },
        { title: pattern },
        { description: pattern },
      ];
      let fb: FilterQuery<IListing> = {
        status: "active",
        $or: slugOrText,
      };
      if (args.priceMin != null || args.priceMax != null) {
        fb.price = {};
        if (args.priceMin != null) fb.price.$gte = args.priceMin;
        if (args.priceMax != null) fb.price.$lte = args.priceMax;
      }
      if (args.type?.trim() && !isGenericPropertyTypeTerm(args.type)) {
        fb.type = new RegExp(`^${escapeRegex(args.type.trim())}$`, "i");
      }
      if (args.amenities?.length) {
        fb.amenities = { $all: args.amenities };
      }

      let fbDocs = await findLimited(fb);
      if (fbDocs.length === 0 && args.amenities?.length && "amenities" in fb) {
        fb = stripAmenities(fb);
        fbDocs = await findLimited(fb);
      }
      if (
        fbDocs.length === 0 &&
        args.type?.trim() &&
        !isGenericPropertyTypeTerm(args.type) &&
        "type" in fb
      ) {
        fb = stripType(fb);
        fbDocs = await findLimited(fb);
      }

      if (fbDocs.length > 0) {
        docs = fbDocs;
        currentMatch = fb;
        notes.push(
          `No matches from the primary geo/slug query; found ${fbDocs.length} active listing(s) by saved city tag or city/name text—verify map pins.`,
        );
      }
    }
  }

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

  const appliedAmenities =
    args.amenities?.length && queryHasAmenityFilter(currentMatch)
      ? args.amenities
      : undefined;
  const appliedType =
    args.type?.trim() && queryHasTypeFilter(currentMatch)
      ? args.type
      : undefined;

  const applied = {
    citySlug: args.citySlug,
    areaLabel: geo.areaLabel,
    priceMin: args.priceMin,
    priceMax: args.priceMax,
    type: appliedType,
    amenities: appliedAmenities,
  };

  if (geo.localityRegex && docs.length > 0 && "$or" in currentMatch) {
    notes.push(
      `Matched "${args.areaName}" via text search within ${geo.areaLabel}.`,
    );
  }

  if (docs.length === 0) {
    notes.push(
      "No active listings matched these filters in this region. Widen price, omit amenities or area text, or try search_listings again with only citySlug.",
    );
  }

  const note = notes.length ? notes.join(" ") : undefined;

  return { listings, applied, note };
}
