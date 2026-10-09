
create table public.caregiver_links (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references public.patients(id) on delete cascade,
  caregiver_user_id uuid,
  caregiver_name text not null,
  relationship text not null default 'Son/Daughter',
  invite_email text,
  invite_code text not null unique,
  permissions text[] not null default '{}',
  status text not null default 'pending',
  created_at timestamptz not null default now(),
  accepted_at timestamptz,
  revoked_at timestamptz
);
create table public.medication_doses (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references public.patients(id) on delete cascade,
  label text not null,
  scheduled_for timestamptz not null,
  status text not null default 'not_confirmed',
  confirmed_at timestamptz,
  unique (patient_id, scheduled_for)
);
create table public.support_messages (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references public.patients(id) on delete cascade,
  link_id uuid references public.caregiver_links(id) on delete cascade,
  direction text not null,
  kind text not null,
  body text not null,
  created_at timestamptz not null default now()
);
grant select on public.caregiver_links, public.medication_doses, public.support_messages to authenticated;
grant all on public.caregiver_links, public.medication_doses, public.support_messages to service_role;
alter table public.caregiver_links enable row level security;
alter table public.medication_doses enable row level security;
alter table public.support_messages enable row level security;

create or replace function public.caregiver_link_for(_pid uuid) returns public.caregiver_links
language sql stable security definer set search_path = public as $$
  select * from public.caregiver_links where patient_id = _pid and caregiver_user_id = auth.uid() and status = 'active' limit 1 $$;

create or replace function public.caregiver_has(_pid uuid, _perm text) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.caregiver_links where patient_id = _pid and caregiver_user_id = auth.uid()
    and status = 'active' and _perm = any(permissions)) $$;

create policy "links read" on public.caregiver_links for select to authenticated
  using (public.is_patient_owner(patient_id) or (caregiver_user_id = auth.uid() and status <> 'revoked'));
create policy "doses read" on public.medication_doses for select to authenticated
  using (public.is_patient_owner(patient_id) or public.caregiver_has(patient_id, 'medication'));
create policy "msgs read" on public.support_messages for select to authenticated
  using (public.is_patient_owner(patient_id) or exists (select 1 from public.caregiver_links l
    where l.id = support_messages.link_id and l.caregiver_user_id = auth.uid() and l.status = 'active'));

create or replace function public._is_caregiver() returns boolean
language plpgsql stable security definer set search_path = public as $$
begin return exists (select 1 from user_roles where user_id = auth.uid() and role::text = 'caregiver'); end $$;

create or replace function public._ensure_doses(_pid uuid) returns void
language plpgsql security definer set search_path = public as $$
declare i int; d timestamptz;
begin
  for i in 0..6 loop
    d := date_trunc('day', now()) - (i || ' days')::interval;
    insert into medication_doses(patient_id, label, scheduled_for, status, confirmed_at)
    values
      (_pid, 'Morning medicine (after breakfast)', d + interval '8 hours 30 minutes',
        case when i = 0 then 'not_confirmed' when i = 3 then 'missed' when i = 5 then 'not_confirmed' else 'taken' end,
        case when i in (0,3,5) then null else d + interval '8 hours 45 minutes' end),
      (_pid, 'Evening medicine (after dinner)', d + interval '20 hours 30 minutes',
        case when i = 0 then 'not_confirmed' else 'taken' end,
        case when i = 0 then null else d + interval '20 hours 50 minutes' end)
    on conflict (patient_id, scheduled_for) do nothing;
  end loop;
end $$;

create or replace function public._notify_caregivers(_pid uuid, _perm text, _body text) returns void
language plpgsql security definer set search_path = public as $$
begin
  insert into support_messages(patient_id, link_id, direction, kind, body)
  select _pid, id, 'to_caregiver', 'update', _body from caregiver_links
  where patient_id = _pid and status = 'active' and _perm = any(permissions);
end $$;

create or replace function public.invite_caregiver(_name text, _relationship text, _email text, _perms text[]) returns text
language plpgsql security definer set search_path = public as $$
declare pid uuid; pname text; code text;
begin
  select id, name into pid, pname from patients where user_id = auth.uid();
  if pid is null then raise exception 'No patient profile'; end if;
  if coalesce(trim(_name),'') = '' then raise exception 'Name is required'; end if;
  if exists (select 1 from unnest(_perms) p where p not in ('medication','food','glucose','progress')) then raise exception 'Unknown permission'; end if;
  code := upper(substr(md5(random()::text || clock_timestamp()::text), 1, 6));
  insert into caregiver_links(patient_id, caregiver_name, relationship, invite_email, invite_code, permissions)
    values (pid, trim(_name), _relationship, nullif(trim(_email),''), code, coalesce(_perms,'{}'));
  perform _audit(pid, pname, 'patient', 'Family access', 'Invited ' || trim(_name) || ' (' || _relationship || '): ' || coalesce(array_to_string(_perms, ', '), 'none'), 'granted');
  return code;
end $$;

create or replace function public.accept_caregiver_invite(_code text) returns uuid
language plpgsql security definer set search_path = public as $$
declare l caregiver_links;
begin
  if not _is_caregiver() then raise exception 'Only family/caregiver accounts can accept invites'; end if;
  select * into l from caregiver_links where invite_code = upper(trim(_code)) and status = 'pending';
  if l.id is null then raise exception 'Invite code not found or already used'; end if;
  if exists (select 1 from caregiver_links where caregiver_user_id = auth.uid() and status = 'active') then
    raise exception 'This account is already linked to a patient'; end if;
  update caregiver_links set caregiver_user_id = auth.uid(), status = 'active', accepted_at = now() where id = l.id;
  perform _audit(l.patient_id, l.caregiver_name, 'caregiver', 'Family access', 'Invite accepted', 'linked');
  return l.patient_id;
end $$;

create or replace function public.set_caregiver_permissions(_link uuid, _perms text[]) returns void
language plpgsql security definer set search_path = public as $$
declare l caregiver_links; pname text;
begin
  select * into l from caregiver_links where id = _link;
  if l.id is null or not is_patient_owner(l.patient_id) then raise exception 'Not authorised'; end if;
  if exists (select 1 from unnest(_perms) p where p not in ('medication','food','glucose','progress')) then raise exception 'Unknown permission'; end if;
  update caregiver_links set permissions = coalesce(_perms,'{}') where id = _link;
  select name into pname from patients where id = l.patient_id;
  perform _audit(l.patient_id, pname, 'patient', 'Family access', l.caregiver_name || ' can now see: ' || coalesce(nullif(array_to_string(_perms, ', '),''), 'nothing'), 'updated');
end $$;

create or replace function public.revoke_caregiver(_link uuid) returns void
language plpgsql security definer set search_path = public as $$
declare l caregiver_links; pname text;
begin
  select * into l from caregiver_links where id = _link;
  if l.id is null or not is_patient_owner(l.patient_id) then raise exception 'Not authorised'; end if;
  update caregiver_links set status = 'revoked', revoked_at = now() where id = _link;
  select name into pname from patients where id = l.patient_id;
  perform _audit(l.patient_id, pname, 'patient', 'Family access', 'Access revoked for ' || l.caregiver_name, 'withdrawn');
end $$;

create or replace function public.record_dose(_dose uuid, _status text) returns void
language plpgsql security definer set search_path = public as $$
declare d medication_doses; pname text;
begin
  select * into d from medication_doses where id = _dose;
  if d.id is null or not is_patient_owner(d.patient_id) then raise exception 'Not authorised'; end if;
  if _status not in ('taken','missed') then raise exception 'Invalid status'; end if;
  update medication_doses set status = _status, confirmed_at = now() where id = _dose;
  select name into pname from patients where id = d.patient_id;
  if _status = 'missed' then
    perform _notify_caregivers(d.patient_id, 'medication',
      split_part(pname, ' ', 1) || ' marked "' || d.label || '" as missed today. A gentle reminder may help — never suggest a double dose.');
  else
    perform _notify_caregivers(d.patient_id, 'medication', split_part(pname, ' ', 1) || ' confirmed "' || d.label || '" as taken.');
  end if;
end $$;

create or replace function public.log_meal_glucose(_value numeric, _meal text) returns text
language plpgsql security definer set search_path = public as $$
declare pid uuid; pname text; usual numeric; lvl text := 'normal';
begin
  select id, name into pid, pname from patients where user_id = auth.uid();
  if pid is null then raise exception 'No patient profile'; end if;
  if _value is null or _value < 20 or _value > 600 then raise exception 'Enter a reading between 20 and 600 mg/dL'; end if;
  select avg(value) into usual from health_signals where patient_id = pid and signal_type = 'glucose' and recorded_at > now() - interval '14 days';
  insert into health_signals(patient_id, signal_type, value, unit, source, meta)
    values (pid, 'glucose', _value, 'mg/dL', 'Manual input', jsonb_build_object('context','after meal','meal', coalesce(_meal,'')));
  if _value >= 300 or _value < 70 then
    lvl := 'red';
    update care_plans set review_status = 'escalated', updated_at = now() where patient_id = pid;
    perform _audit(pid, 'PULSE LOOP safety engine', 'system', 'Glucose', 'Out-of-range reading escalated to consultant', 'escalated');
    perform _notify_caregivers(pid, 'glucose', 'A reading needs professional review and has been sent to the consultant. Please check in with ' || split_part(pname,' ',1) || ' and follow the consultant''s advice.');
  elsif usual is not null and _value > usual + 40 then
    lvl := 'high';
    perform _notify_caregivers(pid, 'food', 'After ' || coalesce(nullif(_meal,''),'a meal') || ', ' || split_part(pname,' ',1) || '''s reading was higher than his usual range. The care plan suggests a short walk after meals and a smaller rice portion.');
  end if;
  return lvl;
end $$;

create or replace function public.send_support_message(_pid uuid, _kind text, _body text) returns void
language plpgsql security definer set search_path = public as $$
declare l caregiver_links;
begin
  l := caregiver_link_for(_pid);
  if l.id is null then raise exception 'No active caregiver access'; end if;
  if _kind not in ('encourage','remind','acknowledge') then raise exception 'Invalid message type'; end if;
  if coalesce(trim(_body),'') = '' or length(_body) > 280 then raise exception 'Message must be 1–280 characters'; end if;
  insert into support_messages(patient_id, link_id, direction, kind, body) values (_pid, l.id, 'to_patient', _kind, trim(_body));
  perform _audit(_pid, l.caregiver_name, 'caregiver', 'Support message', 'Sent a ' || _kind || ' message', 'sent');
end $$;

create or replace function public.caregiver_dashboard() returns jsonb
language plpgsql security definer set search_path = public as $$
declare l caregiver_links; p patients; res jsonb; usual numeric;
begin
  if not _is_caregiver() then raise exception 'Not authorised'; end if;
  select * into l from caregiver_links where caregiver_user_id = auth.uid() and status = 'active' limit 1;
  if l.id is null then return null; end if;
  select * into p from patients where id = l.patient_id;
  res := jsonb_build_object('link', jsonb_build_object('id', l.id, 'relationship', l.relationship, 'caregiver_name', l.caregiver_name, 'permissions', l.permissions),
    'patient', jsonb_build_object('id', p.id, 'first_name', split_part(replace(p.name,' (demo)',''),' ',1), 'is_demo', p.is_demo));
  if 'medication' = any(l.permissions) then
    perform _ensure_doses(p.id);
    res := res || jsonb_build_object('doses', (select coalesce(jsonb_agg(jsonb_build_object('id',id,'label',label,'scheduled_for',scheduled_for,'status',status,'confirmed_at',confirmed_at) order by scheduled_for desc),'[]')
      from medication_doses where patient_id = p.id and scheduled_for > now() - interval '7 days'));
  end if;
  if 'food' = any(l.permissions) then
    res := res || jsonb_build_object('meals', (select coalesce(jsonb_agg(jsonb_build_object('name', meta->>'name','carbs', meta->>'carbs','at', recorded_at) order by recorded_at desc),'[]')
      from (select * from health_signals where patient_id = p.id and signal_type = 'meal' order by recorded_at desc limit 5) m),
      'meal_goal', (select plan_actions from care_plans where patient_id = p.id));
  end if;
  if 'glucose' = any(l.permissions) then
    select avg(value) into usual from health_signals where patient_id = p.id and signal_type = 'glucose' and recorded_at between now() - interval '14 days' and now() - interval '5 days';
    res := res || jsonb_build_object('glucose', jsonb_build_object(
      'usual', round(usual),
      'recent', (select round(avg(value)) from health_signals where patient_id = p.id and signal_type = 'glucose' and recorded_at > now() - interval '5 days'),
      'latest', (select jsonb_build_object('value', value, 'at', recorded_at, 'context', meta->>'context') from health_signals where patient_id = p.id and signal_type = 'glucose' order by recorded_at desc limit 1),
      'escalated', (select review_status = 'escalated' from care_plans where patient_id = p.id)));
  end if;
  if 'progress' = any(l.permissions) then
    perform _ensure_doses(p.id);
    res := res || jsonb_build_object('progress', jsonb_build_object(
      'doses_taken', (select count(*) from medication_doses where patient_id = p.id and status = 'taken' and scheduled_for > now() - interval '7 days'),
      'doses_total', (select count(*) from medication_doses where patient_id = p.id and scheduled_for > now() - interval '7 days' and scheduled_for < now()),
      'walk_days', (select count(*) from health_signals where patient_id = p.id and signal_type = 'steps' and value >= 6000 and recorded_at > now() - interval '7 days'),
      'balanced_meals', (select count(*) from health_signals where patient_id = p.id and signal_type = 'meal' and value = 0 and recorded_at > now() - interval '7 days'),
      'hba1c', null));
  end if;
  if not exists (select 1 from audit_logs where patient_id = p.id and actor_name = l.caregiver_name and data_category = 'Family dashboard' and created_at > now() - interval '10 minutes') then
    perform _audit(p.id, l.caregiver_name, 'caregiver', 'Family dashboard', 'Viewed: ' || array_to_string(l.permissions, ', '), 'viewed');
  end if;
  return res;
end $$;

create or replace function public.my_doses_today() returns setof public.medication_doses
language plpgsql security definer set search_path = public as $$
declare pid uuid;
begin
  select id into pid from patients where user_id = auth.uid();
  if pid is null then return; end if;
  perform _ensure_doses(pid);
  return query select * from medication_doses where patient_id = pid and scheduled_for >= date_trunc('day', now()) order by scheduled_for;
end $$;

revoke execute on function public._ensure_doses(uuid), public._notify_caregivers(uuid,text,text) from public, anon, authenticated;
grant execute on function public.invite_caregiver(text,text,text,text[]), public.accept_caregiver_invite(text),
  public.set_caregiver_permissions(uuid,text[]), public.revoke_caregiver(uuid), public.record_dose(uuid,text),
  public.log_meal_glucose(numeric,text), public.send_support_message(uuid,text,text), public.caregiver_dashboard(),
  public.my_doses_today() to authenticated;
