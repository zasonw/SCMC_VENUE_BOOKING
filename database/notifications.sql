-- Persistent in-app notifications. No email or push delivery is enabled.
create table venue_private.notifications (
 id uuid primary key default gen_random_uuid(),
 recipient uuid not null references auth.users(id) on delete cascade,
 booking_id uuid not null references venue_private.bookings(id) on delete cascade,
 audience text not null check(audience in ('owner','admin')),
 kind text not null, title text not null, room integer not null,
 starts_at timestamptz not null, status text not null,
 created_at timestamptz not null default now(), read_at timestamptz
);
alter table venue_private.notifications enable row level security;
revoke all on venue_private.notifications from public,anon,authenticated;
create index notifications_recipient_date on venue_private.notifications(recipient,created_at desc,id);
create function venue_private.notify_booking() returns trigger language plpgsql security invoker set search_path='' as $$
declare kind text;
begin
 if TG_OP='INSERT' then kind:='created';
 elsif (to_jsonb(new)-'history'-'is_exception') is not distinct from (to_jsonb(old)-'history'-'is_exception') then return new;
 elsif new.status is distinct from old.status then kind:=new.status;
 else kind:='changed'; end if;
 insert into venue_private.notifications(recipient,booking_id,audience,kind,title,room,starts_at,status)
 select recipient,new.id,audience,kind,new.title,new.room,new.starts_at,new.status from (
  select new.owner_id recipient,'owner'::text audience
  union all select id,'admin' from venue_private.members where is_admin and id<>new.owner_id
 ) recipients;
 return new;
end $$;
revoke all on function venue_private.notify_booking() from public,anon,authenticated;
create trigger booking_notifications after insert or update on venue_private.bookings for each row execute function venue_private.notify_booking();
create function venue_private.notifications_api(action text,payload jsonb default '{}') returns jsonb
language plpgsql security definer set search_path='' as $$
declare uid uuid:=auth.uid(); admin boolean; result jsonb;
begin
 if uid is null then raise exception 'Please sign in first.'; end if;
 if not exists(select 1 from auth.users where id=uid and email_confirmed_at is not null) then raise exception 'Verify your email before signing in.'; end if;
 select coalesce(is_admin,false) into admin from venue_private.members where id=uid;
 if action='read' then
  if jsonb_typeof(payload->'ids') is distinct from 'array' then raise exception 'Choose notifications.'; end if;
  if jsonb_array_length(payload->'ids')>100 then raise exception 'Too many notifications.'; end if;
  update venue_private.notifications set read_at=coalesce(read_at,now()) where recipient=uid and (audience='owner' or coalesce(admin,false)) and id in(select value::uuid from jsonb_array_elements_text(payload->'ids'));
 elsif action is distinct from 'list' then raise exception 'Unknown action.'; end if;
 select jsonb_build_object('unread',(select count(*) from venue_private.notifications where recipient=uid and read_at is null and (audience='owner' or coalesce(admin,false))),
  'items',coalesce((select jsonb_agg(to_jsonb(n) order by n.created_at desc,n.id) from (
   select id,booking_id,kind,title,room,to_char(starts_at at time zone 'Asia/Kuala_Lumpur','YYYY-MM-DD') date,
    to_char(starts_at at time zone 'Asia/Kuala_Lumpur','HH24:MI') start,status,created_at,read_at
   from venue_private.notifications where recipient=uid and (audience='owner' or coalesce(admin,false)) order by created_at desc,id limit 100
  ) n),'[]'::jsonb)) into result;
 return result;
end $$;
revoke all on function venue_private.notifications_api(text,jsonb) from public,anon;
grant execute on function venue_private.notifications_api(text,jsonb) to authenticated;
create function public.venue_notifications(action text,payload jsonb default '{}') returns jsonb
language sql security invoker set search_path='' as $$select venue_private.notifications_api(action,payload)$$;
revoke all on function public.venue_notifications(text,jsonb) from public,anon;
grant execute on function public.venue_notifications(text,jsonb) to authenticated;
