-- NalamLink AI hosted Postgres schema (Supabase Free tier compatible).
-- The application server uses a server-only Supabase secret/service-role key.
-- Browser clients must never receive that key. RLS blocks direct client table access.

create table if not exists public.nl_patients (
  id text primary key,
  profile jsonb not null,
  created_at timestamptz not null default now()
);

create table if not exists public.nl_records (
  patient_id text not null references public.nl_patients(id) on delete cascade,
  collection text not null check (collection in ('members','medications','doses','appointments','tasks','events','notifications','invitations','checkins','handoffs','shifts')),
  record_id text not null,
  data jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (patient_id, collection, record_id)
);

create index if not exists nl_records_member_lookup on public.nl_records ((data->>'userId')) where collection='members';
create index if not exists nl_records_collection_lookup on public.nl_records (patient_id, collection);
create index if not exists nl_records_dose_status on public.nl_records (patient_id, (data->>'status')) where collection='doses';
create index if not exists nl_records_notification_email on public.nl_records (patient_id, (data->>'emailStatus')) where collection='notifications';

alter table public.nl_patients enable row level security;
alter table public.nl_records enable row level security;
-- No anon/authenticated policies by design. Only the trusted API server's secret key accesses data.
grant all on public.nl_patients to service_role;
grant all on public.nl_records to service_role;

create or replace function public.nl_transition_record(
  p_patient_id text, p_collection text, p_record_id text,
  p_expected_status text, p_patch jsonb
) returns jsonb language plpgsql security definer set search_path = public as $$
declare current_data jsonb; next_data jsonb;
begin
  select data into current_data from nl_records
   where patient_id=p_patient_id and collection=p_collection and record_id=p_record_id for update;
  if current_data is null or current_data->>'status' is distinct from p_expected_status then return null; end if;
  next_data := current_data || coalesce(p_patch,'{}'::jsonb) || jsonb_build_object('updatedAt', now());
  update nl_records set data=next_data, updated_at=now()
   where patient_id=p_patient_id and collection=p_collection and record_id=p_record_id;
  return next_data;
end; $$;

create or replace function public.nl_claim_notification_email(
  p_patient_id text, p_notification_id text, p_lease_ms integer default 120000
) returns jsonb language plpgsql security definer set search_path = public as $$
declare current_data jsonb; attempts integer; claimed timestamptz := now();
begin
  select data into current_data from nl_records
   where patient_id=p_patient_id and collection='notifications' and record_id=p_notification_id for update;
  if current_data is null then return null; end if;
  attempts := coalesce((current_data->>'emailAttempts')::integer,0);
  if current_data->>'emailStatus'='sent' or attempts >= 5 then return null; end if;
  if current_data->>'emailStatus'='sending' and nullif(current_data->>'emailClaimedAt','') is not null
     and claimed - (current_data->>'emailClaimedAt')::timestamptz < make_interval(secs => greatest(p_lease_ms,0)::double precision/1000) then return null; end if;
  current_data := current_data || jsonb_build_object('emailStatus','sending','emailClaimedAt',claimed,'emailAttempts',attempts+1);
  update nl_records set data=current_data, updated_at=claimed
   where patient_id=p_patient_id and collection='notifications' and record_id=p_notification_id;
  return current_data;
end; $$;

create or replace function public.nl_record_dose_outcome(
  p_patient_id text, p_dose_id text, p_outcome text, p_actor_name text, p_outcome_note text default ''
) returns jsonb language plpgsql security definer set search_path = public as $$
declare dose_data jsonb; med_data jsonb; med_id text; stock numeric; units numeric; stock_after numeric; now_at timestamptz := now(); changed_record jsonb;
begin
  if p_outcome not in ('taken','skipped') then raise exception 'Unsupported dose outcome'; end if;
  select data into dose_data from nl_records where patient_id=p_patient_id and collection='doses' and record_id=p_dose_id for update;
  if dose_data is null then return null; end if;
  if dose_data->>'status' in ('taken','skipped') then return jsonb_build_object('record',dose_data,'changed',false,'stockAfter',null); end if;
  if dose_data->>'status' not in ('pending','missed') then return null; end if;
  changed_record := dose_data || jsonb_build_object('status',p_outcome,'outcomeNote',left(coalesce(p_outcome_note,''),500),'outcomeAt',now_at,'outcomeBy',p_actor_name,'followUpResolvedAt',now_at,'followUpStatus','resolved','updatedAt',now_at);
  if p_outcome='taken' then changed_record := changed_record || jsonb_build_object('confirmedAt',now_at,'confirmedBy',p_actor_name); end if;
  update nl_records set data=changed_record, updated_at=now_at where patient_id=p_patient_id and collection='doses' and record_id=p_dose_id;
  stock_after := null;
  if p_outcome='taken' then
    med_id := dose_data->>'medicationId';
    if med_id is not null then
      select data into med_data from nl_records where patient_id=p_patient_id and collection='medications' and record_id=med_id for update;
      if med_data is not null and coalesce(med_data->>'stock','') ~ '^[0-9]+([.][0-9]+)?$' then
        stock := (med_data->>'stock')::numeric;
        units := case when coalesce(med_data->>'unitsPerDose','') ~ '^[0-9]+([.][0-9]+)?$' then (med_data->>'unitsPerDose')::numeric else 1 end;
        if units > 0 then
          stock_after := greatest(0, stock-units);
          med_data := med_data || jsonb_build_object('stock',stock_after,'stockUpdatedAt',now_at);
          update nl_records set data=med_data, updated_at=now_at where patient_id=p_patient_id and collection='medications' and record_id=med_id;
        end if;
      end if;
    end if;
  end if;
  return jsonb_build_object('record',changed_record,'changed',true,'stockAfter',stock_after);
end; $$;

create or replace function public.nl_accept_invitation(
  p_code_hash text, p_user_id text, p_user_name text, p_user_email text
) returns jsonb language plpgsql security definer set search_path = public as $$
declare invite_row nl_records%rowtype; invite_data jsonb; member_data jsonb; existing jsonb; patient text; invite_role text; now_at timestamptz := now();
begin
  select * into invite_row from nl_records
   where collection='invitations' and data->>'codeHash'=p_code_hash and data->>'status'='pending'
   order by created_at asc limit 1 for update;
  if invite_row.record_id is null then return null; end if;
  invite_data := invite_row.data; patient := invite_row.patient_id;
  if nullif(invite_data->>'expiresAt','') is not null and (invite_data->>'expiresAt')::timestamptz <= now_at then return null; end if;
  if nullif(invite_data->>'email','') is not null and lower(invite_data->>'email') <> lower(coalesce(p_user_email,'')) then
    return jsonb_build_object('error','This invitation belongs to a different email address.');
  end if;
  select data into existing from nl_records where patient_id=patient and collection='members' and record_id=p_user_id for update;
  if existing is not null and existing->>'status'='active' then
    invite_data := invite_data || jsonb_build_object('status','accepted','acceptedAt',now_at);
    update nl_records set data=invite_data, updated_at=now_at where patient_id=patient and collection='invitations' and record_id=invite_row.record_id;
    return jsonb_build_object('patientId',patient,'role',existing->>'role','alreadyMember',true);
  end if;
  invite_role := invite_data->>'role';
  member_data := jsonb_build_object('id',p_user_id,'userId',p_user_id,'name',p_user_name,'email',coalesce(p_user_email,''),'role',invite_role,'status','active','joinedAt',now_at);
  insert into nl_records(patient_id,collection,record_id,data) values(patient,'members',p_user_id,member_data)
    on conflict(patient_id,collection,record_id) do update set data=excluded.data, updated_at=now_at;
  invite_data := invite_data || jsonb_build_object('status','accepted','acceptedAt',now_at);
  update nl_records set data=invite_data, updated_at=now_at where patient_id=patient and collection='invitations' and record_id=invite_row.record_id;
  return jsonb_build_object('patientId',patient,'role',invite_role);
end; $$;

revoke all on function public.nl_transition_record(text,text,text,text,jsonb) from public, anon, authenticated;
revoke all on function public.nl_claim_notification_email(text,text,integer) from public, anon, authenticated;
revoke all on function public.nl_record_dose_outcome(text,text,text,text,text) from public, anon, authenticated;
revoke all on function public.nl_accept_invitation(text,text,text,text) from public, anon, authenticated;
grant execute on function public.nl_transition_record(text,text,text,text,jsonb) to service_role;
grant execute on function public.nl_claim_notification_email(text,text,integer) to service_role;
grant execute on function public.nl_record_dose_outcome(text,text,text,text,text) to service_role;
grant execute on function public.nl_accept_invitation(text,text,text,text) to service_role;
