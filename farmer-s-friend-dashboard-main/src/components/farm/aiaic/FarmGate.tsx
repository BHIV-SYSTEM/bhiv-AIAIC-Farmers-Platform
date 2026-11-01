import type { ReactNode } from "react";

import { Loading } from "@/components/farm/aiaic/AiaicBits";
import { CrisisFirst } from "@/components/farm/aiaic/CrisisFirst";
import { useAddressHeard } from "@/lib/aiaic-address";
import type { FarmSearch } from "@/lib/aiaic-query";
import { useI18n, type Lang } from "@/lib/i18n";

/**
 * THE ROOT OF EVERY FARM PAGE (the audit of 1 Nov 2026, F12): its address is read by AIAIC first (`useAddressHeard`), and a crisis
 * takes the whole page (`CrisisFirst`). The page itself mounts only after that, so nothing of it is printed or saved on a crisis.
 */
export function FarmGate({ search, children }: { search: FarmSearch; children: ReactNode }) {
  return (
    <CrisisFirst>
      <AddressRead search={search}>{children}</AddressRead>
    </CrisisFirst>
  );
}

function AddressRead({ search, children }: { search: FarmSearch; children: ReactNode }) {
  const { t, lang } = useI18n();
  const activeLang = (["en", "mr", "hi"].includes(lang) ? lang : "en") as Lang;
  const opened = useAddressHeard(search, activeLang);
  if (opened) return <>{children}</>;
  return (
    <div className="mx-auto w-full max-w-xl px-3.5 pb-20 pt-5 sm:px-4 sm:pt-6">
      <Loading label={t("result.loading")} />
    </div>
  );
}
