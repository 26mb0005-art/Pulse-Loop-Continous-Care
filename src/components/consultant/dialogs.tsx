import { useState, type ReactNode } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { InlineSpinner } from "@/components/common/states";
import { supabase } from "@/integrations/supabase/client";
import { qk } from "@/lib/data";
import type { Kpi } from "@/lib/health";

const METRIC_DEFAULTS: Record<
  string,
  { unit: string; direction: string; source: string; name: string }
> = {
  glucose: {
    unit: "mg/dL",
    direction: "max",
    source: "Glucose monitor",
    name: "Fasting glucose trend",
  },
  steps: { unit: "steps/day", direction: "min", source: "Wearable", name: "Daily steps" },
  sleep: { unit: "hours", direction: "min", source: "Wearable", name: "Sleep" },
  meals: { unit: "days/7", direction: "min", source: "Meal photo", name: "Meal adherence" },
};

function Field({
  label,
  htmlFor,
  children,
}: {
  label: string;
  htmlFor: string;
  children: ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={htmlFor}>{label}</Label>
      {children}
    </div>
  );
}

/** Create or edit a consultant-defined KPI (RLS: kpi ins / kpi upd for the patient's consultant). */
export function KpiDialog({
  patientId,
  kpi,
  consultantName,
  trigger,
}: {
  patientId: string;
  kpi?: Kpi;
  consultantName: string;
  trigger: ReactNode;
}) {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [f, setF] = useState(() => ({
    name: kpi?.name ?? METRIC_DEFAULTS["steps"]!.name,
    metric: kpi?.metric ?? "steps",
    target: kpi ? String(kpi.target) : "6000",
    unit: kpi?.unit ?? METRIC_DEFAULTS["steps"]!.unit,
    direction: kpi?.direction ?? "min",
    frequency: kpi?.frequency ?? "Daily",
    source: kpi?.source ?? "Wearable",
    status: kpi?.status ?? "Active",
    notes: kpi?.notes ?? "",
  }));
  const set = (k: keyof typeof f) => (v: string) => setF((cur) => ({ ...cur, [k]: v }));

  const save = useMutation({
    mutationFn: async () => {
      const row = {
        name: f.name.trim(),
        metric: f.metric,
        target: Number(f.target),
        unit: f.unit.trim() || null,
        direction: f.direction,
        frequency: f.frequency,
        source: f.source,
        status: f.status,
        notes: f.notes.trim() || null,
        updated_by: consultantName,
        updated_at: new Date().toISOString(),
      };
      const res = kpi
        ? await supabase.from("kpis").update(row).eq("id", kpi.id)
        : await supabase.from("kpis").insert({ ...row, patient_id: patientId });
      if (res.error) throw new Error(res.error.message);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: qk.kpis(patientId) });
      toast.success(kpi ? "KPI updated" : "KPI added", {
        description: "The patient sees this in their care plan.",
      });
      setOpen(false);
    },
    onError: (e: Error) => toast.error("Couldn't save KPI", { description: e.message }),
  });

  const valid = f.name.trim().length > 1 && Number.isFinite(Number(f.target)) && f.target !== "";

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{kpi ? "Edit KPI" : "Add KPI"}</DialogTitle>
          <DialogDescription>
            KPIs define what PULSE LOOP monitors and coaches against for this patient.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Metric" htmlFor="k-metric">
            <Select
              value={f.metric}
              onValueChange={(v) => {
                const d = METRIC_DEFAULTS[v];
                setF((cur) => ({
                  ...cur,
                  metric: v,
                  ...(d && !kpi
                    ? { unit: d.unit, direction: d.direction, source: d.source, name: d.name }
                    : {}),
                }));
              }}
            >
              <SelectTrigger id="k-metric">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="glucose">Glucose</SelectItem>
                <SelectItem value="steps">Steps</SelectItem>
                <SelectItem value="sleep">Sleep</SelectItem>
                <SelectItem value="meals">Meals</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          <Field label="Name" htmlFor="k-name">
            <Input id="k-name" value={f.name} onChange={(e) => set("name")(e.target.value)} />
          </Field>
          <Field label="Direction" htmlFor="k-dir">
            <Select value={f.direction} onValueChange={set("direction")}>
              <SelectTrigger id="k-dir">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="min">At least (≥)</SelectItem>
                <SelectItem value="max">At most (≤)</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          <div className="grid grid-cols-[1fr_auto] gap-2">
            <Field label="Target" htmlFor="k-target">
              <Input
                id="k-target"
                inputMode="decimal"
                value={f.target}
                onChange={(e) => set("target")(e.target.value)}
              />
            </Field>
            <Field label="Unit" htmlFor="k-unit">
              <Input
                id="k-unit"
                className="w-28"
                value={f.unit}
                onChange={(e) => set("unit")(e.target.value)}
              />
            </Field>
          </div>
          <Field label="Frequency" htmlFor="k-freq">
            <Select value={f.frequency} onValueChange={set("frequency")}>
              <SelectTrigger id="k-freq">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Daily">Daily</SelectItem>
                <SelectItem value="Weekly">Weekly</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          <Field label="Status" htmlFor="k-status">
            <Select value={f.status} onValueChange={set("status")}>
              <SelectTrigger id="k-status">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Active">Active</SelectItem>
                <SelectItem value="Paused">Paused</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          <div className="sm:col-span-2">
            <Field label="Note for patient" htmlFor="k-notes">
              <Textarea
                id="k-notes"
                rows={2}
                value={f.notes}
                onChange={(e) => set("notes")(e.target.value)}
              />
            </Field>
          </div>
        </div>
        <DialogFooter>
          <Button onClick={() => save.mutate()} disabled={!valid || save.isPending}>
            {save.isPending && <InlineSpinner />} Save KPI
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** Issue a prescription (RLS: rx ins for the patient's consultant). */
export function PrescriptionDialog({
  patientId,
  consultantName,
  trigger,
}: {
  patientId: string;
  consultantName: string;
  trigger: ReactNode;
}) {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const today = new Date();
  const iso = (d: Date) => d.toISOString().slice(0, 10);
  const plus = (days: number) => iso(new Date(today.getTime() + days * 86400000));
  const [f, setF] = useState({
    medicine: "",
    dosage: "",
    quantity: "",
    refill_due: plus(30),
    valid_until: plus(180),
  });
  const set = (k: keyof typeof f) => (v: string) => setF((cur) => ({ ...cur, [k]: v }));

  const save = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("prescriptions").insert({
        patient_id: patientId,
        medicine: f.medicine.trim(),
        dosage: f.dosage.trim() || null,
        quantity: f.quantity.trim() || null,
        prescribed_on: iso(today),
        refill_due: f.refill_due || null,
        valid_until: f.valid_until || null,
        prescribed_by: consultantName,
      });
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: qk.prescriptions(patientId) });
      toast.success("Prescription issued");
      setOpen(false);
      setF((cur) => ({ ...cur, medicine: "", dosage: "", quantity: "" }));
    },
    onError: (e: Error) => toast.error("Couldn't issue prescription", { description: e.message }),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Issue prescription</DialogTitle>
          <DialogDescription>
            Clinical decision by the consultant. The patient can then authorise a pharmacy to fulfil
            it.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <Field label="Medicine" htmlFor="rx-med">
              <Input
                id="rx-med"
                value={f.medicine}
                onChange={(e) => set("medicine")(e.target.value)}
              />
            </Field>
          </div>
          <Field label="Dosage instructions" htmlFor="rx-dose">
            <Input id="rx-dose" value={f.dosage} onChange={(e) => set("dosage")(e.target.value)} />
          </Field>
          <Field label="Quantity" htmlFor="rx-qty">
            <Input
              id="rx-qty"
              value={f.quantity}
              onChange={(e) => set("quantity")(e.target.value)}
            />
          </Field>
          <Field label="Refill due" htmlFor="rx-refill">
            <Input
              id="rx-refill"
              type="date"
              value={f.refill_due}
              onChange={(e) => set("refill_due")(e.target.value)}
            />
          </Field>
          <Field label="Valid until" htmlFor="rx-valid">
            <Input
              id="rx-valid"
              type="date"
              value={f.valid_until}
              onChange={(e) => set("valid_until")(e.target.value)}
            />
          </Field>
        </div>
        <DialogFooter>
          <Button
            onClick={() => save.mutate()}
            disabled={f.medicine.trim().length < 2 || save.isPending}
          >
            {save.isPending && <InlineSpinner />} Issue prescription
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
