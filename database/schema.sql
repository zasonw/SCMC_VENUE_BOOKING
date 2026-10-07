-- SCMC booking backend. Apply once to a fresh Supabase project.
create schema if not exists venue_private;
revoke all on schema venue_private from public;
grant usage on schema venue_private to anon, authenticated;
create extension if not exists btree_gist with schema extensions;
create extension if not exists pg_cron with schema pg_catalog;

create table venue_private.admin_bootstrap (email text primary key, claimed boolean not null default false);
create table venue_private.members (
 id uuid primary key references auth.users(id) on delete cascade,
 email text not null, name text not null, is_admin boolean not null default false
);
create table venue_private.rooms (id integer primary key check(id between 1 and 8), name text not null check(length(trim(name)) between 1 and 40), enabled boolean not null default true);
insert into venue_private.rooms select n, 'Room '||n, true from generate_series(1,8) n;
create table venue_private.bookings (
 id uuid primary key default gen_random_uuid(), owner_id uuid not null references auth.users(id),
 room integer not null references venue_private.rooms(id), starts_at timestamptz not null, ends_at timestamptz not null,
 title text not null check(length(trim(title)) between 1 and 120), group_name text not null check(length(trim(group_name)) between 1 and 120),
 pic text not null check(length(trim(pic)) between 1 and 120), contact text not null default '' check(length(contact)<=120),
 attendance integer check(attendance>0), notes text not null default '' check(length(notes)<=1500),
 status text not null default 'pending' check(status in ('pending','confirmed','blocked','cancelled','rejected','expired')),
 created_at timestamptz not null default now(), approval text not null default '', reason text not null default '' check(length(reason)<=500),
 history jsonb not null default '[]', check(ends_at>starts_at),
 exclude using gist(room with =, tstzrange(starts_at,ends_at,'[)') with &&) where(status in ('pending','confirmed','blocked'))
);
create index bookings_owner on venue_private.bookings(owner_id);
create index bookings_pending on venue_private.bookings(created_at) where status='pending';
alter table venue_private.admin_bootstrap enable row level security;
alter table venue_private.members enable row level security;
alter table venue_private.rooms enable row level security;
alter table venue_private.bookings enable row level security;
revoke all on all tables in schema venue_private from public, anon, authenticated;

-- Internal scheduled work has no client EXECUTE grant and runs as the job owner.
create function venue_private.process_approvals() returns void language plpgsql security invoker set search_path='' as $$
begin
 update venue_private.bookings set status='expired', history=history||jsonb_build_array(jsonb_build_object('at',extract(epoch from now())*1000,'text','Expired: start time passed without confirmation')) where status='pending' and starts_at<=now();
 update venue_private.bookings set status='confirmed', approval='Automatic', history=history||jsonb_build_array(jsonb_build_object('at',extract(epoch from now())*1000,'text','Automatically approved after 48 hours')) where status='pending' and created_at<=now()-interval '48 hours' and starts_at>now();
end $$;
revoke all on function venue_private.process_approvals() from public, anon, authenticated;
select cron.schedule('venue-approval-every-minute','* * * * *','select venue_private.process_approvals()');

-- Privileged implementation is private; every operation checks authenticated identity.
-- Only the calendar state action is intentionally anonymous, returning occupancy only.
create function venue_private.api(action text, payload jsonb default '{}') returns jsonb
language plpgsql security definer set search_path='' as $$
declare
 uid uuid := auth.uid(); admin boolean := false; verified boolean := false; email_address text; display_name text;
 old venue_private.bookings%rowtype; bid uuid; room_id integer; ts timestamptz; te timestamptz;
 moved boolean; target uuid; desired boolean; result jsonb; actor text; item jsonb;
begin
 if uid is not null then
  select u.email, u.email_confirmed_at is not null, coalesce(nullif(trim(u.raw_user_meta_data->>'name'),''),split_part(u.email,'@',1)) into email_address,verified,display_name from auth.users u where u.id=uid;
  if not coalesce(verified,false) then raise exception 'Verify your email before signing in.'; end if;
  perform pg_advisory_xact_lock(824731);
  insert into venue_private.members(id,email,name) values(uid,email_address,left(display_name,120)) on conflict(id) do update set email=excluded.email;
  -- Bootstrap and role edits use the same lock so the last admin is retained.
  if exists(select 1 from venue_private.admin_bootstrap where lower(email)=lower(email_address) and not claimed) then
   update venue_private.members set is_admin=true where id=uid;
   update venue_private.admin_bootstrap set claimed=true where lower(email)=lower(email_address);
  end if;
  select m.is_admin,m.name into admin,actor from venue_private.members m where m.id=uid;
 end if;
 if action='state' then
  select jsonb_build_object(
   'admin',admin, 'name',coalesce(actor,''),
   'rooms',(select coalesce(jsonb_agg(to_jsonb(r) order by r.id),'[]') from venue_private.rooms r),
   'bookings',(select coalesce(jsonb_agg(jsonb_build_object(
    'id',b.id,'room',b.room,'date',to_char(b.starts_at at time zone 'Asia/Kuala_Lumpur','YYYY-MM-DD'),
    'start',to_char(b.starts_at at time zone 'Asia/Kuala_Lumpur','HH24:MI'),'end',to_char(b.ends_at at time zone 'Asia/Kuala_Lumpur','HH24:MI'),
    'title',case when uid is null then 'Booked' else b.title end,'group',case when uid is null then '' else b.group_name end,
    'pic',case when uid is null then '' else b.pic end,'status',b.status,'owner',case when b.owner_id=uid then 'member' else 'other' end,
    'contact',case when admin or b.owner_id=uid then b.contact else '' end,'attendance',case when uid is not null then b.attendance else null end,
    'notes',case when admin or b.owner_id=uid then b.notes else '' end,'created',extract(epoch from b.created_at)*1000,
    'approval',b.approval,'reason',case when admin or b.owner_id=uid then b.reason else '' end,
    'history',case when admin or b.owner_id=uid then b.history else '[]'::jsonb end
   ) order by b.starts_at),'[]') from venue_private.bookings b where admin or b.owner_id=uid or b.status in ('pending','confirmed','blocked'))
  ) into result; return result;
 end if;
 if uid is null then raise exception 'Please sign in first.'; end if;
 if action='users' then
  if not admin then raise exception 'Admin access required.'; end if;
  return (select coalesce(jsonb_agg(to_jsonb(m) order by m.email),'[]') from venue_private.members m);
 elsif action='set_admin' then
  if not admin then raise exception 'Admin access required.'; end if;
  target:=(payload->>'id')::uuid; desired:=(payload->>'admin')::boolean;
  if desired is null then raise exception 'Choose an access level.'; end if;
  if not exists(select 1 from venue_private.members where id=target) then raise exception 'User not found.'; end if;
  if not desired and (select is_admin from venue_private.members where id=target) and (select count(*) from venue_private.members where is_admin)<=1 then raise exception 'Keep at least one admin.'; end if;
  update venue_private.members set is_admin=desired where id=target;
  return '{"ok":true}';
 elsif action='rooms' then
  if not admin then raise exception 'Admin access required.'; end if;
  if jsonb_array_length(payload->'rooms')<>8 or (select count(distinct lower(trim(value->>'name'))) from jsonb_array_elements(payload->'rooms'))<>8 or (select count(distinct (value->>'id')::int) from jsonb_array_elements(payload->'rooms') where (value->>'id')::int between 1 and 8)<>8 then raise exception 'Please use a unique, non-empty name for each room.'; end if;
  for item in select value from jsonb_array_elements(payload->'rooms') loop
   update venue_private.rooms set name=trim(item->>'name'),enabled=(item->>'enabled')::boolean where id=(item->>'id')::int;
  end loop; return '{"ok":true}';
 elsif action='save' then
  if nullif(payload->>'id','') is not null then
   bid:=(payload->>'id')::uuid;
   select * into old from venue_private.bookings where id=bid for update;
   if not found or not (admin or old.owner_id=uid) then raise exception 'Booking access denied.'; end if;
   if old.status not in ('pending','confirmed') then raise exception 'This booking cannot be edited.'; end if;
  end if;
  room_id:=(payload->>'room')::int;
  ts:=((payload->>'date')||'T'||(payload->>'start')||':00+08:00')::timestamptz;
  te:=((payload->>'date')||'T'||(payload->>'end')||':00+08:00')::timestamptz;
  if ts is null or te is null or ts<=now() or te<=ts or (ts at time zone 'Asia/Kuala_Lumpur')::time<'06:00'::time or (te at time zone 'Asia/Kuala_Lumpur')::time>'23:00'::time or (ts at time zone 'Asia/Kuala_Lumpur')::date<>(te at time zone 'Asia/Kuala_Lumpur')::date then raise exception 'Choose a future time between 06:00 and 23:00.'; end if;
  if not exists(select 1 from venue_private.rooms where id=room_id and enabled) then raise exception 'This room is not accepting bookings.'; end if;
  moved:=bid is not null and (old.room<>room_id or old.starts_at<>ts or old.ends_at<>te);
  if not admin and moved and old.status='confirmed' then raise exception 'Ask an admin to reschedule a confirmed booking.'; end if;
  if coalesce((payload->>'block')::boolean,false) and not admin then raise exception 'Admin access required.'; end if;
  if bid is null then
   insert into venue_private.bookings(owner_id,room,starts_at,ends_at,title,group_name,pic,contact,attendance,notes,status,history)
    values(uid,room_id,ts,te,trim(payload->>'title'),trim(payload->>'group'),trim(payload->>'pic'),coalesce(payload->>'contact',''),nullif(payload->>'attendance','')::int,coalesce(payload->>'notes',''),case when admin and coalesce((payload->>'block')::boolean,false) then 'blocked' else 'pending' end,jsonb_build_array(jsonb_build_object('at',extract(epoch from now())*1000,'text','Booking submitted; slot reserved'))) returning id into bid;
  else
   update venue_private.bookings set room=room_id,starts_at=ts,ends_at=te,title=trim(payload->>'title'),group_name=trim(payload->>'group'),pic=trim(payload->>'pic'),contact=coalesce(payload->>'contact',''),attendance=nullif(payload->>'attendance','')::int,notes=coalesce(payload->>'notes',''),status=case when moved then 'pending' else status end,created_at=case when moved then now() else created_at end,approval=case when moved then '' else approval end,history=history||jsonb_build_array(jsonb_build_object('at',extract(epoch from now())*1000,'text',case when moved then 'Booking rescheduled; approval window restarted' else 'Booking details updated' end)) where id=bid;
  end if;
  return jsonb_build_object('id',bid);
 elsif action in ('approve','reject','cancel') then
  bid:=(payload->>'id')::uuid;
  select * into old from venue_private.bookings where id=bid for update;
  if not found then raise exception 'Booking not found.'; end if;
  if action='cancel' then
   if not (admin or (old.owner_id=uid and old.status='pending')) or old.status not in ('pending','confirmed','blocked') then raise exception 'Confirmed bookings need an admin to cancel.'; end if;
  else
   if not admin then raise exception 'Admin access required.'; end if;
   if old.status<>'pending' or old.starts_at<=now() then raise exception 'This request is no longer pending or has already started.'; end if;
   if action='reject' and length(trim(coalesce(payload->>'reason','')))=0 then raise exception 'Please provide a reason.'; end if;
  end if;
  update venue_private.bookings set status=case action when 'cancel' then 'cancelled' when 'approve' then 'confirmed' else 'rejected' end,
   approval=case when action='approve' then 'Admin' else approval end,
   reason=case when action='reject' then payload->>'reason' else reason end,
   history=history||jsonb_build_array(jsonb_build_object('at',extract(epoch from now())*1000,'text',action||' · '||actor)) where id=bid;
  return '{"ok":true}';
 end if;
 raise exception 'Unknown action.';
exception when exclusion_violation then raise exception 'This room is already held or booked during that time. Choose another time or venue.';
end $$;
revoke all on function venue_private.api(text,jsonb) from public;
grant execute on function venue_private.api(text,jsonb) to anon,authenticated;
create function public.venue_api(action text,payload jsonb default '{}') returns jsonb language sql security invoker set search_path='' as $$ select venue_private.api(action,payload) $$;
revoke all on function public.venue_api(text,jsonb) from public;
grant execute on function public.venue_api(text,jsonb) to anon,authenticated;
