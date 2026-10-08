import type { ReactNode } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  CircleDashed,
  CircleSlash,
  Clock,
  Eye,
  ShieldAlert,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { KpiState } from "@/lib/health";

export type Tone = "success" | "warning" | "danger" | "neutral" | "info" | "highlight";

const TONE: Record<Tone, string> = {
  success: "bg-success-soft text-success border-success/20",
  warning: "bg-warning-soft text-[oklch(0.45_0.1_70)] border-warning/25",
  danger: "bg-danger-soft text-danger border-danger/20",
  neutral: "bg-muted text-muted-foreground border-border",
  info: "bg-secondary text-secondary-foreground border-primary/15",
  highlight: "bg-highlight-soft text-highlight-foreground border-highlight/25",
};

const TONE_ICON: Record<Tone, ReactNode> = {
  success: <CheckCircle2 />,
  warning: <AlertTriangle />,
  danger: <ShieldAlert />,
  neutral: <CircleDashed />,
  info: <Eye />,
  highlight: <Clock />,
};

/** Status is always icon + label, never colour alone. */
export function StatusPill({
  tone,
  children,
  icon,
  className,
}: {
  tone: Tone;
  children: ReactNode;
  icon?: ReactNode | false;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 whitespace-nowrap rounded-full border px-2 py-0.5 text-xs font-medium [&_svg]:size-3.5",
        TONE[tone],
        className,
      )}
    >
      {icon === false ? null : (icon ?? TONE_ICON[tone])}
      {children}
    </span>
  );
}

export const KPI_TONE: Record<KpiState, Tone> = {
  on_track: "success",
  attention: "warning",
  monitor: "warning",
  no_data: "neutral",
};

export function ConsentPill({ status }: { status: string }) {
  if (status === "active") return <StatusPill tone="success">Active</StatusPill>;
  if (status === "withdrawn")
    return (
      <StatusPill tone="danger" icon={<CircleSlash />}>
        Withdrawn
      </StatusPill>
    );
  return <StatusPill tone="neutral">Not granted</StatusPill>;
}

export function DemoBadge({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border border-highlight/30 bg-highlight-soft px-2 py-0.5 text-[11px] font-medium text-highlight-foreground",
        className,
      )}
      title="Synthetic demo data — not a real patient"
    >
      Synthetic demo
    </span>
  );
}
