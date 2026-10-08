import { createContext, useContext } from "react";
import type { useMyPatient } from "@/lib/data";

export type MyPatient = NonNullable<ReturnType<typeof useMyPatient>["data"]>;

export const PatientContext = createContext<MyPatient | null>(null);

/** The signed-in patient's record. Only available inside the /app layout. */
export function usePatientCtx() {
  const p = useContext(PatientContext);
  if (!p) throw new Error("usePatientCtx must be used inside the patient layout");
  return p;
}
