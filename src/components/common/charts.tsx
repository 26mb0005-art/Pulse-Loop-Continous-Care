import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { format, parseISO } from "date-fns";
import { cn } from "@/lib/utils";
import { fmtNumber } from "@/lib/format";

export type Point = { t: string; v: number };

/** Minimal single-series sparkline for KPI tiles (decorative; the tile states the value in text). */
export function Sparkline({
  points,
  target,
  className,
  stroke = "var(--chart-1)",
}: {
  points: Point[];
  target?: number | undefined;
  className?: string;
  stroke?: string;
}) {
  if (points.length < 2) return <div className={cn("h-8", className)} />;
  const vals = points.map((p) => p.v);
  const min = Math.min(...vals, target ?? Infinity);
  const max = Math.max(...vals, target ?? -Infinity);
  const span = max - min || 1;
  const W = 100;
  const H = 32;
  const x = (i: number) => (i / (points.length - 1)) * W;
  const y = (v: number) => H - 3 - ((v - min) / span) * (H - 6);
  const d = points
    .map((p, i) => `${i ? "L" : "M"}${x(i).toFixed(2)},${y(p.v).toFixed(2)}`)
    .join(" ");
  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      preserveAspectRatio="none"
      className={cn("h-8 w-full overflow-visible", className)}
      aria-hidden="true"
    >
      {target != null && (
        <line
          x1={0}
          x2={W}
          y1={y(target)}
          y2={y(target)}
          stroke="var(--muted-foreground)"
          strokeOpacity={0.5}
          strokeDasharray="3 3"
          vectorEffect="non-scaling-stroke"
        />
      )}
      <path
        d={d}
        fill="none"
        stroke={stroke}
        strokeWidth={2}
        strokeLinejoin="round"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}

/** Daily trend for one signal with the consultant's target as a dashed reference line. */
export function TrendChart({
  points,
  target,
  unit,
  digits = 0,
  height = 180,
  stroke = "var(--chart-1)",
  label,
}: {
  points: Point[];
  target?: number | undefined;
  unit?: string;
  digits?: number;
  height?: number;
  stroke?: string;
  label: string;
}) {
  const data = points.map((p) => ({ t: p.t, v: p.v }));
  const vals = data.map((d) => d.v);
  const lo = Math.min(...vals, target ?? Infinity);
  const hi = Math.max(...vals, target ?? -Infinity);
  const pad = (hi - lo) * 0.15 || 1;
  return (
    <div
      style={{ height }}
      className="w-full"
      role="img"
      aria-label={`${label} trend, last ${data.length} days`}
    >
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -12 }}>
          <CartesianGrid vertical={false} stroke="var(--border)" />
          <XAxis
            dataKey="t"
            tickFormatter={(t: string) => format(parseISO(t), "d MMM")}
            tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
            tickLine={false}
            axisLine={false}
            minTickGap={24}
          />
          <YAxis
            domain={[Math.floor(lo - pad), Math.ceil(hi + pad)]}
            tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
            tickLine={false}
            axisLine={false}
            width={40}
            tickFormatter={(v: number) =>
              Math.abs(v) >= 1000 ? `${fmtNumber(v / 1000, 1)}k` : fmtNumber(v, digits)
            }
          />
          {target != null && (
            <ReferenceLine
              y={target}
              stroke="var(--muted-foreground)"
              strokeDasharray="4 4"
              label={{
                value: `Target ${fmtNumber(target, digits)}`,
                position: "insideTopRight",
                fontSize: 11,
                fill: "var(--muted-foreground)",
              }}
            />
          )}
          <Tooltip
            cursor={{ stroke: "var(--border)", strokeWidth: 1 }}
            content={({ active, payload }) => {
              if (!active || !payload?.length) return null;
              const p = payload[0]?.payload as Point;
              return (
                <div className="rounded-lg border bg-popover px-3 py-2 text-xs shadow-md">
                  <div className="text-muted-foreground">{format(parseISO(p.t), "EEE d MMM")}</div>
                  <div className="mt-0.5 font-medium text-foreground">
                    {fmtNumber(p.v, digits)} {unit}
                  </div>
                </div>
              );
            }}
          />
          <Line
            type="monotone"
            dataKey="v"
            stroke={stroke}
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 4, strokeWidth: 2, stroke: "var(--card)" }}
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
