import { useRef, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  Camera,
  Footprints,
  ImagePlus,
  ScanSearch,
  ShieldOff,
  Sparkles,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { ErrorState, InlineSpinner } from "@/components/common/states";
import { StatusPill, type Tone } from "@/components/common/StatusPill";
import { PageHeader } from "@/components/shell/PatientShell";
import { usePatientCtx } from "@/components/patient/context";
import { analyzeMeal } from "@/lib/care.functions";
import { qk, useConsents } from "@/lib/data";
import demoMeal from "@/assets/demo-meal.jpg";

export const Route = createFileRoute("/app/meal")({
  head: () => ({ meta: [{ title: "Log a meal · PULSE LOOP" }] }),
  component: LogMeal,
});

/** Downscale to keep uploads small (the server function rejects images over ~6 MB). */
async function toDataUrl(src: string | Blob, max = 1280): Promise<string> {
  const url = typeof src === "string" ? src : URL.createObjectURL(src);
  try {
    const img = new Image();
    img.decoding = "async";
    img.src = url;
    await img.decode();
    const scale = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(img.naturalWidth * scale);
    canvas.height = Math.round(img.naturalHeight * scale);
    canvas.getContext("2d")!.drawImage(img, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL("image/jpeg", 0.85);
  } finally {
    if (typeof src !== "string") URL.revokeObjectURL(url);
  }
}

const LEVEL_TONE: Record<string, Tone> = { low: "success", moderate: "info", high: "warning" };

function LogMeal() {
  const patient = usePatientCtx();
  const consents = useConsents(patient.id);
  const queryClient = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string>(demoMeal);
  const [file, setFile] = useState<Blob | null>(null);

  const consent = consents.data?.find((c) => c.category === "meal_photos");
  const allowed = consent?.status === "active";

  const analyze = useMutation({
    mutationFn: async () =>
      analyzeMeal({ data: { patientId: patient.id, image: await toDataUrl(file ?? preview) } }),
    onSuccess: (res) => {
      if (!res.blocked && !res.notFood) {
        void queryClient.invalidateQueries({ queryKey: qk.signals(patient.id) });
        toast.success("Added to your meal log");
      }
    },
    onError: (e: Error) => toast.error("Couldn't analyse this photo", { description: e.message }),
  });

  const pick = (f: File | undefined) => {
    if (!f) return;
    if (!f.type.startsWith("image/")) {
      toast.error("Please choose a photo");
      return;
    }
    setFile(f);
    setPreview(URL.createObjectURL(f));
    analyze.reset();
  };

  const res = analyze.data;

  return (
    <div>
      <Link to="/app" className="mb-2 inline-flex items-center gap-1 text-sm text-muted-foreground">
        <ArrowLeft className="size-4" /> Home
      </Link>
      <PageHeader
        title="Log a meal"
        description="Take a photo of your plate. We'll estimate it against your care plan."
      />

      {consents.data && !allowed && (
        <div className="mb-4 flex items-start gap-3 rounded-2xl border border-warning/30 bg-warning-soft p-4 text-sm">
          <ShieldOff className="mt-0.5 size-4 shrink-0 text-warning" />
          <div>
            <p className="font-medium">Meal photo analysis is off</p>
            <p className="mt-0.5 text-muted-foreground">
              You haven't allowed meal photos to be analysed by the AI engine.
            </p>
            <Link to="/app/privacy" className="mt-2 inline-block font-medium text-primary">
              Review in Privacy Centre
            </Link>
          </div>
        </div>
      )}

      <div className="overflow-hidden rounded-2xl border bg-card">
        <div className="relative aspect-[4/3] bg-muted">
          <img
            src={preview}
            alt={file ? "Your meal photo" : "Demo meal: roti, dal and paneer"}
            className="size-full object-cover"
          />
          {!file && (
            <span className="absolute left-3 top-3 rounded-full bg-background/90 px-2.5 py-1 text-xs font-medium backdrop-blur">
              Demo meal photo
            </span>
          )}
        </div>
        <div className="flex gap-2 p-3">
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={(e) => pick(e.target.files?.[0])}
          />
          <Button
            variant="outline"
            className="h-11 flex-1"
            onClick={() => fileRef.current?.click()}
          >
            <Camera /> {file ? "Retake" : "Take photo"}
          </Button>
          {file && (
            <Button
              variant="ghost"
              className="h-11"
              onClick={() => {
                setFile(null);
                setPreview(demoMeal);
                analyze.reset();
              }}
            >
              <ImagePlus /> Use demo
            </Button>
          )}
        </div>
      </div>

      {!res && (
        <Button
          className="mt-4 h-12 w-full text-base"
          onClick={() => analyze.mutate()}
          disabled={analyze.isPending || !allowed}
        >
          {analyze.isPending ? (
            <>
              <InlineSpinner /> Analysing…
            </>
          ) : (
            <>
              <ScanSearch /> Analyse meal
            </>
          )}
        </Button>
      )}

      {analyze.error && (
        <ErrorState className="mt-4" error={analyze.error} onRetry={() => analyze.mutate()} />
      )}

      {res?.blocked && (
        <ErrorState
          className="mt-4"
          title="Meal photo analysis is off"
          error="Grant the Meal photos permission in the Privacy Centre to use this."
        />
      )}
      {res && !res.blocked && res.notFood && (
        <ErrorState
          className="mt-4"
          title="That doesn't look like a meal"
          error="Try another photo with your plate clearly in view."
          onRetry={() => fileRef.current?.click()}
        />
      )}

      {res && !res.blocked && !res.notFood && (
        <section className="mt-4 rounded-2xl border bg-card p-4" aria-live="polite">
          <div className="flex items-center justify-between">
            <h2 className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
              Meal estimate
            </h2>
            <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
              <Sparkles className="size-3" />{" "}
              {res.source === "ai" ? "AI estimate" : "Demo estimate (AI unavailable)"}
            </span>
          </div>
          <div className="mt-3 flex flex-wrap gap-1.5">
            {res.result.foods.map((f) => (
              <span key={f} className="rounded-full border bg-muted/60 px-2.5 py-1 text-sm">
                {f}
              </span>
            ))}
          </div>
          <dl className="mt-4 grid grid-cols-3 gap-2 text-center">
            <div className="rounded-xl bg-muted/60 p-3">
              <dt className="text-xs text-muted-foreground">Calories</dt>
              <dd className="mt-1 text-lg font-semibold tabular-nums">~{res.result.calories}</dd>
            </div>
            <div className="rounded-xl bg-muted/60 p-3">
              <dt className="text-xs text-muted-foreground">Carbs</dt>
              <dd className="mt-1.5">
                <StatusPill
                  tone={LEVEL_TONE[res.result.carbs_level.toLowerCase()] ?? "neutral"}
                  icon={false}
                >
                  {res.result.carbs_level}
                </StatusPill>
              </dd>
            </div>
            <div className="rounded-xl bg-muted/60 p-3">
              <dt className="text-xs text-muted-foreground">Protein</dt>
              <dd className="mt-1.5">
                <StatusPill tone="neutral" icon={false}>
                  {res.result.protein_level}
                </StatusPill>
              </dd>
            </div>
          </dl>
          <div className="mt-4 flex gap-3 rounded-xl bg-secondary/70 p-3">
            <Footprints className="mt-0.5 size-4 shrink-0 text-primary" />
            <div className="text-sm">
              <p className="font-medium">Your care plan</p>
              <p className="mt-0.5 text-secondary-foreground">{res.result.care_plan_note}</p>
            </div>
          </div>
          <p className="mt-3 text-xs text-muted-foreground">
            AI estimate. Not a clinical assessment.{" "}
            {consent?.retention ? `${consent.retention}.` : ""}
          </p>
          <div className="mt-4 flex gap-2">
            <Button asChild variant="outline" className="flex-1">
              <Link to="/app/care">See meal trend</Link>
            </Button>
            <Button className="flex-1" onClick={() => analyze.reset()}>
              Log another
            </Button>
          </div>
        </section>
      )}
    </div>
  );
}
