import { useEffect, useState, type ReactNode } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, Building2, Info, PackageCheck, Pill, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { CardSkeleton, EmptyState, ErrorState, InlineSpinner } from "@/components/common/states";
import { OrderTimeline, orderTone } from "@/components/common/OrderTimeline";
import { StatusPill } from "@/components/common/StatusPill";
import { SectionTitle } from "@/components/patient/InsightCards";
import { PageHeader } from "@/components/shell/PatientShell";
import { usePatientCtx } from "@/components/patient/context";
import { supabase } from "@/integrations/supabase/client";
import {
  TERMINAL_ORDER,
  qk,
  useConsents,
  useDirectory,
  useOrders,
  usePrescriptions,
  type Prescription,
} from "@/lib/data";
import { daysUntil, orderLabel } from "@/lib/health";
import { fmtDate } from "@/lib/format";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/app/pharmacy")({
  head: () => ({ meta: [{ title: "Pharmacy · PULSE LOOP" }] }),
  component: PatientPharmacy,
});

function PatientPharmacy() {
  const patient = usePatientCtx();
  const rx = usePrescriptions(patient.id);
  const orders = useOrders(patient.id);
  const consents = useConsents(patient.id);

  if (rx.isLoading || orders.isLoading)
    return (
      <div>
        <PageHeader title="Pharmacy" />
        <div className="space-y-3">
          <CardSkeleton lines={4} />
          <CardSkeleton lines={5} />
        </div>
      </div>
    );
  if (rx.error || orders.error)
    return (
      <div>
        <PageHeader title="Pharmacy" />
        <ErrorState
          error={rx.error ?? orders.error}
          onRetry={() => (rx.refetch(), orders.refetch())}
        />
      </div>
    );

  const active = rx.data?.filter((r) => r.status === "active") ?? [];
  const rxConsent = consents.data?.find((c) => c.category === "prescription");
  const past = orders.data?.filter((o) => TERMINAL_ORDER.includes(o.status)) ?? [];

  return (
    <div>
      <PageHeader title="Pharmacy" description="Your prescribed medicines and refill orders." />
      {active.length === 0 ? (
        <EmptyState
          icon={<Pill className="size-5" />}
          title="No active prescriptions"
          description="Prescriptions issued by your consultant appear here."
        />
      ) : (
        <div className="space-y-6">
          {active.map((p) => (
            <PrescriptionBlock
              key={p.id}
              rx={p}
              openOrder={orders.data?.find(
                (o) => o.prescription_id === p.id && !TERMINAL_ORDER.includes(o.status),
              )}
              consentWithdrawn={rxConsent?.status === "withdrawn"}
            />
          ))}
        </div>
      )}

      <p className="mt-6 flex items-start gap-2 rounded-xl bg-muted/60 p-3 text-xs text-muted-foreground">
        <Info className="mt-0.5 size-3.5 shrink-0" />
        Delivery confirms fulfilment only. It is not a record that the medicine was taken.
      </p>

      {past.length > 0 && (
        <>
          <SectionTitle>Past orders</SectionTitle>
          <ul className="divide-y rounded-2xl border bg-card">
            {past.map((o) => (
              <li key={o.id} className="flex items-center justify-between gap-3 px-4 py-3 text-sm">
                <div className="min-w-0">
                  <p className="font-medium">{o.pharmacies?.name}</p>
                  <p className="text-xs text-muted-foreground">Ordered {fmtDate(o.created_at)}</p>
                </div>
                <StatusPill tone={orderTone(o.status)}>
                  {orderLabel[o.status] ?? o.status}
                </StatusPill>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}

type OpenOrder = NonNullable<ReturnType<typeof useOrders>["data"]>[number];

function PrescriptionBlock({
  rx,
  openOrder,
  consentWithdrawn,
}: {
  rx: Prescription;
  openOrder?: OpenOrder | undefined;
  consentWithdrawn: boolean;
}) {
  const days = daysUntil(rx.refill_due);
  const expired = (daysUntil(rx.valid_until) ?? 1) < 0;
  return (
    <div className="space-y-3">
      <section className="rounded-2xl border bg-card p-4">
        <div className="flex items-start gap-3">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-highlight-soft text-highlight">
            <Pill className="size-5" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Prescription
            </p>
            <p className="mt-0.5 font-semibold leading-snug">{rx.medicine}</p>
            <p className="text-sm text-muted-foreground">{rx.dosage}</p>
          </div>
        </div>
        <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
          <Item label="Quantity" value={rx.quantity ?? "—"} />
          <Item
            label="Refill date"
            value={
              <>
                {fmtDate(rx.refill_due)}
                {days != null && (
                  <span
                    className={cn(
                      "block text-xs",
                      days <= 3 ? "text-highlight-foreground" : "text-muted-foreground",
                    )}
                  >
                    {days < 0
                      ? `${-days} days overdue`
                      : days === 0
                        ? "Due today"
                        : `In ${days} day${days === 1 ? "" : "s"}`}
                  </span>
                )}
              </>
            }
          />
          <Item
            label="Prescribed by"
            value={`${rx.prescribed_by ?? "—"} · ${fmtDate(rx.prescribed_on)}`}
          />
          <Item label="Valid until" value={fmtDate(rx.valid_until)} />
        </dl>
      </section>

      {openOrder ? (
        <ActiveOrder
          order={openOrder}
          prescribedOn={rx.prescribed_on}
          consentWithdrawn={consentWithdrawn}
        />
      ) : expired ? (
        <ErrorState
          title="This prescription has expired"
          error="Ask your consultant to renew it before ordering."
        />
      ) : (
        <OrderForm rx={rx} />
      )}
    </div>
  );
}

function Item({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="mt-0.5 font-medium">{value}</dd>
    </div>
  );
}

function OrderForm({ rx }: { rx: Prescription }) {
  const patient = usePatientCtx();
  const dir = useDirectory();
  const queryClient = useQueryClient();
  const [pharmacy, setPharmacy] = useState<string>(patient.pharmacy_id ?? "");
  const [agree, setAgree] = useState(false);

  useEffect(() => {
    if (!pharmacy && dir.data?.pharmacies[0]) setPharmacy(dir.data.pharmacies[0].id);
  }, [dir.data, pharmacy]);

  const selected = dir.data?.pharmacies.find((p) => p.id === pharmacy);

  const create = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.rpc("create_order", {
        _prescription: rx.id,
        _pharmacy: pharmacy,
      });
      if (error) throw new Error(error.message);
      return data;
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: qk.orders(patient.id) }),
        queryClient.invalidateQueries({ queryKey: qk.consents(patient.id) }),
        queryClient.invalidateQueries({ queryKey: qk.audit(patient.id) }),
      ]);
      toast.success("Refill authorised", {
        description: `${selected?.name} has received your prescription.`,
      });
    },
    onError: (e: Error) => toast.error("Couldn't place the order", { description: e.message }),
  });

  return (
    <section className="rounded-2xl border bg-card p-4">
      <h2 className="font-semibold">Order a refill</h2>
      <p className="mt-0.5 text-sm text-muted-foreground">
        Choose where to collect your prescribed medicine from.
      </p>
      {dir.error ? (
        <ErrorState className="mt-3" error={dir.error} onRetry={() => dir.refetch()} />
      ) : (
        <div className="mt-3 space-y-2" role="radiogroup" aria-label="Pharmacy">
          {(dir.data?.pharmacies ?? []).map((p) => (
            <button
              key={p.id}
              type="button"
              role="radio"
              aria-checked={pharmacy === p.id}
              onClick={() => setPharmacy(p.id)}
              className={cn(
                "flex w-full items-center gap-3 rounded-xl border p-3 text-left transition-colors",
                pharmacy === p.id
                  ? "border-primary bg-secondary/60 ring-1 ring-primary"
                  : "hover:bg-muted/50",
              )}
            >
              <Building2 className="size-4 text-muted-foreground" />
              <span className="flex-1">
                <span className="block text-sm font-medium">{p.name}</span>
                <span className="block text-xs text-muted-foreground">{p.city}</span>
              </span>
              <span
                className={cn(
                  "size-4 rounded-full border-2",
                  pharmacy === p.id ? "border-[5px] border-primary" : "border-border",
                )}
              />
            </button>
          ))}
        </div>
      )}

      <label className="mt-4 flex items-start gap-3 rounded-xl bg-secondary/60 p-3 text-sm">
        <Checkbox
          checked={agree}
          onCheckedChange={(v) => setAgree(v === true)}
          className="mt-0.5"
        />
        <span>
          <span className="font-medium">Authorise sharing</span>
          <span className="block text-muted-foreground">
            Share this prescription with {selected?.name ?? "the selected pharmacy"} for fulfilment
            only. None of your other health data is shared.
          </span>
        </span>
      </label>

      <Button
        className="mt-4 h-11 w-full"
        disabled={!agree || !pharmacy || create.isPending}
        onClick={() => create.mutate()}
      >
        {create.isPending ? <InlineSpinner /> : <ShieldCheck />} Authorise & order refill
      </Button>
    </section>
  );
}

function ActiveOrder({
  order,
  prescribedOn,
  consentWithdrawn,
}: {
  order: OpenOrder;
  prescribedOn: string;
  consentWithdrawn: boolean;
}) {
  const patient = usePatientCtx();
  const queryClient = useQueryClient();
  const advance = useMutation({
    mutationFn: async (status: "received" | "cancelled") => {
      const { error } = await supabase.rpc("advance_order", { _order: order.id, _status: status });
      if (error) throw new Error(error.message);
      return status;
    },
    onSuccess: async (status) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: qk.orders(patient.id) }),
        queryClient.invalidateQueries({ queryKey: qk.prescriptions(patient.id) }),
        queryClient.invalidateQueries({ queryKey: qk.audit(patient.id) }),
      ]);
      toast.success(status === "received" ? "Receipt confirmed" : "Order cancelled", {
        description: status === "received" ? "Your next refill date has been updated." : undefined,
      });
    },
    onError: (e: Error) => toast.error("Couldn't update the order", { description: e.message }),
  });

  const canCancel = ["authorised", "confirmed"].includes(order.status);

  return (
    <section className="rounded-2xl border bg-card p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Current order
          </p>
          <p className="mt-0.5 font-semibold">{order.pharmacies?.name}</p>
          <p className="text-xs text-muted-foreground">
            Authorised by you · {fmtDate(order.created_at)}
          </p>
        </div>
        <StatusPill tone={orderTone(order.status)}>
          {orderLabel[order.status] ?? order.status}
        </StatusPill>
      </div>

      {consentWithdrawn && (
        <div className="mt-3 flex items-start gap-2 rounded-xl border border-warning/30 bg-warning-soft p-3 text-sm">
          <AlertTriangle className="mt-0.5 size-4 shrink-0 text-warning" />
          <p>
            You've withdrawn prescription sharing, so the pharmacy can't progress this order.{" "}
            <Link
              to="/app/privacy"
              className="font-medium text-primary underline-offset-2 hover:underline"
            >
              Manage permissions
            </Link>
          </p>
        </div>
      )}

      <div className="mt-4">
        <OrderTimeline order={order} prescribedOn={prescribedOn} />
      </div>

      {order.status === "delivered" && (
        <Button
          className="mt-4 h-11 w-full"
          onClick={() => advance.mutate("received")}
          disabled={advance.isPending}
        >
          {advance.isPending ? <InlineSpinner /> : <PackageCheck />} Confirm receipt
        </Button>
      )}
      {order.status !== "delivered" && (
        <p className="mt-4 text-xs text-muted-foreground">
          Status updates from the pharmacy appear here automatically.
        </p>
      )}
      {canCancel && (
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button variant="ghost" className="mt-2 w-full text-muted-foreground">
              Cancel order
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Cancel this order?</AlertDialogTitle>
              <AlertDialogDescription>
                {order.pharmacies?.name} will stop preparing your refill. You can place a new order
                afterwards.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Keep order</AlertDialogCancel>
              <AlertDialogAction onClick={() => advance.mutate("cancelled")}>
                Cancel order
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}
    </section>
  );
}
