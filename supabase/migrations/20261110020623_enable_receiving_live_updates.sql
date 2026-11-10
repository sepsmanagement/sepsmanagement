-- Publish only staff-protected tables. Existing SELECT grants and RLS remain unchanged.
do $$
begin
 if not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='seps_scan_events') then
  alter publication supabase_realtime add table public.seps_scan_events;
 end if;
 if not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='seps_sessions') then
  alter publication supabase_realtime add table public.seps_sessions;
 end if;
 if not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='seps_staff') then
  alter publication supabase_realtime add table public.seps_staff;
 end if;
end;
$$;
