import { ServiceArea, type ServiceCitySlug } from "../models/ServiceArea";

const EARTH_RADIUS_M = 6_378_100;

function haversineMeters(
  lng1: number,
  lat1: number,
  lng2: number,
  lat2: number,
): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(a)));
}

/**
 * Picks the first service city (smallest seeded disk first) whose disk contains the point.
 */
export async function inferCitySlugFromCoordinates(
  lng: number,
  lat: number,
): Promise<ServiceCitySlug | undefined> {
  const cities = await ServiceArea.find({ kind: "city" })
    .sort({ radiusMeters: 1 })
    .exec();
  for (const c of cities) {
    const [clng, clat] = c.location.coordinates;
    const d = haversineMeters(lng, lat, clng, clat);
    if (d <= c.radiusMeters) return c.citySlug;
  }
  return undefined;
}
