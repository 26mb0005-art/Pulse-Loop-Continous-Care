import { createFileRoute, Outlet } from "@tanstack/react-router";
import { ProShell } from "@/components/shell/ProShell";
import { RequireRole } from "@/components/shell/RequireRole";

export const Route = createFileRoute("/insurer")({
  component: () => (
    <RequireRole role="insurer">
      <ProShell role="insurer">
        <Outlet />
      </ProShell>
    </RequireRole>
  ),
});
