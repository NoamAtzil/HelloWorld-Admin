-- Security self-test for 001_admin_access.sql.
--
-- Run in the Supabase SQL editor AFTER the migration AND after you have made
-- yourself superadmin. It picks one existing non-admin profile and one
-- superadmin automatically, impersonates them inside a single DO block, and
-- prints PASS lines (or stops with a FAIL error).
--
-- Read-only by design: it writes nothing. The only statements that could
-- change data are written to match ZERO rows ("where false"), so even if a
-- protection were broken nothing could be modified. Role and JWT settings
-- are transaction-local.

do $$
declare
  reg uuid := (select id from public.profiles where not is_superadmin limit 1);
  adm uuid := (select id from public.profiles where is_superadmin limit 1);
  keys int;
begin
  if reg is null or adm is null then
    raise exception 'Need at least one superadmin and one non-admin profile to run this test';
  end if;

  ---------------------------------------------------------------- non-admin
  perform set_config('request.jwt.claims',
    json_build_object('sub', reg, 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);

  if public.is_superadmin() then
    raise exception 'FAIL 1: a regular user is reported as superadmin';
  end if;
  raise notice 'PASS 1: regular user is not a superadmin';

  begin
    perform public.admin_overview();
    raise exception 'FAIL 2: admin_overview() ran for a regular user';
  exception when insufficient_privilege then
    raise notice 'PASS 2: admin_overview() is forbidden for a regular user';
  end;

  begin
    perform * from public.admin_posts();
    raise exception 'FAIL 3: admin_posts() ran for a regular user';
  exception when insufficient_privilege then
    raise notice 'PASS 3: admin_posts() is forbidden for a regular user';
  end;

  begin
    perform public.admin_delete_post(-1);
    raise exception 'FAIL 4: admin_delete_post() ran for a regular user';
  exception when insufficient_privilege then
    raise notice 'PASS 4: admin_delete_post() is forbidden for a regular user';
  end;

  -- The statement is rejected at the privilege check, before any row is read
  -- or written; "where false" guarantees no row could be touched regardless.
  begin
    update public.profiles set is_superadmin = true where false;
    raise exception 'FAIL 5: a regular user may update is_superadmin';
  exception when insufficient_privilege then
    raise notice 'PASS 5: a regular user cannot update is_superadmin';
  end;

  -- Read-only privilege checks (catalog lookups, no data touched).
  if has_column_privilege('authenticated', 'public.profiles', 'is_superadmin', 'UPDATE')
     or has_column_privilege('authenticated', 'public.profiles', 'id', 'UPDATE')
     or has_column_privilege('anon', 'public.profiles', 'is_superadmin', 'UPDATE') then
    raise exception 'FAIL 6: is_superadmin or id is updatable by a non-admin role';
  end if;
  if not (has_column_privilege('authenticated', 'public.profiles', 'first_name', 'UPDATE')
      and has_column_privilege('authenticated', 'public.profiles', 'last_name', 'UPDATE')
      and has_column_privilege('authenticated', 'public.profiles', 'avatar_url', 'UPDATE')
      and has_column_privilege('authenticated', 'public.profiles', 'updated_at', 'UPDATE')) then
    raise exception 'FAIL 6: the public app profile update path lost a column privilege';
  end if;
  raise notice 'PASS 6: only first_name/last_name/avatar_url/updated_at are updatable (public app path intact)';

  if not exists (
    select 1 from pg_trigger
     where tgrelid = 'public.profiles'::regclass
       and tgname = 'protect_superadmin_flag'
       and tgenabled <> 'D'
  ) then
    raise exception 'FAIL 6b: the protect_superadmin_flag trigger is missing or disabled';
  end if;
  if has_function_privilege('authenticated', 'public.protect_superadmin_flag()', 'EXECUTE')
     or has_function_privilege('anon', 'public.protect_superadmin_flag()', 'EXECUTE') then
    raise exception 'FAIL 6c: protect_superadmin_flag() is executable by API roles';
  end if;
  raise notice 'PASS 6b-c: trigger is active and its function is not exposed';

  -------------------------------------------------------------- superadmin
  perform set_config('request.jwt.claims',
    json_build_object('sub', adm, 'role', 'authenticated')::text, true);

  if not public.is_superadmin() then
    raise exception 'FAIL 7: the superadmin is not recognised';
  end if;
  select count(*) into keys from jsonb_object_keys(public.admin_overview());
  if keys < 5 then
    raise exception 'FAIL 8: admin_overview() returned too few fields';
  end if;
  raise notice 'PASS 7-8: superadmin is recognised and can read statistics';

  ---------------------------------------------------------------- anonymous
  perform set_config('role', 'anon', true);
  begin
    perform public.is_superadmin();
    raise exception 'FAIL 9: anon can execute is_superadmin()';
  exception when insufficient_privilege then
    raise notice 'PASS 9: anonymous callers cannot execute admin functions';
  end;
  begin
    perform public.admin_overview();
    raise exception 'FAIL 10: anon can execute admin_overview()';
  exception when insufficient_privilege then
    raise notice 'PASS 10: anonymous callers cannot execute admin_overview()';
  end;

  perform set_config('role', 'postgres', true);
  raise notice 'All admin access checks passed.';
end;
$$;
