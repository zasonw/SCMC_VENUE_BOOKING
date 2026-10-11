begin;
do $$
declare a uuid:=gen_random_uuid(); b uuid:=gen_random_uuid(); sid uuid:=gen_random_uuid();
 x uuid:=gen_random_uuid(); y uuid:=gen_random_uuid(); z uuid:=gen_random_uuid(); held uuid:=gen_random_uuid();
 d date:=(now() at time zone 'Asia/Kuala_Lumpur')::date+14; p jsonb; r jsonb; v jsonb; failed boolean;
 room_a int; room_b int;
begin
 select coalesce(max(id),0)+1 into room_a from venue_private.rooms;room_b:=room_a+1;
 insert into venue_private.rooms(id,name) values(room_a,'Test A'),(room_b,'Test B');
 insert into auth.users(id,email,email_confirmed_at,raw_user_meta_data) values(a,'profile-a@example.invalid',now(),'{}'),(b,'profile-b@example.invalid',now(),'{}');
 perform set_config('request.jwt.claim.sub',a::text,true);
 perform public.venue_profile('save','{"name":"Person A","fellowship":"乐龄团契","contact":"123"}');
 if public.venue_profile('get')->>'name'<>'Person A' then raise exception 'TEST profile save';end if;
 perform set_config('request.jwt.claim.sub',b::text,true);
 if public.venue_profile('get')<>'{}'::jsonb or public.venue_api('state')->'profile'<>'{}'::jsonb then raise exception 'TEST profile privacy';end if;
 perform set_config('request.jwt.claim.sub',a::text,true);
 insert into venue_private.booking_series(id,owner_id,request_key,rule) values(sid,a,gen_random_uuid(),'{}');
 insert into venue_private.bookings(id,owner_id,series_id,room,starts_at,ends_at,title,group_name,pic,status) values
 (x,a,sid,room_a,(d||' 09:00+08')::timestamptz,(d||' 10:00+08')::timestamptz,'Test','Test','A','confirmed'),
 (y,a,sid,room_a,((d+7)||' 09:00+08')::timestamptz,((d+7)||' 10:00+08')::timestamptz,'Test','Test','A','confirmed'),
 (z,a,sid,room_a,((d+14)||' 09:00+08')::timestamptz,((d+14)||' 10:00+08')::timestamptz,'Test','Test','A','cancelled');
 p:=jsonb_build_object('id',x,'scope','one','operation','edit','patch',jsonb_build_object('pic','Other PIC','contact',''));
 r:=public.venue_series_edit('preview',p);
 perform public.venue_series_edit('apply',p||jsonb_build_object('ids',jsonb_build_array(x),'versions',jsonb_build_object(x::text,r->0->>'version')));
 if (select status from venue_private.bookings where id=x)<>'confirmed' or not(select is_exception from venue_private.bookings where id=x) then raise exception 'TEST details preserve approval and flag';end if;
 if public.venue_profile('get')->>'name'<>'Person A' then raise exception 'TEST booking changed profile';end if;
 -- Other accounts cannot preview or apply.
 perform set_config('request.jwt.claim.sub',b::text,true);
 failed:=false;begin perform public.venue_series_edit('preview',p);exception when others then failed:=true;end;if not failed then raise exception 'TEST ownership';end if;
 perform set_config('request.jwt.claim.sub',a::text,true);
 p:=jsonb_build_object('id',x,'scope','future','operation','edit','patch',jsonb_build_object('room',room_b));
 r:=public.venue_series_edit('preview',p);
 if jsonb_array_length(r)<>2 or not(r->0->>'exception')::boolean then raise exception 'TEST skipped cancellation or exception';end if;
 v:=jsonb_build_object(x::text,r->0->>'version',y::text,r->1->>'version');
 -- Availability changes after preview: entire batch must roll back.
 insert into venue_private.bookings(id,owner_id,room,starts_at,ends_at,title,group_name,pic,status)
 values(held,b,room_b,((d+7)||' 09:00+08')::timestamptz,((d+7)||' 10:00+08')::timestamptz,'Held','Test','B','confirmed');
 failed:=false;begin perform public.venue_series_edit('apply',p||jsonb_build_object('ids',jsonb_build_array(x,y),'versions',v));exception when others then failed:=true;end;
 if not failed or (select room from venue_private.bookings where id=x)<>room_a then raise exception 'TEST atomic conflict rollback';end if;
 r:=public.venue_series_edit('preview',p);
 if (r->1->>'available')::boolean then raise exception 'TEST conflict preview';end if;
 perform public.venue_series_edit('apply',p||jsonb_build_object('ids',jsonb_build_array(x),'versions',jsonb_build_object(x::text,r->0->>'version')));
 if (select status from venue_private.bookings where id=x)<>'pending' or (select room from venue_private.bookings where id=y)<>room_a or (select status from venue_private.bookings where id=y)<>'confirmed' then raise exception 'TEST excluded date and reapproval';end if;
 -- Stale snapshots cannot overwrite a newer edit.
 p:=jsonb_build_object('id',y,'scope','one','operation','edit','patch','{"title":"New"}'::jsonb);
 r:=public.venue_series_edit('preview',p);update venue_private.bookings set title='Changed elsewhere' where id=y;
 failed:=false;begin perform public.venue_series_edit('apply',p||jsonb_build_object('ids',jsonb_build_array(y),'versions',jsonb_build_object(y::text,r->0->>'version')));exception when others then failed:=true;end;
 if not failed then raise exception 'TEST stale version';end if;
 -- Non-series IDs and IDs before scope cannot be injected.
 p:=jsonb_build_object('id',y,'scope','future','operation','cancel','patch','{}'::jsonb);r:=public.venue_series_edit('preview',p);
 failed:=false;begin perform public.venue_series_edit('apply',p||jsonb_build_object('ids',jsonb_build_array(x,y),'versions',jsonb_build_object(y::text,r->0->>'version')));exception when others then failed:=true;end;
 if not failed or (select status from venue_private.bookings where id=y)<>'confirmed' then raise exception 'TEST scope rollback';end if;
 perform public.venue_series_edit('apply',p||jsonb_build_object('ids',jsonb_build_array(y),'versions',jsonb_build_object(y::text,r->0->>'version')));
 if (select status from venue_private.bookings where id=y)<>'cancelled' then raise exception 'TEST owner skip confirmed';end if;
 -- Cannot reschedule a past occurrence.
 update venue_private.bookings set starts_at=now()-interval '2 hours',ends_at=now()-interval '1 hour' where id=x;
 failed:=false;begin perform public.venue_series_edit('preview',jsonb_build_object('id',x,'scope','one','operation','cancel'));exception when others then failed:=true;end;if not failed then raise exception 'TEST past';end if;
 failed:=false;begin perform public.venue_api('cancel',jsonb_build_object('id',x));exception when others then failed:=true;end;if not failed then raise exception 'TEST legacy API past cancellation';end if;
 perform set_config('request.jwt.claim.sub','',true);
 if public.venue_api('state')->'profile'<>'{}'::jsonb then raise exception 'TEST anon profile';end if;
end $$;
set local role anon;
do $$begin
 if has_function_privilege(current_user,'public.venue_profile(text,jsonb)','execute') or has_function_privilege(current_user,'public.venue_series_edit(text,jsonb)','execute') then raise exception 'TEST anon execution';end if;
 if has_table_privilege(current_user,'venue_private.booking_profiles','select') then raise exception 'TEST raw profiles';end if;
end $$;
set local role authenticated;
do $$begin
 if has_table_privilege(current_user,'venue_private.booking_profiles','select') or has_table_privilege(current_user,'venue_private.bookings','update') then raise exception 'TEST direct member data access';end if;
end $$;
rollback;
select 'PASS: profiles private; PIC independent; recurring scope, exclusions, approval, conflicts, atomic rollback, stale versions, cancellation, past dates and anonymous grants' as result;
