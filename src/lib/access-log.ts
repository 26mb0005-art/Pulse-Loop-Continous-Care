import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

/**
 * Records that a professional viewed a category of a patient's data, via the existing
 * public.log_access RPC (the backend resolves the actor and de-duplicates within 10 minutes).
 * Call it only for categories that were actually returned and shown.
 */
export function useLogAccess(
  patientId: string | undefined,
  entries: { category: string; purpose: string }[],
) {
  const key = entries.map((e) => `${e.category}|${e.purpose}`).join(";");
  useEffect(() => {
    if (!patientId || !entries.length) return;
    for (const e of entries) {
      void supabase
        .rpc("log_access", { _pid: patientId, _category: e.category, _purpose: e.purpose })
        .then(({ error }) => {
          if (error) console.error("log_access failed", error);
        });
    }
    // `key` captures the entries' content; the array identity changes every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [patientId, key]);
}
