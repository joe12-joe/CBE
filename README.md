# CBE Manager — Kenya Competency-Based Education

A web application for managing the **Competency-Based Curriculum (CBC)** in Kenyan schools:
learner records, learning areas & strands, sub-strand assessments, KKEC performance levels,
report cards, and county/school analytics.

The frontend talks directly to **Supabase** (Auth + Postgres/PostgREST with row-level security)
when configured, and falls back to an in-memory mock data layer when it isn't — so the UI can be
demoed with zero backend while still being fully live against a real database.

## Stack

- **React 19 + TypeScript + Vite**
- **Tailwind CSS v4** with shadcn-style components (Radix primitives)
- **TanStack Query** (server state), **Zustand** (auth/term/school context)
- **react-hook-form + Zod** (forms + validation)
- **Supabase** (`@supabase/supabase-js`) — Auth + PostgREST; RLS enforces the CBC role model
- **Recharts** (dashboards), **sonner** (toasts)

## Getting started

```bash
cd apps/web
npm install
cp .env.example .env.local   # fill in your Supabase values, or run without them (mock mode)
npm run dev                  # http://localhost:5173
```

Production build: `npm run build` (outputs to `dist/`), preview with `npm run preview`.

### Modes

- **Mock mode (default):** no env vars — every screen works against the in-memory seed DB.
- **Live Supabase mode:** set `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`, then set up the
  project once (see [`supabase/README.md`](supabase/README.md)):

  ```bash
  cd apps/web
  node --env-file .env.local scripts/setup-supabase.mjs
  ```

  This applies `supabase/schema.sql` + `supabase/seed.sql` (tables, RLS and starter data).
  No demo accounts are created — add your own under Supabase Authentication and grant a role
  with the profile snippet the script prints (or the `create-user` edge function).

  **Fastest manual path:** paste `supabase/init.sql` (schema + seed combined) into the
  dashboard **SQL Editor** and run it — done there.

## What works today

- Role-aware shell, routing guards, term & school switcher
- Learner CRUD + enrolment (UPI auto-generation, class placement)
- Curriculum explorer per grade (learning areas → strands → sub-strands), admin edits
- Bulk assessment grid (learners × sub-strands), KKEC level badges, keyboard entry, dirty tracking
- CBC report card preview (KKEC levels, teacher/head comments) + print stylesheet
- Dashboard + analytics (enrolment, level distribution, weakest learning areas, county comparison)

## Architecture notes

- **Swappable data layer:** `src/services/*` expose the frozen contract
  (`src/lib/types.ts`). Each service tries the Supabase path first; if
  `VITE_SUPABASE_URL`/`VITE_SUPABASE_ANON_KEY` are unset it uses the in-memory seed DB in
  `src/services/mocks/db.ts` (with simulated latency). No UI code knows which backend it's on.
- **RLS role model:** `profiles` stores `role`, `school_ids[]`, `county_ids[]`. Security-definer
  helpers (`app_role()`, `can_access_school()`, `teaches_learner()`) scope every table — see
  `supabase/schema.sql`. A TEACHER can only assess classes where `classes.teacher_id` is them.
- **Curriculum seed data** is starter data — verify learning areas/strands/sub-strands against the
  current KICD framework before production use.
- **UPI** values in the seed/data-entry path are placeholders until integration with the official
  UPI/NEMIS systems.

## Deployment

Containerised static hosting (SPA fallback included). The browser talks to Supabase directly,
so no API proxy is required:

```bash
docker build -t cbe-web apps/web
docker run -p 8080:80 cbe-web
```