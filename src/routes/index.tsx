import type { ReactNode } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import {
  ArrowRight,
  ArrowUpRight,
  ArrowDownRight,
  Footprints,
  Moon,
  Activity,
  ShieldCheck,
  Stethoscope,
  Pill,
  Building2,
  UserRound,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/brand/Logo";
import { ROLE_HOME, useAuth } from "@/lib/auth";
import { PRODUCT } from "@/lib/product";

export const Route = createFileRoute("/")({
  component: Landing,
});

function Landing() {
  const { session, role, loading } = useAuth();
  const dashboard = role ? ROLE_HOME[role] : "/select-role";

  return (
    <div className="min-h-screen bg-background">
      <header className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
        <Logo />
        <div className="flex items-center gap-2">
          {!loading && session ? (
            <Button asChild>
              <Link to={dashboard}>
                Open PULSE LOOP <ArrowRight />
              </Link>
            </Button>
          ) : (
            <>
              <Button asChild variant="ghost">
                <Link to="/sign-in">Sign in</Link>
              </Button>
              <Button asChild className="hidden sm:inline-flex">
                <Link to="/sign-up">Create account</Link>
              </Button>
            </>
          )}
        </div>
      </header>

      <main>
        <section className="mx-auto grid max-w-6xl items-center gap-12 px-4 pb-16 pt-10 sm:px-6 lg:grid-cols-[1.1fr_0.9fr] lg:pt-16">
          <div>
            <p className="mb-4 inline-flex items-center gap-2 rounded-full border bg-card px-3 py-1 text-xs font-medium text-muted-foreground">
              <span className="size-1.5 rounded-full bg-highlight" /> Continuous care for Type 2
              diabetes
            </p>
            <h1 className="text-4xl font-semibold leading-[1.1] tracking-tight sm:text-5xl">
              Know what changed.
              <br />
              <span className="text-primary">Know what to do next.</span>
            </h1>
            <p className="mt-5 max-w-xl text-lg text-muted-foreground">{PRODUCT.thesis}</p>
            <p className="mt-3 max-w-xl text-sm text-muted-foreground">
              Between consultant visits, motivation drops and data sits in silos. PULSE LOOP
              connects your consented signals to your consultant's care plan, and turns them into
              one clear next step.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Button asChild size="lg">
                <Link to={session ? dashboard : "/sign-up"}>
                  {session ? "Open PULSE LOOP" : "Get started"} <ArrowRight />
                </Link>
              </Button>
              {!session && (
                <Button asChild size="lg" variant="outline">
                  <Link to="/sign-in">Sign in</Link>
                </Button>
              )}
            </div>
          </div>
          <ProductPreview />
        </section>

        <section className="border-y bg-card">
          <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
              The care loop
            </h2>
            <ol className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
              {PRODUCT.loop.map((step, i) => (
                <li key={step} className="rounded-xl border bg-background p-4">
                  <span className="text-xs font-semibold text-highlight">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <p className="mt-1 font-medium">{step}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{LOOP_COPY[i]}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-4 py-14 sm:px-6">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {ROLES.map((r) => (
              <div key={r.title} className="rounded-xl border bg-card p-5">
                <r.icon className="size-5 text-primary" />
                <h3 className="mt-3 font-semibold">{r.title}</h3>
                <p className="mt-1 text-sm text-muted-foreground">{r.copy}</p>
              </div>
            ))}
          </div>
          <div className="mt-10 flex flex-col items-start gap-4 rounded-2xl border bg-secondary/60 p-6 sm:flex-row sm:items-center">
            <ShieldCheck className="size-8 shrink-0 text-primary" />
            <div>
              <p className="text-lg font-semibold">
                Your data follows your care plan, not every stakeholder.
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                Every data category has a purpose, a named recipient and a withdraw button. Every
                professional view is logged, and visible to the patient.
              </p>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t">
        <div className="mx-auto flex max-w-6xl flex-col gap-2 px-4 py-6 text-xs text-muted-foreground sm:flex-row sm:justify-between sm:px-6">
          <span>PULSE LOOP prototype · synthetic demo data only</span>
          <span>
            Not a medical device. Does not diagnose, prescribe or replace your consultant.
          </span>
        </div>
      </footer>
    </div>
  );
}

const LOOP_COPY = [
  "Consented glucose, activity, sleep and meals",
  "Spot the pattern that matters",
  "One low-risk next step",
  "Refills reach the pharmacy",
  "Track against consultant KPIs",
  "Consultant reviews and adjusts",
];

const ROLES = [
  {
    icon: UserRound,
    title: "Patients",
    copy: "See what changed, do one thing today, order refills and control who sees what.",
  },
  {
    icon: Stethoscope,
    title: "Consultants",
    copy: "Set KPIs, review deviations between visits and stay the clinical decision-maker.",
  },
  {
    icon: Pill,
    title: "Pharmacies",
    copy: "Fulfil authorised prescriptions without access to unrelated health data.",
  },
  {
    icon: Building2,
    title: "Insurers",
    copy: "Programme and payment status only. Raw clinical data is not accessible.",
  },
];

/** Static illustration of the patient Home screen (clearly labelled as an example). */
function ProductPreview() {
  return (
    <div className="mx-auto w-full max-w-sm">
      <div className="rounded-[2rem] border bg-card p-3 shadow-[0_1px_2px_rgba(0,0,0,0.04),0_12px_32px_-12px_rgba(16,60,45,0.18)]">
        <div className="rounded-[1.5rem] bg-background p-4">
          <p className="text-sm text-muted-foreground">Good morning, Ramesh</p>
          <div className="mt-3 rounded-xl border bg-card p-4">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              What changed?
            </p>
            <p className="mt-2 text-sm leading-snug">
              Your glucose trend has increased over the last 5 days while activity and sleep have
              decreased.
            </p>
            <div className="mt-3 flex flex-wrap gap-1.5 text-xs">
              <Chip icon={<Activity className="size-3.5" />} label="Glucose" dir="up" />
              <Chip icon={<Footprints className="size-3.5" />} label="Activity" dir="down" />
              <Chip icon={<Moon className="size-3.5" />} label="Sleep" dir="down" />
            </div>
          </div>
          <div className="mt-3 rounded-xl bg-primary p-4 text-primary-foreground">
            <p className="text-[11px] font-semibold uppercase tracking-wider opacity-80">
              Next best action
            </p>
            <p className="mt-1.5 font-medium">Take a 15-minute walk after dinner today.</p>
          </div>
          <div className="mt-3 flex items-center justify-between rounded-xl border border-highlight/30 bg-highlight-soft p-3 text-sm">
            <span>Refill due in 3 days</span>
            <span className="font-medium text-highlight-foreground">Order medicine</span>
          </div>
        </div>
      </div>
      <p className="mt-3 text-center text-xs text-muted-foreground">
        Example screen · synthetic data
      </p>
    </div>
  );
}

function Chip({ icon, label, dir }: { icon: ReactNode; label: string; dir: "up" | "down" }) {
  const Arrow = dir === "up" ? ArrowUpRight : ArrowDownRight;
  return (
    <span className="inline-flex items-center gap-1 rounded-full border bg-background px-2 py-0.5 text-muted-foreground">
      {icon}
      {label}
      <Arrow className="size-3.5 text-warning" />
    </span>
  );
}
