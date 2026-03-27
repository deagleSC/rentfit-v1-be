/**
 * Inserts demo listings in Kolkata and Mumbai for local/staging QA.
 * Uses a dedicated owner account (created if missing); re-running replaces only that user's listings.
 *
 * Prerequisite: `yarn seed:service-areas` so city disks match inference/search.
 *
 * Usage: yarn seed:sample-listings
 */
import { hashPassword } from "../auth/password";
import { connectDb, disconnectDb } from "../db/connect";
import { Listing } from "../models/Listing";
import { User } from "../models/User";

const SEED_OWNER_EMAIL = "sample-listings-owner@rentfit.internal";
const SEED_OWNER_PASSWORD = "rentfit-sample-listings";

type SampleRow = {
  citySlug: "kolkata" | "mumbai";
  title: string;
  description: string;
  price: number;
  type: string;
  lng: number;
  lat: number;
  locality: string;
  city: string;
  amenities: string[];
};

const SAMPLES: SampleRow[] = [
  {
    citySlug: "kolkata",
    title: "Bright 2BHK near Salt Lake Sector V",
    description:
      "Corner unit with morning light, two bedrooms, modular kitchen, and covered parking. Walkable to tech parks and the Salt Lake stadium.",
    price: 22_000,
    type: "2BHK",
    lng: 88.4092,
    lat: 22.5845,
    locality: "Salt Lake",
    city: "Kolkata",
    amenities: ["parking", "power backup", "lift"],
  },
  {
    citySlug: "kolkata",
    title: "Compact studio off Park Street",
    description:
      "Furnished studio ideal for a single professional. Cafés, Park Street dining, and Maidan greens within easy reach.",
    price: 14_500,
    type: "Studio",
    lng: 88.3518,
    lat: 22.5498,
    locality: "Park Street",
    city: "Kolkata",
    amenities: ["furnished", "wifi"],
  },
  {
    citySlug: "kolkata",
    title: "Spacious 3BHK in New Town Action Area",
    description:
      "Three bedrooms, two baths, servant quarter, east-facing balconies. Quiet residential block with club access nearby.",
    price: 35_000,
    type: "3BHK",
    lng: 88.4762,
    lat: 22.5901,
    locality: "New Town",
    city: "Kolkata",
    amenities: ["parking", "gym", "clubhouse", "lift"],
  },
  {
    citySlug: "kolkata",
    title: "1BHK in Ballygunge — metro-linked",
    description:
      "Well-ventilated one bedroom with separate kitchen. Short ride to Kalighat and Rabindra Sarobar.",
    price: 16_000,
    type: "1BHK",
    lng: 88.3654,
    lat: 22.5189,
    locality: "Ballygunge",
    city: "Kolkata",
    amenities: ["lift"],
  },
  {
    citySlug: "mumbai",
    title: "Sea-facing 2BHK Bandra West",
    description:
      "Upper-floor apartment with partial sea views, wooden flooring, and in-unit laundry. Bandstand and Linking Road minutes away.",
    price: 85_000,
    type: "2BHK",
    lng: 72.8245,
    lat: 19.0542,
    locality: "Bandra West",
    city: "Mumbai",
    amenities: ["parking", "lift", "sea view"],
  },
  {
    citySlug: "mumbai",
    title: "PG-style double sharing Andheri East",
    description:
      "Managed PG with meals, housekeeping, and Wi‑Fi. Close to metro and Chakala business hub.",
    price: 9_500,
    type: "PG",
    lng: 72.8721,
    lat: 19.1124,
    locality: "Andheri East",
    city: "Mumbai",
    amenities: ["meals", "wifi", "housekeeping"],
  },
  {
    citySlug: "mumbai",
    title: "Lake-view 3BHK Powai Hiranandani",
    description:
      "Large living-dining, modular kitchen, three baths, and two covered car parks. IIT Bombay and Powai lake walks.",
    price: 1_25_000,
    type: "3BHK",
    lng: 72.9068,
    lat: 19.1192,
    locality: "Powai",
    city: "Mumbai",
    amenities: ["parking", "gym", "lift", "lake view"],
  },
  {
    citySlug: "mumbai",
    title: "Cozy 1BHK Fort — heritage neighbourhood",
    description:
      "Heritage walk-up with high ceilings, recently painted, ideal for consultants near CST and Ballard Estate.",
    price: 48_000,
    type: "1BHK",
    lng: 72.8347,
    lat: 18.9342,
    locality: "Fort",
    city: "Mumbai",
    amenities: ["heritage building"],
  },
];

async function ensureSeedOwner() {
  let user = await User.findOne({ email: SEED_OWNER_EMAIL }).exec();
  if (!user) {
    const passwordHash = await hashPassword(SEED_OWNER_PASSWORD);
    user = await User.create({
      email: SEED_OWNER_EMAIL,
      passwordHash,
      role: "owner",
      preferences: { savedListings: [] },
    });
    console.log(
      `Created seed owner ${SEED_OWNER_EMAIL} (password: ${SEED_OWNER_PASSWORD}). Change or delete this user in production.`,
    );
  }
  return user;
}

async function main() {
  await connectDb();
  const owner = await ensureSeedOwner();

  const removed = await Listing.deleteMany({ ownerId: owner._id });
  console.log(
    `Removed ${removed.deletedCount} prior listing(s) for seed owner.`,
  );

  const docs = SAMPLES.map((s) => ({
    ownerId: owner._id,
    citySlug: s.citySlug,
    title: s.title,
    description: s.description,
    price: s.price,
    type: s.type,
    location: {
      type: "Point" as const,
      coordinates: [s.lng, s.lat] as [number, number],
    },
    address: {
      locality: s.locality,
      city: s.city,
      text: `${s.locality}, ${s.city}`,
    },
    amenities: s.amenities,
    images: [] as string[],
    status: "active" as const,
  }));

  await Listing.insertMany(docs);
  console.log(
    `Inserted ${docs.length} sample listings (Kolkata: ${SAMPLES.filter((x) => x.citySlug === "kolkata").length}, Mumbai: ${SAMPLES.filter((x) => x.citySlug === "mumbai").length}).`,
  );
  await disconnectDb();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
