import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Building2,
  Eye,
  History,
  Pill,
  ShieldCheck,
  Sparkles,
  Stethoscope,
  Trash2,
  UserRound,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { CardSkeleton, EmptyState, ErrorState, InlineSpinner } from "@/components/common/states";
import { ConsentPill, StatusPill } from "@/components/common/StatusPill";
import { SectionTitle } from "@/components/patient/InsightCards";
import { usePatientCtx } from "@/components/patient/context";
import { supabase } from "@/integrations/supabase/client";
import {
  qk,
  sortConsents,
  useAuditLogs,
  useConsents,
  useDeletionRequests,
  type Consent,
} from "@/lib/data";
import { consentMeta } from "@/lib/product";
import { fmtDate, fmtDateTime, titleCase } from "@/lib/format";

export const Route = createFileRoute("/app/privacy")({
  head: () => ({ meta: [{ title: "Privacy Centre · PULSE LOOP" }] }),
  component: Privacy,
});

const RECIPIENT_ICON: Record<string, typeof UserRound> = {
  consultant: Stethoscope,
  ai: Sparkles,
  pharmacy: Pill,
  insurer: Building2,
};

function Privacy() {
  const patient = usePatientCtx();
  const consents = useConsents(patient.id);
  const queryClient = useQueryClient();
  const [pending, setPending] = useState<Consent | null>(null);

  const change = useMutation({
    mutationFn: async ({ c, status }: { c: Consent; status: "active" | "withdrawn" }) => {
      const { error } = await supabase.rpc("set_consent", {
        _category: c.category,
        _status: status,
      });
      if (error) throw new Error(error.message);
      return { c, status };
    },
    onMutate: async ({ c, status }) => {
      await queryClient.cancelQueries({ queryKey: qk.consents(patient.id) });
      const prev = queryClient.getQueryData<Consent[]>(qk.consents(patient.id));
      const now = new Date().toISOString();
      queryClient.setQueryData<Consent[]>(qk.consents(patient.id), (rows) =>
        rows?.map((r) =>
          r.id === c.id
            ? {
                ...r,
                status,
                granted_at: status === "active" ? now : r.granted_at,
                withdrawn_at: status === "withdrawn" ? now : null,
              }
            : r,
        ),
      );
      return { prev };
    },
    onError: (e: Error, _v, ctx) => {
      if (ctx?.prev) queryClient.setQueryData(qk.consents(patient.id), ctx.prev);
      toast.error("Couldn't update permission", { description: e.message });
    },
    onSuccess: ({ c, status }) => {
      const meta = consentMeta(c.category);
      toast.success(
        status === "withdrawn"
          ? `${c.data_label}: permission withdrawn`
          : `${c.data_label}: permission granted`,
        {
          description:
            status === "withdrawn"
              ? meta?.effect
              : `${c.recipient_name} can now use it for ${c.purpose.toLowerCase()}.`,
        },
      );
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: qk.consents(patient.id) });
      void queryClient.invalidateQueries({ queryKey: qk.audit(patient.id) });
      void queryClient.invalidateQueries({ queryKey: qk.orders(patient.id) });
    },
  });

  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-wider text-primary">Privacy Centre</p>
      <h1 className="mt-1 text-[22px] font-semibold leading-tight tracking-tight">
        Your data follows your care plan, not every stakeholder.
      </h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Each permission names who receives the data and why. Withdrawing takes effect immediately
        and is enforced by the database, not just this screen.
      </p>

      <SectionTitle>Permissions</SectionTitle>
      {consents.isLoading ? (
        <div className="space-y-2">
          <CardSkeleton lines={3} />
          <CardSkeleton lines={3} />
        </div>
      ) : consents.error ? (
        <ErrorState error={consents.error} onRetry={() => consents.refetch()} />
      ) : (
        <ul className="space-y-2">
          {sortConsents(consents.data ?? []).map((c) => {
            const Icon = RECIPIENT_ICON[c.recipient_type] ?? UserRound;
            const active = c.status === "active";
            return (
              <li key={c.id} className="rounded-2xl border bg-card p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-medium">{c.data_label}</p>
                    <p className="mt-0.5 flex items-center gap-1.5 text-sm text-muted-foreground">
                      <Icon className="size-3.5 shrink-0" />
                      {titleCase(c.recipient_type === "ai" ? "AI engine" : c.recipient_type)}
                    </p>
                  </div>
                  <ConsentPill status={c.status} />
                </div>
                <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
                  <div>
                    <dt className="text-muted-foreground">Purpose</dt>
                    <dd className="mt-0.5 font-medium">{c.purpose}</dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground">Recipient</dt>
                    <dd className="mt-0.5 font-medium">{c.recipient_name}</dd>
                  </div>
                  <div className="col-span-2">
                    <dt className="text-muted-foreground">
                      {c.status === "withdrawn" ? "Withdrawn" : "Date granted"}
                    </dt>
                    <dd className="mt-0.5 font-medium">
                      {fmtDate(c.status === "withdrawn" ? c.withdrawn_at : c.granted_at)}
                    </dd>
                  </div>
                  {c.retention && (
                    <div className="col-span-2 -mt-1">
                      <dt className="sr-only">Retention</dt>
                      <dd className="text-muted-foreground">Kept: {c.retention.toLowerCase()}</dd>
                    </div>
                  )}
                </dl>
                <div className="mt-3 flex items-center justify-between gap-2 border-t pt-3">
                  <span className="text-xs text-muted-foreground">
                    {c.optional ? "Optional" : "Used by your care plan"}
                  </span>
                  {active ? (
                    <Button
                      size="sm"
                      variant="outline"
                      className="text-danger hover:text-danger"
                      onClick={() => setPending(c)}
                    >
                      Withdraw
                    </Button>
                  ) : (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => change.mutate({ c, status: "active" })}
                      disabled={change.isPending && change.variables?.c.id === c.id}
                    >
                      {change.isPending && change.variables?.c.id === c.id && <InlineSpinner />}{" "}
                      Grant
                    </Button>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <AlertDialog open={!!pending} onOpenChange={(o) => !o && setPending(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Withdraw {pending?.data_label.toLowerCase()}?</AlertDialogTitle>
            <AlertDialogDescription>
              {consentMeta(pending?.category ?? "")?.effect} You can grant it again at any time.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep sharing</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => pending && change.mutate({ c: pending, status: "withdrawn" })}
            >
              Withdraw
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AccessHistory />
      <Deletion />
    </div>
  );
}

const ACTION_WORD: Record<string, string> = {
  viewed: "viewed",
  shared: "shared",
  updated: "updated",
  granted: "granted",
  active: "granted",
  withdrawn: "withdrew",
  linked: "linked",
  reset: "reset",
};

function AccessHistory() {
  const patient = usePatientCtx();
  const logs = useAuditLogs(patient.id);
  const [scope, setScope] = useState<"others" | "all">("others");
  const rows = (logs.data ?? []).filter((l) => scope === "all" || l.actor_role !== "patient");
  return (
    <>
      <SectionTitle>Who accessed my data?</SectionTitle>
      <Tabs value={scope} onValueChange={(v) => setScope(v as "others" | "all")}>
        <TabsList className="mb-2 grid w-full grid-cols-2">
          <TabsTrigger value="others">Others' access</TabsTrigger>
          <TabsTrigger value="all">All activity</TabsTrigger>
        </TabsList>
      </Tabs>
      {logs.isLoading ? (
        <CardSkeleton lines={4} />
      ) : logs.error ? (
        <ErrorState error={logs.error} onRetry={() => logs.refetch()} />
      ) : rows.length === 0 ? (
        <EmptyState
          icon={<Eye className="size-5" />}
          title={scope === "others" ? "No one else has accessed your data yet" : "No activity yet"}
          description="Every time your consultant, pharmacy or insurer views your data, it is recorded here."
        />
      ) : (
        <ul className="divide-y rounded-2xl border bg-card">
          {rows.map((l) => {
            const Icon =
              RECIPIENT_ICON[l.actor_role] ?? (l.actor_role === "patient" ? UserRound : History);
            return (
              <li key={l.id} className="flex gap-3 px-4 py-3">
                <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground">
                  <Icon className="size-4" />
                </span>
                <div className="min-w-0 flex-1 text-sm">
                  <p>
                    <span className="font-medium">
                      {l.actor_role === "patient" ? "You" : l.actor_name}
                    </span>{" "}
                    {ACTION_WORD[l.action] ?? l.action}{" "}
                    <span className="font-medium">{l.data_category}</span>
                  </p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {l.purpose} · {fmtDateTime(l.created_at)}
                  </p>
                </div>
                {l.actor_role !== "patient" && (
                  <StatusPill tone="neutral" icon={false} className="self-start">
                    {titleCase(l.actor_role)}
                  </StatusPill>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}

const DELETION_SCOPES = [
  { key: "health_signals", label: "Glucose, activity and sleep readings" },
  { key: "meal_estimates", label: "Meal estimates" },
  { key: "medical_reports", label: "Uploaded reports" },
  { key: "ai_insights", label: "AI summaries" },
  { key: "account", label: "My whole account" },
];

function Deletion() {
  const patient = usePatientCtx();
  const requests = useDeletionRequests(patient.id);
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [scope, setScope] = useState<string[]>([]);

  const submit = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("deletion_requests")
        .insert({ patient_id: patient.id, scope });
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      setOpen(false);
      setScope([]);
      void queryClient.invalidateQueries({ queryKey: qk.deletion(patient.id) });
      toast.success("Deletion request received", {
        description: "We'll confirm what can be deleted and what must be retained.",
      });
    },
    onError: (e: Error) => toast.error("Couldn't submit the request", { description: e.message }),
  });

  return (
    <>
      <SectionTitle>Delete my data</SectionTitle>
      <div className="rounded-2xl border bg-card p-4">
        <p className="text-sm text-muted-foreground">
          Ask for specific data to be deleted. Some records (such as prescriptions and bills) may
          need to be retained for legal reasons; we'll tell you which.
        </p>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button variant="outline" className="mt-3 w-full">
              <Trash2 /> Request deletion
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Request deletion</DialogTitle>
              <DialogDescription>Choose what you'd like deleted.</DialogDescription>
            </DialogHeader>
            <div className="space-y-2">
              {DELETION_SCOPES.map((s) => (
                <label
                  key={s.key}
                  className="flex items-center gap-3 rounded-lg border p-3 text-sm"
                >
                  <Checkbox
                    checked={scope.includes(s.key)}
                    onCheckedChange={(v) =>
                      setScope((cur) =>
                        v === true ? [...cur, s.key] : cur.filter((x) => x !== s.key),
                      )
                    }
                  />
                  {s.label}
                </label>
              ))}
            </div>
            <DialogFooter>
              <Button onClick={() => submit.mutate()} disabled={!scope.length || submit.isPending}>
                {submit.isPending && <InlineSpinner />} Submit request
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {!!requests.data?.length && (
          <ul className="mt-4 space-y-2 border-t pt-3">
            {requests.data.map((r) => (
              <li key={r.id} className="flex items-start justify-between gap-3 text-sm">
                <div className="min-w-0">
                  <p className="font-medium">
                    {r.scope
                      .map((s) => DELETION_SCOPES.find((d) => d.key === s)?.label ?? s)
                      .join(", ")}
                  </p>
                  <p className="text-xs text-muted-foreground">Requested {fmtDate(r.created_at)}</p>
                </div>
                <StatusPill tone="info" icon={false}>
                  {titleCase(r.status)}
                </StatusPill>
              </li>
            ))}
          </ul>
        )}
      </div>
      <p className="mt-6 flex items-center justify-center gap-1.5 text-center text-xs text-muted-foreground">
        <ShieldCheck className="size-3.5" /> Access rules are enforced in the database for every
        role.
      </p>
    </>
  );
}
