// Shared, deterministic health logic used by both the browser and server functions.
export type Signal = {
  signal_type: string;
  value: number | null;
  recorded_at: string;
  source: string;
  meta: any;
};
export type Kpi = {
  id: string;
  name: string;
  metric: string;
  target: number;
  unit: string | null;
  direction: string;
  frequency: string;
  source: string;
  status: string;
  notes: string | null;
  updated_at: string;
  updated_by: string | null;
};

const DAY = 86400000;

export function byType(signals: Signal[], type: string) {
  return signals
    .filter((s) => s.signal_type === type)
    .sort((a, b) => +new Date(a.recorded_at) - +new Date(b.recorded_at));
}

export function avg(nums: number[]) {
  return nums.length ? nums.reduce((a, b) => a + b, 0) / nums.length : null;
}

export function lastDays(signals: Signal[], type: string, days: number) {
  const cutoff = Date.now() - days * DAY;
  return byType(signals, type).filter((s) => +new Date(s.recorded_at) >= cutoff);
}

export function windowAvg(signals: Signal[], type: string, fromDaysAgo: number, toDaysAgo: number) {
  const now = Date.now();
  const vals = byType(signals, type)
    .filter((s) => {
      const t = +new Date(s.recorded_at);
      return t >= now - fromDaysAgo * DAY && t < now - toDaysAgo * DAY;
    })
    .map((s) => Number(s.value));
  return avg(vals);
}

/** Current value of a KPI computed from the last 5 days (meals: last 7). */
export function kpiCurrent(kpi: Kpi, signals: Signal[]): number | null {
  if (kpi.metric === "meals") {
    const m = lastDays(signals, "meal", 7);
    if (!m.length) return null;
    return m.filter((s) => Number(s.value) === 0).length;
  }
  const type = kpi.metric === "steps" ? "steps" : kpi.metric === "sleep" ? "sleep" : kpi.metric === "glucose" ? "glucose" : null;
  if (!type) return null;
  const v = avg(lastDays(signals, type, 5).map((s) => Number(s.value)));
  return v == null ? null : type === "sleep" ? Math.round(v * 10) / 10 : Math.round(v);
}

export type KpiState = "on_track" | "attention" | "monitor" | "no_data";
export function kpiState(kpi: Kpi, current: number | null): KpiState {
  if (current == null) return "no_data";
  const ok = kpi.direction === "max" ? current <= kpi.target : current >= kpi.target;
  if (ok) return "on_track";
  return kpi.metric === "glucose" ? "monitor" : "attention";
}

export const stateLabel: Record<KpiState, string> = {
  on_track: "On track",
  attention: "Needs attention",
  monitor: "Monitor",
  no_data: "No recent data",
};

/** Days in a row (most recent first) a KPI has been outside target. */
export function persistentDeviationDays(kpi: Kpi, signals: Signal[]) {
  const type = kpi.metric === "steps" ? "steps" : kpi.metric === "sleep" ? "sleep" : kpi.metric === "glucose" ? "glucose" : null;
  if (!type) return 0;
  const vals = byType(signals, type).map((s) => Number(s.value)).reverse();
  let n = 0;
  for (const v of vals) {
    const ok = kpi.direction === "max" ? v <= kpi.target : v >= kpi.target;
    if (ok) break;
    n++;
  }
  return n;
}

export type Safety = "green" | "amber" | "red";

export function assessSafety(signals: Signal[], kpis: Kpi[]) {
  const recentGlucose = lastDays(signals, "glucose", 3).map((s) => Number(s.value));
  if (recentGlucose.some((g) => g >= 250 || g < 70)) {
    return { level: "red" as Safety, reason: "A recent reading is outside the range the AI is allowed to coach on." };
  }
  const recentAny = lastDays(signals, "glucose", 3).length + lastDays(signals, "steps", 3).length;
  if (recentAny === 0) {
    return { level: "red" as Safety, reason: "There isn't enough recent, authorised data to make a reliable recommendation." };
  }
  const persistent = kpis.filter((k) => k.status === "Active" && persistentDeviationDays(k, signals) >= 5);
  if (persistent.length) {
    return {
      level: "amber" as Safety,
      reason: `${persistent.map((k) => k.name).join(", ")} has stayed outside target for 5+ days. Your consultant should review this.`,
    };
  }
  return { level: "green" as Safety, reason: "Normal variation." };
}

export function daysUntil(date: string | null) {
  if (!date) return null;
  const d = new Date(date + "T00:00:00");
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.round((+d - +today) / DAY);
}

export const ORDER_STEPS = ["authorised", "confirmed", "preparing", "dispatched", "delivered", "received"] as const;
export const orderLabel: Record<string, string> = {
  authorised: "Authorised",
  confirmed: "Confirmed",
  preparing: "Preparing",
  dispatched: "Dispatched",
  delivered: "Delivered",
  received: "Receipt confirmed",
  cancelled: "Cancelled",
};

export const SAFETY_COPY: Record<Safety, string> = {
  green: "You're on track.",
  amber: "Your care-plan KPI has remained outside target. Your consultant should review this.",
  red: "This requires professional review. The AI will not provide a recommendation.",
};

export const INSUFFICIENT =
  "I don't have enough reliable information to recommend a next step. Your consultant should review this.";
