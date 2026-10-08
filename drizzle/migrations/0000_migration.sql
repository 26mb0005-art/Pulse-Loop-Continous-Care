
create type public.app_role as enum ('patient','consultant','pharmacy','insurer');

create table public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  role public.app_role not null,
  unique (user_id, role)
);
create table public.consultants (id uuid primary key, name text not null, specialty text, hospital text);
create table public.pharmacies (id uuid primary key, name text not null, city text);
create table public.insurers (id uuid primary key, name text not null);
create table public.org_members (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  org_type public.app_role not null,
  org_id uuid not null,
  unique (user_id, org_type)
);
create table public.patients (
  id uuid primary key default gen_random_uuid(),
  user_id uuid unique,
  name text not null, age int, gender text, city text,
  condition text not null default 'Type 2 Diabetes',
  consultant_id uuid references public.consultants(id),
  insurer_id uuid references public.insurers(id),
  pharmacy_id uuid references public.pharmacies(id),
  is_demo boolean not null default false,
  created_at timestamptz not null default now()
);
create table public.consents (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references public.patients(id) on delete cascade,
  category text not null, data_label text not null, purpose text not null,
  recipient_type text not null, recipient_name text not null,
  status text not null default 'not_granted', optional boolean not null default false,
  retention text, granted_at timestamptz, withdrawn_at timestamptz,
  unique (patient_id, category)
);
create table public.health_signals (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references public.patients(id) on delete cascade,
  signal_type text not null, value numeric, unit text, source text not null,
  recorded_at timestamptz not null default now(), meta jsonb not null default '{}'::jsonb
);
create index on public.health_signals(patient_id, signal_type, recorded_at);
create table public.kpis (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references public.patients(id) on delete cascade,
  name text not null, metric text not null, target numeric not null, unit text,
  direction text not null default 'min', frequency text not null default 'Daily',
  source text not null default 'Wearable', status text not null default 'Active',
  notes text, updated_at timestamptz not null default now(), updated_by text
);
create table public.care_plans (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null unique references public.patients(id) on delete cascade,
  review_status text not null default 'on_track', plan_actions text,
  consultant_notes text, flagged_followup boolean not null default false,
  last_reviewed_at timestamptz, updated_at timestamptz not null default now()
);
create table public.prescriptions (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references public.patients(id) on delete cascade,
  medicine text not null, dosage text, quantity text, prescribed_on date not null,
  refill_due date, valid_until date, prescribed_by text, status text not null default 'active'
);
create table public.orders (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references public.patients(id) on delete cascade,
  prescription_id uuid not null references public.prescriptions(id) on delete cascade,
  pharmacy_id uuid not null references public.pharmacies(id),
  status text not null default 'authorised',
  history jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.reports (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references public.patients(id) on delete cascade,
  category text not null, title text not null, report_date date not null default current_date,
  file_path text, amount numeric, payment_status text, notes text,
  created_at timestamptz not null default now()
);
create table public.ai_insights (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references public.patients(id) on delete cascade,
  what_changed text, why_matters text, next_action text, action_kind text,
  safety_level text not null default 'green', human_review boolean not null default false,
  confidence text, source text not null default 'fallback', inputs_used text[],
  action_done_at timestamptz, created_at timestamptz not null default now()
);
create table public.wellness_status (
  patient_id uuid primary key references public.patients(id) on delete cascade,
  programme text not null default 'Continuous Care Programme',
  outcome_status text not null default 'Stable', benefit_eligible boolean not null default true,
  updated_at timestamptz not null default now()
);
create table public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references public.patients(id) on delete cascade,
  actor_name text not null, actor_role text not null, data_category text not null,
  purpose text not null, action text not null default 'viewed',
  created_at timestamptz not null default now()
);
create table public.deletion_requests (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references public.patients(id) on delete cascade,
  scope text[] not null, status text not null default 'received',
  created_at timestamptz not null default now()
);

grant select on public.user_roles, public.consultants, public.pharmacies, public.insurers, public.org_members to authenticated;
grant select, update on public.patients to authenticated;
grant select on public.consents, public.orders, public.audit_logs, public.wellness_status to authenticated;
grant select, insert on public.health_signals, public.deletion_requests to authenticated;
grant select, insert, update, delete on public.kpis, public.reports to authenticated;
grant select, update on public.care_plans to authenticated;
grant select, insert on public.prescriptions to authenticated;
grant select, insert, update on public.ai_insights to authenticated;
grant all on all tables in schema public to service_role;

alter table public.user_roles enable row level security;
alter table public.consultants enable row level security;
alter table public.pharmacies enable row level security;
alter table public.insurers enable row level security;
alter table public.org_members enable row level security;
alter table public.patients enable row level security;
alter table public.consents enable row level security;
alter table public.health_signals enable row level security;
alter table public.kpis enable row level security;
alter table public.care_plans enable row level security;
alter table public.prescriptions enable row level security;
alter table public.orders enable row level security;
alter table public.reports enable row level security;
alter table public.ai_insights enable row level security;
alter table public.wellness_status enable row level security;
alter table public.audit_logs enable row level security;
alter table public.deletion_requests enable row level security;

create or replace function public.has_role(_user_id uuid, _role public.app_role) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.user_roles where user_id = _user_id and role = _role) $$;

create or replace function public.is_patient_owner(_pid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.patients where id = _pid and user_id = auth.uid()) $$;

create or replace function public.my_org(_type public.app_role) returns uuid
language sql stable security definer set search_path = public as $$
  select org_id from public.org_members where user_id = auth.uid() and org_type = _type limit 1 $$;

create or replace function public.is_patient_consultant(_pid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.patients p join public.org_members m
    on m.org_id = p.consultant_id and m.org_type = 'consultant' and m.user_id = auth.uid() where p.id = _pid) $$;

create or replace function public.is_patient_insurer(_pid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.patients p join public.org_members m
    on m.org_id = p.insurer_id and m.org_type = 'insurer' and m.user_id = auth.uid() where p.id = _pid) $$;

create or replace function public.consent_active(_pid uuid, _category text) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.consents where patient_id = _pid and category = _category and status = 'active') $$;

create or replace function public.is_patient_pharmacy(_pid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select public.consent_active(_pid, 'prescription') and exists (
    select 1 from public.orders o join public.org_members m
      on m.org_id = o.pharmacy_id and m.org_type = 'pharmacy' and m.user_id = auth.uid()
    where o.patient_id = _pid) $$;

create policy "own roles" on public.user_roles for select to authenticated using (user_id = auth.uid());
create policy "read orgs c" on public.consultants for select to authenticated using (true);
create policy "read orgs p" on public.pharmacies for select to authenticated using (true);
create policy "read orgs i" on public.insurers for select to authenticated using (true);
create policy "own membership" on public.org_members for select to authenticated using (user_id = auth.uid());

create policy "patient read" on public.patients for select to authenticated using (
  user_id = auth.uid() or public.is_patient_consultant(id) or public.is_patient_insurer(id) or public.is_patient_pharmacy(id));
create policy "patient update own" on public.patients for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy "consents read" on public.consents for select to authenticated using (
  public.is_patient_owner(patient_id) or public.is_patient_consultant(patient_id) or public.is_patient_insurer(patient_id) or public.is_patient_pharmacy(patient_id));

create policy "signals read" on public.health_signals for select to authenticated using (
  public.is_patient_owner(patient_id) or (public.is_patient_consultant(patient_id) and public.consent_active(patient_id,
    case signal_type when 'glucose' then 'glucose' when 'steps' then 'activity' when 'sleep' then 'sleep' else '__none' end)));
create policy "signals insert own" on public.health_signals for insert to authenticated with check (public.is_patient_owner(patient_id));

create policy "kpi read" on public.kpis for select to authenticated using (public.is_patient_owner(patient_id) or public.is_patient_consultant(patient_id));
create policy "kpi ins" on public.kpis for insert to authenticated with check (public.is_patient_consultant(patient_id));
create policy "kpi upd" on public.kpis for update to authenticated using (public.is_patient_consultant(patient_id)) with check (public.is_patient_consultant(patient_id));
create policy "kpi del" on public.kpis for delete to authenticated using (public.is_patient_consultant(patient_id));

create policy "plan read" on public.care_plans for select to authenticated using (public.is_patient_owner(patient_id) or public.is_patient_consultant(patient_id));
create policy "plan upd" on public.care_plans for update to authenticated using (public.is_patient_consultant(patient_id)) with check (public.is_patient_consultant(patient_id));

create policy "rx read" on public.prescriptions for select to authenticated using (
  public.is_patient_owner(patient_id) or public.is_patient_consultant(patient_id) or
  (public.consent_active(patient_id,'prescription') and exists (select 1 from public.orders o where o.prescription_id = prescriptions.id and o.pharmacy_id = public.my_org('pharmacy'))));
create policy "rx ins" on public.prescriptions for insert to authenticated with check (public.is_patient_consultant(patient_id));

create policy "orders read" on public.orders for select to authenticated using (
  public.is_patient_owner(patient_id) or public.is_patient_consultant(patient_id) or
  (pharmacy_id = public.my_org('pharmacy') and public.consent_active(patient_id,'prescription')));

create policy "reports read" on public.reports for select to authenticated using (
  public.is_patient_owner(patient_id) or
  (category <> 'bill' and public.is_patient_consultant(patient_id) and public.consent_active(patient_id,'medical_reports')) or
  (category = 'bill' and public.is_patient_insurer(patient_id) and public.consent_active(patient_id,'billing')));
create policy "reports ins" on public.reports for insert to authenticated with check (public.is_patient_owner(patient_id));
create policy "reports upd" on public.reports for update to authenticated using (public.is_patient_owner(patient_id));
create policy "reports del" on public.reports for delete to authenticated using (public.is_patient_owner(patient_id));

create policy "ai read" on public.ai_insights for select to authenticated using (public.is_patient_owner(patient_id) or public.is_patient_consultant(patient_id));
create policy "ai ins" on public.ai_insights for insert to authenticated with check (public.is_patient_owner(patient_id));
create policy "ai upd" on public.ai_insights for update to authenticated using (public.is_patient_owner(patient_id));

create policy "wellness read" on public.wellness_status for select to authenticated using (
  public.is_patient_owner(patient_id) or public.is_patient_consultant(patient_id) or
  (public.is_patient_insurer(patient_id) and public.consent_active(patient_id,'wellness')));

create policy "audit read" on public.audit_logs for select to authenticated using (public.is_patient_owner(patient_id));
create policy "del read" on public.deletion_requests for select to authenticated using (public.is_patient_owner(patient_id));
create policy "del ins" on public.deletion_requests for insert to authenticated with check (public.is_patient_owner(patient_id));

insert into public.consultants values ('11111111-0000-0000-0000-000000000001','Dr. Mehta','Endocrinology','Hyderabad Diabetes Centre'),
 ('11111111-0000-0000-0000-000000000002','Dr. Rao','Internal Medicine','City Care Clinic');
insert into public.pharmacies values ('22222222-0000-0000-0000-000000000001','MedConnect Pharmacy','Hyderabad'),
 ('22222222-0000-0000-0000-000000000002','CarePlus Chemists','Hyderabad');
insert into public.insurers values ('33333333-0000-0000-0000-000000000001','Apex Health'),
 ('33333333-0000-0000-0000-000000000002','Sahaya Insurance');

create or replace function public._audit(_pid uuid, _actor text, _role text, _cat text, _purpose text, _action text)
returns void language sql security definer set search_path = public as $$
  insert into public.audit_logs(patient_id, actor_name, actor_role, data_category, purpose, action)
  values (_pid, _actor, _role, _cat, _purpose, _action) $$;

create or replace function public._seed_patient_data(_pid uuid) returns void
language plpgsql security definer set search_path = public as $$
declare
  g int[] := array[121,118,124,119,122,126,120,123,125,132,138,144,151,158];
  s int[] := array[6800,6400,7100,6200,6900,6600,7000,6300,6500,5200,4900,4600,4200,3900];
  sl numeric[] := array[7.2,7.0,7.3,6.9,7.1,7.2,7.0,6.8,7.0,6.4,6.2,6.1,5.9,5.8];
  meals text[] := array['Ragi dosa & sambar','Roti, dal & salad','Idli & chutney','Veg pulao & raita','Roti, paneer & salad','Oats upma','Millet khichdi','Roti, dal & sabzi','Poha & sprouts','Rice, dal & papad','Biryani','Roti, paneer & rice','Puri & aloo','White rice & curry'];
  carbs text[] := array['moderate','moderate','moderate','high','moderate','low','moderate','moderate','moderate','high','high','moderate','high','high'];
  i int; d timestamptz;
begin
  for i in 1..14 loop
    d := date_trunc('day', now()) - ((14 - i) || ' days')::interval;
    insert into health_signals(patient_id, signal_type, value, unit, source, recorded_at)
      values (_pid,'glucose',g[i],'mg/dL','Glucose monitor', d + interval '7 hours'),
             (_pid,'steps',s[i],'steps','Connected wearable', d + interval '21 hours'),
             (_pid,'sleep',sl[i],'hours','Connected wearable', d + interval '6 hours');
    insert into health_signals(patient_id, signal_type, value, unit, source, recorded_at, meta)
      values (_pid,'meal', case carbs[i] when 'high' then 1 else 0 end,'high_carb','Meal photo', d + interval '20 hours',
        jsonb_build_object('name', meals[i], 'carbs', carbs[i]));
  end loop;
  insert into kpis(patient_id,name,metric,target,unit,direction,frequency,source,notes,updated_by) values
    (_pid,'Daily steps','steps',6000,'steps/day','min','Daily','Wearable','Aim for a short walk after meals.','Dr. Mehta'),
    (_pid,'Fasting glucose trend','glucose',130,'mg/dL','max','Daily','Glucose monitor','Monitor the trend, not single readings.','Dr. Mehta'),
    (_pid,'Sleep','sleep',7,'hours','min','Daily','Wearable',null,'Dr. Mehta'),
    (_pid,'Meal adherence','meals',5,'days/7','min','Weekly','Meal photo','Balanced plate on most days.','Dr. Mehta');
  insert into care_plans(patient_id, review_status, plan_actions, last_reviewed_at)
    values (_pid,'needs_review','Post-dinner walk 15 min · Balanced plate (half vegetables) · Sleep by 10:30 PM', now() - interval '20 days');
  insert into prescriptions(patient_id, medicine, dosage, quantity, prescribed_on, refill_due, valid_until, prescribed_by)
    values (_pid,'Metformin XR 500 mg (demo)','As prescribed by consultant','30 tablets', current_date - 27, current_date + 3, current_date + 150,'Dr. Mehta');
  insert into reports(patient_id, category, title, report_date, notes) values
    (_pid,'lab','HbA1c panel (simulated)', current_date - 40, 'Synthetic lab record'),
    (_pid,'medical','Annual check-up summary', current_date - 120, 'Synthetic report'),
    (_pid,'consultation','Consultation note – Dr. Mehta', current_date - 20, 'Follow-up in 6 weeks'),
    (_pid,'prescription','Prescription – Metformin XR (demo)', current_date - 27, null);
  insert into reports(patient_id, category, title, report_date, amount, payment_status) values
    (_pid,'bill','Consultation bill – Dr. Mehta', current_date - 20, 800, 'Settled by insurer');
  insert into wellness_status(patient_id, outcome_status) values (_pid,'Needs attention');
end $$;

create or replace function public._seed_consents(_pid uuid, _granted text[]) returns void
language plpgsql security definer set search_path = public as $$
begin
  insert into consents(patient_id, category, data_label, purpose, recipient_type, recipient_name, optional, retention, status, granted_at)
  select _pid, c.cat, c.label, c.purpose, c.rtype, c.rname, c.opt, c.ret,
    case when c.cat = any(_granted) then 'active' else 'not_granted' end,
    case when c.cat = any(_granted) then now() end
  from (values
    ('glucose','Glucose data','Consultant KPI monitoring','consultant','Dr. Mehta',false,'While care plan is active'),
    ('activity','Activity data','Care-plan monitoring','consultant','Dr. Mehta',false,'While care plan is active'),
    ('sleep','Sleep data','Care-plan monitoring','consultant','Dr. Mehta',true,'While care plan is active'),
    ('meal_photos','Meal photos','AI nutrition analysis','ai','AI engine',true,'Photo not stored; only the estimate is kept'),
    ('prescription','Prescription','Medicine fulfilment','pharmacy','Selected pharmacy',false,'Until order is fulfilled'),
    ('medical_reports','Medical reports','Care continuity','consultant','Dr. Mehta',true,'While care plan is active'),
    ('billing','Billing data','Consultation payment','insurer','Apex Health',false,'As required for claims records'),
    ('wellness','Wellness status','Preventive programme','insurer','Apex Health',true,'While enrolled in programme')
  ) as c(cat,label,purpose,rtype,rname,opt,ret);
end $$;

create or replace function public.claim_role(_role public.app_role) returns void
language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid();
begin
  if uid is null then raise exception 'Not signed in'; end if;
  if exists (select 1 from user_roles where user_id = uid) then return; end if;
  insert into user_roles(user_id, role) values (uid, _role);
  if _role = 'consultant' then insert into org_members(user_id, org_type, org_id) values (uid,'consultant','11111111-0000-0000-0000-000000000001');
  elsif _role = 'pharmacy' then insert into org_members(user_id, org_type, org_id) values (uid,'pharmacy','22222222-0000-0000-0000-000000000001');
  elsif _role = 'insurer' then insert into org_members(user_id, org_type, org_id) values (uid,'insurer','33333333-0000-0000-0000-000000000001');
  end if;
end $$;

create or replace function public.onboard_patient(_name text, _age int, _gender text, _city text, _condition text,
  _consultant uuid, _insurer uuid, _granted text[]) returns uuid
language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); pid uuid;
begin
  if not has_role(uid,'patient') then raise exception 'Only patients can onboard'; end if;
  select id into pid from patients where user_id = uid;
  if pid is not null then return pid; end if;
  insert into patients(user_id,name,age,gender,city,condition,consultant_id,insurer_id,pharmacy_id)
    values (uid,_name,_age,_gender,_city,coalesce(_condition,'Type 2 Diabetes'),_consultant,_insurer,'22222222-0000-0000-0000-000000000001')
    returning id into pid;
  perform _seed_consents(pid, _granted);
  perform _seed_patient_data(pid);
  perform _audit(pid, _name, 'patient', 'Permissions', 'Onboarding consent choices', 'granted');
  return pid;
end $$;

create or replace function public.set_consent(_category text, _status text) returns void
language plpgsql security definer set search_path = public as $$
declare pid uuid; pname text;
begin
  select id, name into pid, pname from patients where user_id = auth.uid();
  if pid is null then raise exception 'No patient profile'; end if;
  if _status not in ('active','withdrawn') then raise exception 'Invalid status'; end if;
  update consents set status = _status,
    granted_at = case when _status = 'active' then now() else granted_at end,
    withdrawn_at = case when _status = 'withdrawn' then now() else null end
  where patient_id = pid and category = _category;
  perform _audit(pid, pname, 'patient', _category, 'Consent ' || case when _status='active' then 'granted' else 'withdrawn' end, _status);
end $$;

create or replace function public.create_order(_prescription uuid, _pharmacy uuid) returns uuid
language plpgsql security definer set search_path = public as $$
declare pid uuid; pname text; oid uuid; phname text;
begin
  select p.id, p.name into pid, pname from patients p join prescriptions r on r.patient_id = p.id
    where r.id = _prescription and p.user_id = auth.uid();
  if pid is null then raise exception 'Prescription not found'; end if;
  if exists (select 1 from prescriptions where id = _prescription and valid_until < current_date) then raise exception 'Prescription expired'; end if;
  if exists (select 1 from orders where prescription_id = _prescription and status not in ('received','cancelled')) then raise exception 'An order is already in progress'; end if;
  select name into phname from pharmacies where id = _pharmacy;
  if phname is null then raise exception 'Pharmacy unavailable'; end if;
  update patients set pharmacy_id = _pharmacy where id = pid;
  update consents set status = 'active', granted_at = now(), withdrawn_at = null, recipient_name = phname
    where patient_id = pid and category = 'prescription';
  insert into orders(patient_id, prescription_id, pharmacy_id, status, history)
    values (pid, _prescription, _pharmacy, 'authorised', jsonb_build_array(jsonb_build_object('status','authorised','at',now(),'by',pname)))
    returning id into oid;
  perform _audit(pid, pname, 'patient', 'Prescription', 'Shared with ' || phname || ' for fulfilment', 'shared');
  return oid;
end $$;

create or replace function public.advance_order(_order uuid, _status text) returns void
language plpgsql security definer set search_path = public as $$
declare o record; actor text; arole text; allowed boolean := false;
begin
  select * into o from orders where id = _order;
  if o is null then raise exception 'Order not found'; end if;
  if o.pharmacy_id = my_org('pharmacy') then
    if not consent_active(o.patient_id,'prescription') then raise exception 'Patient has withdrawn prescription sharing'; end if;
    allowed := (o.status,_status) in (('authorised','confirmed'),('confirmed','preparing'),('preparing','dispatched'),('dispatched','delivered'));
    select name into actor from pharmacies where id = o.pharmacy_id; arole := 'pharmacy';
  elsif is_patient_owner(o.patient_id) then
    allowed := (o.status = 'delivered' and _status = 'received') or (o.status in ('authorised','confirmed') and _status = 'cancelled');
    select name into actor from patients where id = o.patient_id; arole := 'patient';
  end if;
  if not allowed then raise exception 'Status change not allowed'; end if;
  update orders set status = _status, updated_at = now(),
    history = history || jsonb_build_array(jsonb_build_object('status',_status,'at',now(),'by',actor)) where id = _order;
  if _status = 'received' then
    update prescriptions set refill_due = current_date + 30 where id = o.prescription_id;
  end if;
  perform _audit(o.patient_id, actor, arole, 'Prescription order', 'Order fulfilment: ' || _status, 'updated');
end $$;

create or replace function public.log_access(_pid uuid, _category text, _purpose text) returns void
language plpgsql security definer set search_path = public as $$
declare actor text; arole text;
begin
  if is_patient_consultant(_pid) then select c.name into actor from consultants c where c.id = my_org('consultant'); arole := 'consultant';
  elsif is_patient_insurer(_pid) then select i.name into actor from insurers i where i.id = my_org('insurer'); arole := 'insurer';
  elsif is_patient_pharmacy(_pid) then select ph.name into actor from pharmacies ph where ph.id = my_org('pharmacy'); arole := 'pharmacy';
  else return; end if;
  if exists (select 1 from audit_logs where patient_id = _pid and actor_name = actor and data_category = _category and created_at > now() - interval '10 minutes') then return; end if;
  perform _audit(_pid, actor, arole, _category, _purpose, 'viewed');
end $$;

create or replace function public.consultant_review(_pid uuid, _status text, _note text, _followup boolean) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not is_patient_consultant(_pid) then raise exception 'Not authorised'; end if;
  update care_plans set review_status = coalesce(_status, review_status), consultant_notes = coalesce(_note, consultant_notes),
    flagged_followup = coalesce(_followup, flagged_followup), last_reviewed_at = now(), updated_at = now() where patient_id = _pid;
end $$;

revoke execute on function public._audit(uuid,text,text,text,text,text), public._seed_patient_data(uuid), public._seed_consents(uuid,text[]) from public, anon, authenticated;
grant execute on function public.claim_role(public.app_role), public.onboard_patient(text,int,text,text,text,uuid,uuid,text[]),
  public.set_consent(text,text), public.create_order(uuid,uuid), public.advance_order(uuid,text),
  public.log_access(uuid,text,text), public.consultant_review(uuid,text,text,boolean) to authenticated;

insert into public.patients(id,name,age,gender,city,consultant_id,insurer_id,pharmacy_id,is_demo) values
 ('44444444-0000-0000-0000-000000000001','Ramesh Kumar (demo)',56,'Male','Hyderabad','11111111-0000-0000-0000-000000000001','33333333-0000-0000-0000-000000000001','22222222-0000-0000-0000-000000000001',true);
select public._seed_consents('44444444-0000-0000-0000-000000000001', array['glucose','activity','sleep','meal_photos','prescription','medical_reports','billing','wellness']);
select public._seed_patient_data('44444444-0000-0000-0000-000000000001');
insert into public.patients(name,age,gender,city,consultant_id,insurer_id,is_demo) values
 ('Lakshmi Iyer',61,'Female','Hyderabad','11111111-0000-0000-0000-000000000001','33333333-0000-0000-0000-000000000001',true),
 ('Arjun Reddy',49,'Male','Secunderabad','11111111-0000-0000-0000-000000000001','33333333-0000-0000-0000-000000000001',true),
 ('Fatima Sheikh',53,'Female','Hyderabad','11111111-0000-0000-0000-000000000001','33333333-0000-0000-0000-000000000001',true),
 ('Suresh Naidu',67,'Male','Warangal','11111111-0000-0000-0000-000000000001','33333333-0000-0000-0000-000000000001',true),
 ('Priya Sharma',45,'Female','Hyderabad','11111111-0000-0000-0000-000000000001','33333333-0000-0000-0000-000000000001',true);
insert into public.care_plans(patient_id, review_status, last_reviewed_at)
 select id, case name when 'Suresh Naidu' then 'escalated' when 'Arjun Reddy' then 'needs_review' else 'on_track' end, now() - interval '7 days'
 from public.patients where is_demo and id <> '44444444-0000-0000-0000-000000000001';
insert into public.wellness_status(patient_id, outcome_status)
 select id, case name when 'Suresh Naidu' then 'Needs attention' when 'Priya Sharma' then 'Improving' else 'Stable' end
 from public.patients where is_demo and id <> '44444444-0000-0000-0000-000000000001';
select public._seed_consents(id, array['glucose','activity','billing','wellness']) from public.patients where is_demo and id <> '44444444-0000-0000-0000-000000000001';

create policy "records own read" on storage.objects for select to authenticated using (bucket_id='records' and exists (select 1 from public.patients p where p.id::text = (storage.foldername(name))[1] and p.user_id = auth.uid()));
create policy "records own write" on storage.objects for insert to authenticated with check (bucket_id='records' and exists (select 1 from public.patients p where p.id::text = (storage.foldername(name))[1] and p.user_id = auth.uid()));
