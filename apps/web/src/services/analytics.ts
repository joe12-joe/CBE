import { db } from "./mocks/db";
import { delay } from "./apiClient";
import { computeLevel, GRADE_ORDER } from "@/lib/format";
import { averageScore, round1 } from "@/lib/score";
import { supabase, supabaseEnabled, supabaseError } from "@/lib/supabase";
import type {
  CompetencyLevel,
  DashboardStats,
  EnrollmentByGrade,
  GradeCode,
  LevelDistribution,
  ReportArea,
  Term,
} from "@/lib/types";
import { getScoreGrid } from "./assessment";

const STATIC_AVG_PERFORMANCE = 6.8;

// --- Live (Supabase) implementation -----------------------------------------

async function sbGetDashboardStats(schoolId: string, term: Term): Promise<DashboardStats> {
  const { data: classes, error: cErr } = await supabase!
    .from("classes")
    .select("id, grade")
    .eq("school_id", schoolId)
    .order("grade");
  if (cErr) throw supabaseError(cErr, "Could not load classes.");

  const { count: schoolLearnerCount } = await supabase!
    .from("learners")
    .select("id", { count: "exact", head: true })
    .eq("school_id", schoolId);

  const { data: classed, error: clErr } = await supabase!
    .from("learners")
    .select("class_id")
    .eq("school_id", schoolId)
    .not("class_id", "is", null);
  if (clErr) throw supabaseError(clErr, "Could not load learners.");

  const gradeById = new Map((classes ?? []).map((c) => [String(c.id), String(c.grade)]));
  const countByGrade = new Map<string, number>();
  for (const l of classed ?? []) {
    const g = gradeById.get(String(l.class_id));
    if (g) countByGrade.set(g, (countByGrade.get(g) ?? 0) + 1);
  }
  const schoolGrades = new Set((classes ?? []).map((c) => String(c.grade)));

  // Learning areas that apply to any grade taught in this school.
  const { data: areas, error: aErr } = await supabase!
    .from("learning_areas")
    .select("id, name, learning_area_grades(grade)");
  if (aErr) throw supabaseError(aErr, "Could not load learning areas.");
  const areaName = new Map((areas ?? []).map((a) => [String(a.id), String(a.name)]));
  const totalLearningAreas = (areas ?? []).filter((a) =>
    (a.learning_area_grades as Array<{ grade: string }>).some((g) => schoolGrades.has(g.grade))
  ).length;

  // Aggregate scores across every class in the school for this term.
  let scoreSum = 0;
  let scoreCount = 0;
  const levelDistribution: Record<string, number> = { EE: 0, ME: 0, AE: 0, BE: 0 };
  const areaScores: Record<string, number[]> = {};
  for (const cls of classes ?? []) {
    const grid = await getScoreGrid(term, String(cls.id));
    for (const row of grid.rows) {
      for (const v of Object.values(row.cells)) {
        if (v == null) continue;
        scoreSum += v;
        scoreCount += 1;
        const lvl = computeLevel(v) ?? "BE";
        levelDistribution[lvl] += 1;
      }
    }
    for (const sub of grid.subStrands) {
      const vals = grid.rows
        .map((r) => r.cells[sub.id])
        .filter((v): v is number => v != null);
      if (vals.length === 0) continue;
      (areaScores[sub.learningAreaId] ??= []).push(...vals);
    }
  }

  const levelDist: LevelDistribution[] = (["EE", "ME", "AE", "BE"] as const).map((lvl) => ({
    level: lvl,
    count: levelDistribution[lvl],
  }));

  const weakestAreas: ReportArea[] = Object.entries(areaScores)
    .map(([areaId, vals]) => {
      const avg = averageScore(vals) ?? 0;
      return {
        learningAreaId: areaId,
        name: areaName.get(areaId) ?? "Unknown",
        averageScore: round1(avg) ?? 0,
        level: computeLevel(avg) ?? "BE",
      };
    })
    .sort((a, b) => a.averageScore - b.averageScore)
    .slice(0, 5);

  const enrollmentByGrade: EnrollmentByGrade[] = GRADE_ORDER.filter((g) => schoolGrades.has(g)).map(
    (grade) => ({ grade, count: countByGrade.get(grade) ?? 0 })
  );

  return {
    year: term.year,
    term: term.term,
    totalLearners: schoolLearnerCount ?? 0,
    totalClasses: classes?.length ?? 0,
    totalLearningAreas,
    avgPerformance: scoreCount > 0 ? round1(scoreSum / scoreCount) ?? STATIC_AVG_PERFORMANCE : STATIC_AVG_PERFORMANCE,
    enrollmentByGrade,
    levelDistribution: levelDist,
    weakestAreas,
  };
}

async function sbGetGradePerformance(schoolId: string, term: Term): Promise<GradePerformance[]> {
  const { data: classes, error: cErr } = await supabase!
    .from("classes")
    .select("id, grade")
    .eq("school_id", schoolId);
  if (cErr) throw supabaseError(cErr, "Could not load classes.");

  const buckets: Record<string, { count: number; sum: number; scoreCount: number }> = {};
  for (const cls of classes ?? []) {
    const grid = await getScoreGrid(term, String(cls.id));
    for (const row of grid.rows) {
      const vals = Object.values(row.cells).filter((v): v is number => v != null);
      const bucket = (buckets[String(cls.grade)] ??= { count: 0, sum: 0, scoreCount: 0 });
      bucket.count += 1;
      bucket.sum += vals.reduce((a, b) => a + b, 0);
      bucket.scoreCount += vals.length;
    }
  }
  return Object.entries(buckets)
    .map(([grade, b]) => {
      const avg = b.scoreCount ? b.sum / b.scoreCount : null;
      return {
        grade: grade as GradeCode,
        learners: b.count,
        avgScore: round1(avg),
        level: avg == null ? null : (computeLevel(avg) ?? null),
      };
    })
    .sort((a, b) => GRADE_ORDER.indexOf(a.grade) - GRADE_ORDER.indexOf(b.grade));
}

async function sbGetCountyComparison(countyId: string, term: Term): Promise<CountyComparison> {
  const { data: schools, error: sErr } = await supabase!
    .from("schools")
    .select("id, name")
    .eq("county_id", countyId)
    .order("name");
  if (sErr) throw supabaseError(sErr, "Could not load schools.");

  const rows: CountyComparison["rows"] = [];
  for (const school of schools ?? []) {
    const { data: classes } = await supabase!
      .from("classes")
      .select("id")
      .eq("school_id", String(school.id));
    let sum = 0;
    let scored = 0;
    let ee = 0;
    for (const cls of classes ?? []) {
      const grid = await getScoreGrid(term, String(cls.id));
      for (const row of grid.rows) {
        for (const v of Object.values(row.cells)) {
          if (v == null) continue;
          sum += v;
          scored += 1;
          if (computeLevel(v) === "EE") ee += 1;
        }
      }
    }
    const { count: learnerCount } = await supabase!
      .from("learners")
      .select("id", { count: "exact", head: true })
      .eq("school_id", String(school.id));
    rows.push({
      schoolId: String(school.id),
      schoolName: String(school.name),
      learners: learnerCount ?? 0,
      avgPerformance: scored ? round1(sum / scored) : null,
      eeRate: scored ? Math.round((ee / scored) * 100) : null,
    });
  }
  return { countyId, term, rows };
}

// --- Public API -------------------------------------------------------------

export async function getDashboardStats(schoolId: string, term: Term): Promise<DashboardStats> {
  if (supabaseEnabled()) return sbGetDashboardStats(schoolId, term);
  await delay(400);
  const schoolLearners = db.learners.filter((l) => l.schoolId === schoolId);
  const classes = db.classes.filter((c) => c.schoolId === schoolId);
  const grades = new Set(classes.map((c) => c.grade));

  const enrollmentByGrade: EnrollmentByGrade[] = GRADE_ORDER.filter((g) => grades.has(g)).map((grade) => ({
    grade,
    count: schoolLearners.filter((l) => {
      const cls = db.classes.find((c) => c.id === l.classId);
      return cls?.grade === grade;
    }).length,
  }));

  // Aggregate scores across every class in the school for this term.
  let scoreSum = 0;
  let scoreCount = 0;
  const levelDistribution: Record<string, number> = { EE: 0, ME: 0, AE: 0, BE: 0 };
  const areaScores: Record<string, number[]> = {};
  for (const cls of classes) {
    const grid = await getScoreGrid(term, cls.id);
    for (const row of grid.rows) {
      for (const v of Object.values(row.cells)) {
        if (v == null) continue;
        scoreSum += v;
        scoreCount += 1;
        const lvl = computeLevel(v) ?? "BE";
        levelDistribution[lvl] += 1;
      }
    }
    // Track per-learning-area scores for the weakest-areas metric.
    for (const sub of grid.subStrands) {
      const vals = grid.rows
        .map((r) => r.cells[sub.id])
        .filter((v): v is number => v != null);
      if (vals.length === 0) continue;
      (areaScores[sub.learningAreaId] ??= []).push(...vals);
    }
  }

  const levelDist: LevelDistribution[] = (["EE", "ME", "AE", "BE"] as const).map((lvl) => ({
    level: lvl,
    count: levelDistribution[lvl],
  }));

  const weakestAreas: ReportArea[] = Object.entries(areaScores)
    .map(([areaId, vals]) => {
      const la = db.learningAreas.find((a) => a.id === areaId)!;
      const avg = averageScore(vals) ?? 0;
      return { learningAreaId: areaId, name: la.name, averageScore: round1(avg) ?? 0, level: computeLevel(avg) ?? "BE" };
    })
    .sort((a, b) => a.averageScore - b.averageScore)
    .slice(0, 5);

  return {
    year: term.year,
    term: term.term,
    totalLearners: schoolLearners.length,
    totalClasses: classes.length,
    totalLearningAreas: db.learningAreas.filter((la) =>
      la.grades.some((g) => grades.has(g))
    ).length,
    avgPerformance: scoreCount > 0 ? round1(scoreSum / scoreCount) ?? STATIC_AVG_PERFORMANCE : STATIC_AVG_PERFORMANCE,
    enrollmentByGrade,
    levelDistribution: levelDist,
    weakestAreas,
  };
}

export interface GradePerformance {
  grade: GradeCode;
  learners: number;
  avgScore: number | null;
  level: CompetencyLevel | null;
}

export async function getGradePerformance(schoolId: string, term: Term): Promise<GradePerformance[]> {
  if (supabaseEnabled()) return sbGetGradePerformance(schoolId, term);
  await delay(350);
  const classes = db.classes.filter((c) => c.schoolId === schoolId);
  const buckets: Record<string, { count: number; sum: number; scoreCount: number }> = {};
  for (const cls of classes) {
    const grid = await getScoreGrid(term, cls.id);
    for (const row of grid.rows) {
      const vals = Object.values(row.cells).filter((v): v is number => v != null);
      const bucket = (buckets[cls.grade] ??= { count: 0, sum: 0, scoreCount: 0 });
      bucket.count += 1;
      bucket.sum += vals.reduce((a, b) => a + b, 0);
      bucket.scoreCount += vals.length;
    }
  }
  return Object.entries(buckets)
    .map(([grade, b]) => {
      const avg = b.scoreCount ? b.sum / b.scoreCount : null;
      return {
        grade: grade as GradeCode,
        learners: b.count,
        avgScore: round1(avg),
        level: avg == null ? null : (computeLevel(avg) ?? null),
      };
    })
    .sort((a, b) => GRADE_ORDER.indexOf(a.grade) - GRADE_ORDER.indexOf(b.grade));
}

export interface CountyComparison {
  countyId: string;
  term: Term;
  rows: Array<{
    schoolId: string;
    schoolName: string;
    learners: number;
    avgPerformance: number | null;
    eeRate: number | null;
  }>;
}

export async function getCountyComparison(countyId: string, term: Term): Promise<CountyComparison> {
  if (supabaseEnabled()) return sbGetCountyComparison(countyId, term);
  await delay(450);
  const schools = db.schools.filter((s) => s.countyId === countyId);
  const rows: CountyComparison["rows"] = [];
  for (const school of schools) {
    const classes = db.classes.filter((c) => c.schoolId === school.id);
    let total = 0;
    let ee = 0;
    let sum = 0;
    let scored = 0;
    for (const cls of classes) {
      const grid = await getScoreGrid(term, cls.id);
      for (const row of grid.rows) {
        for (const v of Object.values(row.cells)) {
          if (v == null) continue;
          total += 1;
          sum += v;
          scored += 1;
          if (computeLevel(v) === "EE") ee += 1;
        }
      }
    }
    void total;
    rows.push({
      schoolId: school.id,
      schoolName: school.name,
      learners: db.learners.filter((l) => l.schoolId === school.id).length,
      avgPerformance: scored ? round1(sum / scored) : null,
      eeRate: scored ? Math.round((ee / scored) * 100) : null,
    });
  }
  return { countyId, term, rows };
}