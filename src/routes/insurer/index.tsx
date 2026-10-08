import { useMemo } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Activity, Lock, ShieldCheck, Users, Wallet } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { CardSkeleton, EmptyState, ErrorState } from "@/components/common/states";
import { DemoBadge, StatusPill, type Tone } from "@/components/common/StatusPill";
import { ProPageHeader } from "@/components/shell/ProShell";
import { supabase } from "@/integrations/supabase/client";
import { useLogAccess } from "@/lib/access-log";
import { displayName, fmtDate, fmtMoney } from "@/lib/format";

export const Route = createFileRoute("/insurer/")({
  head: () => ({ meta: [{ title: "Members · PULSE LOOP" }] }),
  component: InsurerDashboard,
});

/**
 * Insurer view. RLS returns wellness_status only with 'wellness' consent and bill reports only
 * with 'billing' consent. Only identity fields are selected from patients: no condition, no
 * signals, no notes, no non-bill reports.
 */
function useMembers() {
  return useQuery({
    queryKey: ["insurer-members"],
    queryFn: async () => {
      const [p, w, b, c] = await Promise.all([
        supabase.from("patients").select("id,name,city,is_demo").order("name"),
        supabase.from("wellness_status").select("*"),
        supabase
          .from("reports")
          .select("id,patient_id,title,report_date,amount,payment_status")
          .eq("category", "bill")
          .order("report_date", { ascending: false }),
        supabase
          .from("consents")
          .select("patient_id,category,status")
          .in("category", ["billing", "wellness"]),
      ]);
      const err = p.error ?? w.error ?? b.error ?? c.error;
      if (err) throw new Error(err.message);
      return (p.data ?? []).map((m) => ({
        ...m,
        wellness: w.data?.find((x) => x.patient_id === m.id),
        bill: b.data?.find((x) => x.patient_id === m.id),
        billingConsent: c.data?.find((x) => x.patient_id === m.id && x.category === "billing")
          ?.status,
        wellnessConsent: c.data?.find((x) => x.patient_id === m.id && x.category === "wellness")
          ?.status,
      }));
    },
  });
}

const OUTCOME_TONE: Record<string, Tone> = {
  Stable: "success",
  Improving: "success",
  "Needs attention": "warning",
};

function InsurerDashboard() {
  const q = useMembers();
  const members = useMemo(() => q.data ?? [], [q.data]);

  return (
    <div>
      <ProPageHeader
        title="Members"
        description="Continuous care programme status for your members, limited to what each member has consented to share."
      />

      <div className="mb-6 flex flex-col gap-3 rounded-xl border border-primary/20 bg-secondary/60 p-4 sm:flex-row sm:items-center">
        <Lock className="size-5 shrink-0 text-primary" />
        <div className="text-sm">
          <p className="font-semibold">Raw clinical data: Not accessible</p>
          <p className="text-muted-foreground">
            Glucose readings, meal photos, consultant notes and medical reports are never shared
            with insurers. You see programme status and consultation payments only, with member
            consent.
          </p>
        </div>
      </div>

      <div className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Stat
          icon={Users}
          label="Members in programme"
          value={q.isLoading ? "—" : String(members.length)}
        />
        <Stat
          icon={Activity}
          label="Sharing wellness status"
          value={q.isLoading ? "—" : String(members.filter((m) => m.wellness).length)}
        />
        <Stat
          icon={Wallet}
          label="Consultations settled"
          value={
            q.isLoading
              ? "—"
              : String(
                  members.filter((m) => /settled|paid/i.test(m.bill?.payment_status ?? "")).length,
                )
          }
        />
      </div>

      <div className="rounded-xl border bg-card">
        {q.isLoading ? (
          <div className="p-4">
            <CardSkeleton lines={5} className="border-0" />
          </div>
        ) : q.error ? (
          <ErrorState className="m-4" error={q.error} onRetry={() => q.refetch()} />
        ) : members.length === 0 ? (
          <EmptyState
            className="m-4"
            title="No members yet"
            description="Members who choose your plan appear here."
          />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Member</TableHead>
                <TableHead className="hidden md:table-cell">Programme</TableHead>
                <TableHead>Outcome status</TableHead>
                <TableHead className="hidden sm:table-cell">Consultation / payment</TableHead>
                <TableHead className="hidden lg:table-cell">Benefit</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {members.map((m) => (
                <MemberRow key={m.id} m={m} />
              ))}
            </TableBody>
          </Table>
        )}
      </div>
      <p className="mt-3 flex items-center gap-1.5 text-xs text-muted-foreground">
        <ShieldCheck className="size-3.5" /> Each member's data you view is recorded in their access
        history.
      </p>
    </div>
  );
}

type Member = NonNullable<ReturnType<typeof useMembers>["data"]>[number];

function MemberRow({ m }: { m: Member }) {
  useLogAccess(
    m.id,
    [
      m.wellness && { category: "Wellness status", purpose: "Preventive programme" },
      m.bill && { category: "Billing data", purpose: "Consultation payment" },
    ].filter(Boolean) as { category: string; purpose: string }[],
  );
  // Consent granted but nothing on record is different from "not shared".
  const notShared = (status: string | undefined, emptyLabel = "None on record") =>
    status === "active" ? (
      <span className="text-xs text-muted-foreground">{emptyLabel}</span>
    ) : (
      <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
        <Lock className="size-3" /> {status === "withdrawn" ? "Consent withdrawn" : "Not shared"}
      </span>
    );
  return (
    <TableRow>
      <TableCell>
        <div className="font-medium">{displayName(m.name)}</div>
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          {m.city} {m.is_demo && <DemoBadge className="px-1.5 py-0 text-[10px]" />}
        </div>
      </TableCell>
      <TableCell className="hidden md:table-cell">
        {m.wellness ? m.wellness.programme : notShared(m.wellnessConsent)}
      </TableCell>
      <TableCell>
        {m.wellness ? (
          <div>
            <StatusPill tone={OUTCOME_TONE[m.wellness.outcome_status] ?? "neutral"}>
              {m.wellness.outcome_status}
            </StatusPill>
            <div className="mt-0.5 text-xs text-muted-foreground">
              Updated {fmtDate(m.wellness.updated_at)}
            </div>
          </div>
        ) : (
          notShared(m.wellnessConsent)
        )}
      </TableCell>
      <TableCell className="hidden sm:table-cell">
        {m.bill ? (
          <div className="text-sm">
            <div className="font-medium">
              {fmtMoney(m.bill.amount)} · {m.bill.payment_status ?? "Pending"}
            </div>
            <div className="text-xs text-muted-foreground">
              {m.bill.title} · {fmtDate(m.bill.report_date)}
            </div>
          </div>
        ) : (
          notShared(m.billingConsent, "No consultation bills yet")
        )}
      </TableCell>
      <TableCell className="hidden lg:table-cell">
        {m.wellness ? (
          m.wellness.benefit_eligible ? (
            <StatusPill tone="success">Eligible</StatusPill>
          ) : (
            <StatusPill tone="neutral">Not eligible</StatusPill>
          )
        ) : (
          <span className="text-xs text-muted-foreground">—</span>
        )}
      </TableCell>
    </TableRow>
  );
}

function Stat({ icon: Icon, label, value }: { icon: typeof Users; label: string; value: string }) {
  return (
    <div className="rounded-xl border bg-card p-4">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Icon className="size-4" /> {label}
      </div>
      <div className="mt-2 text-3xl font-semibold tabular-nums">{value}</div>
    </div>
  );
}
