-- Apply once after schema.sql. Existing bookings retain their room IDs and status.
alter table venue_private.rooms drop constraint rooms_id_check;
alter table venue_private.rooms add constraint rooms_id_check check(id>0);
update venue_private.rooms set name=case id when 1 then '圣堂' when 2 then '副堂' when 3 then '新会议室' when 4 then '旧会议室' when 5 then 'Cafe' when 6 then '厨房' when 7 then '亲子室' when 8 then '喜乐1' end where id between 1 and 8;
insert into venue_private.rooms(id,name) values(9,'喜乐2');
create table venue_private.booking_series (
 id uuid primary key default gen_random_uuid(), owner_id uuid not null references auth.users(id),
 request_key uuid not null, rule jsonb not null, created_at timestamptz not null default now(),
 unique(owner_id,request_key)
);
alter table venue_private.booking_series enable row level security;
revoke all on venue_private.booking_series from public,anon,authenticated;
alter table venue_private.bookings add column series_id uuid references venue_private.booking_series(id);
create index bookings_series on venue_private.bookings(series_id) where series_id is not null;
create table venue_private.people (
 id uuid primary key default gen_random_uuid(), name text not null check(length(trim(name)) between 1 and 120),
 fellowships text[] not null default '{}', user_id uuid unique references auth.users(id) on delete set null,
 check(cardinality(fellowships)<=20), updated_at timestamptz not null default now()
);
alter table venue_private.people enable row level security;
revoke all on venue_private.people from public,anon,authenticated;

-- Generate dates on the server; browser-selected dates must belong to this result.
create function venue_private.repeat_dates(p jsonb) returns date[] language plpgsql security invoker set search_path='' as $$
declare first_day date:=(p->>'date')::date; last_day date:=(p->'repeat'->>'until')::date; freq text:=p->'repeat'->>'frequency'; pattern text:=p->'repeat'->>'monthly'; d date; dates date[]:='{}'; days jsonb:=p->'repeat'->'weekdays';
begin
 if first_day is null or last_day is null or last_day<first_day or first_day<(now() at time zone 'Asia/Kuala_Lumpur')::date or last_day>((now() at time zone 'Asia/Kuala_Lumpur')::date+interval '6 months')::date then raise exception 'Choose an end date within the next six months.'; end if;
 if freq not in ('weekly','monthly') or freq is null then raise exception 'Choose a repeat pattern.'; end if;
 if freq='weekly' then
  if jsonb_typeof(days) is distinct from 'array' then raise exception 'Choose at least one weekday.'; end if;
  if jsonb_array_length(days) not between 1 and 7 or exists(select 1 from jsonb_array_elements_text(days) v where v::int not between 0 and 6) then raise exception 'Choose at least one weekday.'; end if;
 elsif pattern is null or pattern not in ('date','weekday') then raise exception 'Choose a monthly pattern.'; end if;
 d:=first_day;
 while d<=last_day loop
  if (freq='weekly' and days @> jsonb_build_array(extract(dow from d)::int)) or
     (freq='monthly' and pattern='date' and extract(day from d)=extract(day from first_day)) or
     (freq='monthly' and pattern='weekday' and extract(dow from d)=extract(dow from first_day) and (extract(day from d)::int-1)/7=(extract(day from first_day)::int-1)/7) then dates:=array_append(dates,d); end if;
  d:=d+1;
 end loop;
 if cardinality(dates)=0 then raise exception 'No dates match this repeat pattern.'; end if;
 return dates;
end $$;
revoke all on function venue_private.repeat_dates(jsonb) from public,anon,authenticated;

create function venue_private.recurring_api(action text,payload jsonb default '{}') returns jsonb language plpgsql security definer set search_path='' as $$
declare uid uuid:=auth.uid(); is_admin boolean; st jsonb; dates date[]; selected_dates date[]; d date; sid uuid; bid uuid; key uuid; r record; count_changed int:=0; out jsonb:='[]'; ts timestamptz; te timestamptz; reason text; operation text; person_id uuid; tags text[];
begin
 if uid is null then raise exception 'Please sign in first.'; end if;
 st:=venue_private.api('state'); -- Verifies email, refreshes membership and takes the shared write lock.
 is_admin:=(st->>'admin')::boolean;
 if action in ('preview','create') then
  dates:=venue_private.repeat_dates(payload);
  if not exists(select 1 from venue_private.rooms where id=(payload->>'room')::int and enabled) then raise exception 'This room is not accepting bookings.'; end if;
  if (payload->>'start')::time<'06:00' or (payload->>'end')::time>'23:00' or (payload->>'end')::time<=(payload->>'start')::time or payload->>'start' is null or payload->>'end' is null then raise exception 'Choose a future time between 06:00 and 23:00.'; end if;
  if action='preview' then
   foreach d in array dates loop
    ts:=(d::text||'T'||(payload->>'start')||':00+08:00')::timestamptz;te:=(d::text||'T'||(payload->>'end')||':00+08:00')::timestamptz;
    reason:=case when ts<=now() then 'Past time' when exists(select 1 from venue_private.bookings b where b.room=(payload->>'room')::int and b.status in ('pending','confirmed','blocked') and tstzrange(b.starts_at,b.ends_at,'[)') && tstzrange(ts,te,'[)')) then 'Clash' else null end;
    out:=out||jsonb_build_array(jsonb_build_object('date',d,'available',reason is null,'reason',reason));
   end loop;
   return out;
  end if;
  if jsonb_typeof(payload->'dates') is distinct from 'array' then raise exception 'Select at least one available date.'; end if;
  select array_agg(distinct v::date order by v::date) into selected_dates from jsonb_array_elements_text(payload->'dates') v;
  if coalesce(cardinality(selected_dates),0)=0 or not selected_dates<@dates then raise exception 'Select valid dates from the preview.'; end if;
  key:=(payload->>'request_key')::uuid;
  if key is null then raise exception 'Please preview the dates again.'; end if;
  select id into sid from venue_private.booking_series where owner_id=uid and request_key=key;
  if sid is not null then return jsonb_build_object('series_id',sid,'existing',true); end if;
  insert into venue_private.booking_series(owner_id,request_key,rule) values(uid,key,payload->'repeat') returning id into sid;
  foreach d in array selected_dates loop
   bid:=(venue_private.api('save',(payload-'id'-'block')||jsonb_build_object('date',d,'block',false))->>'id')::uuid;
   update venue_private.bookings set series_id=sid where id=bid;
   count_changed:=count_changed+1;
  end loop;
  return jsonb_build_object('series_id',sid,'count',count_changed);
 elsif action='series_action' then
  sid:=(payload->>'series_id')::uuid;operation:=payload->>'operation';
  if not exists(select 1 from venue_private.booking_series where id=sid and (owner_id=uid or is_admin)) then raise exception 'Booking access denied.'; end if;
  if operation not in ('approve','cancel') or operation is null then raise exception 'Unknown action.'; end if;
  if operation='approve' and not is_admin then raise exception 'Admin access required.'; end if;
  for r in select id from venue_private.bookings where series_id=sid and
   ((operation='approve' and status='pending' and starts_at>now()) or
    (operation='cancel' and ((is_admin and status in ('pending','confirmed','blocked')) or (owner_id=uid and status='pending')))) order by starts_at,id for update loop
   perform venue_private.api(operation,jsonb_build_object('id',r.id));count_changed:=count_changed+1;
  end loop;
  if count_changed=0 then raise exception 'No eligible bookings in this series.'; end if;
  return jsonb_build_object('count',count_changed);
 elsif action='people' then
  if not is_admin then raise exception 'Admin access required.'; end if;
  return (select coalesce(jsonb_agg(jsonb_build_object('id',p.id,'name',p.name,'fellowships',p.fellowships,'user_id',p.user_id,'email',m.email) order by p.name),'[]') from venue_private.people p left join venue_private.members m on m.id=p.user_id);
 elsif action='save_person' then
  if not is_admin then raise exception 'Admin access required.'; end if;
  select coalesce(array_agg(distinct trim(v)) filter(where length(trim(v))>0),'{}') into tags from jsonb_array_elements_text(coalesce(payload->'fellowships','[]')) v;
  if cardinality(tags)>20 or exists(select 1 from unnest(tags) t where length(t)>120) then raise exception 'Use up to 20 short fellowship tags.'; end if;
  if nullif(payload->>'user_id','') is not null and not exists(select 1 from venue_private.members where id=(payload->>'user_id')::uuid) then raise exception 'Choose a registered account.'; end if;
  person_id:=nullif(payload->>'id','')::uuid;
  if person_id is null then
   insert into venue_private.people(name,fellowships,user_id) values(trim(payload->>'name'),tags,nullif(payload->>'user_id','')::uuid) returning id into person_id;
  else
   update venue_private.people set name=trim(payload->>'name'),fellowships=tags,user_id=nullif(payload->>'user_id','')::uuid,updated_at=now() where id=person_id;
   if not found then raise exception 'Person not found.'; end if;
  end if;
  return jsonb_build_object('id',person_id);
 elsif action='delete_person' then
  if not is_admin then raise exception 'Admin access required.'; end if;
  delete from venue_private.people where id=(payload->>'id')::uuid;
  return '{"ok":true}';
 end if;
 raise exception 'Unknown action.';
exception when unique_violation then raise exception 'This account is already linked to another person.';
end $$;
revoke all on function venue_private.recurring_api(text,jsonb) from public,anon,authenticated;
grant execute on function venue_private.recurring_api(text,jsonb) to authenticated;
create function public.venue_recurring(action text,payload jsonb default '{}') returns jsonb language sql security invoker set search_path='' as $$select venue_private.recurring_api(action,payload)$$;
revoke all on function public.venue_recurring(text,jsonb) from public,anon,authenticated;
grant execute on function public.venue_recurring(text,jsonb) to authenticated;
create or replace function venue_private.api(action text, payload jsonb default '{}') returns jsonb
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
    'id',b.id,'series_id',case when uid is not null then b.series_id else null end,'room',b.room,'date',to_char(b.starts_at at time zone 'Asia/Kuala_Lumpur','YYYY-MM-DD'),
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
