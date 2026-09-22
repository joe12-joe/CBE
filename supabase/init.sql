-- ============================================================================
-- CBE Manager — full setup (generated: schema.sql + seed.sql)
-- One paste in the Supabase SQL Editor applies everything.
-- This file is idempotent: re-running it clears starter data and recreates it,
-- leaving rows in public.profiles untouched.
-- ============================================================================
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
  school_ids uuid[] not null default '{}',
  county_ids uuid[] not null default '{}',
  active     boolean not null default true,
  created_at timestamptz not null default now()
);

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

-- Can the current user access a given school?
create or replace function public.can_access_school(p_school_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select
    public.app_role() = 'SUPER_ADMIN'
    or p_school_id = any(public.app_school_ids())
    or exists (
      select 1 from public.schools s
      where s.id = p_school_id and s.county_id = any(public.app_county_ids())
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
  for select to authenticated using (public.can_access_school(school_id));
drop policy if exists class_write on public.classes;
create policy class_write on public.classes
  for all to public
  using (public.app_role() in ('SUPER_ADMIN','SCHOOL_ADMIN') and public.can_access_school(school_id))
  with check (public.app_role() in ('SUPER_ADMIN','SCHOOL_ADMIN') and public.can_access_school(school_id));

-- Learners: read if you can access the school; write school admins/super admin.
drop policy if exists learner_read on public.learners;
create policy learner_read on public.learners
  for select to authenticated using (public.can_access_school(school_id));
drop policy if exists learner_write on public.learners;
create policy learner_write on public.learners
  for insert to authenticated with check (
    public.app_role() in ('SUPER_ADMIN','SCHOOL_ADMIN') and public.can_access_school(school_id)
  );
drop policy if exists learner_update on public.learners;
create policy learner_update on public.learners
  for update to authenticated using (public.can_access_school(school_id))
  with check (public.can_access_school(school_id));
drop policy if exists learner_delete on public.learners;
create policy learner_delete on public.learners
  for delete to authenticated using (public.app_role() in ('SUPER_ADMIN','SCHOOL_ADMIN') and public.can_access_school(school_id));

-- Enrollments: tied to the learner's school.
drop policy if exists enroll_read on public.enrollments;
create policy enroll_read on public.enrollments
  for select to authenticated using (
    exists (select 1 from public.learners l where l.id = learner_id and public.can_access_school(l.school_id))
  );
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
  );
drop policy if exists profile_write on public.profiles;
create policy profile_write on public.profiles
  for all to public using (public.app_role() = 'SUPER_ADMIN') with check (public.app_role() = 'SUPER_ADMIN');

-- Scores: read with school access; write school admins (with access) or the learner's teacher.
drop policy if exists score_read on public.scores;
create policy score_read on public.scores
  for select to authenticated using (
    exists (select 1 from public.learners l where l.id = learner_id and public.can_access_school(l.school_id))
  );
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
  for select to authenticated using (
    exists (select 1 from public.learners l where l.id = learner_id and public.can_access_school(l.school_id))
  );
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

-- Idempotent re-runs: clear starter data (profiles / user rows are NOT touched).
truncate table
  public.scores, public.comments, public.enrollments, public.learners, public.classes,
  public.sub_strands, public.strand_grades, public.strands,
  public.learning_area_grades, public.learning_areas,
  public.schools, public.sub_counties, public.counties
cascade;

-- ============================================================================
-- CBE Manager — demo data
-- Apply AFTER schema.sql (or just run the combined supabase/init.sql).
-- No accounts are created by this seed — add users via the Supabase Dashboard
-- and grant a role with the snippet in supabase/README.md.
-- ============================================================================

-- --- Geography --------------------------------------------------------------
insert into public.counties (id, code, name) values
  ('10000000-0000-4000-8000-000000000001', '47', 'Nairobi'),
  ('10000000-0000-4000-8000-000000000002', '22', 'Kiambu'),
  ('10000000-0000-4000-8000-000000000003', '1',  'Mombasa');

insert into public.sub_counties (id, county_id, name) values
  ('20000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000001', 'Langata'),
  ('20000000-0000-4000-8000-000000000002', '10000000-0000-4000-8000-000000000001', 'Kasarani'),
  ('20000000-0000-4000-8000-000000000003', '10000000-0000-4000-8000-000000000002', 'Ruiru');

-- --- Schools ----------------------------------------------------------------
insert into public.schools (id, code, name, type, county_id, sub_county_id, address, phone) values
  ('30000000-0000-4000-8000-000000000001', '14700112034', 'Langata Estate Primary School', 'PRIMARY',
   '10000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000001',
   'Langata Road, Nairobi', '+254 720 100 100'),
  ('30000000-0000-4000-8000-000000000002', '14700345567', 'Kasarani Primary School', 'PRIMARY',
   '10000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000002',
   'Kasarani Road, Nairobi', '+254 720 100 200'),
  ('30000000-0000-4000-8000-000000000003', '22300118765', 'Ruiru Junior Secondary School', 'JUNIOR_SECONDARY',
   '10000000-0000-4000-8000-000000000002', '20000000-0000-4000-8000-000000000003',
   'Ruiru Town, Kiambu', '+254 720 100 300');

-- --- Classes (teacher_id assigned by setup-supabase.mjs) --------------------
insert into public.classes (id, school_id, grade, stream, teacher_id) values
  ('40000000-0000-4000-8000-000000000101', '30000000-0000-4000-8000-000000000001', 'G5',  'Brown',  null),
  ('40000000-0000-4000-8000-000000000102', '30000000-0000-4000-8000-000000000001', 'G5',  'Blue',   null),
  ('40000000-0000-4000-8000-000000000103', '30000000-0000-4000-8000-000000000001', 'G4',  'Yellow', null),
  ('40000000-0000-4000-8000-000000000104', '30000000-0000-4000-8000-000000000001', 'G3',  'Green',  null),
  ('40000000-0000-4000-8000-000000000105', '30000000-0000-4000-8000-000000000001', 'G1',  'Red',    null),
  ('40000000-0000-4000-8000-000000000106', '30000000-0000-4000-8000-000000000001', 'PP1', 'Sunrise', null),
  ('40000000-0000-4000-8000-000000000107', '30000000-0000-4000-8000-000000000001', 'G6',  'Amber',  null),
  ('40000000-0000-4000-8000-000000000201', '30000000-0000-4000-8000-000000000002', 'G4',  'Red',    null),
  ('40000000-0000-4000-8000-000000000202', '30000000-0000-4000-8000-000000000002', 'G6',  'White',  null),
  ('40000000-0000-4000-8000-000000000301', '30000000-0000-4000-8000-000000000003', 'G7',  'Amber',  null),
  ('40000000-0000-4000-8000-000000000302', '30000000-0000-4000-8000-000000000003', 'G9',  'Silver', null);

-- --- Curriculum -------------------------------------------------------------
do $$
declare
  v_area uuid;
  v_strand uuid;
  v_grades text[];
  v_grade text;
  v_strand_name text;
  v_seq int := 0;
  v_rec record;
begin
  for v_rec in select * from (values
    ('MAT', 'Mathematics',               'PP1,PP2,G1,G2,G3,G4,G5,G6,G7,G8,G9', 'Numbers and Operations|Measurement|Geometry|Data Handling'),
    ('ENG', 'English',                    'G1,G2,G3,G4,G5,G6,G7,G8,G9',         'Listening and Speaking|Reading|Writing|Grammar'),
    ('KIS', 'Kiswahili',                  'PP1,PP2,G1,G2,G3,G4,G5,G6,G7,G8,G9', 'Kusikiliza na Kuzungumza|Kusoma|Kuandika|Matumizi ya Lugha'),
    ('SCI', 'Integrated Science',         'G4,G5,G6,G7,G8,G9',                  'Living Things|Environment and Conservation|Matter and Energy|Earth and Space'),
    ('SST', 'Social Studies',             'G4,G5,G6,G7,G8,G9',                  'Our Country|People and Population|Economic Activities|Governance'),
    ('AGR', 'Agriculture and Nutrition',  'G4,G5,G6,G7,G8,G9',                  'Crop Production|Animal Production|Nutrition and Health'),
    ('CRE', 'Religious Education (CRE)',  'PP1,PP2,G1,G2,G3,G4,G5,G6,G7,G8,G9', 'Creation|The Family|The Church|Values and Morals'),
    ('PE',  'Sports and Physical Education', 'PP1,PP2,G1,G2,G3,G4,G5,G6,G7,G8,G9', 'Athletics|Games|Movement and Coordination')
  ) as t(acode, aname, agrades, astrands) loop

    insert into public.learning_areas (code, name) values (v_rec.acode, v_rec.aname) returning id into v_area;

    v_grades := string_to_array(v_rec.agrades, ',');
    foreach v_grade in array v_grades loop
      insert into public.learning_area_grades (learning_area_id, grade) values (v_area, trim(v_grade));
    end loop;

    foreach v_strand_name in array string_to_array(v_rec.astrands, '|') loop
      v_seq := v_seq + 1;
      insert into public.strands (code, name, learning_area_id)
      values (v_rec.acode || '.' || v_seq, trim(v_strand_name), v_area)
      returning id into v_strand;

      foreach v_grade in array v_grades loop
        insert into public.strand_grades (strand_id, grade) values (v_strand, trim(v_grade));
        insert into public.sub_strands (code, name, strand_id, grade) values
          (v_rec.acode || '.' || v_seq || '.1', trim(v_strand_name) || ' — Competency 1', v_strand, trim(v_grade)),
          (v_rec.acode || '.' || v_seq || '.2', trim(v_strand_name) || ' — Competency 2', v_strand, trim(v_grade));
      end loop;
    end loop;
  end loop;
end $$;

-- --- Learners ---------------------------------------------------------------
insert into public.learners
  (upi, nemis, first_name, middle_name, last_name, gender, dob, school_id, class_id, admission_year) values
  -- Langata Estate · G5 Brown (demo class)
  ('4000000001', 'N80001', 'Brian',   'Otieno',   'Odhiambo',  'M', '2013-04-12', '30000000-0000-4000-8000-000000000001', '40000000-0000-4000-8000-000000000101', 2024),
  ('4200000002', 'N80002', 'Cynthia', 'Njeri',    'Wairimu',   'F', '2013-06-23', '30000000-0000-4000-8000-000000000001', '40000000-0000-4000-8000-000000000101', 2024),
  ('4400000003', 'N80003', 'Daniel',  'Kipchoge', 'Kiplagat',  'M', '2013-01-30', '30000000-0000-4000-8000-000000000001', '40000000-0000-4000-8000-000000000101', 2024),
  ('4600000004', 'N80004', 'Esther',  'Akinyi',   'Achieng',   'F', '2012-11-15', '30000000-0000-4000-8000-000000000001', '40000000-0000-4000-8000-000000000101', 2024),
  ('4800000005', 'N80005', 'Faith',   'Wangari',  'Njoroge',   'F', '2013-03-08', '30000000-0000-4000-8000-000000000001', '40000000-0000-4000-8000-000000000101', 2024),
  ('5000000006', 'N80006', 'Geofrey', 'Muriithi', 'Kariuki',   'M', '2012-09-27', '30000000-0000-4000-8000-000000000001', '40000000-0000-4000-8000-000000000101', 2024),
  ('5200000007', 'N80007', 'Hellen',  'Atieno',   'Okoth',     'F', '2013-07-19', '30000000-0000-4000-8000-000000000001', '40000000-0000-4000-8000-000000000101', 2024),
  ('5400000008', 'N80008', 'Isaac',   'Kiprotich','Langat',    'M', '2013-02-14', '30000000-0000-4000-8000-000000000001', '40000000-0000-4000-8000-000000000101', 2024),
  ('5600000009', 'N80009', 'Joy',     'Wambui',   'Muthoni',   'F', '2012-12-05', '30000000-0000-4000-8000-000000000001', '40000000-0000-4000-8000-000000000101', 2024),
  ('5800000010', 'N80010', 'Kevin',   'Abdullahi','Hassan',    'M', '2013-05-22', '30000000-0000-4000-8000-000000000001', '40000000-0000-4000-8000-000000000101', 2024),
  ('6000000011', 'N80011', 'Linet',   'Chebet',   'Kosgei',    'F', '2013-08-11', '30000000-0000-4000-8000-000000000001', '40000000-0000-4000-8000-000000000101', 2024),
  ('6200000012', 'N80012', 'Moses',   'Kipng''etich', 'Rono',  'M', '2012-10-03', '30000000-0000-4000-8000-000000000001', '40000000-0000-4000-8000-000000000101', 2024),
  ('6400000013', 'N80013', 'Nancy',   'Adhiambo', 'Awuor',     'F', '2013-09-09', '30000000-0000-4000-8000-000000000001', '40000000-0000-4000-8000-000000000101', 2024),
  ('6600000014', 'N80014', 'Samuel',  'Kamau',    'Kibet',     'M', '2013-04-01', '30000000-0000-4000-8000-000000000001', '40000000-0000-4000-8000-000000000101', 2024),
  -- Langata Estate · other grades
  ('6800000015', 'N80015', 'Victor',  'Ochieng',  'Omondi',    'M', '2017-03-18', '30000000-0000-4000-8000-000000000001', '40000000-0000-4000-8000-000000000105', 2025),
  ('7000000016', 'N80016', 'Amina',   'Mwende',   'Kilonzo',   'F', '2019-06-25', '30000000-0000-4000-8000-000000000001', '40000000-0000-4000-8000-000000000106', 2025),
  ('7200000017', 'N80017', 'Beatrice','Njoki',    'Wanjiku',   'F', '2014-01-12', '30000000-0000-4000-8000-000000000001', '40000000-0000-4000-8000-000000000103', 2023),
  ('7400000018', 'N80018', 'Collins', 'Kipkoech', 'Rotich',    'M', '2014-02-28', '30000000-0000-4000-8000-000000000001', '40000000-0000-4000-8000-000000000103', 2023),
  ('7600000019', 'N80019', 'Diana',   'Mwikali',  'Ndanu',     'F', '2015-05-16', '30000000-0000-4000-8000-000000000001', '40000000-0000-4000-8000-000000000104', 2023),
  ('7800000020', 'N80020', 'Erick',   'Mwangi',   'Gitau',     'M', '2015-08-30', '30000000-0000-4000-8000-000000000001', '40000000-0000-4000-8000-000000000104', 2023),
  ('8000000021', 'N80021', 'Janet',   'Kanini',   'Mbithi',    'F', '2012-04-09', '30000000-0000-4000-8000-000000000001', '40000000-0000-4000-8000-000000000107', 2024),
  ('8200000022', 'N80022', 'Ian',     'Mutua',    'Maingi',    'M', '2012-07-21', '30000000-0000-4000-8000-000000000001', '40000000-0000-4000-8000-000000000107', 2024),
  -- Kasarani Primary
  ('8400000023', 'N80023', 'Ruth',    'Nyambura', 'Karanja',   'F', '2014-03-13', '30000000-0000-4000-8000-000000000002', '40000000-0000-4000-8000-000000000201', 2023),
  ('8600000024', 'N80024', 'Peter',   'Kimani',   'Macharia',  'M', '2014-05-02', '30000000-0000-4000-8000-000000000002', '40000000-0000-4000-8000-000000000201', 2023),
  ('8800000025', 'N80025', 'Susan',   'Akoth',    'Odongo',    'F', '2012-02-11', '30000000-0000-4000-8000-000000000002', '40000000-0000-4000-8000-000000000202', 2024),
  ('9000000026', 'N80026', 'Thomas',  'Nderitu',  'Gichuhi',   'M', '2012-06-17', '30000000-0000-4000-8000-000000000002', '40000000-0000-4000-8000-000000000202', 2024),
  -- Ruiru JSS
  ('9200000027', 'N80027', 'Grace',   'Mueni',    'Mutuku',    'F', '2011-04-26', '30000000-0000-4000-8000-000000000003', '40000000-0000-4000-8000-000000000301', 2023),
  ('9400000028', 'N80028', 'Dennis',  'Kariuki',  'Njuguna',   'M', '2011-09-14', '30000000-0000-4000-8000-000000000003', '40000000-0000-4000-8000-000000000301', 2023),
  ('9600000029', 'N80029', 'Carol',   'Njeri',    'Wachira',   'F', '2009-11-08', '30000000-0000-4000-8000-000000000003', '40000000-0000-4000-8000-000000000302', 2023),
  ('9800000030', 'N80030', 'Felix',   'Mureithi', 'Waweru',    'M', '2010-03-29', '30000000-0000-4000-8000-000000000003', '40000000-0000-4000-8000-000000000302', 2023);

-- --- Enrolments (2026 Term 1, still active) ---------------------------------
insert into public.enrollments (learner_id, class_id, year, term, status)
select id, class_id, 2026, 1, 'ACTIVE' from public.learners where class_id is not null;

-- --- Scores: deterministic 4–10 per learner per sub-strand (2026 Term 3) ----
do $$
declare r record; s record;
begin
  for r in select l.id as lid, c.grade as g
           from public.learners l join public.classes c on c.id = l.class_id
  loop
    for s in select id from public.sub_strands where grade = r.g loop
      insert into public.scores (learner_id, sub_strand_id, year, term, score)
      values (r.lid, s.id, 2026, 3, 4 + abs(hashtext(r.lid::text || ':' || s.id::text)) % 7);
    end loop;
  end loop;
end $$;

-- --- Comments for three G5 Brown learners ------------------------------------
insert into public.comments (learner_id, year, term, teacher_comment, head_comment, next_term_focus)
select l.id, 2026, 3,
       l.first_name || ' has made steady progress this term. Keep practising at home.',
       'Good progress. Encouraged to participate in co-curricular activities.',
       'Reading comprehension and problem solving.'
from public.learners l
where l.class_id = '40000000-0000-4000-8000-000000000101'
limit 3;
