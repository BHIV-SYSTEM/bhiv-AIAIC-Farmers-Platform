import type * as Leaflet from "leaflet";
import { useEffect, useMemo, useRef, useState, type RefObject } from "react";

import { useI18n } from "@/lib/i18n";
import { cn } from "@/lib/utils";

import { MapCredit } from "./MapCredit";
import {
  TILE_MAX_ZOOM,
  isPair,
  isPlace,
  kmSaid,
  nameBelow,
  tileUrlFrom,
  type MapDistance,
  type MapPlace,
  type MapRoute,
  type TilesGiven,
} from "./route-map";

/*
 * A MAP OF A SALE'S PLACES, ported from AIAIC's own website (`kit/RouteMap.jsx`, 23 Oct 2026; the owner: "OpenStreetMap
 * maps where they help: her district and the mandis, the route line and distance"). It asks no server of its own: what
 * it shows is what the page was told.
 *
 * - places: `home` (her district) and `chosen` (the mandi chosen) are named on the map (the more southern of the two
 *   below its dot, so two names close together never cover each other), the other mandis when pointed at. Each name is
 *   as the page gives it: in her language from AIAIC's names (`routeMapOf`). Circle markers: drawn, so no image file is
 *   fetched for them.
 * - route: ONE line as [lat, lon] pairs. An estimate (no road route was had) is drawn dashed: a straight line between
 *   two places is no road. `provider` names who made a road route ("geoapify"): its credit is then on the map too.
 * - distance: "N km by road", or "about N km (estimate)".
 * - "© OpenStreetMap contributors", linked to openstreetmap.org/copyright, is always on the map, in its corner, without
 *   a click, and "Powered by Geoapify" beside it for a route Geoapify made: drawn by this component, not by Leaflet, so
 *   they show while the map loads and if it fails.
 * - Leaflet needs a browser window: it is loaded (with its stylesheet) only in the browser, in an effect, the first time
 *   the map comes into view, so the server's render and build never run it. The wheel does not zoom and, on a phone,
 *   one finger does not drag the map (the page scrolls past it); only the tiles in view are asked for.
 * - If Leaflet cannot load or draw (no network, an old browser), the places are said as text: never a blank grey box
 *   that looks like a map.
 */

type LeafletApi = typeof Leaflet;

/** The places' colours, AIAIC's own: her district green, the chosen mandi orange, the other mandis blue. */
const PLACE_STYLE: Record<MapPlace["kind"], { color: string; fillColor: string; radius: number }> =
  {
    home: { color: "#2e6b3e", fillColor: "#2e6b3e", radius: 8 },
    chosen: { color: "#9a4508", fillColor: "#9a4508", radius: 8 },
    mandi: { color: "#2a5f90", fillColor: "#2a5f90", radius: 6 },
  };
/** The route, drawn solid. */
const LINE_STYLE = { color: "#2e6b3e", weight: 4, opacity: 1 };
/** The dash of a line that is an estimate (a straight line, not a road). */
const ESTIMATE_DASH = "8 8";

/** Leaflet and its stylesheet, loaded the first time a map is shown (a page with no map in view never fetches them). */
async function loadLeaflet(): Promise<LeafletApi> {
  const [mod] = await Promise.all([import("leaflet"), import("leaflet/dist/leaflet.css")]);
  return (mod as unknown as { default?: LeafletApi }).default ?? (mod as LeafletApi);
}

type Drawing = {
  shown: { lat: number; lon: number; label: string | null; kind: MapPlace["kind"] }[];
  line: [number, number][];
  dashed: boolean;
};

/**
 * The places and the line drawn into the map's group, and the map fitted to them. A label goes in as text (a node,
 * never HTML: a place's name comes from a server). A map with no size yet (laid out while hidden) cannot be fitted: it
 * is centred instead, and fitted when it has a size (the ResizeObserver).
 */
function drawPlaces(
  L: LeafletApi,
  map: Leaflet.Map,
  group: Leaflet.LayerGroup,
  { shown, line, dashed }: Drawing,
) {
  group.clearLayers();
  const all: [number, number][] = [];
  for (const p of shown) {
    const at: [number, number] = [p.lat, p.lon];
    const style = PLACE_STYLE[p.kind] ?? PLACE_STYLE.mandi;
    const marker = L.circleMarker(at, { ...style, weight: 2, fillOpacity: 0.85 });
    if (p.label) {
      const name = document.createElement("span");
      name.textContent = p.label;
      const below = nameBelow(p, shown);
      marker.bindTooltip(name, {
        permanent: p.kind === "home" || p.kind === "chosen",
        direction: below ? "bottom" : "top",
        offset: below ? [0, 8] : [0, -8],
      });
    }
    marker.addTo(group);
    all.push(at);
  }
  if (line.length > 1) {
    L.polyline(line, { ...LINE_STYLE, ...(dashed ? { dashArray: ESTIMATE_DASH } : {}) }).addTo(
      group,
    );
    all.push(...line);
  }
  const first = all[0];
  if (!first) return;
  const size = map.getSize();
  if (all.length === 1) map.setView(first, 10);
  else if (!(size.x > 0 && size.y > 0)) map.setView(L.latLngBounds(all).getCenter(), 8);
  // more room at the top: the distance is said in the top left corner, over the map, and must hide no place's name;
  // room at the bottom for a name said below its dot (`nameBelow`), above the credits
  else
    map.fitBounds(L.latLngBounds(all), {
      paddingTopLeft: [28, 56],
      paddingBottomRight: [28, 44],
      maxZoom: 12,
    });
}

/** True once the element has come near the screen (200 px ahead), and from then on. A browser with no
 * IntersectionObserver shows it at once. `shown`: the element is on the page (watched again when it comes). */
function useInView(ref: RefObject<HTMLElement | null>, shown: boolean): boolean {
  const [seen, setSeen] = useState(() => typeof globalThis.IntersectionObserver !== "function");
  useEffect(() => {
    const el = ref.current;
    if (seen || !shown || !el) return undefined;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setSeen(true);
          io.disconnect();
        }
      },
      { rootMargin: "200px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [seen, shown, ref]);
  return seen;
}

type MapState = "waiting" | "loading" | "ready" | "failed";

export function RouteMap({
  places = [],
  route = null,
  distance = null,
  tiles = null,
  height = 260,
  title = null,
  className,
  testid = "route-map",
}: {
  places?: readonly MapPlace[] | null | undefined;
  route?: MapRoute | null | undefined;
  distance?: MapDistance | null | undefined;
  /** The server's tile setting (`GET /places/coordinates` -> `tiles`); none: OpenStreetMap's own standard tiles. */
  tiles?: TilesGiven;
  height?: number | undefined;
  title?: string | null | undefined;
  className?: string | undefined;
  testid?: string | undefined;
}) {
  const { t } = useI18n();
  const frame = useRef<HTMLElement | null>(null);
  const box = useRef<HTMLDivElement | null>(null);
  // { L, map, group } while the map stands
  const live = useRef<{ L: LeafletApi; map: Leaflet.Map; group: Leaflet.LayerGroup } | null>(null);
  const [state, setState] = useState<MapState>("waiting");
  // the tile address: the server's own (checked again: https, no key), else OpenStreetMap's; worked out once per address
  const given = String((tiles && typeof tiles === "object" ? tiles.url : tiles) ?? "").trim();
  const tileUrl = useMemo(() => tileUrlFrom(given), [given]);

  // What is drawn, as one string: the map is drawn again only when it changes, not on every render of the page.
  const shape = JSON.stringify({
    shown: (places ?? []).filter(isPlace).map((p) => ({
      lat: Number(p.lat),
      lon: Number(p.lon),
      label: p.label ? String(p.label) : null,
      kind: p.kind,
    })),
    line: (route?.points ?? []).filter(isPair).map((q) => [Number(q[0]), Number(q[1])]),
    dashed: Boolean(route?.estimate),
  });
  const drawing = useMemo(() => JSON.parse(shape) as Drawing, [shape]);
  const any = drawing.shown.length > 0;
  const seen = useInView(frame, any);

  // THE MAP, made once it is in view, and removed with the component (or when it cannot draw)
  useEffect(() => {
    if (!seen || !any || !box.current) return undefined;
    let gone = false;
    let map: Leaflet.Map | null = null;
    setState("loading");
    void (async () => {
      try {
        const L = await loadLeaflet();
        if (gone || !box.current) return;
        map = L.map(box.current, {
          attributionControl: false,
          zoomControl: false,
          scrollWheelZoom: false,
          // quarter steps: the places fill the map's room instead of the next whole zoom out
          zoomSnap: 0.25,
          dragging: !L.Browser.mobile,
        });
        // the zoom buttons top right: the distance is said top left, the credits bottom right
        L.control.zoom({ position: "topright" }).addTo(map);
        L.tileLayer(tileUrl, { maxZoom: TILE_MAX_ZOOM }).addTo(map);
        live.current = { L, map, group: L.layerGroup().addTo(map) };
        setState("ready");
      } catch {
        live.current = null;
        if (map) {
          try {
            map.remove();
          } catch {
            /* already gone */
          }
          map = null;
        }
        if (!gone) setState("failed");
      }
    })();
    return () => {
      gone = true;
      live.current = null;
      if (map) {
        try {
          map.remove();
        } catch {
          /* already gone */
        }
      }
    };
  }, [seen, any, tileUrl]);

  // THE PLACES AND THE LINE, drawn when the map stands and again whenever they change
  useEffect(() => {
    const m = live.current;
    if (state !== "ready" || !m) return;
    try {
      drawPlaces(m.L, m.map, m.group, drawing);
    } catch {
      try {
        m.map.remove();
      } catch {
        /* already gone */
      }
      live.current = null;
      setState("failed");
    }
  }, [state, drawing]);

  // A MAP LAID OUT WHILE HIDDEN (a closed section) stays grey until it is told its size: told whenever its box changes
  // size, and fitted again to its places the first time it has one
  useEffect(() => {
    const el = box.current;
    if (state !== "ready" || typeof ResizeObserver !== "function" || !el) return undefined;
    const sized = (s: Leaflet.Point) => s.x > 0 && s.y > 0;
    const ro = new ResizeObserver(() => {
      const m = live.current;
      if (!m) return;
      const before = m.map.getSize();
      m.map.invalidateSize();
      if (!sized(before) && sized(m.map.getSize())) {
        try {
          drawPlaces(m.L, m.map, m.group, drawing);
        } catch {
          /* it stays as drawn before */
        }
      }
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [state, drawing]);

  if (!any) return null;
  const km = distance ? kmSaid(distance.km) : null;
  const kmEstimate = Boolean(distance?.estimate);
  // WHO MADE WHAT IS SHOWN: the road line's maker, or the road distance's (an estimate is AIAIC's own straight line)
  const maker =
    (route && !drawing.dashed && route.provider) ||
    (distance && !kmEstimate && distance.provider) ||
    null;
  const said = drawing.shown.map((p, i) => (
    <li key={i} data-name="">
      {p.label || `${p.lat}, ${p.lon}`}
    </li>
  ));
  return (
    <section
      ref={frame}
      className={cn(
        "relative isolate overflow-hidden rounded-2xl border border-border bg-muted/40",
        className,
      )}
      style={{ height }}
      aria-label={title || t("aiaic.routemap.title")}
      data-testid={testid}
      data-state={state}
    >
      {/* Leaflet's own box: React puts nothing in it */}
      <div
        ref={box}
        className={state === "failed" ? "hidden" : "h-full w-full"}
        data-testid={`${testid}-canvas`}
      />
      {state === "waiting" || state === "loading" ? (
        <p
          className="absolute inset-0 grid place-items-center text-xs font-semibold text-muted-foreground"
          role="status"
        >
          {t("aiaic.routemap.loading")}
        </p>
      ) : null}
      {state === "failed" ? (
        <div
          className="absolute inset-0 overflow-auto px-3 pb-6 pt-12 text-sm text-foreground"
          data-testid={`${testid}-fallback`}
        >
          <p className="text-xs text-muted-foreground">{t("aiaic.routemap.unavailable")}</p>
          <ul className="mt-1 space-y-0.5">{said}</ul>
        </div>
      ) : null}
      {km !== null ? (
        <p
          className="absolute left-2 top-2 z-[1000] max-w-[70%] rounded-lg border border-border bg-card px-2 py-1 text-sm font-bold text-foreground shadow-sm"
          data-testid={`${testid}-distance`}
          data-estimate={kmEstimate ? "yes" : "no"}
        >
          {t(kmEstimate ? "aiaic.routemap.km_estimate" : "aiaic.routemap.km_road", { km })}
          {distance?.note ? (
            <span className="block text-xs font-normal text-muted-foreground">{distance.note}</span>
          ) : null}
        </p>
      ) : null}
      {/* the places, for a screen reader, whatever the map does (a place's label is its NAME as the server holds it) */}
      {state !== "failed" ? <ul className="sr-only">{said}</ul> : null}
      {/* THE CREDITS, ALWAYS ON THE MAP: OpenStreetMap's, and the route maker's for its route */}
      <MapCredit
        provider={maker}
        testid={`${testid}-credit`}
        className="absolute bottom-0 right-0 z-[1000] max-w-full rounded-tl-md bg-card/90 px-1.5 py-0.5 text-[11px] text-foreground"
      />
    </section>
  );
}
