# PULSE LOOP — demo runbook

All patient data in this prototype is synthetic. Nothing here bypasses authentication or RLS:
every account signs in through normal Supabase Auth, and every read and write goes through the
existing policies and RPCs.

## One-time setup

1. **Apply migration `drizzle/migrations/0001_demo_support.sql`** (additive only). It:
   - creates the private `records` storage bucket if it is missing (idempotent);
   - adds `public.demo_accounts` and `claim_demo_patient()`, which link one designated email to
     the synthetic patient "Ramesh Kumar" the first time that account signs in;
   - adds `reset_demo_patient()`, which only the linked owner of an `is_demo` patient can call,
     to re-seed the synthetic dataset relative to today.
2. **Create the four demo accounts** with the normal sign-up form (`/sign-up`):

   | Account | Email | Role step |
   | --- | --- | --- |
   | Patient (Ramesh) | `ramesh.demo@pulseloop.app` | none — linked automatically |
   | Consultant | any email you control | choose **Consultant** (joins Dr. Mehta) |
   | Pharmacy | any email you control | choose **Pharmacy** (joins MedConnect Pharmacy) |
   | Insurer | any email you control | choose **Insurer** (joins Apex Health) |

   If email confirmation is enabled in Lovable Cloud auth, the demo patient address must be able
   to receive mail. Either disable confirmation for the demo, or point the demo account at an
   inbox you own:
   `update public.demo_accounts set email = 'you+ramesh@example.com';` and change
   `DEMO_PATIENT_EMAIL` in `src/lib/product.ts` to match.
3. **Before each run:** sign in as Ramesh → account menu (top right) → **Reset demo data**. The
   seeded readings are relative to the day they were seeded, so the reset keeps "last 5 days"
   meaningful and clears previous orders.

Use two browser profiles (or one normal and one private window) to switch roles quickly.

## Judging flow

1. Sign in as Ramesh → **Home**: "What changed?" with glucose ↑, activity ↓, sleep ↓.
2. **Next best action**: one step ("Take a 15-minute walk after dinner today."), flagged for
   consultant review because KPIs have been off target for 5+ days.
3. **Care** tab: Dr. Mehta, plan, consultant-defined KPIs (target / current / trend / status).
4. **Pharmacy** tab (or "Order medicine" on Home): prescription → choose pharmacy → tick
   *Authorise sharing* → **Authorise & order refill**.
5. Switch to the pharmacy account → **Order queue** → open Ramesh's order →
   Confirm order → Start preparing → Mark dispatched → Mark delivered.
6. Back to Ramesh → **Pharmacy** (updates every 5 s) → **Confirm receipt**. Refill date moves on
   30 days. Delivery confirms fulfilment, not consumption.
7. Switch to the consultant → **Patients** → Ramesh: KPI deviation (off-target days), AI
   insight, consent-gated trends → write a note → **Save review** (or **Escalate**).
8. Back to Ramesh → **Privacy** → *Who accessed my data?* lists Dr. Mehta's and the pharmacy's
   views and actions.
9. **Withdraw** Glucose data. Re-open the consultant's patient view: the glucose chart shows
   "Patient withdrew consent. Data no longer accessible." (enforced by RLS), and no new glucose
   access is logged.

Optional: **Log a meal** from Home (demo roti/dal/paneer photo → Analyse), **Records** upload,
insurer view at `/insurer` ("Raw clinical data: Not accessible").
