import { createFileRoute, Navigate, Outlet } from "@tanstack/react-router";
import { ErrorState, FullScreenLoader } from "@/components/common/states";
import { PatientShell } from "@/components/shell/PatientShell";
import { RequireRole } from "@/components/shell/RequireRole";
import { PatientContext } from "@/components/patient/context";
import { useMyPatient } from "@/lib/data";

export const Route = createFileRoute("/app")({
  component: () => (
    <RequireRole role="patient">
      <PatientGate />
    </RequireRole>
  ),
});

/** Loads the signed-in patient's record client-side; sends new patients to onboarding. */
function PatientGate() {
  const me = useMyPatient();
  if (me.isLoading) return <FullScreenLoader />;
  if (me.error)
    return (
      <div className="mx-auto max-w-md p-4 pt-16">
        <ErrorState error={me.error} onRetry={() => me.refetch()} />
      </div>
    );
  if (!me.data) return <Navigate to="/onboarding" replace />;
  return (
    <PatientContext.Provider value={me.data}>
      <PatientShell>
        <Outlet />
      </PatientShell>
    </PatientContext.Provider>
  );
}
