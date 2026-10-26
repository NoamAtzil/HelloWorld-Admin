-- Homework 7, part 2: admin-managed configuration tables.
--
-- DO NOT RUN until reviewed. Run ONCE in the Supabase SQL editor, AFTER the admin
-- 001 (it needs public.is_superadmin()) and public 004. Recommended order:
--   admin 001 -> public 004 -> admin 002 -> public 005 -> THIS FILE.
-- Additive and safe to re-run: no existing table, function, policy or row is
-- changed, and nothing is deleted.
--
-- Tables (all superadmin-only, enforced by RLS in the database):
--   prompt_chains, prompt_chain_steps, prompt_chain_mix
--   terms, generation_examples
--   allowed_signup_domains, whitelisted_emails   (recorded only: signup rules
--                                                 are NOT enforced anywhere)
--   images + the public storage bucket "library-images"
--
-- Prompt chains are configuration for admins. They do NOT change the live
-- Gemini prompts, which stay in the application code.

-- Shared helper: keep updated_at honest.
create or replace function public.touch_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;
revoke execute on function public.touch_updated_at() from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 1. Prompt chains, steps, mix
-- ---------------------------------------------------------------------------

create table if not exists public.prompt_chains (
  id bigint generated always as identity primary key,
  name text not null check (char_length(btrim(name)) between 1 and 80),
  description text check (description is null or char_length(description) <= 500),
  voice_id text check (voice_id is null or voice_id ~ '^[a-z][a-z-]{0,23}$'),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists prompt_chains_name_key on public.prompt_chains (lower(btrim(name)));

create table if not exists public.prompt_chain_steps (
  id bigint generated always as identity primary key,
  chain_id bigint not null references public.prompt_chains (id) on delete cascade,
  position integer not null check (position between 1 and 50),
  instruction text not null check (char_length(btrim(instruction)) between 1 and 1000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (chain_id, position)
);

-- One mix row per step: how strongly that step counts within its chain.
-- Rows are created automatically with each step (weight 100); admins can read
-- and update them but not insert or delete them directly.
create table if not exists public.prompt_chain_mix (
  id bigint generated always as identity primary key,
  chain_id bigint not null references public.prompt_chains (id) on delete cascade,
  step_id bigint not null unique references public.prompt_chain_steps (id) on delete cascade,
  weight integer not null default 100 check (weight between 0 and 100),
  updated_at timestamptz not null default now()
);

create or replace function public.create_mix_for_step()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.prompt_chain_mix (chain_id, step_id) values (new.chain_id, new.id)
  on conflict (step_id) do nothing;
  return new;
end;
$$;
revoke execute on function public.create_mix_for_step() from public, anon, authenticated;

-- Moving a step to another chain moves its mix row with it.
create or replace function public.sync_mix_chain()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.prompt_chain_mix set chain_id = new.chain_id where step_id = new.id;
  return new;
end;
$$;
revoke execute on function public.sync_mix_chain() from public, anon, authenticated;

drop trigger if exists sync_mix_chain on public.prompt_chain_steps;
create trigger sync_mix_chain
  after update of chain_id on public.prompt_chain_steps
  for each row when (old.chain_id is distinct from new.chain_id)
  execute function public.sync_mix_chain();

drop trigger if exists create_mix_for_step on public.prompt_chain_steps;
create trigger create_mix_for_step
  after insert on public.prompt_chain_steps
  for each row execute function public.create_mix_for_step();

-- ---------------------------------------------------------------------------
-- 2. Terms and examples
-- ---------------------------------------------------------------------------

create table if not exists public.terms (
  id bigint generated always as identity primary key,
  term text not null check (char_length(btrim(term)) between 1 and 80),
  definition text check (definition is null or char_length(definition) <= 1000),
  category text check (category is null or char_length(category) <= 40),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists terms_term_key on public.terms (lower(btrim(term)));

create table if not exists public.generation_examples (
  id bigint generated always as identity primary key,
  title text not null check (char_length(btrim(title)) between 1 and 120),
  direction text check (direction is null or char_length(direction) <= 200),
  voice text check (voice is null or voice ~ '^[a-z][a-z-]{0,23}$'),
  caption text not null check (char_length(btrim(caption)) between 1 and 500),
  library_file text check (library_file is null or library_file ~ '^[A-Za-z0-9._-]{1,120}$'),
  notes text check (notes is null or char_length(notes) <= 1000),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- 3. Signup rules (recorded only; nothing enforces them)
-- ---------------------------------------------------------------------------

create table if not exists public.allowed_signup_domains (
  id bigint generated always as identity primary key,
  domain text not null check (domain ~ '^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?(\.[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?)+$' and char_length(domain) <= 253),
  note text check (note is null or char_length(note) <= 200),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists allowed_signup_domains_key on public.allowed_signup_domains (domain);

create table if not exists public.whitelisted_emails (
  id bigint generated always as identity primary key,
  email text not null check (email ~ '^[a-z0-9._%+-]{1,64}@[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?(\.[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?)+$' and char_length(email) <= 254),
  note text check (note is null or char_length(note) <= 200),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists whitelisted_emails_key on public.whitelisted_emails (email);

-- Store them lower-cased and trimmed so duplicates cannot hide behind casing.
create or replace function public.normalize_signup_rule()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_table_name = 'allowed_signup_domains' then
    new.domain := lower(btrim(new.domain));
  else
    new.email := lower(btrim(new.email));
  end if;
  return new;
end;
$$;
revoke execute on function public.normalize_signup_rule() from public, anon, authenticated;

drop trigger if exists normalize_signup_rule on public.allowed_signup_domains;
create trigger normalize_signup_rule before insert or update on public.allowed_signup_domains
  for each row execute function public.normalize_signup_rule();
drop trigger if exists normalize_signup_rule on public.whitelisted_emails;
create trigger normalize_signup_rule before insert or update on public.whitelisted_emails
  for each row execute function public.normalize_signup_rule();

-- ---------------------------------------------------------------------------
-- 4. Images (managed library) + public storage bucket
-- ---------------------------------------------------------------------------

create table if not exists public.images (
  id bigint generated always as identity primary key,
  -- File name inside the bucket: always "<uuid>.<ext>", generated by the server.
  storage_path text not null check (storage_path ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(jpg|png|webp)$'),
  title text not null check (char_length(btrim(title)) between 1 and 120),
  description text check (description is null or char_length(description) <= 500),
  is_active boolean not null default true,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (storage_path)
);

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'library-images', 'library-images', true, 4194304,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update
  set file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- Only superadmins may add, see, replace or remove files here. Everyone can
-- still READ a file by its public URL (the library is meant to be public).
drop policy if exists "Superadmins view library images" on storage.objects;
create policy "Superadmins view library images" on storage.objects
  for select to authenticated using (bucket_id = 'library-images' and public.is_superadmin());
drop policy if exists "Superadmins upload library images" on storage.objects;
create policy "Superadmins upload library images" on storage.objects
  for insert to authenticated with check (bucket_id = 'library-images' and public.is_superadmin());
drop policy if exists "Superadmins update library images" on storage.objects;
create policy "Superadmins update library images" on storage.objects
  for update to authenticated
  using (bucket_id = 'library-images' and public.is_superadmin())
  with check (bucket_id = 'library-images' and public.is_superadmin());
drop policy if exists "Superadmins delete library images" on storage.objects;
create policy "Superadmins delete library images" on storage.objects
  for delete to authenticated using (bucket_id = 'library-images' and public.is_superadmin());

-- ---------------------------------------------------------------------------
-- 5. updated_at triggers, privileges and RLS (superadmin only)
-- ---------------------------------------------------------------------------

do $$
declare
  t text;
begin
  foreach t in array array['prompt_chains','prompt_chain_steps','prompt_chain_mix','terms',
                           'generation_examples','allowed_signup_domains','whitelisted_emails','images']
  loop
    execute format('drop trigger if exists touch_updated_at on public.%I', t);
    execute format('create trigger touch_updated_at before update on public.%I for each row execute function public.touch_updated_at()', t);
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on public.%I from public, anon, authenticated', t);
  end loop;

  foreach t in array array['prompt_chains','prompt_chain_steps','terms','generation_examples',
                           'allowed_signup_domains','whitelisted_emails','images']
  loop
    execute format('grant select, insert, update, delete on public.%I to authenticated', t);
    execute format('drop policy if exists "Superadmins manage %s" on public.%I', t, t);
    execute format('create policy "Superadmins manage %s" on public.%I for all to authenticated using ((select public.is_superadmin())) with check ((select public.is_superadmin()))', t, t);
  end loop;
end $$;

-- Mix: read and update the weight only (no direct insert/delete).
grant select on public.prompt_chain_mix to authenticated;
grant update (weight) on public.prompt_chain_mix to authenticated;
drop policy if exists "Superadmins read prompt chain mix" on public.prompt_chain_mix;
create policy "Superadmins read prompt chain mix" on public.prompt_chain_mix
  for select to authenticated using ((select public.is_superadmin()));
drop policy if exists "Superadmins update prompt chain mix" on public.prompt_chain_mix;
create policy "Superadmins update prompt chain mix" on public.prompt_chain_mix
  for update to authenticated
  using ((select public.is_superadmin()))
  with check ((select public.is_superadmin()));

grant usage on sequence
  public.prompt_chains_id_seq, public.prompt_chain_steps_id_seq, public.terms_id_seq,
  public.generation_examples_id_seq, public.allowed_signup_domains_id_seq,
  public.whitelisted_emails_id_seq, public.images_id_seq
  to authenticated;

-- ---------------------------------------------------------------------------
-- 6. Seed: one documentation chain per existing voice (do not drive Gemini)
-- ---------------------------------------------------------------------------

insert into public.prompt_chains (name, description, voice_id)
select v.name, v.description, v.voice_id
  from (values
    ('Classic', 'A sharp, friendly observational comic. Clean setup, clear punchline.', 'classic'),
    ('Roast Master', 'Affectionate roast-battle host. Aims at the situation, never at people.', 'roast'),
    ('Noir Detective', 'A weary 1940s detective narrating the scene.', 'noir'),
    ('Nature Doc', 'Hushed wildlife narration of everyday people.', 'nature'),
    ('Passive-Aggressive Grandma', 'Sweet words, devastating subtext.', 'grandma'),
    ('Sports Announcer', 'Everything is the championship play-by-play.', 'hype')
  ) as v(name, description, voice_id)
 where not exists (select 1 from public.prompt_chains);

insert into public.prompt_chain_steps (chain_id, position, instruction)
select c.id, 1, 'Write the caption in this voice: ' || c.description
  from public.prompt_chains c
 where not exists (select 1 from public.prompt_chain_steps);

notify pgrst, 'reload schema';
