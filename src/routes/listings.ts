import { Router } from "express";
import mongoose from "mongoose";
import { Listing, type IAddress, type ListingStatus } from "../models/Listing";
import { requireAuth } from "../middleware/auth";
import { requireOwnerOrAdmin } from "../middleware/roles";
import { ErrorCodes } from "../http/errorCodes";
import { fail, ok } from "../http/response";
import { serializeListing } from "../serializers/listing";
import { asyncHandler } from "../util/asyncHandler";

const MAP_LISTING_LIMIT = 200;

const STATUSES: ListingStatus[] = ["active", "rented", "pending"];

function isNonEmptyString(v: unknown): v is string {
  return typeof v === "string" && v.trim().length > 0;
}

function parseStringArray(
  v: unknown,
  field: string,
): string[] | { error: string } {
  if (v === undefined) return [];
  if (!Array.isArray(v))
    return { error: `${field} must be an array of strings` };
  const out: string[] = [];
  for (const item of v) {
    if (typeof item !== "string")
      return { error: `${field} must be an array of strings` };
    const t = item.trim();
    if (t) out.push(t);
  }
  return out;
}

function parseAddress(v: unknown): IAddress | { error: string } {
  if (v === undefined || v === null) return {};
  if (typeof v !== "object" || v === null) {
    return { error: "address must be an object" };
  }
  const o = v as Record<string, unknown>;
  const text = typeof o.text === "string" ? o.text.trim() : undefined;
  const locality =
    typeof o.locality === "string" ? o.locality.trim() : undefined;
  const city = typeof o.city === "string" ? o.city.trim() : undefined;
  return { text, locality, city };
}

function parseCoordinates(
  v: unknown,
): { lng: number; lat: number } | { error: string } {
  if (!v || typeof v !== "object") {
    return { error: "location.coordinates must be [longitude, latitude]" };
  }
  const coords = (v as { coordinates?: unknown }).coordinates;
  if (!Array.isArray(coords) || coords.length !== 2) {
    return { error: "location.coordinates must be [longitude, latitude]" };
  }
  const lng = Number(coords[0]);
  const lat = Number(coords[1]);
  if (!Number.isFinite(lng) || !Number.isFinite(lat)) {
    return { error: "location.coordinates must be numbers" };
  }
  if (lng < -180 || lng > 180 || lat < -90 || lat > 90) {
    return { error: "coordinates out of range (lng ±180, lat ±90)" };
  }
  return { lng, lat };
}

function parseCreateBody(body: unknown):
  | { error: string }
  | {
      title: string;
      description: string;
      price: number;
      type: string;
      lng: number;
      lat: number;
      address: IAddress;
      amenities: string[];
      images: string[];
    } {
  if (!body || typeof body !== "object") {
    return { error: "JSON body is required" };
  }
  const b = body as Record<string, unknown>;
  if (!isNonEmptyString(b.title)) return { error: "title is required" };
  if (!isNonEmptyString(b.description))
    return { error: "description is required" };
  if (!isNonEmptyString(b.type)) return { error: "type is required" };
  const price = Number(b.price);
  if (!Number.isFinite(price) || price <= 0) {
    return { error: "price must be a positive number" };
  }
  const loc = parseCoordinates(b.location);
  if ("error" in loc) return loc;
  const addr = parseAddress(b.address);
  if ("error" in addr) return addr;
  const amenities = parseStringArray(b.amenities, "amenities");
  if ("error" in amenities) return amenities;
  const images = parseStringArray(b.images, "images");
  if ("error" in images) return images;
  return {
    title: b.title.trim(),
    description: b.description.trim(),
    price,
    type: b.type.trim(),
    lng: loc.lng,
    lat: loc.lat,
    address: addr,
    amenities,
    images,
  };
}

type ListingUpdatePatch = {
  title?: string;
  description?: string;
  price?: number;
  type?: string;
  lng?: number;
  lat?: number;
  address?: IAddress;
  amenities?: string[];
  images?: string[];
  status?: ListingStatus;
};

function parseUpdateBody(
  body: unknown,
): { error: string } | ListingUpdatePatch {
  if (!body || typeof body !== "object") {
    return { error: "JSON body is required" };
  }
  const b = body as Record<string, unknown>;
  const patch: ListingUpdatePatch = {};

  if (b.title !== undefined) {
    if (!isNonEmptyString(b.title)) return { error: "title cannot be empty" };
    patch.title = b.title.trim();
  }
  if (b.description !== undefined) {
    if (!isNonEmptyString(b.description))
      return { error: "description cannot be empty" };
    patch.description = b.description.trim();
  }
  if (b.price !== undefined) {
    const price = Number(b.price);
    if (!Number.isFinite(price) || price <= 0) {
      return { error: "price must be a positive number" };
    }
    patch.price = price;
  }
  if (b.type !== undefined) {
    if (!isNonEmptyString(b.type)) return { error: "type cannot be empty" };
    patch.type = b.type.trim();
  }
  if (b.location !== undefined) {
    const loc = parseCoordinates(b.location);
    if ("error" in loc) return loc;
    patch.lng = loc.lng;
    patch.lat = loc.lat;
  }
  if (b.address !== undefined) {
    const addr = parseAddress(b.address);
    if ("error" in addr) return addr;
    patch.address = addr;
  }
  if (b.amenities !== undefined) {
    const amenities = parseStringArray(b.amenities, "amenities");
    if ("error" in amenities) return amenities;
    patch.amenities = amenities;
  }
  if (b.images !== undefined) {
    const images = parseStringArray(b.images, "images");
    if ("error" in images) return images;
    patch.images = images;
  }
  if (b.status !== undefined) {
    if (
      typeof b.status !== "string" ||
      !STATUSES.includes(b.status as ListingStatus)
    ) {
      return { error: `status must be one of: ${STATUSES.join(", ")}` };
    }
    patch.status = b.status as ListingStatus;
  }

  if (Object.keys(patch).length === 0) {
    return { error: "No valid fields to update" };
  }
  return patch;
}

function parseBbox(
  raw: unknown,
):
  | { minLng: number; minLat: number; maxLng: number; maxLat: number }
  | { error: string } {
  if (typeof raw !== "string" || !raw.trim()) {
    return { error: "bbox query is required (minLng,minLat,maxLng,maxLat)" };
  }
  const parts = raw.split(",").map((s) => s.trim());
  if (parts.length !== 4) {
    return { error: "bbox must have four comma-separated numbers" };
  }
  const nums = parts.map((p) => Number(p));
  if (nums.some((n) => !Number.isFinite(n))) {
    return { error: "bbox values must be numbers" };
  }
  const [minLng, minLat, maxLng, maxLat] = nums;
  if (minLng >= maxLng || minLat >= maxLat) {
    return { error: "bbox must satisfy minLng < maxLng and minLat < maxLat" };
  }
  if (minLng < -180 || maxLng > 180 || minLat < -90 || maxLat > 90) {
    return { error: "bbox coordinates out of range" };
  }
  return { minLng, minLat, maxLng, maxLat };
}

function canEditListing(
  ownerId: string,
  userId: string,
  role: string,
): boolean {
  if (role === "admin") return true;
  return ownerId === userId;
}

export const listingsRouter = Router();

listingsRouter.post(
  "/",
  requireAuth,
  requireOwnerOrAdmin,
  asyncHandler(async (req, res) => {
    const parsed = parseCreateBody(req.body);
    if ("error" in parsed) {
      fail(res, 400, ErrorCodes.VALIDATION_ERROR, parsed.error);
      return;
    }
    const userId = req.auth!.userId;
    const doc = await Listing.create({
      ownerId: userId,
      title: parsed.title,
      description: parsed.description,
      price: parsed.price,
      type: parsed.type,
      location: {
        type: "Point",
        coordinates: [parsed.lng, parsed.lat],
      },
      address: parsed.address,
      amenities: parsed.amenities,
      images: parsed.images,
      status: "active",
    });
    ok(res, 201, { listing: serializeListing(doc) });
  }),
);

listingsRouter.get(
  "/:id",
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    if (!mongoose.isValidObjectId(id)) {
      fail(res, 404, ErrorCodes.NOT_FOUND, "Listing not found");
      return;
    }
    const doc = await Listing.findById(id);
    if (!doc) {
      fail(res, 404, ErrorCodes.NOT_FOUND, "Listing not found");
      return;
    }
    ok(res, 200, { listing: serializeListing(doc) });
  }),
);

listingsRouter.put(
  "/:id",
  requireAuth,
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    if (!mongoose.isValidObjectId(id)) {
      fail(res, 404, ErrorCodes.NOT_FOUND, "Listing not found");
      return;
    }
    const parsed = parseUpdateBody(req.body);
    if ("error" in parsed) {
      fail(res, 400, ErrorCodes.VALIDATION_ERROR, parsed.error);
      return;
    }

    const doc = await Listing.findById(id);
    if (!doc) {
      fail(res, 404, ErrorCodes.NOT_FOUND, "Listing not found");
      return;
    }

    const auth = req.auth!;
    if (!canEditListing(doc.ownerId.toString(), auth.userId, auth.role)) {
      fail(res, 403, ErrorCodes.FORBIDDEN, "You cannot edit this listing");
      return;
    }

    if (parsed.title !== undefined) doc.title = parsed.title;
    if (parsed.description !== undefined) doc.description = parsed.description;
    if (parsed.price !== undefined) doc.price = parsed.price;
    if (parsed.type !== undefined) doc.type = parsed.type;
    if (parsed.lng !== undefined && parsed.lat !== undefined) {
      doc.location = {
        type: "Point",
        coordinates: [parsed.lng, parsed.lat],
      };
    }
    if (parsed.address !== undefined) doc.address = parsed.address;
    if (parsed.amenities !== undefined) doc.amenities = parsed.amenities;
    if (parsed.images !== undefined) doc.images = parsed.images;
    if (parsed.status !== undefined) doc.status = parsed.status;

    await doc.save();
    ok(res, 200, { listing: serializeListing(doc) });
  }),
);

export const mapRouter = Router();

mapRouter.get(
  "/listings",
  asyncHandler(async (req, res) => {
    const bbox = parseBbox(req.query.bbox);
    if ("error" in bbox) {
      fail(res, 400, ErrorCodes.VALIDATION_ERROR, bbox.error);
      return;
    }

    // Exterior ring: counter-clockwise on the sphere (GeoJSON / MongoDB 2dsphere)
    const polygon = {
      type: "Polygon" as const,
      coordinates: [
        [
          [bbox.minLng, bbox.maxLat],
          [bbox.maxLng, bbox.maxLat],
          [bbox.maxLng, bbox.minLat],
          [bbox.minLng, bbox.minLat],
          [bbox.minLng, bbox.maxLat],
        ],
      ],
    };

    const docs = await Listing.find({
      status: "active",
      location: {
        $geoWithin: {
          $geometry: polygon,
        },
      },
    })
      .sort({ createdAt: -1 })
      .limit(MAP_LISTING_LIMIT)
      .exec();

    ok(res, 200, {
      listings: docs.map(serializeListing),
      count: docs.length,
    });
  }),
);
