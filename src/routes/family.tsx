import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Bell, HeartHandshake, Languages, Lock, Pill, Salad, Send, TrendingUp, TriangleAlert } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Logo } from "@/components/brand/Logo";
import { UserMenu } from "@/components/shell/UserMenu";
import { RequireRole } from "@/components/shell/RequireRole";
import { StatusPill } from "@/components/common/StatusPill";
import { CardSkeleton, ErrorState, InlineSpinner } from "@/components/common/states";
import { supabase } from "@/integrations/supabase/client";
// New caregiver tables/RPCs aren't in the generated types yet.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;
import { fmtAgo, fmtDateTime } from "@/lib/format";
import { QUICK_MESSAGES, t, type Lang } from "@/lib/family";

export const Route = createFileRoute("/family")({
  head: () => ({
    meta: [
      { title: "Family Support · PULSE LOOP" },
      { name: "description", content: "Support your family member's diabetes care plan with their permission." },
      { property: "og:title", content: "Family Support · PULSE LOOP" },
      { property: "og:description", content: "Consent-based caregiver dashboard for diabetes support." },
    ],
  }),
  component: () => (
    <RequireRole role="caregiver">
      <FamilyPage />
    </RequireRole>
  ),
});

type Dose = { id: string; label: string; scheduled_for: string; status: string; confirmed_at: string | null };
type Dash = {
  link: { id: string; relationship: string; caregiver_name: string; permissions: string[] };
  patient: { id: string; first_name: string; is_demo: boolean };
  doses?: Dose[];
  meals?: { name: string; carbs: string; at: string }[];
  meal_goal?: string | null;
  glucose?: { usual: number | null; recent: number | null; latest: { value: number; at: string; context: string | null } | null; escalated: boolean };
  progress?: { doses_taken: number; doses_total: number; walk_days: number; balanced_meals: number; hba1c: null };
};

function FamilyPage() {
  const [lang, setLang] = useState<Lang>("en");
  const dash = useQuery({
    queryKey: ["caregiver-dashboard"],
    queryFn: async () => {
      const { data, error } = await db.rpc("caregiver_dashboard");
      if (error) throw new Error(error.message);
      return data as unknown as Dash | null;
    },
    refetchInterval: 8000,
  });

  return (
    <div className="min-h-screen bg-muted/40">
      <div className="mx-auto flex min-h-screen max-w-md flex-col bg-background sm:border-x">
        <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b bg-background/95 px-4">
          <Logo size="sm" />
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => setLang(lang === "en" ? "hi" : "en")} aria-label="Switch language">
              <Languages className="size-4" /> {lang === "en" ? "हिंदी" : "English"}
            </Button>
            <UserMenu name={dash.data?.link.caregiver_name ?? "Family"} subtitle="Family / Caregiver" />
          </div>
        </header>
        <main className="flex-1 space-y-4 px-4 py-4 text-[15px]">
          {dash.isLoading ? (
            <CardSkeleton lines={4} />
          ) : dash.error ? (
            <ErrorState error={dash.error} onRetry={() => dash.refetch()} />
          ) : !dash.data ? (
            <AcceptInvite />
          ) : (
            <Dashboard d={dash.data} lang={lang} />
          )}
          <p className="pb-4 text-center text-xs text-muted-foreground">
            Hackathon prototype. Simulated health data and notifications. Not for clinical use.
          </p>
        </main>
      </div>
    </div>
  );
}

function AcceptInvite() {
  const qc = useQueryClient();
  const [code, setCode] = useState("");
  const accept = useMutation({
    mutationFn: async () => {
      const { error } = await db.rpc("accept_caregiver_invite", { _code: code });
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      toast.success("You're linked. You'll only see what was shared with you.");
      void qc.invalidateQueries({ queryKey: ["caregiver-dashboard"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });
  return (
    <section className="rounded-2xl border bg-card p-5">
      <HeartHandshake className="size-8 text-primary" />
      <h1 className="mt-3 text-xl font-semibold">Enter your invite code</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Ask your family member to open <b>Privacy → Family access</b> in PULSE LOOP and share the 6-letter code with you.
        You'll only see what they choose to share.
      </p>
      <form
        className="mt-4 flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          accept.mutate();
        }}
      >
        <Input value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder="e.g. A1B2C3" maxLength={6} className="h-12 text-lg tracking-widest" aria-label="Invite code" />
        <Button type="submit" className="h-12" disabled={code.length < 6 || accept.isPending}>
          {accept.isPending && <InlineSpinner />} Link
        </Button>
      </form>
    </section>
  );
}

function Card({ icon: Icon, title, children }: { icon: typeof Pill; title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border bg-card p-4">
      <h2 className="mb-3 flex items-center gap-2 font-semibold">
        <Icon className="size-5 text-primary" /> {title}
      </h2>
      {children}
    </section>
  );
}

function Locked({ lang }: { lang: Lang }) {
  return (
    <p className="flex items-center gap-2 text-sm text-muted-foreground">
      <Lock className="size-4" /> {t("noAccess", lang)}
    </p>
  );
}

const DOSE_TONE = { taken: "success", missed: "warning", not_confirmed: "neutral" } as const;

function Dashboard({ d, lang }: { d: Dash; lang: Lang }) {
  const name = d.patient.first_name;
  const today = new Date().toDateString();
  const todayDoses = d.doses?.filter((x) => new Date(x.scheduled_for).toDateString() === today) ?? [];
  return (
    <>
      <div>
        <p className="text-xs font-semibold uppercase tracking-wider text-primary">{t("today", lang)}</p>
        <h1 className="text-[22px] font-semibold leading-tight">
          {lang === "en" ? `Supporting ${name}` : `${name} की मदद`}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {d.link.relationship} · {name} decides what you can see. You can't change medicines or doses.
        </p>
      </div>

      <Updates patientId={d.patient.id} lang={lang} />

      <Card icon={Pill} title={t("meds", lang)}>
        {!d.doses ? (
          <Locked lang={lang} />
        ) : (
          <>
            <ul className="space-y-2">
              {todayDoses.map((x) => (
                <li key={x.id} className="flex items-center justify-between gap-2 rounded-xl bg-muted/50 p-3">
                  <span className="text-sm">{x.label}</span>
                  <StatusPill tone={DOSE_TONE[x.status as keyof typeof DOSE_TONE] ?? "neutral"}>
                    {t((x.status as "taken") ?? "not_confirmed", lang)}
                  </StatusPill>
                </li>
              ))}
            </ul>
            <p className="mt-3 text-xs text-muted-foreground">
              Last 7 days:{" "}
              {d.doses.filter((x) => x.status === "taken").length} confirmed taken ·{" "}
              {d.doses.filter((x) => x.status === "missed").length} missed ·{" "}
              {d.doses.filter((x) => x.status === "not_confirmed").length} not confirmed. Unconfirmed doses are never counted as taken.
            </p>
          </>
        )}
      </Card>

      <Card icon={Salad} title={t("food", lang)}>
        {!d.meals && !d.glucose ? (
          <Locked lang={lang} />
        ) : (
          <div className="space-y-3 text-sm">
            {d.meal_goal && (
              <p className="rounded-xl bg-secondary p-3">
                <b>Care-plan goal:</b> {d.meal_goal}
              </p>
            )}
            {d.glucose && <GlucoseSummary g={d.glucose} name={name} lang={lang} />}
            {d.meals && (
              <ul className="divide-y">
                {d.meals.map((m, i) => (
                  <li key={i} className="flex items-center justify-between py-2">
                    <span>{m.name}</span>
                    <span className="text-xs text-muted-foreground">
                      {m.carbs === "high" ? "Higher carb" : "Balanced"} · {fmtAgo(m.at)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
            {d.meals && (
              <p className="text-xs text-muted-foreground">
                Tip: if rice is part of dinner, help plate a smaller portion with more dal and salad — a habit from {name}'s care plan.
              </p>
            )}
          </div>
        )}
      </Card>

      <Card icon={TrendingUp} title={t("progress", lang)}>
        {!d.progress ? (
          <Locked lang={lang} />
        ) : (
          <div className="grid grid-cols-3 gap-2 text-center">
            <Stat v={`${d.progress.doses_taken}/${d.progress.doses_total}`} l="Doses confirmed" />
            <Stat v={`${d.progress.walk_days}/7`} l="Days at step goal" />
            <Stat v={`${d.progress.balanced_meals}/7`} l="Balanced meals" />
            <div className="col-span-3 rounded-xl bg-muted/50 p-3 text-left text-sm">
              <b>HbA1c:</b> {t("na", lang)} <span className="text-xs text-muted-foreground">(no recorded result shared)</span>
            </div>
          </div>
        )}
      </Card>

      <SendSupport patientId={d.patient.id} lang={lang} />
    </>
  );
}

function Stat({ v, l }: { v: string; l: string }) {
  return (
    <div className="rounded-xl bg-muted/50 p-3">
      <div className="text-lg font-semibold">{v}</div>
      <div className="text-[11px] text-muted-foreground">{l}</div>
    </div>
  );
}

function GlucoseSummary({ g, name, lang }: { g: NonNullable<Dash["glucose"]>; name: string; lang: Lang }) {
  if (g.escalated)
    return (
      <p className="flex gap-2 rounded-xl border border-danger/30 bg-danger-soft p-3 text-danger">
        <TriangleAlert className="size-4 shrink-0" /> A reading has been sent to the consultant for review. Please follow their advice.
      </p>
    );
  if (g.usual == null || g.recent == null) return <p>{t("na", lang)}</p>;
  const higher = g.recent > g.usual + 10;
  return (
    <p className="rounded-xl bg-muted/50 p-3">
      {higher
        ? `${name}'s recent readings are a little higher than his usual range (about ${g.recent} vs ${g.usual} mg/dL). Walks after meals and balanced plates can help.`
        : `${name}'s readings are close to his usual range.`}
      {g.latest?.context === "after meal" && (
        <span className="mt-1 block text-xs text-muted-foreground">Latest after-meal reading: {g.latest.value} mg/dL · {fmtAgo(g.latest.at)}</span>
      )}
      <span className="mt-1 block text-xs text-muted-foreground">Informational only — not a diagnosis.</span>
    </p>
  );
}

type Msg = { id: string; direction: string; kind: string; body: string; created_at: string };

function Updates({ patientId, lang }: { patientId: string; lang: Lang }) {
  const msgs = useQuery({
    queryKey: ["support-messages", patientId],
    queryFn: async () => {
      const { data, error } = await db
        .from("support_messages").select("*").eq("patient_id", patientId).order("created_at", { ascending: false }).limit(6);
      if (error) throw new Error(error.message);
      return data as Msg[];
    },
    refetchInterval: 8000,
  });
  const updates = (msgs.data ?? []).filter((m) => m.direction === "to_caregiver");
  if (!updates.length) return null;
  return (
    <Card icon={Bell} title={`${t("updates", lang)} (simulated notifications)`}>
      <ul className="space-y-2">
        {updates.slice(0, 3).map((m) => (
          <li key={m.id} className="rounded-xl bg-highlight-soft p-3 text-sm">
            {m.body}
            <span className="mt-1 block text-xs text-muted-foreground">{fmtDateTime(m.created_at)}</span>
          </li>
        ))}
      </ul>
    </Card>
  );
}

function SendSupport({ patientId, lang }: { patientId: string; lang: Lang }) {
  const qc = useQueryClient();
  const [kind, setKind] = useState<keyof typeof QUICK_MESSAGES>("encourage");
  const [body, setBody] = useState(QUICK_MESSAGES.encourage[lang]);
  const send = useMutation({
    mutationFn: async () => {
      const { error } = await db.rpc("send_support_message", { _pid: patientId, _kind: kind, _body: body });
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      toast.success("Sent (simulated in-app message)");
      void qc.invalidateQueries({ queryKey: ["support-messages", patientId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });
  return (
    <Card icon={Send} title={t("send", lang)}>
      <div className="mb-2 grid grid-cols-3 gap-2">
        {(Object.keys(QUICK_MESSAGES) as (keyof typeof QUICK_MESSAGES)[]).map((k) => (
          <Button
            key={k}
            type="button"
            variant={kind === k ? "default" : "outline"}
            className="h-11"
            onClick={() => {
              setKind(k);
              setBody(QUICK_MESSAGES[k][lang]);
            }}
          >
            {t(k, lang)}
          </Button>
        ))}
      </div>
      <Textarea value={body} onChange={(e) => setBody(e.target.value)} maxLength={280} rows={3} aria-label="Message" />
      <Button className="mt-2 h-11 w-full" onClick={() => send.mutate()} disabled={!body.trim() || send.isPending}>
        {send.isPending && <InlineSpinner />} Send
      </Button>
      <p className="mt-2 text-xs text-muted-foreground">Supportive messages only. Medicine changes are always the consultant's decision.</p>
    </Card>
  );
}
