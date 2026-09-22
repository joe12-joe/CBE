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