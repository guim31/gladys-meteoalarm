// -----------------------------------------------------------------------------
// Is a house inside a CAP area? CAP outlines an area with polygons
// ("lat,lon" pairs, WGS 84) or circles ("lat,lon radius_km"). The areas are
// regions a few hundred kilometres wide at most: a plane ray casting on the
// raw coordinates is exact enough there.
// -----------------------------------------------------------------------------

/**
 * Ray casting: whether the point is inside the polygon (edges included or not,
 * a house exactly on a border is not a real case).
 * @param {{ lat: number, lon: number }} point
 * @param {Array<[number, number]>} polygon [[lat, lon], …]
 */
export function inPolygon({ lat, lon }, polygon) {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i, i += 1) {
    const [latI, lonI] = polygon[i];
    const [latJ, lonJ] = polygon[j];
    if (latI > lat !== latJ > lat && lon < ((lonJ - lonI) * (lat - latI)) / (latJ - latI) + lonI) {
      inside = !inside;
    }
  }
  return inside;
}

const EARTH_RADIUS_KM = 6371;
const radians = (degrees) => (degrees * Math.PI) / 180;

/** Great-circle distance, in kilometres. */
export function distanceKm(a, b) {
  const dLat = radians(b.lat - a.lat);
  const dLon = radians(b.lon - a.lon);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(radians(a.lat)) * Math.cos(radians(b.lat)) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.min(1, Math.sqrt(h)));
}

/**
 * Whether the point is inside one of the outlined areas of a CAP info block.
 * @param {{ lat: number, lon: number }} point
 * @param {{ areas: Array<{ polygons: Array<Array<[number, number]>>, circles: Array<{ lat: number, lon: number, radiusKm: number }> }> }} info
 */
export function infoContains(point, info) {
  return info.areas.some(
    (area) =>
      area.polygons.some((polygon) => inPolygon(point, polygon)) ||
      area.circles.some((circle) => distanceKm(point, circle) <= circle.radiusKm),
  );
}
