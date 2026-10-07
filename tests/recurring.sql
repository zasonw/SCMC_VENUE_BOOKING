-- Transactional checks: rollback leaves all real bookings and directory entries unchanged.
begin;
do $$
declare
 a uuid:=gen_random_uuid(); b uuid:=gen_random_uuid(); c uuid:=gen_random_uuid(); sid uuid; sid2 uuid; bid uuid; person uuid;
 first_day date:=(now() at time zone 'Asia/Kuala_Lumpur')::date+14; d date; dates date[]; v jsonb; rows jsonb; selected_dates jsonb;
 failed boolean; n int; key uuid:=gen_random_uuid();
begin
 insert into auth.users(id,email,email_confirmed_at,raw_user_meta_data) values(a,'rec-admin@example.invalid',now(),'{}'),(b,'rec-member@example.invalid',now(),'{}'),(c,'rec-other@example.invalid',now(),'{}');
 insert into venue_private.members values(a,'rec-admin@example.invalid','Admin',true);
 perform set_config('request.jwt.claim.sub',b::text,true);
 v:=jsonb_build_object('date',first_day,'start','08:00','end','09:00','room',9,'title','Recurring test','group','Test fellowship','pic','Tester','repeat',jsonb_build_object('frequency','weekly','until',first_day+14,'weekdays',jsonb_build_array(extract(dow from first_day)::int)));
 dates:=venue_private.repeat_dates(v);if cardinality(dates)<>3 then raise exception 'TEST weekly dates';end if;
 rows:=public.venue_recurring('preview',v);if jsonb_array_length(rows)<>3 or exists(select 1 from jsonb_array_elements(rows) e where not (e->>'available')::boolean) then raise exception 'TEST preview';end if;
 bid:=(public.venue_api('save',v||jsonb_build_object('date',first_day+7))->>'id')::uuid;
 rows:=public.venue_recurring('preview',v);if (rows->1->>'reason')<>'Clash' then raise exception 'TEST clash not shown';end if;
 -- A conflict anywhere rolls back the entire create, including its series record.
 failed:=false;begin perform public.venue_recurring('create',v||jsonb_build_object('dates',to_jsonb(dates),'request_key',key));exception when others then failed:=true;end;
 if not failed or exists(select 1 from venue_private.booking_series where request_key=key) then raise exception 'TEST atomic rollback';end if;
 selected_dates:=jsonb_build_array(first_day,first_day+14);
 sid:=(public.venue_recurring('create',v||jsonb_build_object('dates',selected_dates,'request_key',key))->>'series_id')::uuid;
 if (select count(*) from venue_private.bookings where series_id=sid)<>2 then raise exception 'TEST skipped clash';end if;
 perform public.venue_recurring('create',v||jsonb_build_object('dates',selected_dates,'request_key',key));
 if (select count(*) from venue_private.bookings where series_id=sid)<>2 then raise exception 'TEST duplicate request';end if;
 failed:=false;begin perform public.venue_recurring('create',v||jsonb_build_object('dates',jsonb_build_array(first_day+1),'request_key',gen_random_uuid()));exception when others then failed:=true;end;if not failed then raise exception 'TEST injected date';end if;
 failed:=false;begin perform public.venue_recurring('series_action',jsonb_build_object('series_id',sid,'operation','approve'));exception when others then failed:=true;end;if not failed then raise exception 'TEST member approval';end if;
 perform set_config('request.jwt.claim.sub',c::text,true);
 failed:=false;begin perform public.venue_recurring('series_action',jsonb_build_object('series_id',sid,'operation','cancel'));exception when others then failed:=true;end;if not failed then raise exception 'TEST other series cancel';end if;
 perform set_config('request.jwt.claim.sub',a::text,true);
 select id into bid from venue_private.bookings where series_id=sid order by starts_at limit 1;
 perform public.venue_api('approve',jsonb_build_object('id',bid));
 perform set_config('request.jwt.claim.sub',b::text,true);
 perform public.venue_recurring('series_action',jsonb_build_object('series_id',sid,'operation','cancel'));
 if (select count(*) from venue_private.bookings where series_id=sid and status='confirmed')<>1 or (select count(*) from venue_private.bookings where series_id=sid and status='cancelled')<>1 then raise exception 'TEST pending only cancel';end if;
 perform set_config('request.jwt.claim.sub',a::text,true);
 perform public.venue_recurring('series_action',jsonb_build_object('series_id',sid,'operation','cancel'));
 if exists(select 1 from venue_private.bookings where series_id=sid and status<>'cancelled') then raise exception 'TEST admin cancel confirmed';end if;
 perform set_config('request.jwt.claim.sub',b::text,true);
 sid2:=(public.venue_recurring('create',v||jsonb_build_object('dates',selected_dates,'request_key',gen_random_uuid()))->>'series_id')::uuid;
 perform set_config('request.jwt.claim.sub',a::text,true);
 perform public.venue_recurring('series_action',jsonb_build_object('series_id',sid2,'operation','approve'));
 if exists(select 1 from venue_private.bookings where series_id=sid2 and status<>'confirmed') then raise exception 'TEST approve series';end if;
 -- Monthly dates skip nonexistent days; weekday mode retains ordinal and weekday.
 select x::date into d from generate_series(first_day::timestamp,(first_day+60)::timestamp,interval '1 day') x where extract(day from x)=31 limit 1;
 v:=jsonb_build_object('date',d,'repeat',jsonb_build_object('frequency','monthly','monthly','date','until',((now() at time zone 'Asia/Kuala_Lumpur')::date+interval '6 months')::date));
 dates:=venue_private.repeat_dates(v);if exists(select 1 from unnest(dates) x where extract(day from x)<>31) then raise exception 'TEST monthly 31st';end if;
 v:=jsonb_set(v,'{repeat,monthly}','"weekday"');dates:=venue_private.repeat_dates(v);
 if exists(select 1 from unnest(dates) x where extract(dow from x)<>extract(dow from d) or (extract(day from x)::int-1)/7<>(extract(day from d)::int-1)/7) then raise exception 'TEST monthly weekday';end if;
 failed:=false;begin perform venue_private.repeat_dates(jsonb_set(v,'{repeat,until}',to_jsonb((now()+interval '7 months')::date)));exception when others then failed:=true;end;if not failed then raise exception 'TEST six month bound';end if;
 person:=(public.venue_recurring('save_person',jsonb_build_object('name','Test Person','fellowships',jsonb_build_array('Youth','Choir','Youth'),'user_id',b))->>'id')::uuid;
 if (select cardinality(fellowships) from venue_private.people where id=person)<>2 then raise exception 'TEST tag dedup';end if;
 if (select is_admin from venue_private.members where id=b) then raise exception 'TEST linking grants admin';end if;
 perform set_config('request.jwt.claim.sub',b::text,true);
 failed:=false;begin perform public.venue_recurring('people');exception when others then failed:=true;end;if not failed then raise exception 'TEST directory privacy';end if;
 failed:=false;begin perform public.venue_recurring('save_person',jsonb_build_object('id',person,'name','Changed'));exception when others then failed:=true;end;if not failed then raise exception 'TEST directory mutation';end if;
 perform set_config('request.jwt.claim.sub',a::text,true);
 perform public.venue_recurring('delete_person',jsonb_build_object('id',person));
 if not exists(select 1 from auth.users where id=b) then raise exception 'TEST deleted login';end if;
 if (select count(*) from venue_private.rooms)<>9 then raise exception 'TEST room count';end if;
 perform venue_private.api('rooms',jsonb_build_object('rooms',(select jsonb_agg(to_jsonb(r)) from venue_private.rooms r)));
end $$;
set local role anon;
do $$begin
 if has_function_privilege(current_user,'public.venue_recurring(text,jsonb)','execute') then raise exception 'TEST anonymous series RPC';end if;
 if has_table_privilege(current_user,'venue_private.people','SELECT') then raise exception 'TEST raw directory';end if;
end $$;
rollback;
select 'PASS: repeat patterns, six-month limit, preview clashes, atomic save, idempotency, series permissions, people tags, privacy and nine rooms' as result;
