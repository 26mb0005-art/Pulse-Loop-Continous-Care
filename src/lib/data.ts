// Client-side data hooks. Every query runs in the browser with the signed-in user's Supabase
// session, so the existing RLS policies decide what each role can see. Nothing here bypasses them.
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import { useAuth } from "@/lib/auth";
import type { Kpi, Signal } from "@/lib/health";

export type Patient = Tables<"patients">;
export type Consent = Tables<"consents">;
export type Prescription = Tables<"prescriptions">;
export type Order = Tables<"orders">;
export type Report = Tables<"reports">;
export type Insight = Tables<"ai_insights">;
export type CarePlan = Tables<"care_plans">;
export type AuditLog = Tables<"audit_logs">;
export type Wellness = Tables<"wellness_status">;
export type OrderEvent = { status: string; at: string; by?: string };

export const qk = {
  myPatient: (uid?: string) => ["my-patient", uid] as const,
  signals: (pid?: string) => ["signals", pid] as const,
  kpis: (pid?: string) => ["kpis", pid] as const,
  carePlan: (pid?: string) => ["care-plan", pid] as const,
  prescriptions: (pid?: string) => ["prescriptions", pid] as const,
  orders: (pid?: string) => ["orders", pid] as const,
  reports: (pid?: string) => ["reports", pid] as const,
  insight: (pid?: string) => ["insight", pid] as const,
  consents: (pid?: string) => ["consents", pid] as const,
  audit: (pid?: string) => ["audit", pid] as const,
  deletion: (pid?: string) => ["deletion", pid] as const,
  wellness: (pid?: string) => ["wellness", pid] as const,
  patient: (pid?: string) => ["patient", pid] as const,
};

function must<T>(res: { data: T; error: { message: string } | null }): T {
  if (res.error) throw new Error(res.error.message);
  return res.data;
}

/** Like must(), for list queries: a successful list query never yields null. */
function rows<T>(res: { data: T[] | null; error: { message: string } | null }): T[] {
  return must(res) ?? [];
}

export function orderHistory(o: Pick<Order, "history">): OrderEvent[] {
  return Array.isArray(o.history) ? (o.history as unknown as OrderEvent[]) : [];
}

export const TERMINAL_ORDER = ["received", "cancelled"];

const PATIENT_SELECT =
  "*, consultants(name, specialty, hospital), insurers(name), pharmacies(name, city)";

/** The signed-in patient's own record (null when onboarding hasn't happened yet). */
export function useMyPatient() {
  const { user } = useAuth();
  return useQuery({
    queryKey: qk.myPatient(user?.id),
    enabled: !!user,
    queryFn: async () =>
      must(
        await supabase
          .from("patients")
          .select(PATIENT_SELECT)
          .eq("user_id", user!.id)
          .maybeSingle(),
      ),
  });
}

/** A patient record as visible to the current user (professional views). */
export function usePatient(pid?: string) {
  return useQuery({
    queryKey: qk.patient(pid),
    enabled: !!pid,
    queryFn: async () =>
      must(await supabase.from("patients").select(PATIENT_SELECT).eq("id", pid!).maybeSingle()),
  });
}

export function useSignals(pid?: string, days = 15) {
  return useQuery({
    queryKey: [...qk.signals(pid), days],
    enabled: !!pid,
    queryFn: async () => {
      const since = new Date(Date.now() - days * 86400000).toISOString();
      const data = rows(
        await supabase
          .from("health_signals")
          .select("signal_type,value,recorded_at,source,meta")
          .eq("patient_id", pid!)
          .gte("recorded_at", since)
          .order("recorded_at"),
      );
      return data as Signal[];
    },
  });
}

export function useKpis(pid?: string) {
  return useQuery({
    queryKey: qk.kpis(pid),
    enabled: !!pid,
    queryFn: async () =>
      rows(await supabase.from("kpis").select("*").eq("patient_id", pid!).order("name")) as Kpi[],
  });
}

export function useCarePlan(pid?: string) {
  return useQuery({
    queryKey: qk.carePlan(pid),
    enabled: !!pid,
    queryFn: async () =>
      must(await supabase.from("care_plans").select("*").eq("patient_id", pid!).maybeSingle()),
  });
}

export function usePrescriptions(pid?: string) {
  return useQuery({
    queryKey: qk.prescriptions(pid),
    enabled: !!pid,
    queryFn: async () =>
      rows(
        await supabase
          .from("prescriptions")
          .select("*")
          .eq("patient_id", pid!)
          .order("prescribed_on", { ascending: false }),
      ),
  });
}

/** Orders poll every few seconds while one is in flight, so cross-role status changes show up. */
export function useOrders(pid?: string) {
  return useQuery({
    queryKey: qk.orders(pid),
    enabled: !!pid,
    queryFn: async () =>
      rows(
        await supabase
          .from("orders")
          .select("*, pharmacies(name, city)")
          .eq("patient_id", pid!)
          .order("created_at", { ascending: false }),
      ),
    refetchInterval: (q) =>
      q.state.data?.some((o) => !TERMINAL_ORDER.includes(o.status)) ? 5000 : false,
  });
}

export function useReports(pid?: string) {
  return useQuery({
    queryKey: qk.reports(pid),
    enabled: !!pid,
    queryFn: async () =>
      rows(
        await supabase
          .from("reports")
          .select("*")
          .eq("patient_id", pid!)
          .order("report_date", { ascending: false }),
      ),
  });
}

export function useLatestInsight(pid?: string) {
  return useQuery({
    queryKey: qk.insight(pid),
    enabled: !!pid,
    queryFn: async () =>
      must(
        await supabase
          .from("ai_insights")
          .select("*")
          .eq("patient_id", pid!)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle(),
      ),
  });
}

export function useConsents(pid?: string) {
  return useQuery({
    queryKey: qk.consents(pid),
    enabled: !!pid,
    queryFn: async () => rows(await supabase.from("consents").select("*").eq("patient_id", pid!)),
  });
}

export function useAuditLogs(pid?: string) {
  return useQuery({
    queryKey: qk.audit(pid),
    enabled: !!pid,
    queryFn: async () =>
      rows(
        await supabase
          .from("audit_logs")
          .select("*")
          .eq("patient_id", pid!)
          .order("created_at", { ascending: false })
          .limit(100),
      ),
  });
}

export function useDeletionRequests(pid?: string) {
  return useQuery({
    queryKey: qk.deletion(pid),
    enabled: !!pid,
    queryFn: async () =>
      rows(
        await supabase
          .from("deletion_requests")
          .select("*")
          .eq("patient_id", pid!)
          .order("created_at", { ascending: false }),
      ),
  });
}

export function useWellness(pid?: string) {
  return useQuery({
    queryKey: qk.wellness(pid),
    enabled: !!pid,
    queryFn: async () =>
      must(await supabase.from("wellness_status").select("*").eq("patient_id", pid!).maybeSingle()),
  });
}

export function useDirectory() {
  return useQuery({
    queryKey: ["directory"],
    staleTime: 10 * 60 * 1000,
    queryFn: async () => {
      const [c, i, p] = await Promise.all([
        supabase.from("consultants").select("*").order("name"),
        supabase.from("insurers").select("*").order("name"),
        supabase.from("pharmacies").select("*").order("name"),
      ]);
      return { consultants: rows(c), insurers: rows(i), pharmacies: rows(p) };
    },
  });
}

/** Sort consent rows into the order the product presents them in. */
export const CONSENT_ORDER = [
  "glucose",
  "activity",
  "sleep",
  "meal_photos",
  "prescription",
  "medical_reports",
  "billing",
  "wellness",
];
export function sortConsents<T extends { category: string }>(rows: T[]) {
  return [...rows].sort(
    (a, b) => CONSENT_ORDER.indexOf(a.category) - CONSENT_ORDER.indexOf(b.category),
  );
}
