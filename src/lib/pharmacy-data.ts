import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

// Pharmacy-side reads. RLS limits these to orders addressed to the signed-in pharmacy and only
// while the patient's prescription consent is active; patient fields are restricted to
// fulfilment details (name, city) by what this screen selects.
const ORDER_SELECT =
  "id,status,history,created_at,updated_at,patient_id,prescription_id,prescriptions(medicine,dosage,quantity,prescribed_by,prescribed_on,valid_until),patients(name,city,is_demo)";

export function usePharmacyQueue() {
  return useQuery({
    queryKey: ["pharmacy-queue"],
    refetchInterval: 5000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("orders")
        .select(ORDER_SELECT)
        .order("created_at", { ascending: false });
      if (error) throw new Error(error.message);
      return data;
    },
  });
}

export function usePharmacyOrder(id: string) {
  return useQuery({
    queryKey: ["pharmacy-order", id],
    refetchInterval: 5000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("orders")
        .select(ORDER_SELECT)
        .eq("id", id)
        .maybeSingle();
      if (error) throw new Error(error.message);
      return data;
    },
  });
}

/** The pharmacy-side transitions allowed by public.advance_order. */
export const NEXT_STEP: Record<string, { status: string; label: string } | undefined> = {
  authorised: { status: "confirmed", label: "Confirm order" },
  confirmed: { status: "preparing", label: "Start preparing" },
  preparing: { status: "dispatched", label: "Mark dispatched" },
  dispatched: { status: "delivered", label: "Mark delivered" },
};
