# CBE Manager — Kenya Competency-Based Education

A web application for managing the **Competency-Based Curriculum (CBC)** in Kenyan schools:
learner records, learning areas & strands, sub-strand assessments, KKEC performance levels,
report cards, and county/school analytics.

Currently a **frontend-first build**: the entire UI runs against a typed mock service layer so it
can be developed, demoed, and reviewed before the backend exists.

## Stack

- **React 18 + TypeScript + Vite**
- **Tailwind CSS v4** with shadcn-style components (Radix primitives)
- **TanStack Query** (server state), **Zustand** (auth/term/school context)
- **react-hook-form + Zod** (forms + validation)
- **Recharts** (dashboards), **sonner** (toasts)

## Getting started

```bash
cd apps/web
npm install
npm run dev        # http://localhost:5173
```

Production build: `npm run build` (outputs to `dist/`), preview with `npm run preview`.

## Demo accounts

Any password works. Click a badge on the login screen to fill the email.

| Role            | Email                              | Scope |
| --------------- | ---------------------------------- | ----- |
| Super Admin     | `superadmin@cbe.go.ke`             | All counties & schools |
| County Admin    | `county@nairobi.cbe.go.ke`         | Nairobi schools |
| Sub-County Admin| `subcounty@kasarani.cbe.go.ke`     | Kasarani schools |
| School Admin    | `admin@langataestate.ac.ke`        | Langata Estate Primary |
| Teacher         | `teacher@langataestate.ac.ke`      | Own classes (G5) |

## What works today

- Role-aware shell, routing guards, term & school switcher
- Learner CRUD + enrolment (UPI auto-generation, class placement)
- Curriculum explorer per grade (learning areas → strands → sub-strands), admin edits
- Bulk assessment grid (learners × sub-strands), live level badges, keyboard entry, dirty tracking
- CBC report card preview (KKEC levels, teacher/head comments) + print stylesheet
- Dashboard + analytics (enrolment, level distribution, weakest learning areas, county comparison)

## Architecture notes

- **Frozen API contract:** `src/lib/types.ts` and the signatures in `src/services/*` are the
  interface the future backend must implement. Today the services read/write the in-memory seed
  DB in `src/services/mocks/db.ts` (with simulated latency).
- **Curriculum seed data** is starter data — verify learning areas/strands/sub-strands against the
  current KICD framework before production use.
- **UPI** values in the seed/data-entry path are placeholders until integration with the official
  UPI/NEMIS systems.

## Deployment

Containerised static hosting (SPA fallback included):

```bash
docker build -t cbe-web apps/web
docker run -p 8080:80 cbe-web
```

## Next steps (backend)

Implement `apps/api` (Node + Express + PostgreSQL, multi-tenant) against the frozen contract;
swap `src/services` implementations from the mock DB to REST calls without touching any UI code.