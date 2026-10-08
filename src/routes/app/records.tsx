import { useRef, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Eye, EyeOff, FileText, Paperclip, Receipt, Upload } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { CardSkeleton, EmptyState, ErrorState, InlineSpinner } from "@/components/common/states";
import { StatusPill } from "@/components/common/StatusPill";
import { PageHeader } from "@/components/shell/PatientShell";
import { usePatientCtx } from "@/components/patient/context";
import { supabase } from "@/integrations/supabase/client";
import { qk, useConsents, useReports, type Report } from "@/lib/data";
import { RECORD_CATEGORIES } from "@/lib/product";
import { fmtDate, fmtMoney } from "@/lib/format";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/app/records")({
  head: () => ({ meta: [{ title: "Records · PULSE LOOP" }] }),
  component: Records,
});

function Records() {
  const patient = usePatientCtx();
  const reports = useReports(patient.id);
  const consents = useConsents(patient.id);
  const [filter, setFilter] = useState<string>("all");

  const shared = (consentKey?: string) =>
    consents.data?.find((c) => c.category === consentKey)?.status === "active";

  return (
    <div>
      <PageHeader
        title="Records"
        description="Your prescriptions, reports and bills in one place."
        action={<UploadDialog />}
      />

      <div className="-mx-4 mb-4 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none]">
        {[{ key: "all", plural: "All" }, ...RECORD_CATEGORIES].map((c) => (
          <button
            key={c.key}
            type="button"
            onClick={() => setFilter(c.key)}
            className={cn(
              "shrink-0 rounded-full border px-3 py-1.5 text-sm transition-colors",
              filter === c.key
                ? "border-primary bg-primary text-primary-foreground"
                : "bg-card text-muted-foreground hover:text-foreground",
            )}
          >
            {c.plural}
          </button>
        ))}
      </div>

      {reports.isLoading ? (
        <div className="space-y-2">
          <CardSkeleton lines={2} />
          <CardSkeleton lines={2} />
        </div>
      ) : reports.error ? (
        <ErrorState error={reports.error} onRetry={() => reports.refetch()} />
      ) : (
        <div className="space-y-6">
          {RECORD_CATEGORIES.filter((c) => filter === "all" || filter === c.key).map((c) => {
            const rows = (reports.data ?? []).filter((r) => r.category === c.key);
            const visible = shared(c.sharedVia);
            const who =
              c.key === "bill"
                ? (patient.insurers?.name ?? "your insurer")
                : (patient.consultants?.name ?? "your consultant");
            return (
              <section key={c.key}>
                <div className="mb-2 flex items-center justify-between gap-2">
                  <h2 className="text-sm font-semibold">{c.plural}</h2>
                  <span
                    className={cn(
                      "inline-flex items-center gap-1 text-[11px]",
                      visible ? "text-muted-foreground" : "text-danger",
                    )}
                  >
                    {visible ? <Eye className="size-3" /> : <EyeOff className="size-3" />}
                    {visible ? `Visible to ${who}` : "Only you"}
                  </span>
                </div>
                {rows.length ? (
                  <ul className="divide-y rounded-2xl border bg-card">
                    {rows.map((r) => (
                      <RecordRow key={r.id} r={r} />
                    ))}
                  </ul>
                ) : (
                  <p className="rounded-2xl border border-dashed px-4 py-5 text-center text-sm text-muted-foreground">
                    No {c.plural.toLowerCase()} yet
                  </p>
                )}
              </section>
            );
          })}
          {filter === "all" && !reports.data?.length && (
            <EmptyState
              title="No records yet"
              description="Upload a report to keep it with your care plan."
            />
          )}
        </div>
      )}
    </div>
  );
}

function RecordRow({ r }: { r: Report }) {
  const [opening, setOpening] = useState(false);
  const open = async () => {
    if (!r.file_path) return;
    setOpening(true);
    const { data, error } = await supabase.storage.from("records").createSignedUrl(r.file_path, 60);
    setOpening(false);
    if (error || !data) toast.error("Couldn't open the file", { description: error?.message });
    else window.open(data.signedUrl, "_blank", "noopener");
  };
  const Icon = r.category === "bill" ? Receipt : FileText;
  return (
    <li className="flex items-start gap-3 px-4 py-3">
      <span className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
        <Icon className="size-4" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium leading-snug">{r.title}</p>
        <p className="mt-0.5 text-xs text-muted-foreground">
          {fmtDate(r.report_date)}
          {r.notes ? ` · ${r.notes}` : ""}
        </p>
        {r.category === "bill" && (
          <div className="mt-1.5 flex flex-wrap items-center gap-2 text-xs">
            <span className="font-medium">{fmtMoney(r.amount)}</span>
            {r.payment_status && (
              <StatusPill tone={/settled|paid/i.test(r.payment_status) ? "success" : "warning"}>
                {r.payment_status}
              </StatusPill>
            )}
          </div>
        )}
      </div>
      {r.file_path && (
        <Button
          size="sm"
          variant="ghost"
          onClick={open}
          disabled={opening}
          aria-label={`Open ${r.title}`}
        >
          {opening ? <InlineSpinner /> : <Paperclip />} Open
        </Button>
      )}
    </li>
  );
}

const MAX_BYTES = 10 * 1024 * 1024;

function UploadDialog() {
  const patient = usePatientCtx();
  const queryClient = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [category, setCategory] = useState("lab");
  const [title, setTitle] = useState("");
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [file, setFile] = useState<File | null>(null);

  const upload = useMutation({
    mutationFn: async () => {
      if (!file) throw new Error("Choose a file");
      const safe = file.name.replace(/[^\w.-]+/g, "_").slice(-80);
      // Path must start with the patient id: the existing storage policies check the first folder.
      const path = `${patient.id}/${crypto.randomUUID()}-${safe}`;
      const up = await supabase.storage
        .from("records")
        .upload(path, file, { contentType: file.type, upsert: false });
      if (up.error) {
        throw new Error(
          /bucket not found/i.test(up.error.message)
            ? "Record storage isn't set up yet (the 'records' bucket is missing)."
            : up.error.message,
        );
      }
      const { error } = await supabase.from("reports").insert({
        patient_id: patient.id,
        category,
        title: title.trim() || file.name,
        report_date: date,
        file_path: path,
        notes: "Uploaded by you",
      });
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: qk.reports(patient.id) });
      toast.success("Record uploaded");
      setOpen(false);
      setTitle("");
      setFile(null);
    },
    onError: (e: Error) => toast.error("Upload failed", { description: e.message }),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm">
          <Upload /> Upload
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-[calc(100%-2rem)] sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Upload a record</DialogTitle>
          <DialogDescription>
            PDF or image, up to 10 MB. Stored privately in your records.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="cat">Type</Label>
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger id="cat">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {RECORD_CATEGORIES.map((c) => (
                  <SelectItem key={c.key} value={c.key}>
                    {c.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="title">Title</Label>
            <Input
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. HbA1c report"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="date">Date</Label>
            <Input id="date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="file">File</Label>
            <input
              ref={fileRef}
              id="file"
              type="file"
              accept="application/pdf,image/*"
              className="block w-full text-sm file:mr-3 file:rounded-md file:border-0 file:bg-secondary file:px-3 file:py-2 file:text-sm file:font-medium file:text-secondary-foreground"
              onChange={(e) => {
                const f = e.target.files?.[0] ?? null;
                if (f && f.size > MAX_BYTES) {
                  toast.error("File is larger than 10 MB");
                  e.target.value = "";
                  return;
                }
                setFile(f);
              }}
            />
          </div>
        </div>
        <DialogFooter>
          <Button
            onClick={() => upload.mutate()}
            disabled={!file || upload.isPending}
            className="w-full sm:w-auto"
          >
            {upload.isPending && <InlineSpinner />} Upload
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
