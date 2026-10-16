begin;
do $$
declare u uuid:=gen_random_uuid(); stranger uuid:=gen_random_uuid(); b uuid; other_notice uuid; own_notice uuid; response jsonb; r integer;
begin
 insert into auth.users(id,email,email_confirmed_at) values(u,'notification-test@example.invalid',now()),(stranger,'notification-other@example.invalid',now());
 insert into venue_private.members(id,email,name) values(u,'notification-test@example.invalid','Fixture'),(stranger,'notification-other@example.invalid','Other fixture');
 select id into r from venue_private.rooms order by id limit 1;
 insert into venue_private.bookings(owner_id,room,starts_at,ends_at,title,group_name,pic) values(u,r,'2099-01-05 06:00+08','2099-01-05 06:30+08','Notification test','Fixture','Fixture') returning id into b;
 update venue_private.bookings set status='confirmed',approval='Automatic' where id=b;
 update venue_private.bookings set title='Changed fixture' where id=b;
 update venue_private.bookings set status='cancelled' where id=b;
 if (select count(*) from venue_private.notifications where recipient=u and booking_id=b)<>4 then raise exception 'Missing booking lifecycle notifications'; end if;
 select id into own_notice from venue_private.notifications where recipient=u limit 1;
 insert into venue_private.notifications(recipient,booking_id,audience,kind,title,room,starts_at,status) values(stranger,b,'owner','changed','Other',r,now(),'cancelled') returning id into other_notice;
 perform set_config('request.jwt.claim.sub',u::text,true);
 response:=public.venue_notifications('list');
 if (response->>'unread')::int<>4 or jsonb_array_length(response->'items')<>4 then raise exception 'Inbox ownership failed'; end if;
 perform public.venue_notifications('read',jsonb_build_object('ids',jsonb_build_array(own_notice,other_notice)));
 if (select read_at from venue_private.notifications where id=own_notice) is null then raise exception 'Read update missing'; end if;
 if (select read_at from venue_private.notifications where id=other_notice) is not null then raise exception 'Cross-account read update'; end if;
 if has_function_privilege('anon','public.venue_notifications(text,jsonb)','execute') or has_table_privilege('authenticated','venue_private.notifications','select') then raise exception 'Unexpected direct grant'; end if;
 perform set_config('request.jwt.claim.sub','',true);
 begin
  perform public.venue_notifications('list');
  raise exception 'Anonymous call accepted';
 exception when others then
  if sqlerrm<>'Please sign in first.' then raise; end if;
 end;
 raise notice 'PASS notification lifecycle, owner isolation, mark-read isolation, grants and anonymous guard';
end $$;
rollback;
