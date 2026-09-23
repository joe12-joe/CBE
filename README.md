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
- **Live Supabase mode:** set `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` in
  `.env.local`, then provision the backend **once**:

  1. Paste `supabase/init.sql` (schema + starter data, one file) into the Supabase
     **SQL Editor** and run it.
  2. Deploy the user-creation edge function:

     ```bash
     supabase functions deploy create-user --project-ref <your-ref>
     ```

  3. Create accounts deliberately via **Authentication → Users** in the Dashboard
     or the in-app **Admin → Users** page. **No demo accounts are shipped** — the
     first account (granted `SUPER_ADMIN`) is created by you.

### Role model — per-role isolation

Every role sees only its own data and manages only the users beneath it. RLS
enforces this with security-definer helpers over a few scope arrays stored on
`profiles` (`school_ids[]`, `sub_county_ids[]`, `county_ids[]`).

| Role | Scope | Users it can create/manage |
| --- | --- | --- |
| `SUPER_ADMIN` | National — everything | all roles |
| `COUNTY_ADMIN` | own counties | `SUB_COUNTY_ADMIN`, `SCHOOL_ADMIN`, `TEACHER` in scope |
| `SUB_COUNTY_ADMIN` | own sub-counties | `SCHOOL_ADMIN`, `TEACHER` in scope |
| `SCHOOL_ADMIN` | own schools | `TEACHER` in scope |
| `TEACHER` | classes where `classes.teacher_id` is them | — |

Each role also gets its own dashboard: a teacher sees *My classes* with
per-learner averages, a school admin sees their school, and county/sub-county
admins see scope-wide stats.

## What works today

- Role-aware shell with routing guards, term & school switcher, and per-role dashboard
  (teacher "My classes"; school per school; county/sub-county scope-wide)
- Hierarchical user management: create/manage users strictly beneath your role via the
  `create-user` edge function (scope selectors, generated passwords, activate/deactivate)
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
- **RLS role model:** `profiles` stores `role`, `school_ids[]`, `sub_county_ids[]`,
  `county_ids[]`. Security-definer helpers (`app_role()`, `can_access_school()`,
  `teaches_learner()`) scope every table — see `supabase/schema.sql`. A TEACHER can only
  assess classes where `classes.teacher_id` is them.
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