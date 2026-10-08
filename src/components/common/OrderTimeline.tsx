import { Check, CircleX } from "lucide-react";
import { ORDER_STEPS, orderLabel } from "@/lib/health";
import { orderHistory, type Order } from "@/lib/data";
import { fmtDate, fmtDateTime } from "@/lib/format";
import { cn } from "@/lib/utils";

/** Prescribed → Authorised → Confirmed → Preparing → Dispatched → Delivered → Receipt confirmed. */
export function OrderTimeline({
  order,
  prescribedOn,
  compact,
}: {
  order: Pick<Order, "status" | "history">;
  prescribedOn?: string | null;
  compact?: boolean;
}) {
  const history = orderHistory(order);
  const at = (s: string) => history.find((h) => h.status === s);
  const cancelled = order.status === "cancelled";
  const reachedIdx = cancelled
    ? Math.max(
        ...history
          .filter((h) => h.status !== "cancelled")
          .map((h) => ORDER_STEPS.indexOf(h.status as (typeof ORDER_STEPS)[number])),
        0,
      )
    : ORDER_STEPS.indexOf(order.status as (typeof ORDER_STEPS)[number]);

  const steps: {
    key: string;
    label: string;
    when?: string | undefined;
    by?: string | undefined;
    done: boolean;
    current: boolean;
  }[] = [
    {
      key: "prescribed",
      label: "Prescribed",
      when: prescribedOn ? fmtDate(prescribedOn) : undefined,
      done: true,
      current: false,
    },
    ...ORDER_STEPS.map((s, i) => {
      const ev = at(s);
      return {
        key: s,
        label: orderLabel[s] ?? s,
        when: ev ? fmtDateTime(ev.at) : undefined,
        by: ev?.by,
        done: i <= reachedIdx,
        current: !cancelled && i === reachedIdx + 1,
      };
    }),
  ];

  return (
    <ol className="relative">
      {steps.map((s, i) => {
        const last = i === steps.length - 1;
        return (
          <li
            key={s.key}
            className={cn("relative flex gap-3", !last && (compact ? "pb-3" : "pb-4"))}
          >
            {!last && (
              <span
                className={cn(
                  "absolute left-[11px] top-6 h-[calc(100%-1.25rem)] w-0.5",
                  s.done && steps[i + 1]?.done ? "bg-primary" : "bg-border",
                )}
                aria-hidden="true"
              />
            )}
            <span
              className={cn(
                "relative z-10 flex size-6 shrink-0 items-center justify-center rounded-full border-2 bg-card",
                s.done
                  ? "border-primary bg-primary text-primary-foreground"
                  : s.current
                    ? "border-primary"
                    : "border-border",
              )}
            >
              {s.done ? (
                <Check className="size-3.5" strokeWidth={3} />
              ) : s.current ? (
                <span className="size-2 rounded-full bg-primary" />
              ) : null}
            </span>
            <div className="min-w-0 pt-0.5">
              <p
                className={cn(
                  "text-sm leading-tight",
                  s.done
                    ? "font-medium"
                    : s.current
                      ? "font-medium text-foreground"
                      : "text-muted-foreground",
                )}
              >
                {s.label}
                {s.current && <span className="ml-2 text-xs font-normal text-primary">Next</span>}
              </p>
              {(s.when || s.by) && (
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {s.when}
                  {s.by ? ` · ${s.by}` : ""}
                </p>
              )}
            </div>
          </li>
        );
      })}
      {cancelled && (
        <li className="mt-4 flex items-center gap-2 text-sm text-danger">
          <CircleX className="size-4" /> Order cancelled{" "}
          {at("cancelled") ? `· ${fmtDateTime(at("cancelled")!.at)}` : ""}
        </li>
      )}
    </ol>
  );
}

export function orderTone(status: string) {
  if (status === "received") return "success" as const;
  if (status === "cancelled") return "neutral" as const;
  if (status === "delivered") return "highlight" as const;
  return "info" as const;
}
