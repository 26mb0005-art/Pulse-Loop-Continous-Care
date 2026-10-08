-- 0001: demo support. Additive only: no existing table, policy or function is changed.

-- 1. Records bucket. 0000 created storage policies for bucket 'records' but never the bucket.
--    Idempotent so it is safe whether or not the bucket already exists. Private (not public):
--    access stays governed by the existing "records own read" / "records own write" policies.
insert into storage.buckets (id, name, public)
values ('records', 'records', false)
on conflict (id) do nothing;

-- 2. Demo patient linkage. Lets one designated auth account (signed up through the normal
--    Supabase Auth flow) become the synthetic demo patient. No password or session is created
--    here, no RLS policy changes, and only patients flagged is_demo can ever be linked.
create table public.demo_accounts (
  email text primary key,
  patient_id uuid not null unique references public.patients(id) on delete cascade
);
alter table public.demo_accounts enable row level security;
-- No grants or policies: only the security-definer function below reads this table.

insert into public.demo_accounts (email, patient_id)
values ('ramesh.demo@pulseloop.app', '44444444-0000-0000-0000-000000000001')
on conflict (email) do nothing;

create or replace function public.claim_demo_patient() returns boolean
language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  em text := lower(coalesce(auth.jwt() ->> 'email', ''));
  pid uuid;
begin
  if uid is null then raise exception 'Not signed in'; end if;
  select d.patient_id into pid
    from demo_accounts d join patients p on p.id = d.patient_id
    where lower(d.email) = em and p.is_demo and (p.user_id is null or p.user_id = uid);
  if pid is null then return false; end if;
  -- Never turn a professional account into a patient, and never give one user two patient records.
  if exists (select 1 from user_roles where user_id = uid and role <> 'patient') then return false; end if;
  if exists (select 1 from patients where user_id = uid and id <> pid) then return false; end if;
  insert into user_roles (user_id, role) values (uid, 'patient') on conflict do nothing;
  update patients set user_id = uid where id = pid and user_id is null;
  if found then
    perform _audit(pid, (select name from patients where id = pid), 'patient', 'Account', 'Demo account linked', 'linked');
  end if;
  return true;
end $$;

-- 3. Demo reset. Re-seeds the synthetic dataset relative to today so the demo journey can be
--    replayed. Only the linked owner of an is_demo patient can call it. Audit logs, deletion
--    requests and patient-uploaded records are kept.
create or replace function public.reset_demo_patient() returns void
language plpgsql security definer set search_path = public as $$
declare pid uuid; pname text;
begin
  select id, name into pid, pname from patients where user_id = auth.uid() and is_demo;
  if pid is null then raise exception 'Only a linked demo patient can reset demo data'; end if;
  delete from orders where patient_id = pid;
  delete from prescriptions where patient_id = pid;
  delete from health_signals where patient_id = pid;
  delete from kpis where patient_id = pid;
  delete from care_plans where patient_id = pid;
  delete from reports where patient_id = pid and file_path is null;
  delete from ai_insights where patient_id = pid;
  delete from wellness_status where patient_id = pid;
  delete from consents where patient_id = pid;
  update patients set pharmacy_id = '22222222-0000-0000-0000-000000000001' where id = pid;
  perform _seed_consents(pid, array['glucose','activity','sleep','meal_photos','prescription','medical_reports','billing','wellness']);
  perform _seed_patient_data(pid);
  perform _audit(pid, pname, 'patient', 'Demo data', 'Synthetic demo data reset', 'reset');
end $$;

revoke execute on function public.claim_demo_patient(), public.reset_demo_patient() from public, anon;
grant execute on function public.claim_demo_patient(), public.reset_demo_patient() to authenticated;
