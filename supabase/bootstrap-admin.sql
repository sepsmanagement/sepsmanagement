-- Run AFTER inviting ryan@sepsmanagement.com in Authentication → Users → Invite user.
-- Change the invitation redirect to https://sepsmanagement.com/operations/auth.html
-- This is intentionally tied to one exact email; it never promotes the first person to sign up.
begin;
do $$
declare uid uuid;
begin
 select id into uid from auth.users where lower(email)='ryan@sepsmanagement.com' and invited_at is not null;
 if uid is null then raise exception 'Invite ryan@sepsmanagement.com in Supabase Auth first, then run this script.'; end if;
 insert into public.seps_staff(user_id,email,role,active)
 values(uid,'ryan@sepsmanagement.com','admin',true)
 on conflict(user_id) do update set role='admin',active=true;
end;
$$;
commit;
