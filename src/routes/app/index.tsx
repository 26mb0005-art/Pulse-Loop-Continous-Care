import { useEffect, useRef } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { isToday, parseISO } from "date-fns";
import { Camera, ChevronRight, Pill, Truck } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Sparkline } from "@/components/common/charts";
import { CardSkeleton, ErrorState } from "@/components/common/states";
import { KPI_TONE, StatusPill } from "@/components/common/StatusPill";
import { NextActionCard, SectionTitle, WhatChangedCard } from "@/components/patient/InsightCards";
import { usePatientCtx } from "@/components/patient/context";
import { supabase } from "@/integrations/supabase/client";
import { generateInsight } from "@/lib/care.functions";
import {
  TERMINAL_ORDER,
  qk,
  useKpis,
  useLatestInsight,
  useOrders,
  usePrescriptions,
  useSignals,
} from "@/lib/data";
import { daysUntil, kpiCurrent, kpiState, orderLabel, type Kpi, type Signal } from "@/lib/health";
import { firstName, fmtNumber, greeting } from "@/lib/format";
import { METRICS, kpiForMetric, series, targetText, type MetricKey } from "@/lib/signals";

export const Route = createFileRoute("/app/")({
  head: () => ({ meta: [{ title: "Home · PULSE LOOP" }] }),
  component: Home,
});

function Home() {
  const patient = usePatientCtx();
  const pid = patient.id;
  const queryClient = useQueryClient();
  const signals = useSignals(pid);
  const kpis = useKpis(pid);
  const insight = useLatestInsight(pid);

  const gen = useMutation({
    mutationFn: () => generateInsight({ data: { patientId: pid } }),
    onSuccess: (row) => queryClient.setQueryData(qk.insight(pid), row),
    onError: (e: Error) => toast.error("Couldn't refresh your summary", { description: e.message }),
  });

  const markDone = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("ai_insights")
        .update({ action_done_at: new Date().toISOString() })
        .eq("id", id);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: qk.insight(pid) });
      toast.success("Logged. Small steps add up.");
    },
    onError: (e: Error) => toast.error("Couldn't save", { description: e.message }),
  });

  // Produce today's summary once if the latest one is from an earlier day (or there is none).
  const tried = useRef(false);
  useEffect(() => {
    if (tried.current || insight.isLoading || insight.error) return;
    const latest = insight.data;
    if (!latest || !isToday(parseISO(latest.created_at))) {
      tried.current = true;
      gen.mutate();
    }
  }, [insight.isLoading, insight.error, insight.data, gen]);

  return (
    <div>
      <p className="text-sm text-muted-foreground">{patient.condition} · continuous care</p>
      <h1 className="text-[26px] font-semibold leading-tight tracking-tight">
        {greeting()}, {firstName(patient.name)}
      </h1>

      <div className="mt-4 space-y-3">
        {insight.error ? (
          <ErrorState error={insight.error} onRetry={() => insight.refetch()} />
        ) : insight.isLoading || signals.isLoading ? (
          <>
            <CardSkeleton lines={3} />
            <CardSkeleton lines={2} className="h-36" />
          </>
        ) : (
          <>
            <WhatChangedCard
              insight={insight.data}
              signals={signals.data ?? []}
              generating={gen.isPending}
            />
            <NextActionCard
              insight={insight.data}
              generating={gen.isPending}
              onRefresh={() => gen.mutate()}
              onDone={() => insight.data && markDone.mutate(insight.data.id)}
              marking={markDone.isPending}
            />
          </>
        )}
      </div>

      <SectionTitle
        action={
          <Link
            to="/app/care"
            className="inline-flex items-center text-xs font-medium text-primary"
          >
            Care plan <ChevronRight className="size-3.5" />
          </Link>
        }
      >
        KPI snapshot
      </SectionTitle>
      {signals.error || kpis.error ? (
        <ErrorState
          error={signals.error ?? kpis.error}
          onRetry={() => (signals.refetch(), kpis.refetch())}
        />
      ) : signals.isLoading || kpis.isLoading ? (
        <div className="grid grid-cols-3 gap-2">
          {[0, 1, 2].map((i) => (
            <CardSkeleton key={i} lines={2} className="p-3" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-3 gap-2">
          {(["glucose", "steps", "sleep"] as const).map((m) => (
            <KpiTile
              key={m}
              metric={m}
              kpi={kpiForMetric(kpis.data ?? [], m)}
              signals={signals.data ?? []}
            />
          ))}
        </div>
      )}

      <RefillCard />

      <Link
        to="/app/meal"
        className="mt-3 flex items-center gap-3 rounded-2xl border bg-card p-4 transition-colors hover:bg-muted/50"
      >
        <span className="flex size-10 items-center justify-center rounded-xl bg-secondary text-primary">
          <Camera className="size-5" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block font-medium">Log a meal</span>
          <span className="block text-xs text-muted-foreground">
            Photo → AI estimate against your care plan
          </span>
        </span>
        <ChevronRight className="size-4 text-muted-foreground" />
      </Link>
    </div>
  );
}

// Short labels so status fits a one-third-width tile on a phone.
const TILE_LABEL: Record<string, string> = {
  on_track: "On track",
  attention: "Attention",
  monitor: "Monitor",
  no_data: "No data",
};

function KpiTile({
  metric,
  kpi,
  signals,
}: {
  metric: MetricKey;
  kpi?: Kpi | undefined;
  signals: Signal[];
}) {
  const m = METRICS[metric];
  const pts = series(signals, metric);
  const current = kpi ? kpiCurrent(kpi, signals) : (pts.at(-1)?.v ?? null);
  const state = kpi ? kpiState(kpi, current) : current == null ? "no_data" : null;
  return (
    <Link
      to="/app/care"
      className="flex flex-col rounded-2xl border bg-card p-3 transition-colors hover:bg-muted/40"
    >
      <span className="text-xs font-medium text-muted-foreground">{m.label}</span>
      <span className="mt-1 text-lg font-semibold tabular-nums leading-none">
        {current == null
          ? "—"
          : metric === "steps"
            ? fmtNumber(current / 1000, 1) + "k"
            : fmtNumber(current, m.digits)}
      </span>
      <span className="mt-0.5 text-[11px] text-muted-foreground">
        {metric === "steps" ? "steps/day" : m.unit}
      </span>
      <Sparkline points={pts} target={kpi ? Number(kpi.target) : undefined} className="mt-2 h-7" />
      {kpi && (
        <span className="mt-1 truncate text-[11px] text-muted-foreground">
          Target {targetText(kpi).replace(/ steps\/day| mg\/dL| hours/, "")}
        </span>
      )}
      {state && (
        <StatusPill
          tone={KPI_TONE[state]}
          className="mt-2 max-w-full self-start px-1.5 text-[10px] [&_svg]:size-3"
        >
          <span className="truncate">{TILE_LABEL[state]}</span>
        </StatusPill>
      )}
    </Link>
  );
}

function RefillCard() {
  const patient = usePatientCtx();
  const rx = usePrescriptions(patient.id);
  const orders = useOrders(patient.id);
  if (rx.isLoading || orders.isLoading) return <CardSkeleton lines={2} className="mt-6" />;
  const current = rx.data?.find((r) => r.status === "active") ?? rx.data?.[0];
  if (!current) return null;
  const open = orders.data?.find(
    (o) => o.prescription_id === current.id && !TERMINAL_ORDER.includes(o.status),
  );
  const days = daysUntil(current.refill_due);
  const when =
    days == null
      ? "soon"
      : days < 0
        ? "overdue"
        : days === 0
          ? "due today"
          : days === 1
            ? "due tomorrow"
            : `due for refill in ${days} days`;

  return (
    <>
      <SectionTitle>Medication</SectionTitle>
      <section className="rounded-2xl border border-highlight/30 bg-highlight-soft p-4">
        <div className="flex items-start gap-3">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-card text-highlight">
            {open ? <Truck className="size-5" /> : <Pill className="size-5" />}
          </span>
          <div className="min-w-0 flex-1">
            <p className="font-medium leading-snug">
              {open
                ? `Your refill order is ${orderLabel[open.status]?.toLowerCase() ?? open.status}.`
                : `Your prescribed medicine is ${when === "overdue" ? "overdue for refill" : when}.`}
            </p>
            <p className="mt-0.5 truncate text-sm text-muted-foreground">{current.medicine}</p>
          </div>
        </div>
        <Button asChild className="mt-3 h-11 w-full">
          <Link to="/app/pharmacy">{open ? "Track order" : "Order medicine"}</Link>
        </Button>
      </section>
    </>
  );
}
