import { useEffect, useState, type ReactNode } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  AlertOctagon,
  ArrowLeft,
  Eye,
  FileText,
  Flag,
  Lock,
  Pencil,
  Pill,
  Plus,
  ShieldAlert,
  Sparkles,
  Trash2,
  Utensils,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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
import { TrendChart } from "@/components/common/charts";
import { CardSkeleton, EmptyState, ErrorState, InlineSpinner } from "@/components/common/states";
import { ConsentPill, DemoBadge, KPI_TONE, StatusPill } from "@/components/common/StatusPill";
import { orderTone } from "@/components/common/OrderTimeline";
import { KpiDialog, PrescriptionDialog } from "@/components/consultant/dialogs";
import { useMyOrg } from "@/components/shell/ProShell";
import { supabase } from "@/integrations/supabase/client";
import { useLogAccess } from "@/lib/access-log";
import {
  TERMINAL_ORDER,
  qk,
  sortConsents,
  useCarePlan,
  useConsents,
  useKpis,
  useLatestInsight,
  useOrders,
  usePatient,
  usePrescriptions,
  useReports,
  useSignals,
} from "@/lib/data";
import {
  daysUntil,
  kpiCurrent,
  kpiState,
  orderLabel,
  persistentDeviationDays,
  stateLabel,
  type Kpi,
  type Signal,
} from "@/lib/health";
import { displayName, fmtDate, fmtDateTime, fmtNumber } from "@/lib/format";
import { REVIEW_STATUS } from "@/lib/product";
import { METRICS, series, targetText, trend, type MetricKey } from "@/lib/signals";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/consultant/patients/$patientId")({
  head: () => ({ meta: [{ title: "Patient · PULSE LOOP" }] }),
  component: PatientDetail,
});

const SOURCE_LABEL: Record<string, string> = {
  ai: "AI-generated",
  fallback: "Rules-based summary",
  rules: "Care-plan rule",
};

function PatientDetail() {
  const { patientId: pid } = Route.useParams();
  const patient = usePatient(pid);
  const consents = useConsents(pid);
  const signals = useSignals(pid);
  const kpis = useKpis(pid);
  const plan = useCarePlan(pid);
  const insight = useLatestInsight(pid);
  const rx = usePrescriptions(pid);
  const orders = useOrders(pid);
  const reports = useReports(pid);

  const active = (cat: string) =>
    consents.data?.find((c) => c.category === cat)?.status === "active";
  const has = (type: string) => !!signals.data?.some((s) => s.signal_type === type);

  // Log only categories that were actually returned and displayed (RLS already filtered them).
  const loaded = !!patient.data && !signals.isLoading && !reports.isLoading && !kpis.isLoading;
  useLogAccess(
    loaded ? pid : undefined,
    [
      has("glucose") && { category: "Glucose data", purpose: "Consultant KPI monitoring" },
      has("steps") && { category: "Activity data", purpose: "Care-plan monitoring" },
      has("sleep") && { category: "Sleep data", purpose: "Care-plan monitoring" },
      { category: "Care plan & KPIs", purpose: "Care-plan review" },
      !!reports.data?.length && { category: "Medical reports", purpose: "Care continuity" },
      !!rx.data?.length && { category: "Prescription", purpose: "Prescription management" },
    ].filter(Boolean) as { category: string; purpose: string }[],
  );

  const back = (
    <Link
      to="/consultant"
      className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
    >
      <ArrowLeft className="size-4" /> Patients
    </Link>
  );

  if (patient.isLoading)
    return (
      <div>
        {back}
        <div className="grid gap-4 lg:grid-cols-3">
          <CardSkeleton lines={6} className="lg:col-span-2" />
          <CardSkeleton lines={5} />
        </div>
      </div>
    );
  if (patient.error)
    return (
      <div>
        {back}
        <ErrorState error={patient.error} onRetry={() => patient.refetch()} />
      </div>
    );
  if (!patient.data)
    return (
      <div>
        {back}
        <EmptyState
          icon={<Lock className="size-5" />}
          title="Patient not available"
          description="This patient isn't under your care, or the record doesn't exist."
        />
      </div>
    );

  const p = patient.data;
  const st = REVIEW_STATUS[plan.data?.review_status ?? ""];

  return (
    <div>
      {back}
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-semibold tracking-tight">{displayName(p.name)}</h1>
            {p.is_demo && <DemoBadge />}
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            {[p.age && `${p.age} yrs`, p.gender, p.city, p.condition].filter(Boolean).join(" · ")}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {st && <StatusPill tone={st.tone}>{st.label}</StatusPill>}
          {plan.data?.flagged_followup && (
            <StatusPill tone="danger" icon={<Flag />}>
              Follow-up flagged
            </StatusPill>
          )}
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <InsightPanel insight={insight.data} loading={insight.isLoading} />

          <Panel
            title="Signals · last 14 days"
            subtitle="Dashed line marks your KPI target. Only categories the patient shares with you are shown."
          >
            {signals.isLoading || consents.isLoading ? (
              <CardSkeleton lines={4} className="border-0 p-0" />
            ) : signals.error ? (
              <ErrorState error={signals.error} onRetry={() => signals.refetch()} />
            ) : (
              <div className="grid gap-4 md:grid-cols-3">
                {(["glucose", "steps", "sleep"] as const).map((m) => (
                  <SignalPanel
                    key={m}
                    metric={m}
                    signals={signals.data ?? []}
                    kpi={kpis.data?.find((k) => k.metric === m)}
                    consentStatus={
                      consents.data?.find((c) => c.category === METRICS[m].consent)?.status
                    }
                  />
                ))}
              </div>
            )}
            <div className="mt-4 flex items-start gap-2 rounded-lg bg-muted/60 p-3 text-xs text-muted-foreground">
              <Utensils className="mt-0.5 size-3.5 shrink-0" />
              Meal trends: meal photos are consented for AI nutrition analysis for the patient only,
              so meal-level data is not shared with consultants. The patient sees their meal
              adherence in their care plan.
            </div>
          </Panel>

          <KpiPanel
            pid={pid}
            kpis={kpis.data ?? []}
            signals={signals.data ?? []}
            consents={consents.data ?? []}
            loading={kpis.isLoading}
          />
        </div>

        <aside className="space-y-4">
          <ReviewPanel pid={pid} plan={plan.data} loading={plan.isLoading} />

          <Panel title="Data shared with you">
            {consents.isLoading ? (
              <CardSkeleton lines={3} className="border-0 p-0" />
            ) : (
              <ul className="space-y-2 text-sm">
                {sortConsents(
                  (consents.data ?? []).filter((c) => c.recipient_type === "consultant"),
                ).map((c) => (
                  <li key={c.id} className="flex items-center justify-between gap-2">
                    <span>{c.data_label}</span>
                    <ConsentPill status={c.status} />
                  </li>
                ))}
              </ul>
            )}
            <p className="mt-3 flex items-start gap-1.5 text-xs text-muted-foreground">
              <Eye className="mt-0.5 size-3.5 shrink-0" /> Your access to this record is logged and
              visible to the patient.
            </p>
          </Panel>

          <PrescriptionPanel
            pid={pid}
            rx={rx.data ?? []}
            orders={orders.data ?? []}
            loading={rx.isLoading}
          />

          <Panel title="Reports">
            {reports.isLoading ? (
              <CardSkeleton lines={2} className="border-0 p-0" />
            ) : !active("medical_reports") ? (
              <Locked text="The patient hasn't shared medical reports with you." />
            ) : reports.data?.length ? (
              <ul className="space-y-2.5 text-sm">
                {reports.data.map((r) => (
                  <li key={r.id} className="flex items-start gap-2">
                    <FileText className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                    <div className="min-w-0">
                      <p className="font-medium leading-snug">{r.title}</p>
                      <p className="text-xs text-muted-foreground">
                        {fmtDate(r.report_date)} · {r.category}
                        {r.file_path ? " · file held by patient" : ""}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">No reports.</p>
            )}
          </Panel>
        </aside>
      </div>
    </div>
  );
}

function Panel({
  title,
  subtitle,
  action,
  children,
  className,
}: {
  title: string;
  subtitle?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("rounded-xl border bg-card p-5", className)}>
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h2 className="font-semibold">{title}</h2>
          {subtitle && <p className="mt-0.5 text-xs text-muted-foreground">{subtitle}</p>}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

function Locked({ text }: { text: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed px-4 py-6 text-center text-sm text-muted-foreground">
      <Lock className="size-4" />
      {text}
    </div>
  );
}

function SignalPanel({
  metric,
  signals,
  kpi,
  consentStatus,
}: {
  metric: MetricKey;
  signals: Signal[];
  kpi: Kpi | undefined;
  consentStatus: string | undefined;
}) {
  const m = METRICS[metric];
  const pts = series(signals, metric);
  const t = trend(signals, metric);
  return (
    <div className="min-w-0">
      <div className="flex items-baseline justify-between gap-2">
        <p className="text-sm font-medium">{m.label}</p>
        {t.recent != null && (
          <p className="text-xs text-muted-foreground">
            5-day avg{" "}
            <span className="font-medium text-foreground tabular-nums">
              {fmtNumber(t.recent, m.digits)}
            </span>
            {t.pct != null && (
              <span className="tabular-nums">
                {" "}
                ({t.pct > 0 ? "+" : ""}
                {Math.round(t.pct)}%)
              </span>
            )}
          </p>
        )}
      </div>
      {consentStatus !== "active" ? (
        <div className="mt-2">
          <Locked
            text={
              consentStatus === "withdrawn"
                ? "Patient withdrew consent. Data no longer accessible."
                : "Not shared with you."
            }
          />
        </div>
      ) : pts.length > 1 ? (
        <TrendChart
          points={pts}
          target={kpi ? Number(kpi.target) : undefined}
          unit={m.unit}
          digits={m.digits}
          label={m.label}
          height={150}
        />
      ) : (
        <p className="py-8 text-center text-sm text-muted-foreground">No recent readings.</p>
      )}
    </div>
  );
}

function InsightPanel({
  insight,
  loading,
}: {
  insight: ReturnType<typeof useLatestInsight>["data"];
  loading: boolean;
}) {
  return (
    <Panel
      title="Latest AI insight"
      subtitle="Pattern summary shown to the patient. For your review; you remain the clinical decision-maker."
      action={
        insight ? (
          <span className="text-xs text-muted-foreground">{fmtDateTime(insight.created_at)}</span>
        ) : undefined
      }
    >
      {loading ? (
        <CardSkeleton lines={3} className="border-0 p-0" />
      ) : !insight ? (
        <p className="text-sm text-muted-foreground">
          No insight has been generated for this patient yet.
        </p>
      ) : (
        <div className="space-y-3">
          <div className="flex flex-wrap gap-2">
            {insight.safety_level === "red" ? (
              <StatusPill tone="danger" icon={<ShieldAlert />}>
                AI blocked · professional review
              </StatusPill>
            ) : insight.safety_level === "amber" ? (
              <StatusPill tone="warning">KPI outside target 5+ days</StatusPill>
            ) : (
              <StatusPill tone="success">Within normal variation</StatusPill>
            )}
            {insight.human_review && (
              <StatusPill tone="highlight">Consultant review suggested</StatusPill>
            )}
            <StatusPill tone="neutral" icon={<Sparkles />}>
              {SOURCE_LABEL[insight.source] ?? insight.source}
              {insight.confidence ? ` · ${insight.confidence}` : ""}
            </StatusPill>
          </div>
          <dl className="grid gap-3 text-sm md:grid-cols-3">
            <div className="rounded-lg bg-muted/50 p-3">
              <dt className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                What changed
              </dt>
              <dd className="mt-1">{insight.what_changed}</dd>
            </div>
            <div className="rounded-lg bg-muted/50 p-3">
              <dt className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Why it matters
              </dt>
              <dd className="mt-1">{insight.why_matters}</dd>
            </div>
            <div className="rounded-lg bg-secondary/70 p-3">
              <dt className="text-xs font-semibold uppercase tracking-wider text-secondary-foreground">
                Next action given
              </dt>
              <dd className="mt-1 font-medium">{insight.next_action}</dd>
              {insight.action_done_at && (
                <dd className="mt-1 text-xs text-success">
                  Patient marked done · {fmtDateTime(insight.action_done_at)}
                </dd>
              )}
            </div>
          </dl>
          {!!insight.inputs_used?.length && (
            <p className="text-xs text-muted-foreground">
              Inputs used (consented only): {insight.inputs_used.join(", ")}
            </p>
          )}
        </div>
      )}
    </Panel>
  );
}

function KpiPanel({
  pid,
  kpis,
  signals,
  consents,
  loading,
}: {
  pid: string;
  kpis: Kpi[];
  signals: Signal[];
  consents: { category: string; status: string }[];
  loading: boolean;
}) {
  const org = useMyOrg("consultant");
  const KPI_CONSENT: Record<string, string> = {
    glucose: "glucose",
    steps: "activity",
    sleep: "sleep",
  };
  const queryClient = useQueryClient();
  const name = org.data?.name ?? "Consultant";
  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("kpis").delete().eq("id", id);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: qk.kpis(pid) });
      toast.success("KPI removed");
    },
    onError: (e: Error) => toast.error("Couldn't remove KPI", { description: e.message }),
  });

  return (
    <Panel
      title="KPIs"
      subtitle="Current value is the 5-day average (meals: last 7 days)."
      action={
        <KpiDialog
          patientId={pid}
          consultantName={name}
          trigger={
            <Button size="sm" variant="outline">
              <Plus /> Add KPI
            </Button>
          }
        />
      }
    >
      {loading ? (
        <CardSkeleton lines={4} className="border-0 p-0" />
      ) : !kpis.length ? (
        <p className="text-sm text-muted-foreground">No KPIs defined yet.</p>
      ) : (
        <div className="-mx-5 overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="pl-5">KPI</TableHead>
                <TableHead>Target</TableHead>
                <TableHead>Current</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="hidden md:table-cell">Off target</TableHead>
                <TableHead className="w-20 pr-5" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {kpis.map((k) => {
                const consentCat = KPI_CONSENT[k.metric];
                const consentStatus = consents.find((c) => c.category === consentCat)?.status;
                // Meals are never shared with consultants; other metrics follow the patient's consent.
                const shared = !!consentCat && consentStatus === "active";
                const cur = shared ? kpiCurrent(k, signals) : null;
                const state = kpiState(k, cur);
                const off = persistentDeviationDays(k, signals);
                return (
                  <TableRow key={k.id}>
                    <TableCell className="pl-5">
                      <div className="font-medium">{k.name}</div>
                      <div className="text-xs text-muted-foreground">
                        {k.frequency} · {k.source}
                        {k.status !== "Active" && ` · ${k.status}`}
                      </div>
                    </TableCell>
                    <TableCell className="tabular-nums">{targetText(k)}</TableCell>
                    <TableCell className="tabular-nums">
                      {shared ? (
                        cur == null ? (
                          "—"
                        ) : (
                          fmtNumber(cur, k.metric === "sleep" ? 1 : 0)
                        )
                      ) : (
                        <span className="text-xs text-muted-foreground">
                          {consentStatus === "withdrawn" ? "Withdrawn" : "Not shared"}
                        </span>
                      )}
                    </TableCell>
                    <TableCell>
                      {shared ? (
                        <StatusPill tone={KPI_TONE[state]}>{stateLabel[state]}</StatusPill>
                      ) : (
                        <StatusPill tone="neutral" icon={<Lock />}>
                          {consentStatus === "withdrawn" ? "Access withdrawn" : "Patient only"}
                        </StatusPill>
                      )}
                    </TableCell>
                    <TableCell className="hidden md:table-cell">
                      {off > 0 ? (
                        <span className={cn("text-sm", off >= 5 && "font-medium text-danger")}>
                          {off} day{off === 1 ? "" : "s"}
                        </span>
                      ) : (
                        <span className="text-sm text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell className="pr-5">
                      <div className="flex justify-end gap-1">
                        <KpiDialog
                          patientId={pid}
                          kpi={k}
                          consultantName={name}
                          trigger={
                            <Button size="icon" variant="ghost" aria-label={`Edit ${k.name}`}>
                              <Pencil />
                            </Button>
                          }
                        />
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button size="icon" variant="ghost" aria-label={`Delete ${k.name}`}>
                              <Trash2 />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Remove “{k.name}”?</AlertDialogTitle>
                              <AlertDialogDescription>
                                PULSE LOOP will stop monitoring and coaching against this KPI.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Keep</AlertDialogCancel>
                              <AlertDialogAction onClick={() => del.mutate(k.id)}>
                                Remove
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </Panel>
  );
}

function ReviewPanel({
  pid,
  plan,
  loading,
}: {
  pid: string;
  plan: ReturnType<typeof useCarePlan>["data"];
  loading: boolean;
}) {
  const queryClient = useQueryClient();
  const [status, setStatus] = useState("on_track");
  const [note, setNote] = useState("");
  const [followup, setFollowup] = useState(false);

  useEffect(() => {
    if (!plan) return;
    setStatus(plan.review_status);
    setNote(plan.consultant_notes ?? "");
    setFollowup(plan.flagged_followup);
  }, [plan]);

  const save = useMutation({
    mutationFn: async (v: { status: string; note: string; followup: boolean }) => {
      const { error } = await supabase.rpc("consultant_review", {
        _pid: pid,
        _status: v.status,
        _note: v.note,
        _followup: v.followup,
      });
      if (error) throw new Error(error.message);
      return v;
    },
    onSuccess: (v) => {
      void queryClient.invalidateQueries({ queryKey: qk.carePlan(pid) });
      void queryClient.invalidateQueries({ queryKey: ["caseload"] });
      toast.success(v.status === "escalated" ? "Patient escalated" : "Review saved", {
        description: "The patient sees your note in their care plan.",
      });
    },
    onError: (e: Error) => toast.error("Couldn't save review", { description: e.message }),
  });

  if (loading) return <CardSkeleton lines={4} />;
  if (!plan)
    return (
      <Panel title="Care-plan review">
        <p className="text-sm text-muted-foreground">No care plan on record.</p>
      </Panel>
    );

  return (
    <Panel title="Care-plan review" subtitle={`Last reviewed ${fmtDate(plan.last_reviewed_at)}`}>
      {plan.plan_actions && (
        <div className="mb-4 rounded-lg bg-muted/50 p-3 text-sm">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Current plan
          </p>
          <p className="mt-1">{plan.plan_actions}</p>
        </div>
      )}
      <div className="space-y-3">
        <div className="space-y-1.5">
          <Label htmlFor="rv-status">Review status</Label>
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger id="rv-status">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(REVIEW_STATUS).map(([k, v]) => (
                <SelectItem key={k} value={k}>
                  {v.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="rv-note">Note to patient</Label>
          <Textarea
            id="rv-note"
            rows={3}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="e.g. Reviewed your trend. Keep the post-dinner walk; we'll recheck in 2 weeks."
          />
        </div>
        <label className="flex items-center justify-between gap-3 text-sm">
          <span className="inline-flex items-center gap-1.5">
            <Flag className="size-4 text-muted-foreground" /> Flag for follow-up
          </span>
          <Switch checked={followup} onCheckedChange={setFollowup} />
        </label>
        <div className="flex flex-col gap-2 pt-1 sm:flex-row lg:flex-col xl:flex-row">
          <Button
            className="flex-1"
            onClick={() => save.mutate({ status, note, followup })}
            disabled={save.isPending}
          >
            {save.isPending && save.variables?.status !== "escalated" && <InlineSpinner />} Save
            review
          </Button>
          <Button
            variant="outline"
            className="flex-1 border-danger/40 text-danger hover:bg-danger-soft hover:text-danger"
            onClick={() => {
              setStatus("escalated");
              setFollowup(true);
              save.mutate({ status: "escalated", note, followup: true });
            }}
            disabled={save.isPending || plan.review_status === "escalated"}
          >
            <AlertOctagon /> Escalate
          </Button>
        </div>
      </div>
    </Panel>
  );
}

function PrescriptionPanel({
  pid,
  rx,
  orders,
  loading,
}: {
  pid: string;
  rx: NonNullable<ReturnType<typeof usePrescriptions>["data"]>;
  orders: NonNullable<ReturnType<typeof useOrders>["data"]>;
  loading: boolean;
}) {
  const org = useMyOrg("consultant");
  return (
    <Panel
      title="Prescription & refill"
      action={
        <PrescriptionDialog
          patientId={pid}
          consultantName={org.data?.name ?? "Consultant"}
          trigger={
            <Button size="sm" variant="outline">
              <Plus /> Issue
            </Button>
          }
        />
      }
    >
      {loading ? (
        <CardSkeleton lines={3} className="border-0 p-0" />
      ) : !rx.length ? (
        <p className="text-sm text-muted-foreground">No prescriptions.</p>
      ) : (
        <ul className="space-y-3">
          {rx.map((r) => {
            const open = orders.find(
              (o) => o.prescription_id === r.id && !TERMINAL_ORDER.includes(o.status),
            );
            const last = orders.find((o) => o.prescription_id === r.id);
            const d = daysUntil(r.refill_due);
            return (
              <li key={r.id} className="rounded-lg border p-3 text-sm">
                <p className="flex items-start gap-2 font-medium">
                  <Pill className="mt-0.5 size-4 shrink-0 text-highlight" /> {r.medicine}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {r.quantity} · prescribed {fmtDate(r.prescribed_on)} · valid to{" "}
                  {fmtDate(r.valid_until)}
                </p>
                <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
                  <span
                    className={cn(d != null && d <= 3 && "font-medium text-highlight-foreground")}
                  >
                    Refill{" "}
                    {d == null
                      ? "—"
                      : d < 0
                        ? `${-d}d overdue`
                        : d === 0
                          ? "due today"
                          : `in ${d}d`}
                  </span>
                  {(open ?? last) && (
                    <StatusPill tone={orderTone((open ?? last)!.status)} icon={false}>
                      Order: {orderLabel[(open ?? last)!.status] ?? (open ?? last)!.status}
                    </StatusPill>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
      <p className="mt-3 text-xs text-muted-foreground">
        Fulfilment status confirms delivery, not that medicine was taken.
      </p>
    </Panel>
  );
}
