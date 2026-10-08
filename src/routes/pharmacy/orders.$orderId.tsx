import type { ReactNode } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, ArrowRight, CheckCircle2, EyeOff, Lock, Pill, UserRound } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { CardSkeleton, EmptyState, ErrorState, InlineSpinner } from "@/components/common/states";
import { DemoBadge, StatusPill } from "@/components/common/StatusPill";
import { OrderTimeline, orderTone } from "@/components/common/OrderTimeline";
import { supabase } from "@/integrations/supabase/client";
import { useLogAccess } from "@/lib/access-log";
import { NEXT_STEP, usePharmacyOrder } from "@/lib/pharmacy-data";
import { orderLabel } from "@/lib/health";
import { displayName, fmtDate } from "@/lib/format";

export const Route = createFileRoute("/pharmacy/orders/$orderId")({
  head: () => ({ meta: [{ title: "Order · PULSE LOOP" }] }),
  component: OrderDetail,
});

function OrderDetail() {
  const { orderId } = Route.useParams();
  const q = usePharmacyOrder(orderId);
  const queryClient = useQueryClient();
  const order = q.data;

  useLogAccess(
    order?.patient_id,
    order ? [{ category: "Prescription", purpose: "Medicine fulfilment" }] : [],
  );

  const advance = useMutation({
    mutationFn: async (status: string) => {
      const { error } = await supabase.rpc("advance_order", { _order: orderId, _status: status });
      if (error) throw new Error(error.message);
      return status;
    },
    onSuccess: async (status) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["pharmacy-order", orderId] }),
        queryClient.invalidateQueries({ queryKey: ["pharmacy-queue"] }),
      ]);
      toast.success(`Order ${orderLabel[status]?.toLowerCase() ?? status}`);
    },
    onError: (e: Error) => {
      toast.error("Couldn't update the order", { description: e.message });
      void q.refetch();
    },
  });

  const back = (
    <Link
      to="/pharmacy"
      className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
    >
      <ArrowLeft className="size-4" /> Order queue
    </Link>
  );

  if (q.isLoading)
    return (
      <div>
        {back}
        <div className="grid gap-4 lg:grid-cols-3">
          <CardSkeleton lines={5} className="lg:col-span-2" />
          <CardSkeleton lines={4} />
        </div>
      </div>
    );
  if (q.error)
    return (
      <div>
        {back}
        <ErrorState error={q.error} onRetry={() => q.refetch()} />
      </div>
    );
  if (!order)
    return (
      <div>
        {back}
        <EmptyState
          icon={<Lock className="size-5" />}
          title="This order is no longer available"
          description="The patient may have withdrawn prescription sharing, or the order belongs to another pharmacy."
        />
      </div>
    );

  const next = NEXT_STEP[order.status];
  const rx = order.prescriptions;

  return (
    <div>
      {back}
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm text-muted-foreground">
            Order · {order.id.slice(0, 8).toUpperCase()}
          </p>
          <h1 className="text-2xl font-semibold tracking-tight">{rx?.medicine}</h1>
        </div>
        <StatusPill tone={orderTone(order.status)} className="px-3 py-1 text-sm">
          {orderLabel[order.status] ?? order.status}
        </StatusPill>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <section className="rounded-xl border bg-card p-5">
            <h2 className="flex items-center gap-2 font-semibold">
              <Pill className="size-4 text-primary" /> Prescription
            </h2>
            <dl className="mt-4 grid gap-4 text-sm sm:grid-cols-3">
              <Field label="Medicine" value={rx?.medicine} />
              <Field label="Dosage" value={rx?.dosage} />
              <Field label="Quantity" value={rx?.quantity} />
              <Field label="Prescribed by" value={rx?.prescribed_by} />
              <Field label="Prescribed on" value={fmtDate(rx?.prescribed_on)} />
              <Field label="Valid until" value={fmtDate(rx?.valid_until)} />
            </dl>
          </section>

          <section className="rounded-xl border bg-card p-5">
            <h2 className="font-semibold">Status</h2>
            <div className="mt-4 grid gap-6 md:grid-cols-[1fr_auto]">
              <OrderTimeline order={order} prescribedOn={rx?.prescribed_on} />
              <div className="md:w-64">
                {next ? (
                  <>
                    <Button
                      className="h-11 w-full"
                      onClick={() => advance.mutate(next.status)}
                      disabled={advance.isPending}
                    >
                      {advance.isPending ? <InlineSpinner /> : <ArrowRight />} {next.label}
                    </Button>
                    <p className="mt-2 text-xs text-muted-foreground">
                      Each update is logged and shown to the patient.
                    </p>
                  </>
                ) : order.status === "delivered" ? (
                  <div className="rounded-lg bg-highlight-soft p-3 text-sm">
                    Delivered. Waiting for the patient to confirm receipt.
                  </div>
                ) : (
                  <div className="flex items-center gap-2 rounded-lg bg-success-soft p-3 text-sm text-success">
                    <CheckCircle2 className="size-4" />{" "}
                    {order.status === "received"
                      ? "Receipt confirmed by patient"
                      : orderLabel[order.status]}
                  </div>
                )}
              </div>
            </div>
          </section>
        </div>

        <aside className="space-y-4">
          <section className="rounded-xl border bg-card p-5">
            <h2 className="flex items-center gap-2 font-semibold">
              <UserRound className="size-4 text-primary" /> Fulfilment details
            </h2>
            <dl className="mt-4 space-y-3 text-sm">
              <Field
                label="Patient"
                value={
                  <span className="inline-flex items-center gap-2">
                    {displayName(order.patients?.name)} {order.patients?.is_demo && <DemoBadge />}
                  </span>
                }
              />
              <Field label="City" value={order.patients?.city} />
              <Field
                label="Authorised"
                value={
                  <StatusPill tone="success">By patient · {fmtDate(order.created_at)}</StatusPill>
                }
              />
            </dl>
          </section>
          <section className="rounded-xl border bg-muted/50 p-5 text-sm">
            <h2 className="flex items-center gap-2 font-semibold">
              <EyeOff className="size-4 text-muted-foreground" /> Not shared with pharmacies
            </h2>
            <p className="mt-2 text-muted-foreground">
              Glucose, activity, sleep, meals, reports and consultant notes. Access to this order
              ends if the patient withdraws prescription sharing.
            </p>
            <p className="mt-2 text-xs text-muted-foreground">
              Your view of this order is recorded in the patient's access history.
            </p>
          </section>
        </aside>
      </div>
    </div>
  );
}

function Field({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="mt-0.5 font-medium">{value ?? "—"}</dd>
    </div>
  );
}
