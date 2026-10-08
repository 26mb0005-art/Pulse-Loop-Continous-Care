import { createFileRoute, Outlet } from "@tanstack/react-router";
import { ProShell } from "@/components/shell/ProShell";
import { RequireRole } from "@/components/shell/RequireRole";

export const Route = createFileRoute("/pharmacy")({
  component: () => (
    <RequireRole role="pharmacy">
      <ProShell role="pharmacy">
        <Outlet />
      </ProShell>
    </RequireRole>
  ),
});
