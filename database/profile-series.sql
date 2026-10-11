-- Account defaults and transactional recurring exceptions. Apply after recurring-and-people.sql.
create table venue_private.booking_profiles (
 user_id uuid primary key references auth.users(id) on delete cascade,
 name text not null check(length(trim(name)) between 1 and 120),
 fellowship text not null default '' check(length(fellowship)<=120),
 contact text not null default '' check(length(contact)<=120)
);
alter table venue_private.booking_profiles enable row level security;
revoke all on venue_private.booking_profiles from public,anon,authenticated;
alter table venue_private.bookings add column is_exception boolean not null default false;
-- Existing individually edited dates should also be flagged.
update venue_private.bookings set is_exception=true
where series_id is not null and (history::text like '%Booking details updated%' or history::text like '%Booking rescheduled%');

create function venue_private.profile_api(action text,payload jsonb default '{}') returns jsonb
language plpgsql security definer set search_path='' as $$
declare uid uuid:=auth.uid(); st jsonb;
begin
 if uid is null then raise exception 'Please sign in first.'; end if;
 st:=venue_private.api('state');
 if action='save' then
  if length(trim(coalesce(payload->>'name',''))) not between 1 and 120
   or length(coalesce(payload->>'fellowship',''))>120 or length(coalesce(payload->>'contact',''))>120 then
   raise exception 'Enter a name and use at most 120 characters per field.';
  end if;
  insert into venue_private.booking_profiles(user_id,name,fellowship,contact)
  values(uid,trim(payload->>'name'),trim(coalesce(payload->>'fellowship','')),trim(coalesce(payload->>'contact','')))
  on conflict(user_id) do update set name=excluded.name,fellowship=excluded.fellowship,contact=excluded.contact;
 elsif action<>'get' then raise exception 'Unknown action.';
 end if;
 return coalesce((select to_jsonb(p)-'user_id' from venue_private.booking_profiles p where user_id=uid),'{}'::jsonb);
end $$;
revoke all on function venue_private.profile_api(text,jsonb) from public,anon;
grant execute on function venue_private.profile_api(text,jsonb) to authenticated;
create function public.venue_profile(action text,payload jsonb default '{}') returns jsonb
language sql security invoker set search_path='' as $$select venue_private.profile_api(action,payload)$$;
revoke all on function public.venue_profile(text,jsonb) from public,anon;
grant execute on function public.venue_profile(text,jsonb) to authenticated;

create function venue_private.series_edit(action text,payload jsonb default '{}') returns jsonb
language plpgsql security definer set search_path='' as $$
declare
 uid uuid:=auth.uid(); st jsonb; admin boolean; anchor venue_private.bookings%rowtype; b venue_private.bookings%rowtype;
 scope text:=payload->>'scope'; op text:=payload->>'operation'; patch jsonb:=coalesce(payload->'patch','{}');
 rows jsonb:='[]'; entry jsonb; changed int:=0; requested uuid[]; eligible uuid[]:='{}';
 target_room int; ts timestamptz; te timestamptz; d date; reason text; moved boolean; fp text;
begin
 if uid is null then raise exception 'Please sign in first.'; end if;
 st:=venue_private.api('state'); -- verified identity + shared transaction lock used by all booking writers
 admin:=(st->>'admin')::boolean;
 if action not in ('preview','apply') or action is null then raise exception 'Unknown action.'; end if;
 if scope not in ('one','future') or scope is null or op not in ('edit','cancel') or op is null then raise exception 'Choose an edit scope and operation.'; end if;
 select * into anchor from venue_private.bookings where id=(payload->>'id')::uuid for update;
 if not found or anchor.series_id is null or not(admin or anchor.owner_id=uid) then raise exception 'Booking access denied.'; end if;
 if anchor.starts_at<=now() or anchor.status not in ('pending','confirmed') then raise exception 'Choose an upcoming active occurrence.'; end if;
 if jsonb_typeof(patch)<>'object' or exists(select 1 from jsonb_object_keys(patch) k where k not in ('room','date','start','end','title','group','pic','contact','attendance','notes')) then raise exception 'Invalid changes.'; end if;
 if scope='future' and patch ? 'date' then raise exception 'Change dates one occurrence at a time.'; end if;
 if action='apply' then
  if jsonb_typeof(payload->'ids') is distinct from 'array' then raise exception 'Select at least one available date.'; end if;
  select array_agg(distinct v::uuid) into requested from jsonb_array_elements_text(payload->'ids') v;
  if coalesce(cardinality(requested),0)=0 then raise exception 'Select at least one available date.'; end if;
 end if;
 for b in select * from venue_private.bookings
  where series_id=anchor.series_id and (admin or owner_id=uid) and starts_at>now() and status in ('pending','confirmed')
   and ((scope='one' and id=anchor.id) or (scope='future' and starts_at>=anchor.starts_at))
  order by starts_at,id for update
 loop
  eligible:=array_append(eligible,b.id); fp:=md5(to_jsonb(b)::text);
  target_room:=case when patch ? 'room' then (patch->>'room')::int else b.room end;
  d:=case when patch ? 'date' then (patch->>'date')::date else (b.starts_at at time zone 'Asia/Kuala_Lumpur')::date end;
  ts:=(d::text||'T'||coalesce(patch->>'start',to_char(b.starts_at at time zone 'Asia/Kuala_Lumpur','HH24:MI'))||':00+08:00')::timestamptz;
  te:=(d::text||'T'||coalesce(patch->>'end',to_char(b.ends_at at time zone 'Asia/Kuala_Lumpur','HH24:MI'))||':00+08:00')::timestamptz;
  reason:=null;
  if op='edit' then
   if target_room is null or not exists(select 1 from venue_private.rooms where id=target_room and enabled) then reason:='This room is not accepting bookings.';
   elsif ts is null or te is null or ts<=now() or te<=ts or (ts at time zone 'Asia/Kuala_Lumpur')::time<'06:00' or (te at time zone 'Asia/Kuala_Lumpur')::time>'23:00' or (ts at time zone 'Asia/Kuala_Lumpur')::date<>(te at time zone 'Asia/Kuala_Lumpur')::date then reason:='Choose a future time between 06:00 and 23:00.';
   elsif exists(select 1 from venue_private.bookings x where x.id<>b.id and x.room=target_room and x.status in ('pending','confirmed','blocked') and tstzrange(x.starts_at,x.ends_at,'[)')&&tstzrange(ts,te,'[)')) then reason:='Clash';
   end if;
   if length(trim(coalesce(patch->>'title',b.title))) not between 1 and 120 or length(trim(coalesce(patch->>'group',b.group_name))) not between 1 and 120 or length(trim(coalesce(patch->>'pic',b.pic))) not between 1 and 120
    or length(coalesce(patch->>'contact',b.contact))>120 or length(coalesce(patch->>'notes',b.notes))>1500 then raise exception 'Please enter the activity, group and PIC.'; end if;
  end if;
  moved:=b.room is distinct from target_room or b.starts_at is distinct from ts or b.ends_at is distinct from te;
  rows:=rows||jsonb_build_array(jsonb_build_object('id',b.id,'version',fp,'date',to_char(b.starts_at at time zone 'Asia/Kuala_Lumpur','YYYY-MM-DD'),'new_date',d,'room',target_room,'start',to_char(ts at time zone 'Asia/Kuala_Lumpur','HH24:MI'),'end',to_char(te at time zone 'Asia/Kuala_Lumpur','HH24:MI'),'available',reason is null,'reason',reason,'exception',b.is_exception,'reapproval',op='edit' and moved));
  if action='apply' and b.id=any(requested) then
   if payload->'versions'->>b.id::text is distinct from fp then raise exception 'Booking changed. Preview again.'; end if;
   if reason is not null then raise exception 'One or more dates conflict. Preview again.'; end if;
   if op='cancel' then
    update venue_private.bookings set status='cancelled',is_exception=true,history=history||jsonb_build_array(jsonb_build_object('at',extract(epoch from now())*1000,'text','Occurrence cancelled · '||coalesce(st->>'name',''),'by',uid)) where id=b.id;
   else
    update venue_private.bookings set room=target_room,starts_at=ts,ends_at=te,
     title=coalesce(patch->>'title',title),group_name=coalesce(patch->>'group',group_name),pic=coalesce(patch->>'pic',pic),
     contact=coalesce(patch->>'contact',contact),notes=coalesce(patch->>'notes',notes),
     attendance=case when patch ? 'attendance' then nullif(patch->>'attendance','')::int else attendance end,
     status=case when moved then 'pending' else status end,created_at=case when moved then now() else created_at end,
     approval=case when moved then '' else approval end,is_exception=(scope='one' or is_exception),
     history=history||jsonb_build_array(jsonb_build_object('at',extract(epoch from now())*1000,'text',case when moved then 'Occurrence rescheduled; approval window restarted' else 'Occurrence details updated' end,'by',uid,'scope',scope))
     where id=b.id;
   end if;
   changed:=changed+1;
  end if;
 end loop;
 if action='apply' then
  if not requested<@eligible or changed<>cardinality(requested) then raise exception 'Booking changed. Preview again.'; end if;
  return jsonb_build_object('count',changed);
 end if;
 return rows;
exception when exclusion_violation then raise exception 'One or more dates conflict. Preview again.';
end $$;
revoke all on function venue_private.series_edit(text,jsonb) from public,anon;
grant execute on function venue_private.series_edit(text,jsonb) to authenticated;
create function public.venue_series_edit(action text,payload jsonb default '{}') returns jsonb
language sql security invoker set search_path='' as $$select venue_private.series_edit(action,payload)$$;
revoke all on function public.venue_series_edit(text,jsonb) from public,anon;
grant execute on function public.venue_series_edit(text,jsonb) to authenticated;

CREATE OR REPLACE FUNCTION venue_private.api(action text, payload jsonb DEFAULT '{}'::jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
   'profile',coalesce((select to_jsonb(p)-'user_id' from venue_private.booking_profiles p where p.user_id=uid),'{}'::jsonb),
   'rooms',(select coalesce(jsonb_agg(to_jsonb(r) order by r.id),'[]') from venue_private.rooms r),
   'bookings',(select coalesce(jsonb_agg(jsonb_build_object(
    'id',b.id,'is_exception',b.is_exception,'booked_by',case when admin or b.owner_id=uid then (select m.name from venue_private.members m where m.id=b.owner_id) else '' end,'series_id',case when uid is not null then b.series_id else null end,'room',b.room,'date',to_char(b.starts_at at time zone 'Asia/Kuala_Lumpur','YYYY-MM-DD'),
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
  if jsonb_array_length(payload->'rooms')<>(select count(*) from venue_private.rooms) or (select count(distinct lower(trim(value->>'name'))) from jsonb_array_elements(payload->'rooms'))<>(select count(*) from venue_private.rooms) or (select count(distinct (value->>'id')::int) from jsonb_array_elements(payload->'rooms') where (value->>'id')::int in (select id from venue_private.rooms))<>(select count(*) from venue_private.rooms) then raise exception 'Please use a unique, non-empty name for each room.'; end if;
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
  if old.series_id is not null and old.starts_at<=now() then raise exception 'Choose an upcoming active occurrence.'; end if;
  if not admin and moved and old.status='confirmed' and old.series_id is null then raise exception 'Ask an admin to reschedule a confirmed booking.'; end if;
  if coalesce((payload->>'block')::boolean,false) and not admin then raise exception 'Admin access required.'; end if;
  if bid is null then
   insert into venue_private.bookings(owner_id,room,starts_at,ends_at,title,group_name,pic,contact,attendance,notes,status,history)
    values(uid,room_id,ts,te,trim(payload->>'title'),trim(payload->>'group'),trim(payload->>'pic'),coalesce(payload->>'contact',''),nullif(payload->>'attendance','')::int,coalesce(payload->>'notes',''),case when admin and coalesce((payload->>'block')::boolean,false) then 'blocked' else 'pending' end,jsonb_build_array(jsonb_build_object('at',extract(epoch from now())*1000,'text','Booking submitted; slot reserved'))) returning id into bid;
  else
   update venue_private.bookings set is_exception=(is_exception or series_id is not null),room=room_id,starts_at=ts,ends_at=te,title=trim(payload->>'title'),group_name=trim(payload->>'group'),pic=trim(payload->>'pic'),contact=coalesce(payload->>'contact',''),attendance=nullif(payload->>'attendance','')::int,notes=coalesce(payload->>'notes',''),status=case when moved then 'pending' else status end,created_at=case when moved then now() else created_at end,approval=case when moved then '' else approval end,history=history||jsonb_build_array(jsonb_build_object('at',extract(epoch from now())*1000,'text',case when moved then 'Booking rescheduled; approval window restarted' else 'Booking details updated' end)) where id=bid;
  end if;
  return jsonb_build_object('id',bid);
 elsif action in ('approve','reject','cancel') then
  bid:=(payload->>'id')::uuid;
  select * into old from venue_private.bookings where id=bid for update;
  if not found then raise exception 'Booking not found.'; end if;
  if action='cancel' then
   if old.series_id is not null and old.starts_at<=now() then raise exception 'Choose an upcoming active occurrence.'; end if;
   if not (admin or (old.owner_id=uid and (old.status='pending' or (old.series_id is not null and old.status='confirmed' and old.starts_at>now())))) or old.status not in ('pending','confirmed','blocked') then raise exception 'Confirmed bookings need an admin to cancel.'; end if;
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
end $function$

;
