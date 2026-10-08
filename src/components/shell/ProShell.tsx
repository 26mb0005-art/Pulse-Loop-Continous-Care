import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Logo } from "@/components/brand/Logo";
import { UserMenu } from "@/components/shell/UserMenu";
import { supabase } from "@/integrations/supabase/client";
import { ROLE_LABEL, useAuth, type AppRole } from "@/lib/auth";
import { cn } from "@/lib/utils";

type ProRole = Exclude<AppRole, "patient">;

/** The organisation the signed-in professional belongs to (via org_members). */
export function useMyOrg(role: ProRole) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["my-org", role, user?.id],
    enabled: !!user,
    staleTime: 10 * 60 * 1000,
    queryFn: async () => {
      const { data: m, error } = await supabase
        .from("org_members")
        .select("org_id")
        .eq("user_id", user!.id)
        .eq("org_type", role)
        .maybeSingle();
      if (error) throw new Error(error.message);
      if (!m) return null;
      if (role === "consultant") {
        const { data } = await supabase
          .from("consultants")
          .select("*")
          .eq("id", m.org_id)
          .maybeSingle();
        return data
          ? {
              id: data.id,
              name: data.name,
              detail: [data.specialty, data.hospital].filter(Boolean).join(" · "),
            }
          : null;
      }
      if (role === "pharmacy") {
        const { data } = await supabase
          .from("pharmacies")
          .select("*")
          .eq("id", m.org_id)
          .maybeSingle();
        return data ? { id: data.id, name: data.name, detail: data.city ?? "" } : null;
      }
      const { data } = await supabase.from("insurers").select("*").eq("id", m.org_id).maybeSingle();
      return data ? { id: data.id, name: data.name, detail: "Insurer" } : null;
    },
  });
}

const NAV: Record<ProRole, { to: string; label: string }[]> = {
  consultant: [{ to: "/consultant", label: "Patients" }],
  pharmacy: [{ to: "/pharmacy", label: "Order queue" }],
  insurer: [{ to: "/insurer", label: "Members" }],
};

const HOME = { consultant: "/consultant", pharmacy: "/pharmacy", insurer: "/insurer" } as const;

/** Desktop-first professional shell; collapses cleanly on tablet and phone. */
export function ProShell({ role, children }: { role: ProRole; children: ReactNode }) {
  const org = useMyOrg(role);
  const name = org.data?.name ?? ROLE_LABEL[role];
  return (
    <div className="min-h-screen bg-[oklch(0.975_0.006_150)]">
      <header className="sticky top-0 z-30 border-b bg-card/95 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-7xl items-center gap-4 px-4 sm:px-6">
          <Link to={HOME[role]} aria-label="PULSE LOOP home" className="shrink-0">
            <Logo size="sm" />
          </Link>
          <span className="hidden h-6 w-px bg-border sm:block" />
          <span className="hidden rounded-md bg-secondary px-2 py-1 text-xs font-semibold uppercase tracking-wider text-secondary-foreground sm:inline">
            {ROLE_LABEL[role]} workspace
          </span>
          <nav className="ml-2 flex items-center gap-1">
            {NAV[role].map((n) => (
              <Link
                key={n.to}
                to={n.to}
                className={cn(
                  "rounded-md px-3 py-2 text-sm font-medium text-muted-foreground hover:text-foreground",
                  "data-[status=active]:bg-muted data-[status=active]:text-foreground",
                )}
              >
                {n.label}
              </Link>
            ))}
          </nav>
          <div className="ml-auto flex items-center gap-3">
            <div className="hidden text-right md:block">
              <div className="text-sm font-medium leading-tight">{name}</div>
              {org.data?.detail && (
                <div className="text-xs text-muted-foreground">{org.data.detail}</div>
              )}
            </div>
            <UserMenu name={name} subtitle={org.data?.detail || ROLE_LABEL[role]} />
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-8">{children}</main>
    </div>
  );
}

export function ProPageHeader({
  title,
  description,
  action,
}: {
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        {description && (
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">{description}</p>
        )}
      </div>
      {action}
    </div>
  );
}
