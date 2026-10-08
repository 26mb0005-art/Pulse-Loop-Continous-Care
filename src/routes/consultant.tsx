import { createFileRoute, Outlet } from "@tanstack/react-router";
import { ProShell } from "@/components/shell/ProShell";
import { RequireRole } from "@/components/shell/RequireRole";

export const Route = createFileRoute("/consultant")({
  component: () => (
    <RequireRole role="consultant">
      <ProShell role="consultant">
        <Outlet />
      </ProShell>
    </RequireRole>
  ),
});
