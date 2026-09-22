# Supabase backend

The CBE Manager uses a hosted Supabase project as its backend:

- **Auth** — email/password (Supabase Auth), JWT sessions.
- **Database** — PostgreSQL via PostgREST. Row-level security (RLS) enforces the
  CBC role model (`SUPER_ADMIN`, `COUNTY_ADMIN`, `SUB_COUNTY_ADMIN`,
  `SCHOOL_ADMIN`, `TEACHER`).
- **Edge function** `create-user` — lets a SUPER_ADMIN create new login users
  from the web UI (the Auth admin API can't be called from the browser).

The web app talks to Supabase directly (`apps/web/src/lib/supabase.ts`). When
`VITE_SUPABASE_URL` + `VITE_SUPABASE_ANON_KEY` are set it runs in live mode;
without them it falls back to the in-memory mock DB so the UI can be demoed
offline.

## Files

| File | Purpose |
| --- | --- |
| `schema.sql` | All tables, indexes, RLS helper functions and policies. |
| `seed.sql`   | Starter geography, schools, classes, curriculum, learners, scores, comments. |
| `init.sql`   | Generated snapshot: `schema.sql` + `seed.sql` — one paste for the SQL Editor. |
| `functions/create-user/index.ts` | Edge function that creates Auth users + profiles. |
| `../apps/web/scripts/setup-supabase.mjs` | One-shot setup: applies schema (and seed). |

## Setup (new project)

1. Create a Supabase project (or reuse one).
2. In **Project Settings → API**, copy:
   - Project URL → `VITE_SUPABASE_URL`
   - `anon` / `public` key → `VITE_SUPABASE_ANON_KEY`
   - `service_role` key → `SUPABASE_SERVICE_ROLE_KEY`
3. Put all three in `apps/web/.env.local` (see `apps/web/.env.example`).
   `.env.local` is gitignored.
4. Apply the schema (from `apps/web`):

   ```bash
   node --env-file .env.local scripts/setup-supabase.mjs
   ```

   This applies `schema.sql` + `seed.sql` via the pg-meta SQL endpoint when
   permitted (`--schema-only` skips the seed). If your project rejects the
   pg-meta call, paste `supabase/schema.sql` then `supabase/seed.sql` into the
   dashboard **SQL Editor** and run them.
5. Create your own users — **no demo accounts are shipped**:

   - Dashboard → **Authentication → Users → Add user** (email + password), then
     grant a role with this snippet in the SQL Editor:

     ```sql
     insert into public.profiles (id, name, email, role, school_ids, county_ids)
     select id, coalesce(raw_user_meta_data->>'name', email), email,
            'SUPER_ADMIN', '{}', '{}'
     from auth.users
     where email = '<the user email>';
     ```

     - `SUPER_ADMIN` — all data.
     - `SCHOOL_ADMIN` / `TEACHER` — put the school uuid in `school_ids`.
     - `COUNTY_ADMIN` / `SUB_COUNTY_ADMIN` — put county uuid(s) in `county_ids`.
   - Or deploy the edge function and create users from the in-app Users page:

     ```bash
     supabase link
     supabase functions deploy create-user
     ```

6. Start the app: `npm run dev` from `apps/web`.

## Notes

- **RLS roles**: the `profiles` table stores `role`, `school_ids[]` and
  `county_ids[]`. Policies use security-definer helpers (`app_role()`,
  `can_access_school()`…) to scope every table to the signed-in user.
- **Teacher scoping**: a TEACHER may only write scores/comments for learners in
  a class where `classes.teacher_id = auth.uid()`.
- **Seed data is starter/placeholder**: curriculum follows the official CBC
  structure but should be verified against KICD before production. UPI values
  are placeholders until NEMIS/UPI integration.
- **Scores** are 0–10 per learner per sub-strand per term; levels are derived
  (EE ≥ 8, ME ≥ 6, AE ≥ 4, BE < 4).