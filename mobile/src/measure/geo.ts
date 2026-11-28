/** Mean Earth radius in metres (IUGG). */
export const EARTH_RADIUS_M = 6371008.8;

type Point = { lat: number; lon: number };

const rad = (degrees: number) => (degrees * Math.PI) / 180;

/** Great-circle distance in metres. At the few metres between two fixes its error is far below GPS noise. */
export function haversineM(a: Point, b: Point): number {
  const dLat = rad(b.lat - a.lat);
  const dLon = rad(b.lon - a.lon);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(h)));
}
