import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { ClipboardList, FileText, Home, Pill, RotateCcw, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { Logo } from "@/components/brand/Logo";
import { DemoBadge } from "@/components/common/StatusPill";
import { DropdownMenuItem, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { UserMenu } from "@/components/shell/UserMenu";
import { usePatientCtx } from "@/components/patient/context";
import { supabase } from "@/integrations/supabase/client";
import { displayName } from "@/lib/format";

const NAV = [
  { to: "/app", label: "Home", icon: Home, exact: true },
  { to: "/app/care", label: "Care", icon: ClipboardList },
  { to: "/app/pharmacy", label: "Pharmacy", icon: Pill },
  { to: "/app/records", label: "Records", icon: FileText },
  { to: "/app/privacy", label: "Privacy", icon: ShieldCheck },
] as const;

/** Smartphone-first shell: single column, sticky header, bottom tab bar. */
export function PatientShell({ children }: { children: ReactNode }) {
  const patient = usePatientCtx();
  const queryClient = useQueryClient();

  const resetDemo = async () => {
    const id = toast.loading("Resetting synthetic demo data…");
    const { error } = await supabase.rpc("reset_demo_patient");
    if (error) {
      toast.error("Could not reset demo data", { id, description: error.message });
      return;
    }
    await queryClient.invalidateQueries();
    toast.success("Demo data reset to today", { id });
  };

  return (
    <div className="min-h-screen bg-[oklch(0.955_0.01_155)]">
      <div className="relative mx-auto flex min-h-screen max-w-md flex-col bg-background sm:border-x">
        <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b bg-background/90 px-4 backdrop-blur supports-[backdrop-filter]:bg-background/75">
          <Link to="/app" aria-label="PULSE LOOP home">
            <Logo size="sm" />
          </Link>
          <div className="flex items-center gap-2">
            {patient.is_demo && <DemoBadge />}
            <UserMenu name={displayName(patient.name)} subtitle={patient.condition}>
              {patient.is_demo && (
                <>
                  <DropdownMenuItem onSelect={resetDemo}>
                    <RotateCcw /> Reset demo data
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                </>
              )}
            </UserMenu>
          </div>
        </header>

        <main className="flex-1 px-4 pb-[calc(5.5rem+env(safe-area-inset-bottom))] pt-4">
          {children}
        </main>

        <nav
          className="fixed inset-x-0 bottom-0 z-30 mx-auto max-w-md border-t bg-background/95 pb-[env(safe-area-inset-bottom)] backdrop-blur sm:border-x"
          aria-label="Primary"
        >
          <ul className="grid grid-cols-5">
            {NAV.map(({ to, label, icon: Icon, ...rest }) => (
              <li key={to}>
                <Link
                  to={to}
                  activeOptions={{ exact: "exact" in rest }}
                  className="group flex h-16 flex-col items-center justify-center gap-1 text-[11px] font-medium text-muted-foreground transition-colors data-[status=active]:text-primary"
                >
                  <Icon
                    className="size-5 transition-transform group-data-[status=active]:scale-105"
                    strokeWidth={2}
                  />
                  {label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </div>
    </div>
  );
}

/** Consistent page heading for patient screens. */
export function PageHeader({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow?: string;
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="mb-4 flex items-start justify-between gap-3">
      <div className="min-w-0">
        {eyebrow && (
          <p className="text-xs font-semibold uppercase tracking-wider text-primary">{eyebrow}</p>
        )}
        <h1 className="text-[22px] font-semibold leading-tight tracking-tight">{title}</h1>
        {description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}
      </div>
      {action}
    </div>
  );
}
