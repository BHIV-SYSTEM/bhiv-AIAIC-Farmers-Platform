/**
 * The map's plain parts, ported from AIAIC's own website (aiaic-frontend: `lib/mapTiles.js`, the distance words and
 * place checks of `kit/RouteMap.jsx`, and how `kit/TransportCard.jsx` feeds the map from GET /transport/estimate;
 * 23-24 Oct 2026). No Leaflet here: this file is safe on the server.
 *
 * TILES: OpenStreetMap's own standard tiles at the one address their usage policy names,
 * https://tile.openstreetmap.org/{z}/{x}/{y}.png (no a/b/c sub-domains, never plain http). A page may give the map the
 * tile address AIAIC's server sends (`GET /places/coordinates` -> `tiles.url`, AIAIC's one setting
 * `AIAIC_MAP_TILE_URL`); it is checked again here: an https address with {z}, {x} and {y}, NO KEY in it (a key in a
 * tile address reaches every visitor's browser) and no name or password before the host. Anything else is not used,
 * that is said in the console by the setting's NAME (never its value), and OpenStreetMap's own tiles are used.
 * What OpenStreetMap's tile policy asks, and where it is met:
 *   - the attribution visible on the map, without a click: `MapCredit`, drawn by `RouteMap` on every map;
 *   - a Referer from a browser: the browser's default policy sends this site's origin, and nothing here turns it off;
 *   - no bulk download, no tile nobody looks at: a map loads only when it comes into view, and Leaflet asks only for
 *     the tiles in view.
 * This app's server sends no Content-Security-Policy today. If one is ever added, its `img-src` must let in
 * https://tile.openstreetmap.org (and any other tile host used), or the browser refuses every tile.
 */
import type { NearbyMandi, TransportEstimate } from "@/lib/aiaic-trade";

export const OSM_TILE_URL = "https://tile.openstreetmap.org/{z}/{x}/{y}.png";
export const OSM_COPYRIGHT_URL = "https://www.openstreetmap.org/copyright";
/** OpenStreetMap's standard tiles stop at zoom 19. */
export const TILE_MAX_ZOOM = 19;
/** AIAIC's setting's name, the only thing about it ever said. */
export const TILE_SETTING = "AIAIC_MAP_TILE_URL";
/** What a tile address must look like to be used: https, a host, and the three places of a tile. */
const TEMPLATE = /^https:\/\/[^\s/]+\/\S*\{z\}\S*\{x\}\S*\{y\}\S*$/;
/** A name or a password before the host (https://name:password@host/...). */
const USERINFO = /^https:\/\/[^/]*@/;
/** A query parameter that carries a key or a token: key, apikey, apiKey, api_key, access_token, token, signature... */
const KEY_PARAM = /[?&](?:[a-z_-]*key|[a-z_-]*token|signature|sig)=/i;

/** The server's tile setting as a page may pass it: the `tiles` answer, its `url`, or nothing. */
export type TilesGiven = string | { url?: string | null | undefined } | null | undefined;

/**
 * The tile address a map uses: the one it is given when that is an https tile address with no key in it;
 * OpenStreetMap's own when it is given none (blank is none) or one it cannot use.
 */
export function tileUrlFrom(
  given: TilesGiven,
  warn: (m: string) => void = (m) => console.warn(m),
): string {
  const v = String((given && typeof given === "object" ? given.url : given) ?? "").trim();
  if (!v) return OSM_TILE_URL;
  if (TEMPLATE.test(v) && !USERINFO.test(v) && !KEY_PARAM.test(v)) return v;
  warn(
    `${TILE_SETTING} (the server's tiles.url) is not an https tile address with {z}, {x} and {y} and no key in it: ` +
      "OpenStreetMap's own tiles are used.",
  );
  return OSM_TILE_URL;
}

/**
 * WHO MADE A ROUTE, AND THE CREDIT THEY ASK FOR beside what they made. Geoapify (its pricing page's FAQ, read by AIAIC
 * on 23 Oct 2026): on the free plan, a follow-link such as "Powered by Geoapify" to geoapify.com, near the map or the
 * information the service gave; and OpenStreetMap's attribution always. A page names a route's maker by this key.
 */
export const ROUTE_CREDITS: Record<string, { before: string; name: string; url: string }> = {
  geoapify: { before: "Powered by", name: "Geoapify", url: "https://www.geoapify.com/" },
};

/** A place on the map: `home` (her district), `chosen` (the mandi chosen) or `mandi` (another mandi near her). */
export type MapPlace = {
  lat: number | string | null | undefined;
  lon: number | string | null | undefined;
  label?: string | null | undefined;
  kind: "home" | "chosen" | "mandi";
};

/** ONE line, as [lat, lon] pairs (Leaflet's order). An estimate (no road route was had) is drawn dashed. */
export type MapRoute = {
  points: (readonly unknown[])[];
  estimate: boolean;
  /** Who made a road route (`geoapify`): its credit is then on the map too. */
  provider?: string | null | undefined;
};

/** "N km by road", or "about N km (estimate)" when `estimate`; `note` is the page's short source line. */
export type MapDistance = {
  km: number | string | null | undefined;
  estimate: boolean;
  note?: string | null | undefined;
  provider?: string | null | undefined;
};

const coord = (v: unknown): number =>
  v === null || v === undefined || v === "" || typeof v === "boolean" ? Number.NaN : Number(v);

/** A point that can be drawn: two finite numbers, a latitude within 90 and a longitude within 180. */
export function isPlace(p: { lat?: unknown; lon?: unknown } | null | undefined): boolean {
  if (!p) return false;
  const lat = coord(p.lat);
  const lon = coord(p.lon);
  return (
    Number.isFinite(lat) && Number.isFinite(lon) && Math.abs(lat) <= 90 && Math.abs(lon) <= 180
  );
}

/** A line's point: [lat, lon], both drawable. */
export function isPair(q: unknown): q is readonly [unknown, unknown] {
  return Array.isArray(q) && q.length >= 2 && isPlace({ lat: q[0], lon: q[1] });
}

/** A distance as a person reads it: whole kilometres from 10 km, one decimal below; Latin digits. */
export function kmSaid(km: unknown): string | null {
  if (km === null || km === undefined || km === "") return null;
  const v = Number(km);
  if (!Number.isFinite(v) || v < 0) return null;
  return v.toLocaleString("en-IN", { maximumFractionDigits: v < 10 ? 1 : 0 });
}

/** How many of the nearby mandis are drawn as dots (AIAIC's own card: 12). */
export const NEARBY_DOTS = 12;

/**
 * The map's places, line and distance from AIAIC's transport estimate, as AIAIC's own transport card makes them: her
 * district (said by its name in her language when the page has it), the mandi chosen, the other mandis near her as
 * dots, and the road's own line when AIAIC sent one (a GeoJSON line is [lon, lat]: turned round for the map), else a
 * straight line between the two ends, drawn dashed (an estimate is never drawn as a road).
 */
export function routeMapOf(
  est: TransportEstimate,
  fromName: string | null | undefined,
  nearby: readonly NearbyMandi[] = [],
): { places: MapPlace[]; route: MapRoute; distance: MapDistance } {
  const from = est.from;
  const to = est.to;
  const coordinates = est.route?.coordinates;
  const road = est.distance?.method === "road" && Array.isArray(coordinates);
  const others: MapPlace[] = nearby
    .filter((m) => m.mandi !== to.mandi)
    .slice(0, NEARBY_DOTS)
    .map((m) => ({ lat: m.lat, lon: m.lon, label: m.mandi, kind: "mandi" }));
  return {
    places: [
      { lat: from.lat, lon: from.lon, label: fromName || from.district, kind: "home" },
      { lat: to.lat, lon: to.lon, label: to.mandi, kind: "chosen" },
      ...others,
    ],
    route:
      road && coordinates
        ? {
            points: coordinates.map((q) => (Array.isArray(q) ? [q[1], q[0]] : [])),
            estimate: false,
            provider: est.distance.provider ?? null,
          }
        : {
            points: [
              [from.lat, from.lon],
              [to.lat, to.lon],
            ],
            estimate: true,
            provider: null,
          },
    distance: {
      km: est.distance?.km,
      estimate: !road,
      provider: road ? (est.distance.provider ?? null) : null,
    },
  };
}
