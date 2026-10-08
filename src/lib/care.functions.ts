import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import {
  assessSafety,
  daysUntil,
  INSUFFICIENT,
  kpiCurrent,
  kpiState,
  windowAvg,
  type Kpi,
  type Signal,
} from "./health";

const InsightSchema = z.object({
  what_changed: z.string(),
  why_matters: z.string(),
  next_action: z.string(),
  confidence: z.string(),
});

export const generateInsight = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { patientId: string }) => input)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: patient } = await supabase.from("patients").select("*").eq("id", data.patientId).maybeSingle();
    if (!patient || patient.user_id !== userId) throw new Error("Not authorised");

    // Consent + purpose + relevance filter: only categories with active consent reach the AI.
    const { data: consents } = await supabase.from("consents").select("category,status").eq("patient_id", patient.id);
    const active = new Set((consents ?? []).filter((c) => c.status === "active").map((c) => c.category));
    const typeToConsent: Record<string, string> = { glucose: "glucose", steps: "activity", sleep: "sleep", meal: "meal_photos" };

    const since = new Date(Date.now() - 15 * 86400000).toISOString();
    const [{ data: rawSignals }, { data: kpiRows }, { data: rx }, { data: orders }] = await Promise.all([
      supabase.from("health_signals").select("signal_type,value,recorded_at,source,meta").eq("patient_id", patient.id).gte("recorded_at", since),
      supabase.from("kpis").select("*").eq("patient_id", patient.id),
      supabase.from("prescriptions").select("*").eq("patient_id", patient.id).order("prescribed_on", { ascending: false }).limit(1),
      supabase.from("orders").select("status,prescription_id").eq("patient_id", patient.id),
    ]);
    const signals = ((rawSignals ?? []) as Signal[]).filter((s) => active.has(typeToConsent[s.signal_type] ?? ""));
    const kpis = (kpiRows ?? []) as Kpi[];
    const inputsUsed = [...new Set(signals.map((s) => s.signal_type))];

    const safety = assessSafety(signals, kpis);
    const prescription = rx?.[0];
    const openOrder = (orders ?? []).some((o) => !["received", "cancelled"].includes(o.status));
    const refillDays = prescription ? daysUntil(prescription.refill_due) : null;

    const save = async (row: Record<string, unknown>) => {
      const { data: saved, error } = await supabase
        .from("ai_insights")
        .insert({ patient_id: patient.id, inputs_used: inputsUsed, safety_level: safety.level, ...row })
        .select()
        .single();
      if (error) throw new Error(error.message);
      return saved;
    };

    // 1. Safety-critical: block AI.
    if (safety.level === "red") {
      return save({
        what_changed: safety.reason,
        why_matters: "This requires professional review. The AI will not provide a recommendation.",
        next_action: INSUFFICIENT,
        action_kind: "escalate",
        human_review: true,
        confidence: "Insufficient",
        source: "rules",
      });
    }

    const stats = {
      glucose: { before: windowAvg(signals, "glucose", 14, 5), recent: windowAvg(signals, "glucose", 5, -1) },
      steps: { before: windowAvg(signals, "steps", 14, 5), recent: windowAvg(signals, "steps", 5, -1) },
      sleep: { before: windowAvg(signals, "sleep", 14, 5), recent: windowAvg(signals, "sleep", 5, -1) },
      highCarbMealsLast5: signals.filter((s) => s.signal_type === "meal" && Number(s.value) === 1 && +new Date(s.recorded_at) > Date.now() - 5 * 86400000).length,
    };
    const kpiSummary = kpis
      .filter((k) => k.status === "Active")
      .map((k) => {
        const cur = kpiCurrent(k, signals);
        return { name: k.name, target: `${k.direction === "max" ? "≤" : "≥"} ${k.target} ${k.unit ?? ""}`, current: cur, state: kpiState(k, cur) };
      });
    const deviating = kpiSummary.filter((k) => k.state === "attention" || k.state === "monitor");

    // 2. Treatment access issue takes priority.
    if (prescription && refillDays != null && refillDays <= 1 && !openOrder) {
      return save({
        what_changed: `Your prescribed medicine refill is due ${refillDays <= 0 ? "now" : "tomorrow"}.`,
        why_matters: "Staying on your consultant's plan without gaps helps keep your care on track.",
        next_action: "Order your prescribed refill from your chosen pharmacy.",
        action_kind: "refill",
        human_review: safety.level === "amber",
        confidence: "High",
        source: "rules",
      });
    }

    // 6. Nothing to do.
    if (!deviating.length) {
      return save({
        what_changed: "Your recent readings are within your care-plan targets.",
        why_matters: "Keeping steady routines is what's working.",
        next_action: "You're on track. No action needed today.",
        action_kind: "none",
        human_review: false,
        confidence: "High",
        source: "rules",
      });
    }

    const r = (n: number | null, d = 0) => (n == null ? "n/a" : n.toFixed(d));
    const fallback = {
      what_changed: `Your glucose readings have gradually increased over the last 5 days (avg ${r(stats.glucose.recent)} vs ${r(stats.glucose.before)} mg/dL before).`,
      why_matters: `During the same period, daily activity fell to about ${r(stats.steps.recent)} steps (target 6,000) and average sleep dropped to ${r(stats.sleep.recent, 1)} hours.`,
      next_action: "Take a 15-minute walk after dinner today.",
      confidence: "Moderate",
    };

    let out = fallback;
    let source = "fallback";
    try {
      const ai = await aiObject(
        InsightSchema,
        `You are the care-coaching layer of Pulse Loop, supporting an adult with Type 2 diabetes between consultant visits.
You are NOT a doctor. Never diagnose, never mention or change medication or dosage, never claim to cure or reverse disease.
Write in simple, warm, plain English (max 35 words per field). Give exactly ONE small, low-risk behavioural next action for TODAY that addresses the most important KPI deviation.
confidence must be one of: High, Moderate, Low. If data is too thin, use Low.`,
        [
          {
            role: "user",
            content: JSON.stringify({ averages_previous_9_days_vs_last_5_days: stats, consultant_kpis: kpiSummary }),
          },
        ],
      );
      if (!(await isUnsafe(ai.what_changed, ai.why_matters, ai.next_action)) && ai.next_action) {
        out = ai;
        source = "ai";
      }
    } catch (e) {
      console.error("AI insight failed, using safe fallback", e);
    }
    if (out.confidence === "Low") {
      return save({ ...out, next_action: INSUFFICIENT, action_kind: "escalate", human_review: true, source });
    }
    return save({ ...out, action_kind: "lifestyle", human_review: safety.level === "amber", source });
  });

// Late import keeps the module graph small for the client bundle.
async function aiObject<T>(...args: Parameters<typeof import("./ai.server").aiObject<T>>) {
  const m = await import("./ai.server");
  return m.aiObject<T>(...args);
}
// Single safety rule shared with ai.server.ts (the stricter banned-terms list).
async function isUnsafe(...t: string[]) {
  return (await import("./ai.server")).isUnsafe(...t);
}

const MealSchema = z.object({
  foods: z.array(z.string()),
  calories: z.number(),
  carbs_level: z.string(),
  protein_level: z.string(),
  care_plan_note: z.string(),
});

export const analyzeMeal = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { patientId: string; image: string }) => {
    if (!input.image?.startsWith("data:image/")) throw new Error("Invalid image");
    if (input.image.length > 6_000_000) throw new Error("Image too large");
    return input;
  })
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: patient } = await supabase.from("patients").select("id,user_id").eq("id", data.patientId).maybeSingle();
    if (!patient || patient.user_id !== userId) throw new Error("Not authorised");
    const { data: consent } = await supabase
      .from("consents").select("status").eq("patient_id", patient.id).eq("category", "meal_photos").maybeSingle();
    if (consent?.status !== "active") {
      return { blocked: true as const };
    }

    let result = {
      foods: ["Roti", "Dal", "Paneer", "Rice", "Salad"],
      calories: 650,
      carbs_level: "High",
      protein_level: "Moderate",
      care_plan_note:
        "This meal is relatively high in carbohydrates for your current care plan. A short post-meal walk may help you stay aligned with your activity target.",
    };
    let source = "fallback";
    try {
      const ai = await aiObject(
        MealSchema,
        `Estimate the contents of an Indian meal photo for a person with Type 2 diabetes following a consultant care plan (activity target 6,000 steps/day, balanced plate).
List detected foods (short names). calories: approximate integer for the whole plate. carbs_level and protein_level: one of Low, Moderate, High.
care_plan_note: max 40 words, plain English, non-judgemental, relate to the care plan, may suggest a short walk or balancing the plate. Never diagnose or mention medication.
If the image is not food, return an empty foods array.`,
        [{ role: "user", content: [{ type: "text", text: "Analyse this meal." }, { type: "image", image: data.image }] }],
      );
      if (ai.foods.length && !(await isUnsafe(ai.care_plan_note))) {
        result = { ...ai, calories: Math.round(ai.calories) };
        source = "ai";
      } else if (!ai.foods.length) {
        return { blocked: false as const, notFood: true as const };
      }
    } catch (e) {
      console.error("Meal analysis failed, using demo estimate", e);
    }
    const high = /high/i.test(result.carbs_level);
    await supabase.from("health_signals").insert({
      patient_id: patient.id,
      signal_type: "meal",
      value: high ? 1 : 0,
      unit: "high_carb",
      source: "Meal photo",
      meta: { name: result.foods.slice(0, 3).join(", "), carbs: result.carbs_level.toLowerCase(), calories: result.calories, ai: source },
    });
    return { blocked: false as const, notFood: false as const, result, source };
  });
