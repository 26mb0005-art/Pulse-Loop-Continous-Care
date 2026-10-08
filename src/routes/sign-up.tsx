import { useEffect, useState, type FormEvent } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { MailCheck } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AuthLayout } from "@/components/shell/AuthLayout";
import { InlineSpinner } from "@/components/common/states";
import { supabase } from "@/integrations/supabase/client";
import { ROLE_HOME, useAuth } from "@/lib/auth";

export const Route = createFileRoute("/sign-up")({
  head: () => ({ meta: [{ title: "Create account · PULSE LOOP" }] }),
  component: SignUp,
});

function SignUp() {
  const { session, role, loading } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [sentTo, setSentTo] = useState<string | null>(null);

  useEffect(() => {
    if (loading || !session) return;
    void navigate({ to: role ? ROLE_HOME[role] : "/select-role", replace: true });
  }, [loading, session, role, navigate]);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (password.length < 8) {
      toast.error("Use at least 8 characters for your password");
      return;
    }
    setBusy(true);
    const { data, error } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: { emailRedirectTo: `${window.location.origin}/sign-in` },
    });
    setBusy(false);
    if (error) {
      toast.error("Couldn't create your account", { description: error.message });
      return;
    }
    // With email confirmation enabled there is no session yet.
    if (!data.session) setSentTo(email.trim());
  };

  if (sentTo) {
    return (
      <AuthLayout
        title="Check your inbox"
        description={`We sent a confirmation link to ${sentTo}.`}
      >
        <div className="flex flex-col items-center gap-4 py-2 text-center">
          <MailCheck className="size-10 text-primary" />
          <p className="text-sm text-muted-foreground">
            Confirm your email, then sign in to continue.
          </p>
          <Button asChild className="w-full">
            <Link to="/sign-in">Go to sign in</Link>
          </Button>
        </div>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout
      title="Create your account"
      description="You'll choose how you use PULSE LOOP on the next step."
      footer={
        <>
          Already have an account?{" "}
          <Link to="/sign-in" className="font-medium text-primary hover:underline">
            Sign in
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
            autoComplete="new-password"
            required
            minLength={8}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="h-11"
          />
          <p className="text-xs text-muted-foreground">At least 8 characters.</p>
        </div>
        <Button type="submit" className="h-11 w-full" disabled={busy}>
          {busy && <InlineSpinner />} Create account
        </Button>
      </form>
    </AuthLayout>
  );
}
