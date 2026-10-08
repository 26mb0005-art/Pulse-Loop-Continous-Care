import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import {
  ArrowDownRight,
  ArrowRight,
  ArrowUpRight,
  Check,
  CircleHelp,
  Minus,
  RefreshCw,
  ShieldAlert,
  Sparkles,
  Stethoscope,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { InlineSpinner } from "@/components/common/states";
import type { Insight } from "@/lib/data";
import type { Signal } from "@/lib/health";
import { AI_LIMITS } from "@/lib/product";
import { fmtNumber, fmtDateTime } from "@/lib/format";
import { METRICS, trend, trendTone, type MetricKey } from "@/lib/signals";
import { cn } from "@/lib/utils";

const SOURCE_LABEL: Record<string, string> = {
  ai: "AI-generated",
  fallback: "Rules-based summary",
  rules: "Care-plan rule",
};

export function TrendChip({ signals, metric }: { signals: Signal[]; metric: MetricKey }) {
  const t = trend(signals, metric);
  if (t.recent == null) return null;
  const tone = trendTone(metric, t.dir);
  const Arrow = t.dir === "up" ? ArrowUpRight : t.dir === "down" ? ArrowDownRight : Minus;
  const m = METRICS[metric];
  const word = t.dir === "up" ? "up" : t.dir === "down" ? "down" : "steady";
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-medium",
        tone === "bad" && "border-warning/30 bg-warning-soft text-[oklch(0.45_0.1_70)]",
        tone === "good" && "border-success/25 bg-success-soft text-success",
        tone === "neutral" && "bg-muted text-muted-foreground",
      )}
      title={`5-day average ${fmtNumber(t.recent, m.digits)} vs ${fmtNumber(t.before, m.digits)} ${m.unit} before`}
    >
      {m.label}
      <Arrow className="size-3.5" aria-hidden="true" />
      <span className="sr-only">{word}</span>
      {t.pct != null && (
        <span className="tabular-nums">{`${t.pct > 0 ? "+" : ""}${Math.round(t.pct)}%`}</span>
      )}
    </span>
  );
}

export function WhatChangedCard({
  insight,
  signals,
  generating,
}: {
  insight: Insight | null | undefined;
  signals: Signal[];
  generating: boolean;
}) {
  const blocked = insight?.safety_level === "red";
  return (
    <section
      className="rounded-2xl border bg-card p-4 shadow-[0_1px_2px_rgba(0,0,0,0.03)]"
      aria-labelledby="what-changed"
    >
      <div className="flex items-center justify-between">
        <h2
          id="what-changed"
          className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground"
        >
          What changed?
        </h2>
        <span className="text-[11px] text-muted-foreground">Last 5 days vs previous 9</span>
      </div>
      {insight ? (
        <>
          <p
            className={cn(
              "mt-2 text-[17px] font-medium leading-snug",
              blocked && "text-foreground",
            )}
          >
            {insight.what_changed}
          </p>
          {insight.why_matters && (
            <p className="mt-2 text-sm text-muted-foreground">{insight.why_matters}</p>
          )}
        </>
      ) : (
        <p className="mt-2 flex items-center gap-2 text-sm text-muted-foreground">
          {generating ? (
            <>
              <InlineSpinner /> Reading your consented signals…
            </>
          ) : (
            "No summary yet."
          )}
        </p>
      )}
      <div className="mt-3 flex flex-wrap gap-1.5">
        {(["glucose", "steps", "sleep"] as const).map((m) => (
          <TrendChip key={m} signals={signals} metric={m} />
        ))}
      </div>
    </section>
  );
}

export function NextActionCard({
  insight,
  generating,
  onRefresh,
  onDone,
  marking,
}: {
  insight: Insight | null | undefined;
  generating: boolean;
  onRefresh: () => void;
  onDone: () => void;
  marking: boolean;
}) {
  if (!insight) return null;
  const kind = insight.action_kind ?? "none";
  const escalate = kind === "escalate" || insight.safety_level === "red";
  const done = !!insight.action_done_at;

  const meta = (
    <div className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] opacity-85">
      <span className="inline-flex items-center gap-1">
        <Sparkles className="size-3" /> {SOURCE_LABEL[insight.source] ?? insight.source}
      </span>
      {insight.confidence && <span>Confidence: {insight.confidence}</span>}
      {insight.inputs_used?.length ? <span>Based on: {insight.inputs_used.join(", ")}</span> : null}
      <span>{fmtDateTime(insight.created_at)}</span>
    </div>
  );

  const header = (light: boolean) => (
    <div className="flex items-center justify-between">
      <h2
        className={cn(
          "text-[11px] font-semibold uppercase tracking-[0.12em]",
          light ? "opacity-85" : "text-muted-foreground",
        )}
      >
        Next best action
      </h2>
      <div className="flex items-center gap-1">
        <AiInfo light={light} />
        <button
          type="button"
          onClick={onRefresh}
          disabled={generating}
          className={cn(
            "rounded-full p-1.5 transition-colors disabled:opacity-50",
            light ? "hover:bg-white/15" : "hover:bg-muted",
          )}
          aria-label="Re-check with latest data"
        >
          {generating ? <InlineSpinner className="size-3.5" /> : <RefreshCw className="size-3.5" />}
        </button>
      </div>
    </div>
  );

  if (escalate) {
    return (
      <section
        className="rounded-2xl border border-warning/35 bg-warning-soft p-4"
        aria-label="Next best action"
      >
        {header(false)}
        <div className="mt-2 flex items-start gap-2.5">
          <ShieldAlert className="mt-0.5 size-5 shrink-0 text-warning" />
          <p className="font-medium leading-snug">{insight.next_action}</p>
        </div>
        <p className="mt-2 text-sm text-muted-foreground">
          PULSE LOOP won't suggest a step here. This has been flagged for your consultant to review.
        </p>
        <div className="text-muted-foreground">{meta}</div>
      </section>
    );
  }

  return (
    <section
      className="rounded-2xl bg-primary p-4 text-primary-foreground shadow-[0_8px_24px_-12px_oklch(0.5_0.105_162/0.6)]"
      aria-label="Next best action"
    >
      {header(true)}
      <p className="mt-2 text-xl font-semibold leading-snug">{insight.next_action}</p>
      {insight.human_review && (
        <p className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-white/15 px-2.5 py-1 text-xs">
          <Stethoscope className="size-3.5" /> Also flagged for your consultant to review
        </p>
      )}
      <div className="mt-4">
        {kind === "refill" ? (
          <Button
            asChild
            variant="secondary"
            className="h-11 w-full bg-white text-primary hover:bg-white/90"
          >
            <Link to="/app/pharmacy">
              Order medicine <ArrowRight />
            </Link>
          </Button>
        ) : kind === "lifestyle" ? (
          done ? (
            <div className="flex h-11 items-center justify-center gap-2 rounded-md bg-white/15 text-sm font-medium">
              <Check className="size-4" /> Done. Nice work.
            </div>
          ) : (
            <Button
              variant="secondary"
              className="h-11 w-full bg-white text-primary hover:bg-white/90"
              onClick={onDone}
              disabled={marking}
            >
              {marking ? <InlineSpinner /> : <Check />} Mark as done
            </Button>
          )
        ) : null}
      </div>
      {meta}
    </section>
  );
}

function AiInfo({ light }: { light: boolean }) {
  return (
    <Popover>
      <PopoverTrigger
        className={cn(
          "rounded-full p-1.5 transition-colors",
          light ? "hover:bg-white/15" : "hover:bg-muted",
        )}
        aria-label="About this suggestion"
      >
        <CircleHelp className="size-3.5" />
      </PopoverTrigger>
      <PopoverContent className="w-72 text-sm" align="end">
        <p className="font-medium">About this suggestion</p>
        <p className="mt-1 text-muted-foreground">{AI_LIMITS}</p>
        <p className="mt-2 text-muted-foreground">
          Uses only the categories you've allowed in the Privacy Centre.
        </p>
      </PopoverContent>
    </Popover>
  );
}

export function SectionTitle({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return (
    <div className="mb-2 mt-6 flex items-center justify-between">
      <h2 className="text-sm font-semibold">{children}</h2>
      {action}
    </div>
  );
}
