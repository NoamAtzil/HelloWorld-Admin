# caption admin

Admin dashboard for the caption app (AI photo captions + voting). It is a
separate Next.js app that talks to the **same Supabase project** as the public
app ([NoamAtzil/HelloWorld](https://github.com/NoamAtzil/HelloWorld)).

Only users with `profiles.is_superadmin = true` can use it.

## What it does

- **Dashboard:** totals (users, posts, votes), upvote/downvote split, activity
  chart for the last 30 days, top-rated posts, most active users, recent activity.
- **Users:** read-only list with search and sorting.
- **AI Media:** list/search/sort every generated post; view details; create a
  post; edit its caption/prompt; delete it (votes cascade, image is removed).
- **Votes:** read-only voting history with voter, post and totals.

## How access is secured

1. Google sign-in through Supabase; the proxy sends signed-out visitors to `/login`.
2. Every page and every server action calls `requireAdmin()` (session check +
   `public.is_superadmin()`), not just the layout.
3. The database is the real boundary: every admin read/edit/delete is a
   `SECURITY DEFINER` function that re-checks `is_superadmin()` itself, with
   `EXECUTE` revoked from `anon`. No table policy of the public app was changed.
4. Ordinary users cannot grant themselves admin: `UPDATE` on `profiles` is
   limited to `first_name, last_name, avatar_url, updated_at`, and a trigger
   lets only the trusted database roles (`postgres`, i.e. the SQL editor, and
   `supabase_admin`) change `is_superadmin`, regardless of any JWT.
5. No service-role key is used anywhere; the browser only ever has the anon key.

## Setup

1. **Database** (once, in the Supabase SQL editor of the shared project):
   run `supabase/migrations/001_admin_access.sql`. It is idempotent and does
   not delete data. Then run `supabase/tests/admin_access_checks.sql` after
   step 2 to verify the security rules.
2. **First superadmin:** sign in once (public app or this app), then run:
   ```sql
   update public.profiles
      set is_superadmin = true
    where id = (select id from auth.users where email = 'you@example.com');
   ```
   More admins are added the same way; the app itself can never grant admin.
3. **Auth redirects:** Supabase dashboard > Authentication > URL Configuration >
   Redirect URLs: add `http://localhost:3001/auth/callback` and
   `https://<your-admin-project>.vercel.app/auth/callback`. Leave the Site URL
   and the Google Cloud OAuth client as they are (Google redirects to Supabase,
   not to this app).
4. **Environment** (`.env.local` / Vercel): copy `.env.example`
   (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`).

## Develop

```bash
npm install
npm run dev     # http://localhost:3001
npm run lint && npx tsc --noEmit && npm run build
```

## What not to do

- Don't add a service-role key or any admin API route; everything goes through
  the signed-in admin's own session and the guarded database functions.
- Don't rely on a layout-only auth check (layouts don't re-run on navigation).


## Week 7: Studio, Arena and Daily Drop administration

Run `supabase/migrations/002_admin_studio.sql` **after** the caption app's migration `004`.
It adds superadmin-only functions (same pattern as `001`) behind two new pages:

- **Activity** (`/activity`): guest and member AI usage against the daily limits, Arena
  battles, voices, Drop entries, public shares. Shows a warning if the guest quota secret
  isn't configured.
- **Drops** (`/challenges`): pin a library image and theme to a future day (today and past
  days can't be changed), and review recent Drops with entries, votes and winners.

Post detail pages also show voice, sharing, Drop and Arena record. Deleting a post also
removes its public image copy. No existing admin function or policy was changed.


## Homework 7: AI configuration, activity and access management

Apply, in this order (each is additive and idempotent; the public app's `004` needs the admin `001`
first):

1. admin `001` (already applied) → public `004` → admin `002` → public `005` → admin `003`.

`003_admin_ai_config.sql` adds superadmin-only tables protected by RLS in the database:
`prompt_chains`, `prompt_chain_steps`, `prompt_chain_mix` (read + update weight only; rows are
created with each step), `terms`, `generation_examples`, `allowed_signup_domains`,
`whitelisted_emails` and `images` (plus the public `library-images` bucket, writable only by
superadmins). `005` (public repo) adds `llm_providers`, `llm_models`, `generation_requests` and
`llm_responses`.

Everything is managed from one config-driven page, `/manage/[resource]`
(`src/lib/resources.ts`): Images, Terms, Examples, Chains, Steps, Mix, Models, Providers,
Requests, Responses, Signup domains and Whitelisted emails. The sidebar has six groups and each
group's pages appear as tabs. Generation requests/responses are read-only and are filled by the
caption app's real Studio pipeline. Models and providers referenced by that history cannot be
deleted (deactivate them instead). Signup domains/emails are **recorded only**; nothing enforces
them, so editing them cannot lock anyone out. Prompt chains are configuration only: the live
Gemini prompts are unchanged.
