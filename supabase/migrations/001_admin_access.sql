-- Week 6: admin dashboard access.
--
-- Run ONCE in the Supabase SQL editor of the shared project (it is safe to
-- re-run). It is additive: no existing table policy is changed and no data is
-- deleted. The public app keeps working because the only profile columns it
-- ever writes (first_name, last_name, avatar_url, updated_at) stay writable.
--
-- Model
--   * profiles.is_superadmin marks administrators. Ordinary users can never
--     change it (column-level privileges + a trigger that only trusted database
--     administrator roles can pass), only the SQL editor can.
--   * Every admin read/edit goes through a SECURITY DEFINER function that
--     independently re-checks is_superadmin() before doing anything.
--   * EXECUTE on every function is limited to signed-in users; anonymous
--     callers cannot run any of them. No service-role key is ever used.

-- ---------------------------------------------------------------------------
-- 1. The flag, and protection against privilege escalation
-- ---------------------------------------------------------------------------

alter table public.profiles
  add column if not exists is_superadmin boolean not null default false;

-- Existing policy "Users can update their own profile" allows updating ANY
-- column of one's own row. Narrow the privilege itself so is_superadmin (and
-- id) are not writable by signed-in users. The public app only writes these
-- four columns.
revoke update on public.profiles from anon, authenticated;
grant update (first_name, last_name, avatar_url, updated_at)
  on public.profiles to authenticated;

-- Second layer: even if a privilege is ever re-granted by mistake, the flag
-- can only be set or changed by a trusted administrative database role. This
-- deliberately does NOT depend on auth.uid() (which can be NULL for API
-- requests with a missing or odd JWT): it looks at who is actually executing
-- the statement. Trusted roles:
--   postgres        the Supabase SQL editor, CLI migrations, and the owner of
--                   SECURITY DEFINER functions such as the signup trigger
--   supabase_admin  Supabase's internal administrative role
-- Everything else (authenticated, anon, service_role, authenticator, ...) is
-- refused, so API traffic can never change the flag. Normal signup and profile
-- updates leave is_superadmin untouched (false), so they are unaffected.
create or replace function public.protect_superadmin_flag()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if (tg_op = 'INSERT' and new.is_superadmin)
     or (tg_op = 'UPDATE' and new.is_superadmin is distinct from old.is_superadmin) then
    if current_user not in ('postgres', 'supabase_admin') then
      raise exception 'is_superadmin can only be changed by a database administrator role (SQL editor)'
        using errcode = '42501';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists protect_superadmin_flag on public.profiles;
create trigger protect_superadmin_flag
  before insert or update on public.profiles
  for each row execute function public.protect_superadmin_flag();

-- A trigger function is only ever run by the trigger itself; nobody needs
-- EXECUTE on it (firing a trigger does not check the caller's privileges).
revoke execute on function public.protect_superadmin_flag()
  from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 2. Authorization helpers
-- ---------------------------------------------------------------------------

-- True only when the caller's own profile is flagged. SECURITY DEFINER so it
-- can read profiles regardless of the caller's RLS; it only ever answers for
-- auth.uid(), so it reveals nothing about anyone else.
create or replace function public.is_superadmin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (select p.is_superadmin from public.profiles p where p.id = (select auth.uid())),
    false
  );
$$;

revoke execute on function public.is_superadmin() from public, anon;
grant execute on function public.is_superadmin() to authenticated;

-- Called first by every admin function below. Not callable from the API.
create or replace function public.assert_superadmin()
returns void
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.is_superadmin() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
end;
$$;

revoke execute on function public.assert_superadmin() from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 3. Dashboard numbers (one call, computed in the database)
-- ---------------------------------------------------------------------------

create or replace function public.admin_overview()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform public.assert_superadmin();

  return jsonb_build_object(
    'users', (select count(*) from public.profiles),
    'posts', (select count(*) from public.generations),
    'votes', (select count(*) from public.votes),
    'upvotes', (select count(*) from public.votes where value = 1),
    'downvotes', (select count(*) from public.votes where value = -1),
    'posts_without_votes', (
      select count(*) from public.generations g
      where not exists (select 1 from public.votes v where v.generation_id = g.id)
    ),
    'activity_by_day', (
      select coalesce(jsonb_agg(d order by d.day), '[]'::jsonb)
      from (
        select
          (current_date - 29 + n) as day,
          (select count(*) from public.generations g
            where (g.created_at at time zone 'utc')::date = (current_date - 29 + n)) as posts,
          (select count(*) from public.votes v
            where (v.created_at at time zone 'utc')::date = (current_date - 29 + n)) as votes
        from generate_series(0, 29) n
      ) d
    ),
    'top_posts', (
      select coalesce(jsonb_agg(t), '[]'::jsonb)
      from (
        select
          g.id,
          g.content,
          g.image_path,
          g.created_at,
          coalesce(sum(v.value), 0)::int as score,
          (count(*) filter (where v.value = 1))::int as upvotes,
          (count(*) filter (where v.value = -1))::int as downvotes,
          coalesce(nullif(trim(concat_ws(' ', p.first_name, p.last_name)), ''), 'Unknown') as author
        from public.generations g
        left join public.votes v on v.generation_id = g.id
        left join public.profiles p on p.id = g.user_id
        group by g.id, p.first_name, p.last_name
        order by score desc, g.created_at desc
        limit 5
      ) t
    ),
    'active_users', (
      select coalesce(jsonb_agg(a), '[]'::jsonb)
      from (
        select *
        from (
          select
            p.id,
            coalesce(nullif(trim(concat_ws(' ', p.first_name, p.last_name)), ''), 'Unknown') as name,
            u.email,
            (select count(*) from public.generations g where g.user_id = p.id)::int as posts,
            (select count(*) from public.votes v where v.user_id = p.id)::int as votes
          from public.profiles p
          join auth.users u on u.id = p.id
        ) x
        order by (x.posts + x.votes) desc, x.name
        limit 5
      ) a
    ),
    'recent_activity', (
      select coalesce(jsonb_agg(r order by r.occurred_at desc), '[]'::jsonb)
      from (
        select *
        from (
          select
            'post'::text as kind,
            g.created_at as occurred_at,
            coalesce(nullif(trim(concat_ws(' ', p.first_name, p.last_name)), ''), 'Unknown') as actor,
            g.content as detail,
            g.id as post_id
          from public.generations g
          left join public.profiles p on p.id = g.user_id
          union all
          select
            'vote'::text,
            v.created_at,
            coalesce(nullif(trim(concat_ws(' ', p.first_name, p.last_name)), ''), 'Unknown'),
            case when v.value = 1 then 'upvoted' else 'downvoted' end,
            v.generation_id
          from public.votes v
          left join public.profiles p on p.id = v.user_id
        ) merged
        order by occurred_at desc
        limit 10
      ) r
    )
  );
end;
$$;

revoke execute on function public.admin_overview() from public, anon;
grant execute on function public.admin_overview() to authenticated;

-- ---------------------------------------------------------------------------
-- 4. Users (read-only)
-- ---------------------------------------------------------------------------

create or replace function public.admin_users(
  p_search text default '',
  p_sort text default 'newest',
  p_limit int default 25,
  p_offset int default 0
)
returns table (
  id uuid,
  email text,
  first_name text,
  last_name text,
  avatar_url text,
  is_superadmin boolean,
  created_at timestamptz,
  last_sign_in_at timestamptz,
  posts bigint,
  votes bigint,
  total_count bigint
)
language plpgsql
stable
security definer
set search_path = ''
as $$
#variable_conflict use_column
begin
  perform public.assert_superadmin();

  return query
  select
    p.id,
    u.email::text,
    p.first_name,
    p.last_name,
    p.avatar_url,
    p.is_superadmin,
    u.created_at,
    u.last_sign_in_at,
    (select count(*) from public.generations g where g.user_id = p.id) as posts,
    (select count(*) from public.votes v where v.user_id = p.id) as votes,
    count(*) over () as total_count
  from public.profiles p
  join auth.users u on u.id = p.id
  where coalesce(p_search, '') = ''
     or u.email ilike '%' || p_search || '%'
     or p.first_name ilike '%' || p_search || '%'
     or p.last_name ilike '%' || p_search || '%'
  order by
    case when p_sort = 'name' then lower(coalesce(p.first_name, '') || ' ' || coalesce(p.last_name, '')) end asc,
    case when p_sort = 'posts' then (select count(*) from public.generations g where g.user_id = p.id) end desc,
    case when p_sort = 'votes' then (select count(*) from public.votes v where v.user_id = p.id) end desc,
    case when p_sort = 'oldest' then u.created_at end asc,
    u.created_at desc
  limit least(greatest(coalesce(p_limit, 25), 1), 100)
  offset greatest(coalesce(p_offset, 0), 0);
end;
$$;

revoke execute on function public.admin_users(text, text, int, int) from public, anon;
grant execute on function public.admin_users(text, text, int, int) to authenticated;

-- ---------------------------------------------------------------------------
-- 5. Generated posts: list / detail (read)
-- ---------------------------------------------------------------------------

create or replace function public.admin_posts(
  p_search text default '',
  p_sort text default 'newest',
  p_limit int default 20,
  p_offset int default 0,
  p_id bigint default null
)
returns table (
  id bigint,
  user_id uuid,
  author_name text,
  author_email text,
  prompt text,
  content text,
  image_path text,
  model text,
  created_at timestamptz,
  score int,
  upvotes int,
  downvotes int,
  total_count bigint
)
language plpgsql
stable
security definer
set search_path = ''
as $$
#variable_conflict use_column
begin
  perform public.assert_superadmin();

  return query
  select
    g.id,
    g.user_id,
    coalesce(nullif(trim(concat_ws(' ', p.first_name, p.last_name)), ''), 'Unknown') as author_name,
    u.email::text as author_email,
    g.prompt,
    g.content,
    g.image_path,
    g.model,
    g.created_at,
    vs.score,
    vs.upvotes,
    vs.downvotes,
    count(*) over () as total_count
  from public.generations g
  left join public.profiles p on p.id = g.user_id
  left join auth.users u on u.id = g.user_id
  left join lateral (
    select
      coalesce(sum(v.value), 0)::int as score,
      (count(*) filter (where v.value = 1))::int as upvotes,
      (count(*) filter (where v.value = -1))::int as downvotes
    from public.votes v
    where v.generation_id = g.id
  ) vs on true
  where (p_id is null or g.id = p_id)
    and (
      coalesce(p_search, '') = ''
      or g.content ilike '%' || p_search || '%'
      or g.prompt ilike '%' || p_search || '%'
      or u.email ilike '%' || p_search || '%'
      or p.first_name ilike '%' || p_search || '%'
      or p.last_name ilike '%' || p_search || '%'
    )
  order by
    case when p_sort = 'top' then vs.score end desc,
    case when p_sort = 'oldest' then g.created_at end asc,
    g.created_at desc,
    g.id desc
  limit least(greatest(coalesce(p_limit, 20), 1), 100)
  offset greatest(coalesce(p_offset, 0), 0);
end;
$$;

revoke execute on function public.admin_posts(text, text, int, int, bigint) from public, anon;
grant execute on function public.admin_posts(text, text, int, int, bigint) to authenticated;

-- ---------------------------------------------------------------------------
-- 6. Generated posts: edit and delete
--    (Create needs no function: an admin creates a post as themselves through
--    the existing "Users can create their own generations" policy.)
-- ---------------------------------------------------------------------------

-- Only the caption and the prompt can be changed; never the author or image.
create or replace function public.admin_update_post(
  p_id bigint,
  p_content text,
  p_prompt text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.assert_superadmin();

  if char_length(btrim(coalesce(p_content, ''))) not between 1 and 500 then
    raise exception 'caption must be 1-500 characters' using errcode = '22023';
  end if;
  if char_length(btrim(coalesce(p_prompt, ''))) not between 1 and 200 then
    raise exception 'prompt must be 1-200 characters' using errcode = '22023';
  end if;

  update public.generations
     set content = btrim(p_content),
         prompt = btrim(p_prompt)
   where id = p_id;

  if not found then
    raise exception 'post not found' using errcode = 'P0002';
  end if;
end;
$$;

revoke execute on function public.admin_update_post(bigint, text, text) from public, anon;
grant execute on function public.admin_update_post(bigint, text, text) to authenticated;

-- Deletes the row (its votes go with it through the existing ON DELETE
-- CASCADE) and returns the Storage path so the app can remove the image as a
-- separate step. The database deletion is final either way.
create or replace function public.admin_delete_post(p_id bigint)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_path text;
begin
  perform public.assert_superadmin();

  delete from public.generations
   where id = p_id
  returning image_path into v_path;

  if not found then
    raise exception 'post not found' using errcode = 'P0002';
  end if;

  return v_path;
end;
$$;

revoke execute on function public.admin_delete_post(bigint) from public, anon;
grant execute on function public.admin_delete_post(bigint) to authenticated;

-- Superadmins may delete any file in post-images (needed to clean up the image
-- of a post that belongs to someone else). Ordinary users keep only their own
-- folder (policy from the public app's migration 003).
drop policy if exists "Superadmins can delete post images" on storage.objects;
create policy "Superadmins can delete post images"
  on storage.objects for delete to authenticated
  using (bucket_id = 'post-images' and public.is_superadmin());

-- ---------------------------------------------------------------------------
-- 7. Votes history (read-only)
-- ---------------------------------------------------------------------------

create or replace function public.admin_votes(
  p_limit int default 50,
  p_offset int default 0
)
returns table (
  id bigint,
  value smallint,
  created_at timestamptz,
  voter_id uuid,
  voter_name text,
  voter_email text,
  generation_id bigint,
  post_content text,
  total_count bigint,
  total_up bigint,
  total_down bigint
)
language plpgsql
stable
security definer
set search_path = ''
as $$
#variable_conflict use_column
begin
  perform public.assert_superadmin();

  return query
  select
    v.id,
    v.value,
    v.created_at,
    v.user_id as voter_id,
    coalesce(nullif(trim(concat_ws(' ', p.first_name, p.last_name)), ''), 'Unknown') as voter_name,
    u.email::text as voter_email,
    v.generation_id,
    g.content as post_content,
    count(*) over () as total_count,
    (count(*) filter (where v.value = 1) over ()) as total_up,
    (count(*) filter (where v.value = -1) over ()) as total_down
  from public.votes v
  left join public.profiles p on p.id = v.user_id
  left join auth.users u on u.id = v.user_id
  left join public.generations g on g.id = v.generation_id
  order by v.created_at desc, v.id desc
  limit least(greatest(coalesce(p_limit, 50), 1), 200)
  offset greatest(coalesce(p_offset, 0), 0);
end;
$$;

revoke execute on function public.admin_votes(int, int) from public, anon;
grant execute on function public.admin_votes(int, int) to authenticated;

-- ---------------------------------------------------------------------------
-- 8. Bootstrap the first superadmin (run this yourself, once)
-- ---------------------------------------------------------------------------
-- The person must have signed in at least once (to the public app or to the
-- admin app) so a profile row exists. Replace the email, then run:
--
--   update public.profiles
--      set is_superadmin = true
--    where id = (select id from auth.users where email = 'you@example.com');
--
--   select p.id, u.email, p.is_superadmin
--     from public.profiles p join auth.users u on u.id = p.id
--    where p.is_superadmin;

-- ---------------------------------------------------------------------------
-- 9. Make the API pick up the new functions straight away
-- ---------------------------------------------------------------------------

notify pgrst, 'reload schema';
