import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Camera, ClipboardCheck, Quote, Stethoscope, Utensils } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Sparkline, TrendChart } from "@/components/common/charts";
import { CardSkeleton, EmptyState, ErrorState } from "@/components/common/states";
import { KPI_TONE, StatusPill } from "@/components/common/StatusPill";
import { SectionTitle, TrendChip } from "@/components/patient/InsightCards";
import { PageHeader } from "@/components/shell/PatientShell";
import { usePatientCtx } from "@/components/patient/context";
import { useCarePlan, useKpis, useSignals } from "@/lib/data";
import {
  byType,
  kpiCurrent,
  kpiState,
  lastDays,
  stateLabel,
  type Kpi,
  type Signal,
} from "@/lib/health";
import { fmtDate, fmtNumber, fmtShortDate } from "@/lib/format";
import { REVIEW_STATUS } from "@/lib/product";
import { METRICS, series, targetText, type MealMeta, type MetricKey } from "@/lib/signals";

export const Route = createFileRoute("/app/care")({
  head: () => ({ meta: [{ title: "My Care Plan · PULSE LOOP" }] }),
  component: CarePlan,
});

function CarePlan() {
  const patient = usePatientCtx();
  const plan = useCarePlan(patient.id);
  const kpis = useKpis(patient.id);
  const signals = useSignals(patient.id);
  const consultant = patient.consultants;
  const review = REVIEW_STATUS[plan.data?.review_status ?? ""];

  return (
    <div>
      <PageHeader title="My Care Plan" />

      <section className="rounded-2xl border bg-card p-4">
        <div className="flex items-start gap-3">
          <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-secondary text-primary">
            <Stethoscope className="size-5" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-xs text-muted-foreground">Consultant</p>
            <p className="font-semibold">{consultant?.name ?? "Not assigned"}</p>
            {consultant && (
              <p className="text-xs text-muted-foreground">
                {[consultant.specialty, consultant.hospital].filter(Boolean).join(" · ")}
              </p>
            )}
          </div>
          {review && <StatusPill tone={review.tone}>{review.label}</StatusPill>}
        </div>
        <p className="mt-4 rounded-xl bg-secondary/70 p-3 text-sm text-secondary-foreground">
          The care plan is defined by your consultant. PULSE LOOP helps you stay on track.
        </p>

        {plan.isLoading ? (
          <CardSkeleton lines={2} className="mt-3 border-0 p-0" />
        ) : plan.error ? (
          <ErrorState className="mt-3" error={plan.error} onRetry={() => plan.refetch()} />
        ) : plan.data ? (
          <>
            {plan.data.plan_actions && (
              <ul className="mt-4 space-y-2">
                {plan.data.plan_actions.split("·").map((a) => (
                  <li key={a} className="flex items-start gap-2.5 text-sm">
                    <ClipboardCheck className="mt-0.5 size-4 shrink-0 text-primary" />
                    {a.trim()}
                  </li>
                ))}
              </ul>
            )}
            {plan.data.consultant_notes && (
              <div className="mt-4 flex gap-2.5 rounded-xl border p-3 text-sm">
                <Quote className="size-4 shrink-0 text-muted-foreground" />
                <div>
                  <p>{plan.data.consultant_notes}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{consultant?.name}</p>
                </div>
              </div>
            )}
            <p className="mt-3 text-xs text-muted-foreground">
              Last reviewed {fmtDate(plan.data.last_reviewed_at)}
            </p>
          </>
        ) : null}
      </section>

      <SectionTitle>Your KPIs</SectionTitle>
      {kpis.error || signals.error ? (
        <ErrorState
          error={kpis.error ?? signals.error}
          onRetry={() => (kpis.refetch(), signals.refetch())}
        />
      ) : kpis.isLoading || signals.isLoading ? (
        <div className="space-y-2">
          <CardSkeleton lines={2} />
          <CardSkeleton lines={2} />
        </div>
      ) : !kpis.data?.length ? (
        <EmptyState title="No KPIs yet" description="Your consultant hasn't set any targets yet." />
      ) : (
        <div className="space-y-2">
          {kpis.data.map((k) => (
            <KpiRow key={k.id} kpi={k} signals={signals.data ?? []} />
          ))}
        </div>
      )}

      {!!signals.data?.length && <Trends signals={signals.data} kpis={kpis.data ?? []} />}

      <Meals signals={signals.data ?? []} />
    </div>
  );
}

function KpiRow({ kpi, signals }: { kpi: Kpi; signals: Signal[] }) {
  const current = kpiCurrent(kpi, signals);
  const state = kpiState(kpi, current);
  const metric = (["glucose", "steps", "sleep"] as const).find((m) => m === kpi.metric);
  const digits = kpi.metric === "sleep" ? 1 : 0;
  return (
    <div className="rounded-2xl border bg-card p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-medium">{kpi.name}</p>
          <p className="text-xs text-muted-foreground">
            {kpi.frequency} · {kpi.source}
            {kpi.status !== "Active" && ` · ${kpi.status}`}
          </p>
        </div>
        <StatusPill tone={KPI_TONE[state]}>{stateLabel[state]}</StatusPill>
      </div>
      <div className="mt-3 grid grid-cols-3 gap-3 text-sm">
        <div>
          <p className="text-xs text-muted-foreground">Target</p>
          <p className="font-medium tabular-nums">{targetText(kpi)}</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">
            {kpi.metric === "meals" ? "Last 7 days" : "5-day average"}
          </p>
          <p className="font-medium tabular-nums">
            {current == null ? "—" : `${fmtNumber(current, digits)} ${kpi.unit ?? ""}`}
          </p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Trend</p>
          {metric ? (
            <Sparkline
              points={series(signals, metric)}
              target={Number(kpi.target)}
              className="h-6"
            />
          ) : (
            <p className="text-muted-foreground">—</p>
          )}
        </div>
      </div>
      {metric && (
        <div className="mt-2">
          <TrendChip signals={signals} metric={metric} />
        </div>
      )}
      {kpi.notes && <p className="mt-3 text-sm text-muted-foreground">“{kpi.notes}”</p>}
    </div>
  );
}

function Trends({ signals, kpis }: { signals: Signal[]; kpis: Kpi[] }) {
  const [metric, setMetric] = useState<MetricKey>("glucose");
  const m = METRICS[metric];
  const kpi = kpis.find((k) => k.metric === metric);
  const pts = series(signals, metric);
  return (
    <>
      <SectionTitle>14-day trends</SectionTitle>
      <div className="rounded-2xl border bg-card p-4">
        <Tabs value={metric} onValueChange={(v) => setMetric(v as MetricKey)}>
          <TabsList className="grid w-full grid-cols-3">
            {(Object.keys(METRICS) as MetricKey[]).map((k) => (
              <TabsTrigger key={k} value={k}>
                {METRICS[k].label}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
        <p className="mt-3 text-xs text-muted-foreground">
          Daily {m.label.toLowerCase()} ({m.unit})
          {kpi ? ` · dashed line is your consultant's target` : ""}
        </p>
        {pts.length > 1 ? (
          <div className="mt-2">
            <TrendChart
              points={pts}
              target={kpi ? Number(kpi.target) : undefined}
              unit={m.unit}
              digits={m.digits}
              label={m.label}
            />
          </div>
        ) : (
          <p className="py-8 text-center text-sm text-muted-foreground">Not enough data yet.</p>
        )}
      </div>
    </>
  );
}

function Meals({ signals }: { signals: Signal[] }) {
  const meals = byType(lastDays(signals, "meal", 7), "meal").reverse();
  return (
    <>
      <SectionTitle
        action={
          <Button asChild size="sm" variant="outline">
            <Link to="/app/meal">
              <Camera /> Log meal
            </Link>
          </Button>
        }
      >
        Meals · last 7 days
      </SectionTitle>
      {meals.length ? (
        <ul className="divide-y rounded-2xl border bg-card">
          {meals.map((s, i) => {
            const meta = (s.meta ?? {}) as MealMeta;
            const high = Number(s.value) === 1;
            return (
              <li key={i} className="flex items-center gap-3 px-4 py-3">
                <Utensils className="size-4 shrink-0 text-muted-foreground" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{meta.name ?? "Meal"}</p>
                  <p className="text-xs text-muted-foreground">
                    {fmtShortDate(s.recorded_at)}
                    {meta.calories ? ` · ~${meta.calories} kcal` : ""}
                  </p>
                </div>
                <StatusPill tone={high ? "warning" : "success"}>
                  {high
                    ? "High carb"
                    : `${meta.carbs ? meta.carbs.charAt(0).toUpperCase() + meta.carbs.slice(1) : "Balanced"} carb`}
                </StatusPill>
              </li>
            );
          })}
        </ul>
      ) : (
        <EmptyState icon={<Utensils className="size-5" />} title="No meals logged this week" />
      )}
    </>
  );
}
