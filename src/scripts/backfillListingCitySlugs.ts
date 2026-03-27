/**
 * Sets `citySlug` on listings from map coordinates (service-area city disks).
 * Run after `seed:service-areas` when adding this field to existing data.
 *
 * Usage: yarn backfill:listing-city-slugs
 */
import { connectDb, disconnectDb } from "../db/connect";
import { Listing } from "../models/Listing";
import { inferCitySlugFromCoordinates } from "../services/inferListingCitySlug";

async function main() {
  await connectDb();
  const cursor = Listing.find({}).cursor();
  let updated = 0;
  let skipped = 0;
  for await (const doc of cursor) {
    const [lng, lat] = doc.location.coordinates;
    const inferred = await inferCitySlugFromCoordinates(lng, lat);
    if (!inferred) {
      skipped += 1;
      continue;
    }
    if (doc.citySlug === inferred) {
      skipped += 1;
      continue;
    }
    await Listing.updateOne({ _id: doc._id }, { $set: { citySlug: inferred } });
    updated += 1;
  }
  console.log(
    `backfill listing citySlug: updated=${updated} skipped=${skipped}`,
  );
  await disconnectDb();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
