import { useEffect, useState, type FormEvent } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Info } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AuthLayout } from "@/components/shell/AuthLayout";
import { safeRedirect } from "@/components/shell/RequireRole";
import { InlineSpinner } from "@/components/common/states";
import { supabase } from "@/integrations/supabase/client";
import { ROLE_HOME, useAuth } from "@/lib/auth";
import { DEMO_PATIENT_EMAIL } from "@/lib/product";

export const Route = createFileRoute("/sign-in")({
  validateSearch: (s: Record<string, unknown>): { redirect?: string | undefined } => ({
    redirect: safeRedirect(s["redirect"]),
  }),
  head: () => ({ meta: [{ title: "Sign in · PULSE LOOP" }] }),
  component: SignIn,
});

function SignIn() {
  const { redirect } = Route.useSearch();
  const { session, role, loading } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (loading || !session) return;
    if (!role) void navigate({ to: "/select-role", replace: true });
    else if (redirect) void navigate({ href: redirect, replace: true });
    else void navigate({ to: ROLE_HOME[role], replace: true });
  }, [loading, session, role, redirect, navigate]);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    setBusy(false);
    if (error) toast.error("Couldn't sign in", { description: error.message });
  };

  return (
    <AuthLayout
      title="Sign in"
      description="Welcome back to PULSE LOOP."
      footer={
        <>
          New here?{" "}
          <Link to="/sign-up" className="font-medium text-primary hover:underline">
            Create an account
          </Link>
        </>
      }
    >
      <form onSubmit={submit} className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="h-11"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="password">Password</Label>
          <Input
            id="password"
            type="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="h-11"
          />
        </div>
        <Button type="submit" className="h-11 w-full" disabled={busy || (!!session && loading)}>
          {busy && <InlineSpinner />} Sign in
        </Button>
      </form>

      <div className="mt-6 rounded-xl border bg-muted/50 p-4 text-sm">
        <div className="flex items-start gap-2.5">
          <Info className="mt-0.5 size-4 shrink-0 text-primary" />
          <div className="space-y-1.5 text-muted-foreground">
            <p className="font-medium text-foreground">Demo accounts</p>
            <p>
              Synthetic demo patient (Ramesh):{" "}
              <button
                type="button"
                className="font-medium text-primary hover:underline"
                onClick={() => setEmail(DEMO_PATIENT_EMAIL)}
              >
                {DEMO_PATIENT_EMAIL}
              </button>
            </p>
            <p>
              Consultant, pharmacy and insurer demo accounts: sign up with any email and choose the
              role.
            </p>
          </div>
        </div>
      </div>
    </AuthLayout>
  );
}
