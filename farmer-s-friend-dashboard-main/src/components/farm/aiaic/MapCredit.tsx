import { OSM_COPYRIGHT_URL, ROUTE_CREDITS } from "./route-map";

/**
 * The credits a map, or a distance a routing service gave, must show (ported from AIAIC's `kit/MapCredit.jsx`):
 * - "© OpenStreetMap contributors", linked to openstreetmap.org/copyright, ALWAYS (the OSMF attribution guidelines; and
 *   Geoapify's terms ask it of everything made from its answers, which are built on OpenStreetMap's data);
 * - "Powered by Geoapify", linked to geoapify.com, when the route or the distance came from Geoapify (its free plan
 *   asks it near the map or the information).
 * Their own wording, the same in every language: a name and a credit (marked `lang="en"` and `data-name`).
 */
export function MapCredit({
  provider = null,
  className = "text-[11px] text-muted-foreground",
  testid = "map-credit",
}: {
  provider?: string | null | undefined;
  className?: string | undefined;
  testid?: string | undefined;
}) {
  const maker = provider ? (ROUTE_CREDITS[provider] ?? null) : null;
  // A maker with no credit held is said in the console by its key (a credit owed and not shown is a fault to fix).
  if (provider && !maker) {
    console.warn(
      `MapCredit: no credit is held for the route maker "${provider}": add it to ROUTE_CREDITS`,
    );
  }
  return (
    <p className={className} lang="en" data-name="OpenStreetMap" data-testid={testid}>
      ©{" "}
      <a className="underline" href={OSM_COPYRIGHT_URL} target="_blank" rel="noopener noreferrer">
        OpenStreetMap
      </a>{" "}
      contributors
      {maker ? (
        <span data-testid={`${testid}-route`} data-provider={provider ?? undefined}>
          {" · "}
          {maker.before}{" "}
          <a className="underline" href={maker.url} target="_blank" rel="noopener noreferrer">
            {maker.name}
          </a>
        </span>
      ) : null}
    </p>
  );
}
