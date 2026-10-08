// Presentation helpers over the shared health logic in ./health.ts.
import { byType, windowAvg, type Kpi, type Signal } from "./health";
import type { Point } from "@/components/common/charts";

export type MetricKey = "glucose" | "steps" | "sleep";

export const METRICS: Record<
  MetricKey,
  {
    label: string;
    short: string;
    unit: string;
    digits: number;
    consent: string;
    goodDirection: "down" | "up";
  }
> = {
  glucose: {
    label: "Glucose",
    short: "Glucose",
    unit: "mg/dL",
    digits: 0,
    consent: "glucose",
    goodDirection: "down",
  },
  steps: {
    label: "Activity",
    short: "Steps",
    unit: "steps/day",
    digits: 0,
    consent: "activity",
    goodDirection: "up",
  },
  sleep: {
    label: "Sleep",
    short: "Sleep",
    unit: "hours",
    digits: 1,
    consent: "sleep",
    goodDirection: "up",
  },
};

export function series(signals: Signal[], type: string): Point[] {
  return byType(signals, type).map((s) => ({ t: s.recorded_at, v: Number(s.value) }));
}

/** Last 5 days vs the 9 days before them — the same windows generateInsight uses. */
export function trend(signals: Signal[], type: MetricKey) {
  const before = windowAvg(signals, type, 14, 5);
  const recent = windowAvg(signals, type, 5, -1);
  if (before == null || recent == null || before === 0)
    return { before, recent, pct: null, dir: "flat" as const };
  const pct = ((recent - before) / before) * 100;
  const dir = Math.abs(pct) < 3 ? ("flat" as const) : pct > 0 ? ("up" as const) : ("down" as const);
  return { before, recent, pct, dir };
}

/** Is a movement in this direction good, bad or neutral for this metric? */
export function trendTone(metric: MetricKey, dir: "up" | "down" | "flat") {
  if (dir === "flat") return "neutral" as const;
  return dir === METRICS[metric].goodDirection ? ("good" as const) : ("bad" as const);
}

export function kpiForMetric(kpis: Kpi[], metric: string) {
  return (
    kpis.find((k) => k.metric === metric && k.status === "Active") ??
    kpis.find((k) => k.metric === metric)
  );
}

export function targetText(k: Pick<Kpi, "direction" | "target" | "unit">) {
  return `${k.direction === "max" ? "≤" : "≥"} ${Number(k.target).toLocaleString("en-IN")} ${k.unit ?? ""}`.trim();
}

export type MealMeta = { name?: string; carbs?: string; calories?: number; ai?: string };
