import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type { Session, User } from "@supabase/supabase-js";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Enums } from "@/integrations/supabase/types";

export type AppRole = Enums<"app_role">;

export const ROLE_HOME: Record<AppRole, "/app" | "/consultant" | "/pharmacy" | "/insurer" | "/family"> = {
  patient: "/app",
  consultant: "/consultant",
  pharmacy: "/pharmacy",
  insurer: "/insurer",
  caregiver: "/family",
};

export const ROLE_LABEL: Record<AppRole, string> = {
  patient: "Patient",
  consultant: "Consultant",
  pharmacy: "Pharmacy",
  insurer: "Insurer",
  caregiver: "Family / Caregiver",
};

type AuthState = {
  /** True until the browser session and role have been resolved. Always true during SSR. */
  loading: boolean;
  session: Session | null;
  user: User | null;
  role: AppRole | null;
  refreshRole: () => Promise<AppRole | null>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthState | null>(null);

async function fetchRole(userId: string): Promise<AppRole | null> {
  const { data, error } = await supabase.from("user_roles").select("role").eq("user_id", userId);
  if (error) throw error;
  return (data?.[0]?.role as AppRole | undefined) ?? null;
}

/**
 * Users without a role may be the designated demo patient account. The backend decides
 * (claim_demo_patient checks the signed-in email against demo_accounts); for everyone else
 * it is a no-op that returns false. Failures are ignored so the normal role flow still works.
 */
async function tryClaimDemoPatient(): Promise<boolean> {
  try {
    const { data, error } = await supabase.rpc("claim_demo_patient");
    return !error && data === true;
  } catch {
    return false;
  }
}

async function resolveRole(userId: string): Promise<AppRole | null> {
  const role = await fetchRole(userId);
  if (role) return role;
  if (await tryClaimDemoPatient()) return fetchRole(userId);
  return null;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const [loading, setLoading] = useState(true);
  const [session, setSession] = useState<Session | null>(null);
  const [role, setRole] = useState<AppRole | null>(null);
  const resolvedFor = useRef<string | null>(null);

  useEffect(() => {
    let active = true;

    const apply = async (next: Session | null) => {
      if (!active) return;
      setSession(next);
      resolvedFor.current = next?.user.id ?? null;
      if (!next) {
        setRole(null);
        setLoading(false);
        return;
      }
      try {
        const r = await resolveRole(next.user.id);
        if (active) setRole(r);
      } catch (e) {
        console.error("Could not load role", e);
        if (active) setRole(null);
      } finally {
        if (active) setLoading(false);
      }
    };

    supabase.auth.getSession().then(({ data }) => apply(data.session));

    const { data: sub } = supabase.auth.onAuthStateChange((event, next) => {
      if (event === "SIGNED_OUT") {
        queryClient.clear();
        void apply(null);
      } else if (event === "SIGNED_IN" && next && next.user.id !== resolvedFor.current) {
        // A different user signed in. Defer: Supabase advises against awaiting client calls here.
        setLoading(true);
        setTimeout(() => void apply(next), 0);
      } else if (next) {
        // Token refresh / same-user re-emit: keep the role, just update the session.
        setSession(next);
      }
    });

    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, [queryClient]);

  const refreshRole = useCallback(async () => {
    if (!session) return null;
    const r = await resolveRole(session.user.id);
    setRole(r);
    return r;
  }, [session]);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
  }, []);

  const value = useMemo<AuthState>(
    () => ({ loading, session, user: session?.user ?? null, role, refreshRole, signOut }),
    [loading, session, role, refreshRole, signOut],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
}
