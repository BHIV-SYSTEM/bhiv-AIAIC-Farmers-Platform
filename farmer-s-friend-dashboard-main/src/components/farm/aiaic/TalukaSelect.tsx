/**
 * HER TALUKA, RIGHT AFTER HER DISTRICT (28 Oct 2026; the owner: "add them to drop down after the selection of district
 * for more accurate location distance and also transportation cost ... only the distance and transportation will
 * change"). AIAIC's official list (`GET /transport/talukas`), each named in her language (OpenStreetMap's Marathi or
 * Hindi; else the name as written). "Whole district" first: her trips then start at the district's centre, as before.
 */
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";

import { getTripTalukas } from "@/lib/aiaic-trade.functions";
import { useI18n } from "@/lib/i18n";

export function TalukaSelect({
  state,
  district,
  value,
  onChange,
  className = "",
  selectClassName = "",
}: {
  state: string;
  district: string;
  value: string;
  onChange: (taluka: string) => void;
  className?: string;
  selectClassName?: string;
}) {
  const { t, lang } = useI18n();
  const fn = useServerFn(getTripTalukas);
  const q = useQuery({
    queryKey: ["aiaic-talukas", state, district],
    queryFn: () => fn({ data: { state, district } }),
    enabled: Boolean(district),
    staleTime: Infinity,
  });
  const rows = q.data?.ok ? q.data.data.talukas : [];
  return (
    <label className={`block ${className}`}>
      <span className="text-base font-bold text-foreground">{t("aiaic.taluka.label")}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={!district || rows.length === 0}
        className={selectClassName}
        data-testid="aiaic-taluka"
      >
        <option value="">{t("aiaic.taluka.whole_district")}</option>
        {rows.map((r) => (
          <option key={r.taluka_key} value={r.taluka}>
            {(r.names && (r.names as Record<string, string | undefined>)[lang]) || r.taluka}
          </option>
        ))}
      </select>
      <span className="mt-1 block text-xs font-semibold text-muted-foreground">
        {t("aiaic.taluka.help")}
      </span>
    </label>
  );
}
