// Product copy and catalogues shared by the UI. Backend values (categories, statuses) are mirrored
// here only for presentation; the database remains the source of truth.

export const PRODUCT = {
  name: "PULSE LOOP",
  tagline: "Know what changed. Know what to do next.",
  thesis: "Turn fragmented health signals into continuous, coordinated care.",
  loop: ["Sense", "Understand", "Act", "Fulfil", "Measure", "Adapt"],
};

/**
 * Designated demo patient account (synthetic patient "Ramesh Kumar"). Must match the email in
 * drizzle/migrations/0001_demo_support.sql (table public.demo_accounts). Sign up with this email
 * through the normal sign-up form; the backend links it to the demo patient on first sign-in.
 */
export const DEMO_PATIENT_EMAIL = "ramesh.demo@pulseloop.app";

/** Mirrors the categories seeded by public._seed_consents. */
export const CONSENT_CATALOG: {
  category: string;
  label: string;
  purpose: string;
  recipient: string;
  optional: boolean;
  effect: string;
}[] = [
  {
    category: "glucose",
    label: "Glucose data",
    purpose: "KPI monitoring",
    recipient: "Your consultant",
    optional: false,
    effect: "Your consultant will no longer see your glucose readings.",
  },
  {
    category: "activity",
    label: "Activity data",
    purpose: "Care-plan monitoring",
    recipient: "Your consultant",
    optional: false,
    effect: "Your consultant will no longer see your step counts.",
  },
  {
    category: "sleep",
    label: "Sleep data",
    purpose: "Care-plan monitoring",
    recipient: "Your consultant",
    optional: true,
    effect: "Your consultant will no longer see your sleep data.",
  },
  {
    category: "meal_photos",
    label: "Meal photos",
    purpose: "AI nutrition analysis",
    recipient: "AI engine",
    optional: true,
    effect: "Meal photos can no longer be analysed.",
  },
  {
    category: "prescription",
    label: "Prescription",
    purpose: "Medicine fulfilment",
    recipient: "Selected pharmacy",
    optional: false,
    effect: "Your pharmacy will lose access to your prescription and any open order.",
  },
  {
    category: "medical_reports",
    label: "Medical reports",
    purpose: "Care continuity",
    recipient: "Your consultant",
    optional: true,
    effect: "Your consultant will no longer see your reports.",
  },
  {
    category: "billing",
    label: "Billing data",
    purpose: "Consultation payment",
    recipient: "Your insurer",
    optional: false,
    effect: "Your insurer will no longer see consultation bills.",
  },
  {
    category: "wellness",
    label: "Wellness status",
    purpose: "Preventive programme",
    recipient: "Your insurer",
    optional: true,
    effect: "Your insurer will no longer see your programme status.",
  },
];

export const consentMeta = (category: string) =>
  CONSENT_CATALOG.find((c) => c.category === category);

export const RECORD_CATEGORIES: {
  key: string;
  label: string;
  plural: string;
  sharedVia?: string;
}[] = [
  {
    key: "prescription",
    label: "Prescription",
    plural: "Prescriptions",
    sharedVia: "medical_reports",
  },
  {
    key: "medical",
    label: "Medical report",
    plural: "Medical reports",
    sharedVia: "medical_reports",
  },
  { key: "lab", label: "Lab report", plural: "Lab reports", sharedVia: "medical_reports" },
  {
    key: "consultation",
    label: "Consultation record",
    plural: "Consultation records",
    sharedVia: "medical_reports",
  },
  { key: "bill", label: "Bill", plural: "Bills", sharedVia: "billing" },
];

export const REVIEW_STATUS: Record<
  string,
  { label: string; tone: "success" | "warning" | "danger" }
> = {
  on_track: { label: "On track", tone: "success" },
  needs_review: { label: "Needs review", tone: "warning" },
  escalated: { label: "Escalated", tone: "danger" },
};

export const AI_LIMITS =
  "PULSE LOOP's AI spots patterns in the data you've consented to and suggests one low-risk next step. It does not diagnose, prescribe or change medication. Your consultant makes clinical decisions.";
