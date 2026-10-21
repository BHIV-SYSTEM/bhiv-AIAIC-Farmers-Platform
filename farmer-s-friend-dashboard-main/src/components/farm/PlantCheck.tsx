import { useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  AlertCircle,
  AlertTriangle,
  Camera,
  Info,
  Leaf,
  Loader2,
  PhoneCall,
  ShieldAlert,
  Sparkles,
} from "lucide-react";
import { useRef, useState } from "react";

import { StateBlock } from "@/components/farm/StateBlock";
import { analyzePlantPhoto, type PlantResult } from "@/lib/plant.functions";
import { useI18n, type Lang } from "@/lib/i18n";

/**
 * Plant Observation check powered by the confirmed AIAIC Plant Intelligence endpoint:
 * POST http://163.128.209.18:8017/aqiaic/plant/analyze (mode=bioclip)
 *
 * Mandatory Honesty Constraints:
 * 1. This endpoint provides plant identification/observations, NOT a confirmed disease diagnosis.
 * 2. It is never labeled as disease detection or a definitive health diagnosis.
 * 3. Farmer view renders in strict order:
 *    - headline
 *    - lines
 *    - not_a_health_check
 *    - next_step.text
 *    - next_step.phone (tap-to-call)
 * 4. If distress=true, helpline is prominently highlighted.
 */
export function PlantCheck({
  crop,
  state = "mh",
  onResult,
}: {
  crop?: string | undefined;
  state?: string | undefined;
  onResult?: (result: PlantResult | null) => void;
}) {
  const { t, lang } = useI18n();
  const analyze = useServerFn(analyzePlantPhoto);
  const inputRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: async (file: File) => {
      const image = await readAsDataUrl(file);
      setPreview(image);
      return analyze({
        data: {
          image,
          filename: file.name,
          mode: "bioclip",
          lang: (["en", "mr", "hi"].includes(lang) ? lang : "en") as Lang,
          state: state || "mh",
          ...(crop ? { crop } : {}),
        },
      });
    },
    onSuccess: (result) => onResult?.(result),
    onError: () => onResult?.(null),
  });

  const result = mutation.data;
  const fv = result?.farmerView;

  return (
    <section
      aria-labelledby="plant-heading"
      className="rounded-2xl border-2 border-border bg-card p-4 sm:rounded-3xl sm:p-5"
    >
      <div className="flex items-start justify-between gap-2.5 sm:gap-3">
        <div className="min-w-0 flex-1">
          <h2
            id="plant-heading"
            className="flex items-center gap-2 break-words text-lg font-bold text-foreground sm:text-xl"
          >
            <Leaf aria-hidden className="size-5 shrink-0 text-primary sm:size-6" />
            <span className="break-words">
              {t("plant.title") || "Plant Photo Check (Observation)"}
            </span>
          </h2>
          <p className="mt-1 break-words text-sm text-foreground/80 sm:text-base">
            {t("plant.lead") ||
              "Take a clear leaf photo for visual plant identification. Note: This identifies species/features; it is not a disease diagnosis."}
          </p>
        </div>

        <span className="shrink-0 rounded-full bg-secondary px-2.5 py-0.5 text-xs font-bold text-secondary-foreground sm:px-3 sm:py-1">
          BioCLIP v1
        </span>
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        capture="environment"
        className="sr-only"
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) mutation.mutate(file);
          event.target.value = "";
        }}
      />

      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={mutation.isPending}
        className="mt-4 flex min-h-16 w-full items-center justify-center gap-3 rounded-2xl bg-primary px-5 text-xl font-extrabold text-primary-foreground shadow-md transition hover:bg-primary/90 disabled:opacity-60"
      >
        {mutation.isPending ? (
          <Loader2 aria-hidden className="size-6 animate-spin" />
        ) : (
          <Camera aria-hidden className="size-6" />
        )}
        {mutation.isPending
          ? t("plant.working") || "Analyzing Photo…"
          : t("plant.take") || "Take or Upload Leaf Photo"}
      </button>

      {preview ? (
        <div className="relative mt-4 overflow-hidden rounded-2xl border border-border">
          <img
            src={preview}
            alt={t("plant.photo.alt") || "Uploaded plant leaf photo"}
            className="max-h-56 w-full object-cover"
          />
          <div className="absolute bottom-2 right-2 rounded-lg bg-black/60 px-2 py-0.5 text-xs text-white backdrop-blur">
            Max 12 MB • 40 MP
          </div>
        </div>
      ) : null}

      <div className="mt-4">
        {mutation.isError ? (
          <StateBlock
            tone="danger"
            icon={AlertCircle}
            title={t("state.failed.title") || "Photo Check Failed"}
            body={
              t("state.failed.body") ||
              "Could not analyze the photo. Please check your connection and try again."
            }
          />
        ) : null}

        {result && !result.configured ? (
          <StateBlock
            tone="warning"
            icon={Info}
            title={t("plant.notconnected.title") || "Photo Check Offline"}
            body={
              t("plant.notconnected.body") ||
              "The plant intelligence subsystem is not configured on this environment."
            }
          />
        ) : null}

        {result && result.configured && !result.ok ? (
          <div className="rounded-2xl border-2 border-warning bg-warning-soft p-4 text-warning-foreground">
            <div className="flex items-center gap-2">
              <AlertTriangle className="size-5 shrink-0" />
              <h3 className="text-lg font-bold">Analysis Notice</h3>
            </div>
            <p className="mt-2 text-base font-semibold">
              {result.detail || "Could not analyze this image."}
            </p>
            {result.requestId ? (
              <p className="mt-2 font-mono text-xs opacity-70">Request ID: {result.requestId}</p>
            ) : null}
          </div>
        ) : null}

        {result?.ok ? (
          <div className="space-y-4">
            {/* Distress Banner if flagged */}
            {result.distress ? (
              <div className="rounded-2xl border-2 border-destructive bg-danger-soft p-4 text-danger-foreground">
                <div className="flex items-center gap-2">
                  <ShieldAlert className="size-5 shrink-0 text-destructive sm:size-6" />
                  <h3 className="break-words text-base font-extrabold sm:text-lg">
                    Emergency Agricultural Support
                  </h3>
                </div>
                <p className="mt-1 break-words text-sm font-semibold">
                  Severe crop stress or loss indication detected. Please reach out to agricultural
                  helplines immediately.
                </p>
                <div className="mt-3 grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                  <a
                    href="tel:18001801551"
                    className="flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-destructive px-3 text-center text-sm font-bold text-destructive-foreground shadow hover:opacity-90"
                  >
                    <PhoneCall className="size-4 shrink-0" />
                    <span>Kisan Call Centre (1800-180-1551)</span>
                  </a>
                  <a
                    href="tel:14416"
                    className="flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-destructive px-3 text-center text-sm font-bold text-destructive hover:bg-destructive/10"
                  >
                    Tele-MANAS (14416)
                  </a>
                </div>
              </div>
            ) : null}

            {/* Farmer View Rendered in Strict Required Order:
                1. headline
                2. lines
                3. not_a_health_check
                4. next_step.text
                5. next_step.phone
            */}
            {fv ? (
              <div className="rounded-2xl border-2 border-border bg-card p-4 space-y-3.5 shadow-sm sm:p-5 sm:space-y-4">
                {/* 1. Headline */}
                {fv.headline ? (
                  <div>
                    <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground sm:text-xs">
                      Visual Observation
                    </span>
                    <h3 className="mt-1 break-words text-xl font-extrabold text-foreground sm:text-2xl">
                      {fv.headline}
                    </h3>
                  </div>
                ) : null}

                {/* 2. All entries in lines */}
                {fv.lines && fv.lines.length > 0 ? (
                  <ul className="space-y-2 border-t border-border pt-3">
                    {fv.lines.map((line, idx) => (
                      <li
                        key={idx}
                        className="flex items-start gap-2 text-sm text-foreground/90 sm:text-base"
                      >
                        <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-primary" />
                        <span className="min-w-0 flex-1 break-words">{line}</span>
                      </li>
                    ))}
                  </ul>
                ) : null}

                {/* Additional species/stage tags if available */}
                {result.species || result.stage ? (
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {result.species ? (
                      <span className="rounded-lg bg-secondary px-2.5 py-1 text-xs font-bold text-secondary-foreground">
                        Species: {result.species}
                      </span>
                    ) : null}
                    {result.stage ? (
                      <span className="rounded-lg bg-secondary px-2.5 py-1 text-xs font-bold text-secondary-foreground">
                        Stage: {result.stage}
                      </span>
                    ) : null}
                  </div>
                ) : null}

                {/* 3. Not a health check honest notice */}
                <div className="rounded-xl border border-warning/40 bg-warning-soft p-3 text-xs font-semibold text-warning-foreground sm:text-sm">
                  <p className="flex items-center gap-1.5 font-bold">
                    <Info className="size-4 shrink-0" />
                    Important Agricultural Limit:
                  </p>
                  <p className="mt-1 break-words">
                    {fv.not_a_health_check ||
                      "This only says which plant it looks like. It does not check for disease, pests or spots."}
                  </p>
                </div>

                {/* 4 & 5. Next step text and phone */}
                {fv.next_step ? (
                  <div className="rounded-xl border border-primary/30 bg-success-soft p-3.5 sm:p-4">
                    <p className="break-words text-sm font-semibold text-foreground/90">
                      {fv.next_step.text}
                    </p>
                    {fv.next_step.phone ? (
                      <a
                        href={`tel:${fv.next_step.phone.replace(/[^0-9]/g, "")}`}
                        className="mt-3 flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-primary px-3 text-sm font-bold text-primary-foreground shadow-sm hover:bg-primary/90 sm:inline-flex sm:w-auto sm:px-4 sm:text-base"
                      >
                        <PhoneCall className="size-4 shrink-0" />
                        <span>Call Helpline: {fv.next_step.phone}</span>
                      </a>
                    ) : null}
                  </div>
                ) : null}

                {/* Safe Request ID trace */}
                {result.requestId ? (
                  <p className="break-all font-mono text-[11px] text-muted-foreground pt-1">
                    Reference Request ID: {result.requestId}
                  </p>
                ) : null}
              </div>
            ) : (
              /* Fallback if farmer_view is missing but raw observations are present */
              <div className="rounded-2xl border-2 border-border bg-background p-4">
                <p className="text-sm font-semibold text-muted-foreground">Observations</p>
                {result.observations.length ? (
                  <dl className="mt-2 space-y-1.5">
                    {result.observations.map((obs) => (
                      <div key={obs.label} className="flex flex-wrap gap-x-2 text-base">
                        <dt className="font-bold text-foreground">{obs.label}:</dt>
                        <dd className="text-foreground/80">{obs.value}</dd>
                      </div>
                    ))}
                  </dl>
                ) : (
                  <p className="text-base text-foreground/75">
                    Photo processed without specific observations.
                  </p>
                )}
                <p className="mt-3 rounded-xl bg-warning-soft p-3 text-xs font-semibold text-warning-foreground">
                  Observations only. Not a definitive plant disease or health diagnosis.
                </p>
              </div>
            )}
          </div>
        ) : null}
      </div>
    </section>
  );
}

function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("read_failed"));
    reader.readAsDataURL(file);
  });
}
