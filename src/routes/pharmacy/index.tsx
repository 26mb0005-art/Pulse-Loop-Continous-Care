import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ChevronRight, ClipboardList, PackageCheck, ShieldCheck, Timer, Truck } from "lucide-react";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { CardSkeleton, EmptyState, ErrorState } from "@/components/common/states";
import { DemoBadge, StatusPill } from "@/components/common/StatusPill";
import { orderTone } from "@/components/common/OrderTimeline";
import { ProPageHeader } from "@/components/shell/ProShell";
import { usePharmacyQueue } from "@/lib/pharmacy-data";
import { TERMINAL_ORDER, orderHistory } from "@/lib/data";
import { orderLabel } from "@/lib/health";
import { displayName, fmtAgo, fmtDateTime } from "@/lib/format";

export const Route = createFileRoute("/pharmacy/")({
  head: () => ({ meta: [{ title: "Order queue · PULSE LOOP" }] }),
  component: Queue,
});

function Queue() {
  const q = usePharmacyQueue();
  const [tab, setTab] = useState<"active" | "done">("active");
  const rows = q.data ?? [];
  const active = rows.filter((o) => !TERMINAL_ORDER.includes(o.status));
  const shown = tab === "active" ? active : rows.filter((o) => TERMINAL_ORDER.includes(o.status));
  const count = (s: string[]) => rows.filter((o) => s.includes(o.status)).length;

  return (
    <div>
      <ProPageHeader
        title="Order queue"
        description="Prescription refills patients have authorised for your pharmacy. Updates refresh automatically."
      />

      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat icon={ClipboardList} label="Awaiting confirmation" value={count(["authorised"])} />
        <Stat icon={Timer} label="In preparation" value={count(["confirmed", "preparing"])} />
        <Stat icon={Truck} label="Out for delivery" value={count(["dispatched"])} />
        <Stat icon={PackageCheck} label="Awaiting patient receipt" value={count(["delivered"])} />
      </div>

      <div className="rounded-xl border bg-card">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b p-3">
          <Tabs value={tab} onValueChange={(v) => setTab(v as "active" | "done")}>
            <TabsList>
              <TabsTrigger value="active">Active ({active.length})</TabsTrigger>
              <TabsTrigger value="done">Completed ({rows.length - active.length})</TabsTrigger>
            </TabsList>
          </Tabs>
          <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
            <ShieldCheck className="size-3.5 text-primary" /> Fulfilment data only. Patient health
            data is not shared with pharmacies.
          </span>
        </div>
        {q.isLoading ? (
          <div className="p-4">
            <CardSkeleton lines={4} className="border-0" />
          </div>
        ) : q.error ? (
          <ErrorState className="m-4" error={q.error} onRetry={() => q.refetch()} />
        ) : shown.length === 0 ? (
          <EmptyState
            className="m-4"
            title={tab === "active" ? "No open orders" : "No completed orders yet"}
            description={
              tab === "active"
                ? "When a patient authorises a refill for your pharmacy, it appears here."
                : undefined
            }
          />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Patient</TableHead>
                <TableHead>Prescription</TableHead>
                <TableHead className="hidden md:table-cell">Quantity</TableHead>
                <TableHead className="hidden lg:table-cell">Authorisation</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="hidden sm:table-cell">Updated</TableHead>
                <TableHead className="w-8" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {shown.map((o) => {
                const authorised = orderHistory(o).find((h) => h.status === "authorised");
                return (
                  <TableRow key={o.id} className="cursor-pointer">
                    <TableCell>
                      <Link
                        to="/pharmacy/orders/$orderId"
                        params={{ orderId: o.id }}
                        className="font-medium hover:underline"
                      >
                        {displayName(o.patients?.name) || "Patient"}
                      </Link>
                      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        {o.patients?.city}
                        {o.patients?.is_demo && <DemoBadge className="px-1.5 py-0 text-[10px]" />}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="font-medium">{o.prescriptions?.medicine}</div>
                      <div className="text-xs text-muted-foreground">
                        {o.prescriptions?.prescribed_by}
                      </div>
                    </TableCell>
                    <TableCell className="hidden md:table-cell">
                      {o.prescriptions?.quantity}
                    </TableCell>
                    <TableCell className="hidden lg:table-cell">
                      <StatusPill tone="success">Patient authorised</StatusPill>
                      <div className="mt-0.5 text-xs text-muted-foreground">
                        {fmtDateTime(authorised?.at ?? o.created_at)}
                      </div>
                    </TableCell>
                    <TableCell>
                      <StatusPill tone={orderTone(o.status)} icon={false}>
                        {orderLabel[o.status] ?? o.status}
                      </StatusPill>
                    </TableCell>
                    <TableCell className="hidden text-sm text-muted-foreground sm:table-cell">
                      {fmtAgo(o.updated_at)}
                    </TableCell>
                    <TableCell>
                      <Link
                        to="/pharmacy/orders/$orderId"
                        params={{ orderId: o.id }}
                        aria-label="Open order"
                      >
                        <ChevronRight className="size-4 text-muted-foreground" />
                      </Link>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </div>
    </div>
  );
}

function Stat({ icon: Icon, label, value }: { icon: typeof Timer; label: string; value: number }) {
  return (
    <div className="rounded-xl border bg-card p-4">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Icon className="size-4" /> {label}
      </div>
      <div className="mt-2 text-3xl font-semibold tabular-nums">{value}</div>
    </div>
  );
}
