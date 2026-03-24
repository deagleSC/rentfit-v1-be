import { connectDb, disconnectDb } from "../db/connect";
import { ServiceArea } from "../models/ServiceArea";

async function main() {
  await connectDb();
  await ServiceArea.deleteMany({});

  const areas = [
    {
      citySlug: "bangalore" as const,
      kind: "city" as const,
      name: "Bangalore",
      aliases: ["Bengaluru", "BLR"],
      location: {
        type: "Point" as const,
        coordinates: [77.5946, 12.9716] as [number, number],
      },
      radiusMeters: 35_000,
    },
    {
      citySlug: "mumbai" as const,
      kind: "city" as const,
      name: "Mumbai",
      aliases: ["Bombay"],
      location: {
        type: "Point" as const,
        coordinates: [72.8777, 19.076] as [number, number],
      },
      radiusMeters: 40_000,
    },
    {
      citySlug: "kolkata" as const,
      kind: "city" as const,
      name: "Kolkata",
      aliases: ["Calcutta"],
      location: {
        type: "Point" as const,
        coordinates: [88.3639, 22.5726] as [number, number],
      },
      radiusMeters: 35_000,
    },
    {
      citySlug: "bangalore" as const,
      kind: "neighborhood" as const,
      name: "Indiranagar",
      aliases: ["Indira Nagar"],
      location: {
        type: "Point" as const,
        coordinates: [77.6412, 12.9784] as [number, number],
      },
      radiusMeters: 4_000,
    },
    {
      citySlug: "bangalore" as const,
      kind: "neighborhood" as const,
      name: "Koramangala",
      aliases: ["Kora", "Koramangala 5th Block"],
      location: {
        type: "Point" as const,
        coordinates: [77.6271, 12.9352] as [number, number],
      },
      radiusMeters: 5_000,
    },
    {
      citySlug: "bangalore" as const,
      kind: "neighborhood" as const,
      name: "Whitefield",
      aliases: [],
      location: {
        type: "Point" as const,
        coordinates: [77.7499, 12.9698] as [number, number],
      },
      radiusMeters: 6_000,
    },
    {
      citySlug: "mumbai" as const,
      kind: "neighborhood" as const,
      name: "Bandra",
      aliases: ["Bandra West"],
      location: {
        type: "Point" as const,
        coordinates: [72.8267, 19.0596] as [number, number],
      },
      radiusMeters: 4_000,
    },
    {
      citySlug: "mumbai" as const,
      kind: "neighborhood" as const,
      name: "Andheri",
      aliases: ["Andheri West", "Andheri East"],
      location: {
        type: "Point" as const,
        coordinates: [72.8305, 19.1136] as [number, number],
      },
      radiusMeters: 5_000,
    },
    {
      citySlug: "mumbai" as const,
      kind: "neighborhood" as const,
      name: "Powai",
      aliases: [],
      location: {
        type: "Point" as const,
        coordinates: [72.9081, 19.1174] as [number, number],
      },
      radiusMeters: 4_000,
    },
    {
      citySlug: "kolkata" as const,
      kind: "neighborhood" as const,
      name: "Salt Lake",
      aliases: ["Salt Lake City", "Bidhannagar"],
      location: {
        type: "Point" as const,
        coordinates: [88.4123, 22.5868] as [number, number],
      },
      radiusMeters: 5_000,
    },
    {
      citySlug: "kolkata" as const,
      kind: "neighborhood" as const,
      name: "Park Street",
      aliases: [],
      location: {
        type: "Point" as const,
        coordinates: [88.3525, 22.5512] as [number, number],
      },
      radiusMeters: 3_000,
    },
    {
      citySlug: "kolkata" as const,
      kind: "neighborhood" as const,
      name: "New Town",
      aliases: ["Rajarhat New Town"],
      location: {
        type: "Point" as const,
        coordinates: [88.4785, 22.5925] as [number, number],
      },
      radiusMeters: 6_000,
    },
  ];

  await ServiceArea.insertMany(areas);
  console.log(`Seeded ${areas.length} service areas.`);
  await disconnectDb();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
