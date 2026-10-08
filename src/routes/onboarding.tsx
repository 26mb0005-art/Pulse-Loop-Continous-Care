import { useEffect, useState, type ReactNode } from "react";
import { createFileRoute, Navigate, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, ArrowRight, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Logo } from "@/components/brand/Logo";
import { ErrorState, FullScreenLoader, InlineSpinner } from "@/components/common/states";
import { RequireRole } from "@/components/shell/RequireRole";
import { supabase } from "@/integrations/supabase/client";
import { useDirectory, useMyPatient, qk } from "@/lib/data";
import { useAuth } from "@/lib/auth";
import { CONSENT_CATALOG } from "@/lib/product";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/onboarding")({
  head: () => ({ meta: [{ title: "Set up · PULSE LOOP" }] }),
  component: () => (
    <RequireRole role="patient">
      <Onboarding />
    </RequireRole>
  ),
});

const STEPS = ["About you", "Care team", "Your permissions"];

function Onboarding() {
  const me = useMyPatient();
  const dir = useDirectory();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({
    name: "",
    age: "",
    gender: "",
    city: "",
    consultant: "",
    insurer: "",
  });
  const [granted, setGranted] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(CONSENT_CATALOG.map((c) => [c.category, !c.optional])),
  );

  useEffect(() => {
    if (!dir.data) return;
    setForm((f) => ({
      ...f,
      consultant: f.consultant || dir.data.consultants[0]?.id || "",
      insurer: f.insurer || dir.data.insurers[0]?.id || "",
    }));
  }, [dir.data]);

  if (me.isLoading) return <FullScreenLoader />;
  if (me.data) return <Navigate to="/app" replace />;

  const set = (k: keyof typeof form) => (v: string) => setForm((f) => ({ ...f, [k]: v }));
  const ageNum = Number(form.age);
  const stepValid = [
    form.name.trim().length > 1 &&
      ageNum >= 18 &&
      ageNum <= 110 &&
      !!form.gender &&
      form.city.trim().length > 1,
    !!form.consultant && !!form.insurer,
    true,
  ][step];

  const finish = async () => {
    setBusy(true);
    const { error } = await supabase.rpc("onboard_patient", {
      _name: form.name.trim(),
      _age: ageNum,
      _gender: form.gender,
      _city: form.city.trim(),
      _condition: "Type 2 Diabetes",
      _consultant: form.consultant,
      _insurer: form.insurer,
      _granted: Object.entries(granted)
        .filter(([, v]) => v)
        .map(([k]) => k),
    });
    if (error) {
      setBusy(false);
      toast.error("Couldn't finish setup", { description: error.message });
      return;
    }
    await queryClient.invalidateQueries({ queryKey: qk.myPatient(user?.id) });
    toast.success("You're all set");
    void navigate({ to: "/app", replace: true });
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto flex min-h-screen max-w-md flex-col px-4 pb-8">
        <header className="flex h-14 items-center">
          <Logo size="sm" />
        </header>

        <div className="mt-2 flex gap-1.5" aria-hidden="true">
          {STEPS.map((s, i) => (
            <span
              key={s}
              className={cn("h-1 flex-1 rounded-full", i <= step ? "bg-primary" : "bg-muted")}
            />
          ))}
        </div>
        <p className="mt-3 text-xs font-semibold uppercase tracking-wider text-primary">
          Step {step + 1} of {STEPS.length}
        </p>
        <h1 className="mt-1 text-[22px] font-semibold tracking-tight">{STEPS[step]}</h1>

        <div className="mt-5 flex-1">
          {step === 0 && (
            <div className="space-y-4">
              <Field label="Full name" id="name">
                <Input
                  id="name"
                  value={form.name}
                  onChange={(e) => set("name")(e.target.value)}
                  autoComplete="name"
                  className="h-11"
                />
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Age" id="age">
                  <Input
                    id="age"
                    inputMode="numeric"
                    value={form.age}
                    onChange={(e) => set("age")(e.target.value.replace(/\D/g, ""))}
                    className="h-11"
                  />
                </Field>
                <Field label="Gender" id="gender">
                  <Select value={form.gender} onValueChange={set("gender")}>
                    <SelectTrigger id="gender" className="h-11">
                      <SelectValue placeholder="Select" />
                    </SelectTrigger>
                    <SelectContent>
                      {["Female", "Male", "Other", "Prefer not to say"].map((g) => (
                        <SelectItem key={g} value={g}>
                          {g}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
              </div>
              <Field label="City" id="city">
                <Input
                  id="city"
                  value={form.city}
                  onChange={(e) => set("city")(e.target.value)}
                  autoComplete="address-level2"
                  className="h-11"
                />
              </Field>
              <div className="rounded-xl border bg-muted/50 p-3 text-sm">
                <span className="text-muted-foreground">Programme:</span>{" "}
                <span className="font-medium">Type 2 Diabetes continuous care</span>
              </div>
            </div>
          )}

          {step === 1 &&
            (dir.error ? (
              <ErrorState error={dir.error} onRetry={() => dir.refetch()} />
            ) : (
              <div className="space-y-4">
                <Field
                  label="Your consultant"
                  id="consultant"
                  hint="Your consultant defines your care plan and KPIs."
                >
                  <Select value={form.consultant} onValueChange={set("consultant")}>
                    <SelectTrigger id="consultant" className="h-11">
                      <SelectValue placeholder={dir.isLoading ? "Loading…" : "Select"} />
                    </SelectTrigger>
                    <SelectContent>
                      {dir.data?.consultants.map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.name} · {c.specialty}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
                <Field
                  label="Your insurer"
                  id="insurer"
                  hint="Insurers only see what you allow on the next step."
                >
                  <Select value={form.insurer} onValueChange={set("insurer")}>
                    <SelectTrigger id="insurer" className="h-11">
                      <SelectValue placeholder={dir.isLoading ? "Loading…" : "Select"} />
                    </SelectTrigger>
                    <SelectContent>
                      {dir.data?.insurers.map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
              </div>
            ))}

          {step === 2 && (
            <div>
              <div className="mb-4 flex items-start gap-2.5 rounded-xl bg-secondary/70 p-3 text-sm">
                <ShieldCheck className="mt-0.5 size-4 shrink-0 text-primary" />
                <p>
                  Your data follows your care plan, not every stakeholder. You can change any of
                  these later in the Privacy Centre.
                </p>
              </div>
              <ul className="divide-y rounded-xl border bg-card">
                {CONSENT_CATALOG.map((c) => (
                  <li key={c.category} className="flex items-center gap-3 p-3.5">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium">
                        {c.label}
                        {!c.optional && (
                          <span className="ml-1.5 text-xs font-normal text-muted-foreground">
                            · Recommended for care
                          </span>
                        )}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {c.recipient} · {c.purpose}
                      </p>
                    </div>
                    <Switch
                      checked={!!granted[c.category]}
                      onCheckedChange={(v) => setGranted((g) => ({ ...g, [c.category]: v }))}
                      aria-label={`Share ${c.label}`}
                    />
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        <div className="sticky bottom-0 mt-6 flex gap-3 bg-background py-3">
          {step > 0 && (
            <Button
              variant="outline"
              className="h-11"
              onClick={() => setStep((s) => s - 1)}
              disabled={busy}
            >
              <ArrowLeft /> Back
            </Button>
          )}
          {step < STEPS.length - 1 ? (
            <Button
              className="h-11 flex-1"
              onClick={() => setStep((s) => s + 1)}
              disabled={!stepValid}
            >
              Continue <ArrowRight />
            </Button>
          ) : (
            <Button className="h-11 flex-1" onClick={finish} disabled={busy}>
              {busy && <InlineSpinner />} Confirm and start
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

function Field({
  label,
  id,
  hint,
  children,
}: {
  label: string;
  id: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      {children}
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}
