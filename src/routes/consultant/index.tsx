import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  AlertOctagon,
  CheckCircle2,
  ChevronRight,
  Flag,
  Search,
  Sparkles,
  Users,
  ClipboardList,
} from "lucide-react";
import { Input } from "@/components/ui/input";
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
import { ProPageHeader } from "@/components/shell/ProShell";
import { supabase } from "@/integrations/supabase/client";
import { REVIEW_STATUS } from "@/lib/product";
import { displayName, fmtAgo } from "@/lib/format";

export const Route = createFileRoute("/consultant/")({
  head: () => ({ meta: [{ title: "Patients · PULSE LOOP" }] }),
  component: ConsultantDashboard,
});

const ORDER: Record<string, number> = { escalated: 0, needs_review: 1, on_track: 2 };

/** Patients assigned to this consultant (RLS: is_patient_consultant) with triage context. */
function useCaseload() {
  return useQuery({
    queryKey: ["caseload"],
    refetchInterval: 30_000,
    queryFn: async () => {
      const since = new Date(Date.now() - 15 * 86400000).toISOString();
      const [p, s, i] = await Promise.all([
        supabase
          .from("patients")
          .select(
            "id,name,age,gender,city,condition,is_demo,care_plans(review_status,flagged_followup,last_reviewed_at,updated_at)",
          )
          .order("name"),
        // Signals are already filtered by consent in RLS; used only for "last update".
        supabase
          .from("health_signals")
          .select("patient_id,recorded_at")
          .gte("recorded_at", since)
          .order("recorded_at", { ascending: false }),
        supabase
          .from("ai_insights")
          .select("patient_id,safety_level,human_review,created_at")
          .order("created_at", { ascending: false })
          .limit(200),
      ]);
      if (p.error) throw new Error(p.error.message);
      const lastSignal = new Map<string, string>();
      for (const r of s.data ?? [])
        if (!lastSignal.has(r.patient_id)) lastSignal.set(r.patient_id, r.recorded_at);
      const lastInsight = new Map<string, { safety_level: string; human_review: boolean }>();
      for (const r of i.data ?? [])
        if (!lastInsight.has(r.patient_id)) lastInsight.set(r.patient_id, r);
      return (p.data ?? []).map((row) => {
        const plan = Array.isArray(row.care_plans) ? row.care_plans[0] : row.care_plans;
        const sig = lastSignal.get(row.id);
        const updates = [sig, plan?.updated_at].filter(Boolean) as string[];
        return {
          ...row,
          plan,
          insight: lastInsight.get(row.id),
          lastUpdate: updates.sort().at(-1),
          lastUpdateKind: sig && sig === updates.sort().at(-1) ? "Health signal" : "Care plan",
        };
      });
    },
  });
}

function ConsultantDashboard() {
  const q = useCaseload();
  const [tab, setTab] = useState("all");
  const [search, setSearch] = useState("");
  const all = useMemo(() => q.data ?? [], [q.data]);
  const count = (s: string) => all.filter((p) => p.plan?.review_status === s).length;

  const shown = all
    .filter(
      (p) =>
        tab === "all" ||
        (tab === "flagged" ? p.plan?.flagged_followup : p.plan?.review_status === tab),
    )
    .filter((p) => !search || p.name.toLowerCase().includes(search.toLowerCase()))
    .sort(
      (a, b) =>
        (ORDER[a.plan?.review_status ?? ""] ?? 3) - (ORDER[b.plan?.review_status ?? ""] ?? 3) ||
        a.name.localeCompare(b.name),
    );

  return (
    <div>
      <ProPageHeader
        title="Patients"
        description="Your caseload between visits. Data shown is limited to what each patient has consented to share with you."
      />

      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat icon={Users} label="Patients" value={all.length} loading={q.isLoading} />
        <Stat
          icon={CheckCircle2}
          label="On track"
          value={count("on_track")}
          loading={q.isLoading}
          tone="text-success"
        />
        <Stat
          icon={ClipboardList}
          label="Needs review"
          value={count("needs_review")}
          loading={q.isLoading}
          tone="text-warning"
        />
        <Stat
          icon={AlertOctagon}
          label="Escalated"
          value={count("escalated")}
          loading={q.isLoading}
          tone="text-danger"
        />
      </div>

      <div className="rounded-xl border bg-card">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b p-3">
          <Tabs value={tab} onValueChange={setTab}>
            <TabsList className="flex-wrap">
              <TabsTrigger value="all">All</TabsTrigger>
              <TabsTrigger value="escalated">Escalated</TabsTrigger>
              <TabsTrigger value="needs_review">Needs review</TabsTrigger>
              <TabsTrigger value="on_track">On track</TabsTrigger>
              <TabsTrigger value="flagged">Flagged</TabsTrigger>
            </TabsList>
          </Tabs>
          <div className="relative w-full sm:w-64">
            <Search className="absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
            <Input
              placeholder="Search patients"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8"
            />
          </div>
        </div>
        {q.isLoading ? (
          <div className="p-4">
            <CardSkeleton lines={5} className="border-0" />
          </div>
        ) : q.error ? (
          <ErrorState className="m-4" error={q.error} onRetry={() => q.refetch()} />
        ) : shown.length === 0 ? (
          <EmptyState
            className="m-4"
            title="No patients here"
            description={
              all.length
                ? "Try another filter."
                : "Patients who choose you as their consultant appear here."
            }
          />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Patient</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="hidden md:table-cell">Review flag</TableHead>
                <TableHead className="hidden lg:table-cell">Latest AI signal</TableHead>
                <TableHead className="hidden sm:table-cell">Last relevant update</TableHead>
                <TableHead className="w-8" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {shown.map((p) => {
                const st = REVIEW_STATUS[p.plan?.review_status ?? ""];
                return (
                  <TableRow key={p.id}>
                    <TableCell>
                      <Link
                        to="/consultant/patients/$patientId"
                        params={{ patientId: p.id }}
                        className="font-medium hover:underline"
                      >
                        {displayName(p.name)}
                      </Link>
                      <div className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                        {[p.age && `${p.age}`, p.gender, p.city].filter(Boolean).join(" · ")}
                        {p.is_demo && <DemoBadge className="px-1.5 py-0 text-[10px]" />}
                      </div>
                    </TableCell>
                    <TableCell>
                      {st ? (
                        <StatusPill tone={st.tone}>{st.label}</StatusPill>
                      ) : (
                        <StatusPill tone="neutral">No plan</StatusPill>
                      )}
                    </TableCell>
                    <TableCell className="hidden md:table-cell">
                      {p.plan?.flagged_followup ? (
                        <span className="inline-flex items-center gap-1 text-sm font-medium text-danger">
                          <Flag className="size-3.5" /> Follow-up
                        </span>
                      ) : (
                        <span className="text-sm text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell className="hidden lg:table-cell">
                      {p.insight ? (
                        <span className="inline-flex items-center gap-1.5 text-sm">
                          <Sparkles className="size-3.5 text-muted-foreground" />
                          {p.insight.safety_level === "red"
                            ? "Escalated by rules"
                            : p.insight.human_review
                              ? "Review suggested"
                              : "No action needed"}
                        </span>
                      ) : (
                        <span className="text-sm text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell className="hidden text-sm sm:table-cell">
                      {p.lastUpdate ? (
                        <>
                          {fmtAgo(p.lastUpdate)}
                          <div className="text-xs text-muted-foreground">{p.lastUpdateKind}</div>
                        </>
                      ) : (
                        <span className="text-muted-foreground">No recent shared data</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Link
                        to="/consultant/patients/$patientId"
                        params={{ patientId: p.id }}
                        aria-label={`Open ${displayName(p.name)}`}
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
      <p className="mt-3 text-xs text-muted-foreground">
        Synthetic demo caseload. Opening a patient record is logged and visible to the patient.
      </p>
    </div>
  );
}

function Stat({
  icon: Icon,
  label,
  value,
  loading,
  tone,
}: {
  icon: typeof Users;
  label: string;
  value: number;
  loading: boolean;
  tone?: string;
}) {
  return (
    <div className="rounded-xl border bg-card p-4">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Icon className={`size-4 ${tone ?? ""}`} /> {label}
      </div>
      <div className="mt-2 text-3xl font-semibold tabular-nums">{loading ? "—" : value}</div>
    </div>
  );
}
