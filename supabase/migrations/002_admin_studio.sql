-- Week 7: admin tools for the Studio, Arena and Daily Drop.
--
-- DO NOT RUN until reviewed. Run ONCE in the Supabase SQL editor, AFTER the
-- public app's 004_studio_arena_drop.sql (this file reads the tables and the
-- private schema that migration creates) and after 001_admin_access.sql. It
-- is additive and safe to re-run: no existing function, table or policy is
-- changed, and nothing is deleted.
--
-- Model (same as 001): every function is SECURITY DEFINER, calls
-- assert_superadmin() first, and is executable by signed-in users only (the
-- check inside is what actually decides). No service-role key is involved.

-- ---------------------------------------------------------------------------
-- 1. Daily challenges: list, set, remove (future days only)
-- ---------------------------------------------------------------------------

create or replace function public.admin_challenges()
returns table (
  drop_date date,
  library_slug text,
  theme text,
  entries bigint
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform public.assert_superadmin();

  return query
  select c.drop_date, c.library_slug, c.theme,
         (select count(*) from public.generations g where g.drop_date = c.drop_date)
    from public.daily_challenges c
   where c.drop_date >= public.drop_today() - 7
   order by c.drop_date;
end;
$$;

-- Pin a specific library image (and optional theme) to a FUTURE day. Today and
-- past days cannot be changed, so a running or finished Drop is never altered.
create or replace function public.admin_set_challenge(
  p_date date,
  p_slug text,
  p_theme text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.assert_superadmin();

  if p_date is null or p_date <= public.drop_today() then
    raise exception 'choose a date after today' using errcode = '22023';
  end if;
  if p_slug is null or p_slug !~ '^[A-Za-z0-9._-]{1,120}$' then
    raise exception 'the image name looks invalid' using errcode = '22023';
  end if;
  if p_theme is not null and char_length(btrim(p_theme)) > 80 then
    raise exception 'the theme must be 80 characters or fewer' using errcode = '22023';
  end if;

  insert into public.daily_challenges (drop_date, library_slug, theme)
  values (p_date, p_slug, nullif(btrim(coalesce(p_theme, '')), ''))
  on conflict (drop_date)
  do update set library_slug = excluded.library_slug, theme = excluded.theme;
end;
$$;

create or replace function public.admin_delete_challenge(p_date date)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.assert_superadmin();

  if p_date is null or p_date <= public.drop_today() then
    raise exception 'only future challenges can be removed' using errcode = '22023';
  end if;
  delete from public.daily_challenges where drop_date = p_date;
  if not found then
    raise exception 'challenge not found' using errcode = 'P0002';
  end if;
end;
$$;

-- Recent Drops: entries, votes, and the winner (positive score only, ties to
-- the earlier entry; today's Drop has no winner yet).
create or replace function public.admin_drop_history(p_days integer default 14)
returns table (
  drop_date date,
  library_slug text,
  entries bigint,
  votes bigint,
  winner_id bigint,
  winner_content text,
  winner_author text,
  winner_score bigint
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform public.assert_superadmin();

  return query
  select d.day,
         (select g.library_slug from public.generations g where g.drop_date = d.day limit 1),
         (select count(*) from public.generations g where g.drop_date = d.day),
         (select count(*) from public.votes v join public.generations g on g.id = v.generation_id
           where g.drop_date = d.day),
         w.id, w.content, w.author, w.score
    from (select generate_series(public.drop_today() - (least(greatest(coalesce(p_days, 14), 1), 60) - 1),
                                 public.drop_today(), interval '1 day')::date as day) d
    left join lateral (
      select g.id, g.content,
             coalesce(nullif(trim(concat_ws(' ', p.first_name, p.last_name)), ''), 'Unknown') as author,
             coalesce(sum(v.value), 0)::bigint as score
        from public.generations g
        left join public.votes v on v.generation_id = g.id
        left join public.profiles p on p.id = g.user_id
       where g.drop_date = d.day and d.day < public.drop_today()
       group by g.id, p.first_name, p.last_name
      having coalesce(sum(v.value), 0) > 0
       order by coalesce(sum(v.value), 0) desc, g.created_at asc
       limit 1) w on true
   order by d.day desc;
end;
$$;

-- ---------------------------------------------------------------------------
-- 2. Studio / Arena / quota statistics
-- ---------------------------------------------------------------------------

create or replace function public.admin_studio_stats()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_today date := (now() at time zone 'utc')::date;
begin
  perform public.assert_superadmin();

  return jsonb_build_object(
    'caps', jsonb_build_object(
      'guest_per_visitor', private.setting_int('guest_per_visitor_daily', 3),
      'guest_global', private.setting_int('guest_global_daily', 100),
      'user_daily', private.setting_int('user_daily', 30),
      'global_daily', private.setting_int('global_daily', 400)),
    'quota_configured', exists (
      select 1 from private.app_settings s
       where s.key = 'quota_secret' and char_length(s.value) >= 24),
    'today', jsonb_build_object(
      'guest_calls', coalesce((select u.calls from private.ai_usage u where u.day = v_today and u.scope = 'guest_total' and u.subject = '*'), 0),
      'guest_visitors', (select count(*) from private.ai_usage u where u.day = v_today and u.scope = 'guest_visitor'),
      'user_calls', coalesce((select sum(u.calls) from private.ai_usage u where u.day = v_today and u.scope = 'user'), 0),
      'users_active', (select count(*) from private.ai_usage u where u.day = v_today and u.scope = 'user'),
      'total_calls', coalesce((select u.calls from private.ai_usage u where u.day = v_today and u.scope = 'total' and u.subject = '*'), 0)),
    'usage_by_day', (
      select coalesce(jsonb_agg(x order by x.day), '[]'::jsonb)
        from (
          select (v_today - 13 + n) as day,
                 coalesce((select u.calls from private.ai_usage u where u.day = v_today - 13 + n and u.scope = 'guest_total' and u.subject = '*'), 0) as guest,
                 coalesce((select sum(u.calls) from private.ai_usage u where u.day = v_today - 13 + n and u.scope = 'user'), 0) as members
            from generate_series(0, 13) n) x),
    'content', jsonb_build_object(
      'public_posts', (select count(*) from public.generations where is_public),
      'drop_entries', (select count(*) from public.generations where drop_date is not null),
      'drop_entries_today', (select count(*) from public.generations where drop_date = public.drop_today())),
    'voices', (
      select coalesce(jsonb_agg(x order by x.posts desc), '[]'::jsonb)
        from (select g.voice, count(*) as posts
                from public.generations g where g.voice is not null group by g.voice) x),
    'arena', jsonb_build_object(
      'battles', (select count(*) from public.duel_votes),
      'judges', (select count(distinct user_id) from public.duel_votes),
      'by_day', (
        select coalesce(jsonb_agg(x order by x.day), '[]'::jsonb)
          from (
            select (public.drop_today() - 13 + n) as day,
                   (select count(*) from public.duel_votes d
                     where (d.created_at at time zone 'America/New_York')::date = public.drop_today() - 13 + n) as battles
              from generate_series(0, 13) n) x))
  );
end;
$$;

-- Studio details for one post (the existing admin_posts() is left untouched).
create or replace function public.admin_post_studio(p_id bigint)
returns table (
  voice text,
  library_slug text,
  is_public boolean,
  drop_date date,
  arena_wins bigint,
  arena_battles bigint
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform public.assert_superadmin();

  return query
  select g.voice, g.library_slug, g.is_public, g.drop_date,
         (select count(*) from public.duel_votes d where d.winner_id = g.id),
         (select count(*) from public.duel_votes d where g.id in (d.winner_id, d.loser_id))
    from public.generations g
   where g.id = p_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- 3. Permissions
-- ---------------------------------------------------------------------------

revoke execute on function public.admin_challenges() from public, anon;
revoke execute on function public.admin_set_challenge(date, text, text) from public, anon;
revoke execute on function public.admin_delete_challenge(date) from public, anon;
revoke execute on function public.admin_drop_history(integer) from public, anon;
revoke execute on function public.admin_studio_stats() from public, anon;
revoke execute on function public.admin_post_studio(bigint) from public, anon;
grant execute on function public.admin_challenges() to authenticated;
grant execute on function public.admin_set_challenge(date, text, text) to authenticated;
grant execute on function public.admin_delete_challenge(date) to authenticated;
grant execute on function public.admin_drop_history(integer) to authenticated;
grant execute on function public.admin_studio_stats() to authenticated;
grant execute on function public.admin_post_studio(bigint) to authenticated;

-- Superadmins may remove the public copy of any shared image (needed when an
-- admin deletes a post that its author had shared). Authors keep their own
-- folder through the policy created in the public app's migration 004.
drop policy if exists "Superadmins can view shared images" on storage.objects;
create policy "Superadmins can view shared images"
  on storage.objects for select to authenticated
  using (bucket_id = 'shared-images' and public.is_superadmin());

drop policy if exists "Superadmins can delete shared images" on storage.objects;
create policy "Superadmins can delete shared images"
  on storage.objects for delete to authenticated
  using (bucket_id = 'shared-images' and public.is_superadmin());

notify pgrst, 'reload schema';
