-- SEPS Cargo Receiving. Run once in the Supabase SQL Editor as the project owner.
-- The application uses the publishable key; all writes go through the functions below.
begin;

create table public.seps_staff (
 user_id uuid primary key references auth.users(id) on delete restrict,
 email text not null unique check(email=lower(email)),
 role text not null default 'staff' check(role in ('admin','staff')),
 active boolean not null default true,
 created_at timestamptz not null default now()
);
create table public.seps_sessions (
 id uuid primary key,
 container text not null check(container ~ '^[A-Z]{4}[0-9]{7}$'),
 voyage text not null default '', source text not null,
 manifest_incomplete boolean not null default true,
 created_by uuid not null references public.seps_staff(user_id),
 created_at timestamptz not null default now(),
 import_payload jsonb not null
);
create table public.seps_shipments (
 id uuid primary key default gen_random_uuid(),
 session_id uuid not null references public.seps_sessions(id),
 shipment_no text not null check(length(shipment_no) between 1 and 80),
 bl_no text not null check(length(bl_no) between 1 and 100),
 consignee text not null check(length(consignee) between 1 and 300),
 barcode text not null,
 expected integer not null check(expected between 1 and 1000000),
 received integer not null default 0 check(received between 0 and expected),
 unique(session_id,shipment_no), unique(session_id,barcode)
);
create table public.seps_scan_events (
 id uuid primary key,
 session_id uuid not null references public.seps_sessions(id),
 shipment_id uuid not null references public.seps_shipments(id),
 actor_id uuid not null references public.seps_staff(user_id),
 actor_email text not null,
 action text not null check(action in ('receive','undo')),
 delta integer not null,
 barcode text not null,
 original_event_id uuid unique references public.seps_scan_events(id),
 reason text,
 created_at timestamptz not null default now(),
 check((action='receive' and delta=1 and original_event_id is null) or
       (action='undo' and delta=-1 and original_event_id is not null and length(trim(reason))>0))
);
create index seps_shipments_session on public.seps_shipments(session_id);
create index seps_events_session on public.seps_scan_events(session_id,created_at,id);

-- Fixed search paths, no dynamic SQL, no client-controlled identity or timestamps.
create function public.seps_is_staff() returns boolean language sql stable security definer
set search_path='' as $$
 select exists(select 1 from public.seps_staff where user_id=auth.uid() and active);
$$;
create function public.seps_is_admin() returns boolean language sql stable security definer
set search_path='' as $$
 select exists(select 1 from public.seps_staff where user_id=auth.uid() and active and role='admin');
$$;

alter table public.seps_staff enable row level security;
alter table public.seps_sessions enable row level security;
alter table public.seps_shipments enable row level security;
alter table public.seps_scan_events enable row level security;
create policy staff_self_or_admin on public.seps_staff for select to authenticated
 using(user_id=auth.uid() or public.seps_is_admin());
create policy sessions_active_staff on public.seps_sessions for select to authenticated using(public.seps_is_staff());
create policy shipments_active_staff on public.seps_shipments for select to authenticated using(public.seps_is_staff());
create policy events_active_staff on public.seps_scan_events for select to authenticated using(public.seps_is_staff());
revoke all on public.seps_staff,public.seps_sessions,public.seps_shipments,public.seps_scan_events from anon,authenticated;
grant select on public.seps_staff,public.seps_sessions,public.seps_shipments,public.seps_scan_events to authenticated;

-- Dashboard/Edge Function invitations create ordinary staff automatically.
-- Self-registrations never create a membership, even if public sign-up is accidentally enabled.
create function public.seps_enroll_invited_user() returns trigger language plpgsql security definer
set search_path='' as $$
begin
 if new.invited_at is not null and new.email is not null then
  insert into public.seps_staff(user_id,email,role) values(new.id,lower(new.email),'staff')
   on conflict(user_id) do nothing;
 end if;
 return new;
end;
$$;
create trigger seps_enroll_invitation after insert or update of invited_at on auth.users
 for each row execute function public.seps_enroll_invited_user();

create function public.seps_create_session(p_id uuid,p_container text,p_voyage text,p_source text,
 p_incomplete boolean,p_rows jsonb) returns uuid language plpgsql security definer set search_path='' as $$
declare r jsonb; old public.seps_sessions; payload jsonb;
begin
 if not public.seps_is_staff() then raise exception 'Active staff access required' using errcode='42501'; end if;
 if p_id is null or p_source is null or length(trim(p_source))=0 or length(p_source)>500
  or p_voyage is null or length(p_voyage)>100 or p_incomplete is null
  or p_container is null or p_container !~ '^[A-Z]{4}[0-9]{7}$'
  or jsonb_typeof(p_rows) is distinct from 'array' then raise exception 'Invalid manifest'; end if;
 if jsonb_array_length(p_rows) not between 1 and 10000 then raise exception 'Manifest needs 1–10000 shipments'; end if;
 payload=jsonb_build_object('container',p_container,'voyage',p_voyage,'source',p_source,'incomplete',p_incomplete,'rows',p_rows);
 -- Serializes identical import request IDs; retries cannot create duplicate sessions.
 perform pg_advisory_xact_lock(hashtextextended(p_id::text,0));
 select * into old from public.seps_sessions where id=p_id;
 if found then
  if old.created_by<>auth.uid() or old.import_payload<>payload then raise exception 'Import request ID already used'; end if;
  return p_id;
 end if;
 insert into public.seps_sessions(id,container,voyage,source,manifest_incomplete,created_by,import_payload)
 values(p_id,p_container,p_voyage,p_source,p_incomplete,auth.uid(),payload);
 for r in select value from jsonb_array_elements(p_rows) loop
  if jsonb_typeof(r->'expected') is distinct from 'number' or (r->>'expected') !~ '^[0-9]+$'
   or length(trim(coalesce(r->>'id',''))) not between 1 and 80
   or length(trim(coalesce(r->>'bl',''))) not between 1 and 100
   or length(trim(coalesce(r->>'name',''))) not between 1 and 300
   or (r->>'container') is distinct from p_container then raise exception 'Invalid shipment record'; end if;
  insert into public.seps_shipments(session_id,shipment_no,bl_no,consignee,barcode,expected)
   values(p_id,trim(r->>'id'),trim(r->>'bl'),trim(r->>'name'),trim(r->>'id'),(r->>'expected')::integer);
 end loop;
 return p_id;
end;
$$;

create function public.seps_receive(p_request_id uuid,p_session_id uuid,p_code text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare sh public.seps_shipments; ev public.seps_scan_events; staff_email text;
begin
 if not public.seps_is_staff() then raise exception 'Active staff access required' using errcode='42501'; end if;
 if p_request_id is null or p_code is null or length(trim(p_code)) not between 1 and 100 then raise exception 'Invalid scan'; end if;
 perform pg_advisory_xact_lock(hashtextextended(p_request_id::text,0));
 select * into ev from public.seps_scan_events where id=p_request_id;
 if found then
  if ev.actor_id<>auth.uid() or ev.session_id<>p_session_id or ev.action<>'receive' or ev.barcode<>trim(p_code) then raise exception 'Scan request ID already used'; end if;
  return jsonb_build_object('event_id',ev.id,'replayed',true);
 end if;
 select * into sh from public.seps_shipments where session_id=p_session_id and barcode=trim(p_code) for update;
 if not found then raise exception 'Unknown barcode: no shipment matches this container'; end if;
 if sh.received>=sh.expected then raise exception 'Shipment already complete: extra scan not counted'; end if;
 select email into staff_email from public.seps_staff where user_id=auth.uid();
 update public.seps_shipments set received=received+1 where id=sh.id;
 insert into public.seps_scan_events(id,session_id,shipment_id,actor_id,actor_email,action,delta,barcode)
 values(p_request_id,p_session_id,sh.id,auth.uid(),staff_email,'receive',1,trim(p_code));
 return jsonb_build_object('event_id',p_request_id,'shipment',sh.shipment_no,'received',sh.received+1,'expected',sh.expected);
end;
$$;

create function public.seps_undo(p_request_id uuid,p_event_id uuid,p_reason text) returns uuid
language plpgsql security definer set search_path='' as $$
declare ev public.seps_scan_events; prior public.seps_scan_events; staff_email text;
begin
 if not public.seps_is_staff() then raise exception 'Active staff access required' using errcode='42501'; end if;
 if p_request_id is null or length(trim(coalesce(p_reason,''))) not between 1 and 500 then raise exception 'A correction reason is required'; end if;
 perform pg_advisory_xact_lock(hashtextextended(p_request_id::text,0));
 select * into prior from public.seps_scan_events where id=p_request_id;
 if found then
  if prior.actor_id<>auth.uid() or prior.action<>'undo' or prior.original_event_id<>p_event_id or prior.reason<>trim(p_reason) then raise exception 'Correction request ID already used'; end if;
  return prior.id;
 end if;
 select * into ev from public.seps_scan_events where id=p_event_id for update;
 if not found or ev.action<>'receive' then raise exception 'Receipt not found'; end if;
 if ev.actor_id<>auth.uid() and not public.seps_is_admin() then raise exception 'You can only undo your own receipts' using errcode='42501'; end if;
 if exists(select 1 from public.seps_scan_events where original_event_id=ev.id) then raise exception 'Receipt already corrected'; end if;
 perform 1 from public.seps_shipments where id=ev.shipment_id for update;
 update public.seps_shipments set received=received-1 where id=ev.shipment_id;
 select email into staff_email from public.seps_staff where user_id=auth.uid();
 insert into public.seps_scan_events(id,session_id,shipment_id,actor_id,actor_email,action,delta,barcode,original_event_id,reason)
 values(p_request_id,ev.session_id,ev.shipment_id,auth.uid(),staff_email,'undo',-1,ev.barcode,ev.id,trim(p_reason));
 return p_request_id;
end;
$$;

create function public.seps_set_staff(p_user_id uuid,p_role text,p_active boolean) returns void
language plpgsql security definer set search_path='' as $$
declare target public.seps_staff;
begin
 -- One lock for all role changes prevents concurrent removal of the last administrator.
 perform pg_advisory_xact_lock(619483001);
 if not public.seps_is_admin() then raise exception 'Administrator access required' using errcode='42501'; end if;
 if p_role is null or p_role not in ('admin','staff') or p_active is null then raise exception 'Invalid staff role'; end if;
 select * into target from public.seps_staff where user_id=p_user_id for update;
 if not found then raise exception 'Staff member not found'; end if;
 if target.active and target.role='admin' and (not p_active or p_role<>'admin')
  and (select count(*) from public.seps_staff where active and role='admin')<=1 then
  raise exception 'Keep at least one active administrator';
 end if;
 update public.seps_staff set role=p_role,active=p_active where user_id=p_user_id;
end;
$$;

-- Functions default to PUBLIC execute in PostgreSQL: explicitly restrict every entry point.
revoke all on function public.seps_is_staff(),public.seps_is_admin(),public.seps_enroll_invited_user(),
 public.seps_create_session(uuid,text,text,text,boolean,jsonb),public.seps_receive(uuid,uuid,text),
 public.seps_undo(uuid,uuid,text),public.seps_set_staff(uuid,text,boolean) from public,anon,authenticated;
grant execute on function public.seps_is_staff(),public.seps_is_admin(),
 public.seps_create_session(uuid,text,text,text,boolean,jsonb),public.seps_receive(uuid,uuid,text),
 public.seps_undo(uuid,uuid,text),public.seps_set_staff(uuid,text,boolean) to authenticated;

-- Existing users are not silently granted access. Bootstrap the administrator separately.
commit;
