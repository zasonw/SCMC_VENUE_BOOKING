-- Explicit selected-date edits preserve exception markers. Existing scope behavior remains supported.
create or replace function venue_private.series_edit(action text,payload jsonb default '{}') returns jsonb
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
 if scope not in ('one','selected','future') or scope is null or op not in ('edit','cancel') or op is null then raise exception 'Choose an edit scope and operation.'; end if;
 select * into anchor from venue_private.bookings where id=(payload->>'id')::uuid for update;
 if not found or anchor.series_id is null or not(admin or anchor.owner_id=uid) then raise exception 'Booking access denied.'; end if;
 if anchor.starts_at<=now() or anchor.status not in ('pending','confirmed') then raise exception 'Choose an upcoming active occurrence.'; end if;
 if jsonb_typeof(patch)<>'object' or exists(select 1 from jsonb_object_keys(patch) k where k not in ('room','date','start','end','title','group','pic','contact','attendance','notes')) then raise exception 'Invalid changes.'; end if;
 if scope in ('selected','future') and patch ? 'date' then raise exception 'Change dates one occurrence at a time.'; end if;
 if action='apply' then
  if jsonb_typeof(payload->'ids') is distinct from 'array' then raise exception 'Select at least one available date.'; end if;
  select array_agg(distinct v::uuid) into requested from jsonb_array_elements_text(payload->'ids') v;
  if coalesce(cardinality(requested),0)=0 then raise exception 'Select at least one available date.'; end if;
 end if;
 for b in select * from venue_private.bookings
  where series_id=anchor.series_id and (admin or owner_id=uid) and starts_at>now() and status in ('pending','confirmed')
   and ((scope='one' and id=anchor.id) or (scope in ('selected','future') and starts_at>=anchor.starts_at))
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
     approval=case when moved then '' else approval end,is_exception=(scope in ('one','selected') or is_exception),
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
