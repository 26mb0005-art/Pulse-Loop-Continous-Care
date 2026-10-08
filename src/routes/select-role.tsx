import { useState } from "react";
import { createFileRoute, Navigate, useNavigate } from "@tanstack/react-router";
import { Building2, Check, Pill, Stethoscope, UserRound } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { AuthLayout } from "@/components/shell/AuthLayout";
import { FullScreenLoader, InlineSpinner } from "@/components/common/states";
import { supabase } from "@/integrations/supabase/client";
import { ROLE_HOME, useAuth, type AppRole } from "@/lib/auth";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/select-role")({
  head: () => ({ meta: [{ title: "Choose your role · PULSE LOOP" }] }),
  component: SelectRole,
});

const OPTIONS: {
  role: AppRole;
  title: string;
  copy: string;
  org?: string;
  icon: typeof UserRound;
}[] = [
  {
    role: "patient",
    title: "Patient",
    copy: "Follow your care plan, order refills and control your data.",
    icon: UserRound,
  },
  {
    role: "consultant",
    title: "Consultant",
    copy: "Monitor patients against KPIs you define and review between visits.",
    org: "Joins Dr. Mehta · Hyderabad Diabetes Centre (demo)",
    icon: Stethoscope,
  },
  {
    role: "pharmacy",
    title: "Pharmacy",
    copy: "Fulfil authorised prescription orders.",
    org: "Joins MedConnect Pharmacy (demo)",
    icon: Pill,
  },
  {
    role: "insurer",
    title: "Insurer",
    copy: "See programme and payment status that members have consented to.",
    org: "Joins Apex Health (demo)",
    icon: Building2,
  },
];

function SelectRole() {
  const { loading, session, role, refreshRole } = useAuth();
  const navigate = useNavigate();
  const [choice, setChoice] = useState<AppRole>("patient");
  const [busy, setBusy] = useState(false);

  if (loading) return <FullScreenLoader />;
  if (!session) return <Navigate to="/sign-in" search={{ redirect: undefined }} replace />;
  if (role) return <Navigate to={ROLE_HOME[role]} replace />;

  const confirm = async () => {
    setBusy(true);
    const { error } = await supabase.rpc("claim_role", { _role: choice });
    if (error) {
      setBusy(false);
      toast.error("Couldn't set your role", { description: error.message });
      return;
    }
    const r = await refreshRole();
    setBusy(false);
    void navigate({ to: r === "patient" ? "/onboarding" : ROLE_HOME[r ?? choice], replace: true });
  };

  return (
    <AuthLayout
      title="How will you use PULSE LOOP?"
      description="Each account has one role. This can't be changed later in the prototype."
    >
      <div className="space-y-2.5" role="radiogroup" aria-label="Role">
        {OPTIONS.map((o) => {
          const active = choice === o.role;
          return (
            <button
              key={o.role}
              type="button"
              role="radio"
              aria-checked={active}
              onClick={() => setChoice(o.role)}
              className={cn(
                "flex w-full items-start gap-3 rounded-xl border p-4 text-left transition-colors",
                active ? "border-primary bg-secondary/70 ring-1 ring-primary" : "hover:bg-muted/60",
              )}
            >
              <span
                className={cn(
                  "flex size-9 shrink-0 items-center justify-center rounded-lg",
                  active ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground",
                )}
              >
                <o.icon className="size-4.5" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex items-center justify-between font-medium">
                  {o.title}
                  {active && <Check className="size-4 text-primary" />}
                </span>
                <span className="mt-0.5 block text-sm text-muted-foreground">{o.copy}</span>
                {o.org && <span className="mt-1 block text-xs text-muted-foreground">{o.org}</span>}
              </span>
            </button>
          );
        })}
      </div>
      <Button className="mt-5 h-11 w-full" onClick={confirm} disabled={busy}>
        {busy && <InlineSpinner />} Continue as {OPTIONS.find((o) => o.role === choice)?.title}
      </Button>
    </AuthLayout>
  );
}
