import type { ReactNode } from "react";
import { Navigate, useLocation } from "@tanstack/react-router";
import { FullScreenLoader } from "@/components/common/states";
import { ROLE_HOME, useAuth, type AppRole } from "@/lib/auth";

/**
 * Client-side route guard. UX only: the real enforcement is RLS + security-definer RPCs in the
 * database, so a user forcing their way to the wrong screen still can't read anything.
 */
export function RequireRole({ role, children }: { role: AppRole; children: ReactNode }) {
  const { loading, session, role: myRole } = useAuth();
  const location = useLocation();

  if (loading) return <FullScreenLoader />;
  if (!session) return <Navigate to="/sign-in" search={{ redirect: location.href }} replace />;
  if (!myRole) return <Navigate to="/select-role" replace />;
  if (myRole !== role) return <Navigate to={ROLE_HOME[myRole]} replace />;
  return <>{children}</>;
}

/** Only allow same-origin, path-only redirects. */
export function safeRedirect(value: unknown): string | undefined {
  return typeof value === "string" && value.startsWith("/") && !value.startsWith("//")
    ? value
    : undefined;
}
