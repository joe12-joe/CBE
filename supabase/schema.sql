-- ============================================================================
-- CBE Manager — Supabase schema (PostgreSQL)
-- Apply in the Supabase SQL editor (or `supabase db push` / psql).
-- Sets up tables, row-level security (RLS) for the CBC role model, and indexes.
-- Demo data lives in seed.sql; demo login accounts are created by
-- scripts/setup-supabase.mjs (they require the Supabase Auth admin API).
-- ============================================================================

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- Reference: geography
-- ---------------------------------------------------------------------------
create table if not exists public.counties (
  id   uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null
);

create table if not exists public.sub_counties (
  id        uuid primary key default gen_random_uuid(),
  county_id uuid not null references public.counties(id) on delete cascade,
  name      text not null
);

-- ---------------------------------------------------------------------------
-- Schools
-- ---------------------------------------------------------------------------
create table if not exists public.schools (
  id           uuid primary key default gen_random_uuid(),
  code         text not null unique,            -- NEMIS-style code
  name         text not null,
  type         text not null check (type in ('PRIMARY', 'JUNIOR_SECONDARY')),
  county_id    uuid not null references public.counties(id),
  sub_county_id uuid not null references public.sub_counties(id),
  address      text,
  phone        text
);

-- ---------------------------------------------------------------------------
-- Users (profiles): one row per Supabase Auth user.
-- school_ids / county_ids keep role scoping simple and RLS-friendly.
-- ---------------------------------------------------------------------------
create table if not exists public.profiles (
  id         uuid primary key references auth.users(id) on delete cascade,
  name       text not null default '',
  email      text not null unique,
  role       text not null default 'TEACHER'
             check (role in ('SUPER_ADMIN','COUNTY_ADMIN','SUB_COUNTY_ADMIN','SCHOOL_ADMIN','TEACHER')),
  school_ids    uuid[] not null default '{}',
  county_ids    uuid[] not null default '{}',
  sub_county_ids uuid[] not null default '{}',
  active        boolean not null default true,
  created_at    timestamptz not null default now()
);

-- For databases created before sub-county scoping existed:
alter table public.profiles add column if not exists sub_county_ids uuid[] not null default '{}';

-- ---------------------------------------------------------------------------
-- Classes & learners
-- ---------------------------------------------------------------------------
create table if not exists public.classes (
  id         uuid primary key default gen_random_uuid(),
  school_id  uuid not null references public.schools(id) on delete cascade,
  grade      text not null check (grade in ('PP1','PP2','G1','G2','G3','G4','G5','G6','G7','G8','G9')),
  stream     text not null,
  teacher_id uuid references public.profiles(id) on delete set null
);

create table if not exists public.learners (
  id             uuid primary key default gen_random_uuid(),
  upi            text not null unique,           -- Unique Personal Identifier
  nemis          text,
  first_name     text not null,
  middle_name    text,
  last_name      text not null,
  gender         text not null check (gender in ('M','F')),
  dob            date not null,
  school_id      uuid not null references public.schools(id),
  class_id       uuid references public.classes(id),
  guardian_name  text,
  guardian_phone text,
  admission_year int not null
);

create table if not exists public.enrollments (
  id         uuid primary key default gen_random_uuid(),
  learner_id uuid not null references public.learners(id) on delete cascade,
  class_id   uuid not null references public.classes(id) on delete cascade,
  year       int  not null,
  term       int  not null check (term between 1 and 3),
  status     text not null default 'ACTIVE' check (status in ('ACTIVE','COMPLETED','TRANSFERRED')),
  unique (learner_id, class_id, year, term)
);

-- ---------------------------------------------------------------------------
-- Curriculum: learning areas → strands → sub-strands (per grade)
-- ---------------------------------------------------------------------------
create table if not exists public.learning_areas (
  id   uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null
);

create table if not exists public.learning_area_grades (
  learning_area_id uuid not null references public.learning_areas(id) on delete cascade,
  grade            text not null,
  primary key (learning_area_id, grade)
);

create table if not exists public.strands (
  id               uuid primary key default gen_random_uuid(),
  code             text not null,
  name             text not null,
  learning_area_id uuid not null references public.learning_areas(id) on delete cascade
);

create table if not exists public.strand_grades (
  strand_id uuid not null references public.strands(id) on delete cascade,
  grade     text not null,
  primary key (strand_id, grade)
);

create table if not exists public.sub_strands (
  id        uuid primary key default gen_random_uuid(),
  code      text not null,
  name      text not null,
  strand_id uuid not null references public.strands(id) on delete cascade,
  grade     text not null
);

-- ---------------------------------------------------------------------------
-- Assessment results (0–10 per learner per sub-strand per term)
-- ---------------------------------------------------------------------------
create table if not exists public.scores (
  id            uuid primary key default gen_random_uuid(),
  learner_id    uuid not null references public.learners(id) on delete cascade,
  sub_strand_id uuid not null references public.sub_strands(id) on delete cascade,
  year          int  not null,
  term          int  not null check (term between 1 and 3),
  score         numeric(3,1) not null check (score >= 0 and score <= 10),
  recorded_by   uuid references public.profiles(id) on delete set null,
  unique (learner_id, sub_strand_id, year, term)
);

create table if not exists public.comments (
  id              uuid primary key default gen_random_uuid(),
  learner_id      uuid not null references public.learners(id) on delete cascade,
  year            int  not null,
  term            int  not null check (term between 1 and 3),
  teacher_comment text,
  head_comment    text,
  next_term_focus text,
  unique (learner_id, year, term)
);

-- ---------------------------------------------------------------------------
-- RLS helper functions (security definer ⇒ they bypass RLS, avoiding recursion)
-- ---------------------------------------------------------------------------
create or replace function public.app_role()
returns text language sql stable security definer set search_path = public as $$
  select coalesce((select role from public.profiles where id = auth.uid()), '')
$$;

create or replace function public.app_school_ids()
returns uuid[] language sql stable security definer set search_path = public as $$
  select coalesce((select school_ids from public.profiles where id = auth.uid()), '{}')
$$;

create or replace function public.app_county_ids()
returns uuid[] language sql stable security definer set search_path = public as $$
  select coalesce((select county_ids from public.profiles where id = auth.uid()), '{}')
$$;

create or replace function public.app_sub_county_ids()
returns uuid[] language sql stable security definer set search_path = public as $$
  select coalesce((select sub_county_ids from public.profiles where id = auth.uid()), '{}')
$$;

-- Can the current user access a given school?
create or replace function public.can_access_school(p_school_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select
    public.app_role() = 'SUPER_ADMIN'
    or p_school_id = any(public.app_school_ids())
    or exists (
      select 1 from public.schools s
      where s.id = p_school_id
        and (
          s.county_id = any(public.app_county_ids())
          or s.sub_county_id = any(public.app_sub_county_ids())
        )
    )
$$;

-- Read scope for a learner: admins/oversight roles use school access; teachers
-- are limited to learners in the classes they teach (not the whole school).
create or replace function public.can_read_learner(p_learner_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select
    public.app_role() = 'SUPER_ADMIN'
    or (
      public.can_access_school((select l.school_id from public.learners l where l.id = p_learner_id))
      and (public.app_role() <> 'TEACHER' or public.teaches_learner(p_learner_id))
    )
$$;

-- Does the current teacher teach the learner's class?
create or replace function public.teaches_learner(p_learner_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1
    from public.learners l
    join public.classes c on c.id = l.class_id
    where l.id = p_learner_id and c.teacher_id = auth.uid()
  )
$$;

-- ---------------------------------------------------------------------------
-- Indexes
-- ---------------------------------------------------------------------------
create index if not exists idx_learners_school  on public.learners(school_id);
create index if not exists idx_learners_class   on public.learners(class_id);
create index if not exists idx_classes_school   on public.classes(school_id);
create index if not exists idx_sub_strands_grade on public.sub_strands(grade);
create index if not exists idx_scores_learner   on public.scores(learner_id);
create index if not exists idx_scores_substrand on public.scores(sub_strand_id);
create index if not exists idx_scores_term      on public.scores(year, term);
create index if not exists idx_enrollments_learner on public.enrollments(learner_id);
create index if not exists idx_profiles_role    on public.profiles(role);

-- ---------------------------------------------------------------------------
-- RLS: enable + policies
-- ---------------------------------------------------------------------------
alter table public.counties            enable row level security;
alter table public.sub_counties        enable row level security;
alter table public.schools             enable row level security;
alter table public.profiles            enable row level security;
alter table public.classes             enable row level security;
alter table public.learners            enable row level security;
alter table public.enrollments         enable row level security;
alter table public.learning_areas      enable row level security;
alter table public.learning_area_grades enable row level security;
alter table public.strands             enable row level security;
alter table public.strand_grades       enable row level security;
alter table public.sub_strands         enable row level security;
alter table public.scores              enable row level security;
alter table public.comments            enable row level security;

-- Geography & curriculum: any signed-in user may read.
drop policy if exists geo_read on public.counties;
create policy geo_read  on public.counties      for select to authenticated using (true);
drop policy if exists geo_sub_read on public.sub_counties;
create policy geo_sub_read on public.sub_counties for select to authenticated using (true);
drop policy if exists la_read on public.learning_areas;
create policy la_read   on public.learning_areas for select to authenticated using (true);
drop policy if exists la_g_read on public.learning_area_grades;
create policy la_g_read on public.learning_area_grades for select to authenticated using (true);
drop policy if exists strand_read on public.strands;
create policy strand_read on public.strands     for select to authenticated using (true);
drop policy if exists sg_read on public.strand_grades;
create policy sg_read   on public.strand_grades for select to authenticated using (true);
drop policy if exists sub_read on public.sub_strands;
create policy sub_read  on public.sub_strands   for select to authenticated using (true);

-- Curriculum & geography writes: super admin only.
drop policy if exists geo_write on public.counties;
create policy geo_write on public.counties  for all to public using (public.app_role() = 'SUPER_ADMIN') with check (public.app_role() = 'SUPER_ADMIN');
drop policy if exists geo_sub_write on public.sub_counties;
create policy geo_sub_write on public.sub_counties for all to public using (public.app_role() = 'SUPER_ADMIN') with check (public.app_role() = 'SUPER_ADMIN');
drop policy if exists la_write on public.learning_areas;
create policy la_write  on public.learning_areas for all to public using (public.app_role() = 'SUPER_ADMIN') with check (public.app_role() = 'SUPER_ADMIN');
drop policy if exists la_g_write on public.learning_area_grades;
create policy la_g_write on public.learning_area_grades for all to public using (public.app_role() = 'SUPER_ADMIN') with check (public.app_role() = 'SUPER_ADMIN');
drop policy if exists strand_write on public.strands;
create policy strand_write on public.strands for all to public using (public.app_role() = 'SUPER_ADMIN') with check (public.app_role() = 'SUPER_ADMIN');
drop policy if exists sg_write on public.strand_grades;
create policy sg_write  on public.strand_grades for all to public using (public.app_role() = 'SUPER_ADMIN') with check (public.app_role() = 'SUPER_ADMIN');
drop policy if exists sub_write on public.sub_strands;
create policy sub_write on public.sub_strands for all to public using (public.app_role() = 'SUPER_ADMIN') with check (public.app_role() = 'SUPER_ADMIN');

-- Schools: all signed-in users read; only super admin writes.
drop policy if exists school_read on public.schools;
create policy school_read on public.schools for select to authenticated using (true);
drop policy if exists school_write on public.schools;
create policy school_write on public.schools for all to public using (public.app_role() = 'SUPER_ADMIN') with check (public.app_role() = 'SUPER_ADMIN');

-- Teachers can't manage schools by policy above.

-- Classes: read if you can access the school; write roles are super/school admin (with access).
drop policy if exists class_read on public.classes;
create policy class_read on public.classes
  for select to authenticated using (
    public.can_access_school(school_id)
    and (public.app_role() <> 'TEACHER' or teacher_id = auth.uid())
  );
drop policy if exists class_write on public.classes;
create policy class_write on public.classes
  for all to public
  using (public.app_role() in ('SUPER_ADMIN','SCHOOL_ADMIN') and public.can_access_school(school_id))
  with check (public.app_role() in ('SUPER_ADMIN','SCHOOL_ADMIN') and public.can_access_school(school_id));

-- Learners: read if you can access the school; write school admins/super admin.
drop policy if exists learner_read on public.learners;
create policy learner_read on public.learners
  for select to authenticated using (public.can_read_learner(id));
drop policy if exists learner_write on public.learners;
create policy learner_write on public.learners
  for insert to authenticated with check (
    public.app_role() in ('SUPER_ADMIN','SCHOOL_ADMIN') and public.can_access_school(school_id)
  );
drop policy if exists learner_update on public.learners;
create policy learner_update on public.learners
  for update to authenticated using (
    public.app_role() in ('SUPER_ADMIN','SCHOOL_ADMIN') and public.can_access_school(school_id)
  )
  with check (
    public.app_role() in ('SUPER_ADMIN','SCHOOL_ADMIN') and public.can_access_school(school_id)
  );
drop policy if exists learner_delete on public.learners;
create policy learner_delete on public.learners
  for delete to authenticated using (public.app_role() in ('SUPER_ADMIN','SCHOOL_ADMIN') and public.can_access_school(school_id));

-- Enrollments: tied to the learner's school.
drop policy if exists enroll_read on public.enrollments;
create policy enroll_read on public.enrollments
  for select to authenticated using (public.can_read_learner(learner_id));
drop policy if exists enroll_insert on public.enrollments;
create policy enroll_insert on public.enrollments
  for insert to authenticated with check (
    public.app_role() in ('SUPER_ADMIN','SCHOOL_ADMIN') and
    exists (select 1 from public.learners l where l.id = learner_id and public.can_access_school(l.school_id))
  );
drop policy if exists enroll_update on public.enrollments;
create policy enroll_update on public.enrollments
  for update to authenticated using (
    exists (select 1 from public.learners l where l.id = learner_id and public.can_access_school(l.school_id))
  ) with check (
    exists (select 1 from public.learners l where l.id = learner_id and public.can_access_school(l.school_id))
  );
drop policy if exists enroll_delete on public.enrollments;
create policy enroll_delete on public.enrollments
  for delete to authenticated using (
    exists (select 1 from public.learners l where l.id = learner_id and public.can_access_school(l.school_id))
  );

-- Profiles: you may read your own, and admins may list scoped rows.
drop policy if exists profile_self on public.profiles;
create policy profile_self on public.profiles
  for select to authenticated using (
    id = auth.uid()
    or public.app_role() = 'SUPER_ADMIN'
    or (public.app_school_ids() && school_ids)
    or (public.app_county_ids() && county_ids)
    or (public.app_sub_county_ids() && sub_county_ids)
  );
drop policy if exists profile_write on public.profiles;
create policy profile_write on public.profiles
  for insert to public with check (public.app_role() = 'SUPER_ADMIN');
drop policy if exists profile_update on public.profiles;
create policy profile_update on public.profiles
  for update to public using (
    public.app_role() = 'SUPER_ADMIN'
    or (public.app_role() in ('COUNTY_ADMIN','SUB_COUNTY_ADMIN')
        and (public.app_county_ids() && county_ids or public.app_sub_county_ids() && sub_county_ids))
    or (public.app_role() = 'SCHOOL_ADMIN' and public.app_school_ids() && school_ids)
  ) with check (
    public.app_role() = 'SUPER_ADMIN'
    or (public.app_role() in ('COUNTY_ADMIN','SUB_COUNTY_ADMIN')
        and (public.app_county_ids() && county_ids or public.app_sub_county_ids() && sub_county_ids))
    or (public.app_role() = 'SCHOOL_ADMIN' and public.app_school_ids() && school_ids)
  );
drop policy if exists profile_delete on public.profiles;
create policy profile_delete on public.profiles
  for delete to public using (public.app_role() = 'SUPER_ADMIN');

-- Scores: read with school access; write school admins (with access) or the learner's teacher.
drop policy if exists score_read on public.scores;
create policy score_read on public.scores
  for select to authenticated using (public.can_read_learner(learner_id));
drop policy if exists score_write on public.scores;
create policy score_write on public.scores
  for insert to authenticated with check (
    (public.app_role() in ('SUPER_ADMIN','SCHOOL_ADMIN')
      and exists (select 1 from public.learners l where l.id = learner_id and public.can_access_school(l.school_id)))
    or (public.app_role() = 'TEACHER' and public.teaches_learner(learner_id))
  );
drop policy if exists score_update on public.scores;
create policy score_update on public.scores
  for update to authenticated using (
    (public.app_role() in ('SUPER_ADMIN','SCHOOL_ADMIN')
      and exists (select 1 from public.learners l where l.id = learner_id and public.can_access_school(l.school_id)))
    or (public.app_role() = 'TEACHER' and public.teaches_learner(learner_id))
  ) with check (
    (public.app_role() in ('SUPER_ADMIN','SCHOOL_ADMIN')
      and exists (select 1 from public.learners l where l.id = learner_id and public.can_access_school(l.school_id)))
    or (public.app_role() = 'TEACHER' and public.teaches_learner(learner_id))
  );
drop policy if exists score_delete on public.scores;
create policy score_delete on public.scores
  for delete to authenticated using (
    (public.app_role() in ('SUPER_ADMIN','SCHOOL_ADMIN')
      and exists (select 1 from public.learners l where l.id = learner_id and public.can_access_school(l.school_id)))
    or (public.app_role() = 'TEACHER' and public.teaches_learner(learner_id))
  );

-- Comments: same scoping as scores.
drop policy if exists comment_read on public.comments;
create policy comment_read on public.comments
  for select to authenticated using (public.can_read_learner(learner_id));
drop policy if exists comment_write on public.comments;
create policy comment_write on public.comments
  for insert to authenticated with check (
    (public.app_role() in ('SUPER_ADMIN','SCHOOL_ADMIN')
      and exists (select 1 from public.learners l where l.id = learner_id and public.can_access_school(l.school_id)))
    or (public.app_role() = 'TEACHER' and public.teaches_learner(learner_id))
  );
drop policy if exists comment_update on public.comments;
create policy comment_update on public.comments
  for update to authenticated using (
    (public.app_role() in ('SUPER_ADMIN','SCHOOL_ADMIN')
      and exists (select 1 from public.learners l where l.id = learner_id and public.can_access_school(l.school_id)))
    or (public.app_role() = 'TEACHER' and public.teaches_learner(learner_id))
  ) with check (
    (public.app_role() in ('SUPER_ADMIN','SCHOOL_ADMIN')
      and exists (select 1 from public.learners l where l.id = learner_id and public.can_access_school(l.school_id)))
    or (public.app_role() = 'TEACHER' and public.teaches_learner(learner_id))
  );
drop policy if exists comment_delete on public.comments;
create policy comment_delete on public.comments
  for delete to authenticated using (
    (public.app_role() in ('SUPER_ADMIN','SCHOOL_ADMIN')
      and exists (select 1 from public.learners l where l.id = learner_id and public.can_access_school(l.school_id)))
    or (public.app_role() = 'TEACHER' and public.teaches_learner(learner_id))
  );