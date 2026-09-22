import { db } from "./mocks/db";
import { delay, ApiError } from "./apiClient";
import { computeLevel } from "@/lib/format";
import { averageScore } from "@/lib/score";
import { supabase, supabaseEnabled, supabaseError } from "@/lib/supabase";
import type {
  CompetencyLevel,
  GradeCode,
  Learner,
  ScoreGridRow,
  ScoreInput,
  SubStrand,
  Term,
} from "@/lib/types";

export interface ScoreGridData {
  grade: GradeCode;
  stream: string;
  subStrands: Array<SubStrand & { strandName: string; learningAreaId: string }>;
  rows: ScoreGridRow[];
}

// --- Live (Supabase) implementation -----------------------------------------

async function sbGetScoreGrid(
  term: Term,
  classId: string,
  learningAreaId?: string
): Promise<ScoreGridData> {
  const { data: cls, error: clsErr } = await supabase!
    .from("classes")
    .select("id, grade, stream")
    .eq("id", classId)
    .maybeSingle();
  if (clsErr) throw supabaseError(clsErr, "Could not load the class.");
  if (!cls) throw new ApiError(404, "Class not found.");

  let q = supabase!
    .from("sub_strands")
    .select("id, strand_id, code, name, grade, strand:strands!inner(id, name, learning_area_id)")
    .eq("grade", cls.grade);
  if (learningAreaId) q = q.eq("strand.learning_area_id", learningAreaId);
  q = q.order("name");
  const { data: subs, error: subsErr } = await q;
  if (subsErr) throw supabaseError(subsErr, "Could not load sub-strands.");

  const { data: learners, error: lErr } = await supabase!
    .from("learners")
    .select("id, upi, first_name, middle_name, last_name")
    .eq("class_id", classId)
    .order("last_name")
    .order("first_name");
  if (lErr) throw supabaseError(lErr, "Could not load learners.");

  const learnerIds = (learners ?? []).map((l) => String(l.id));
  const subIds = (subs ?? []).map((s) => String(s.id));
  const { data: scores, error: scErr } = await supabase!
    .from("scores")
    .select("learner_id, sub_strand_id, score")
    .eq("year", term.year)
    .eq("term", term.term)
    .in("learner_id", learnerIds)
    .in("sub_strand_id", subIds);
  if (scErr) throw supabaseError(scErr, "Could not load scores.");

  const scoreMap = new Map<string, number | null>();
  for (const s of scores ?? []) {
    if (s.score != null) scoreMap.set(`${s.learner_id}:${s.sub_strand_id}`, Number(s.score));
  }

  const gridSubs = (subs ?? []).map((s) => {
    const strand = s.strand && Array.isArray(s.strand) ? s.strand[0] : s.strand;
    return {
      id: String(s.id),
      strandId: String(s.strand_id),
      code: String(s.code),
      name: String(s.name),
      grade: String(s.grade) as GradeCode,
      strandName: String(strand?.name ?? ""),
      learningAreaId: String(strand?.learning_area_id ?? ""),
    };
  });

  const rows: ScoreGridRow[] = (learners ?? []).map((l) => {
    const cells: Record<string, number | null> = {};
    for (const sub of gridSubs) {
      const v = scoreMap.get(`${l.id}:${sub.id}`);
      cells[sub.id] = v ?? null;
    }
    return {
      learner: {
        id: String(l.id),
        upi: String(l.upi),
        firstName: String(l.first_name),
        middleName: l.middle_name ? String(l.middle_name) : undefined,
        lastName: String(l.last_name),
      },
      cells,
    };
  });

  return { grade: cls.grade as GradeCode, stream: String(cls.stream), subStrands: gridSubs, rows };
}

async function sbSaveScores(term: Term, inputs: ScoreInput[]): Promise<void> {
  for (const inp of inputs) {
    const key = {
      learner_id: inp.learnerId,
      sub_strand_id: inp.subStrandId,
      year: term.year,
      term: term.term,
    };
    if (inp.score == null) {
      const { error } = await supabase!.from("scores").delete().match(key);
      if (error) throw supabaseError(error, "Could not clear the score.");
    } else {
      const { error } = await supabase!
        .from("scores")
        .upsert({ ...key, score: inp.score }, { onConflict: "learner_id,sub_strand_id,year,term" });
      if (error) throw supabaseError(error, "Could not save scores.");
    }
  }
}

async function sbGetLearnerAssessment(learnerId: string, term: Term): Promise<LearnerAreaResult[]> {
  const { data: learner, error: lErr } = await supabase!
    .from("learners")
    .select("class_id")
    .eq("id", learnerId)
    .maybeSingle();
  if (lErr) throw supabaseError(lErr, "Could not load the learner.");
  if (!learner) throw new ApiError(404, "Learner not found.");
  if (!learner.class_id) return [];

  const { data: cls, error: cErr } = await supabase!
    .from("classes")
    .select("grade")
    .eq("id", learner.class_id)
    .maybeSingle();
  if (cErr) throw supabaseError(cErr, "Could not load the learner's class.");
  if (!cls) return [];

  const { data: areas, error: aErr } = await supabase!
    .from("learning_areas")
    .select("id, code, name, strands!inner(id, name, sub_strands!inner(id, name, grade))")
    .eq("strands.sub_strands.grade", cls.grade)
    .order("name");
  if (aErr) throw supabaseError(aErr, "Could not load the curriculum.");

  const subIds: string[] = [];
  const areaRows = ((areas as Array<Record<string, unknown>> | null) ?? []).map((area) => {
    const strands = ((area.strands as Array<Record<string, unknown>> | null) ?? []).map((st) => ({
      id: String(st.id),
      name: String(st.name),
      subStrands: ((st.sub_strands as Array<Record<string, unknown>> | null) ?? []).map((s) => {
        subIds.push(String(s.id));
        return { id: String(s.id), name: String(s.name) };
      }),
    }));
    return { id: String(area.id), code: String(area.code), name: String(area.name), strands };
  });

  const { data: scores, error: scErr } = await supabase!
    .from("scores")
    .select("sub_strand_id, score")
    .eq("learner_id", learnerId)
    .eq("year", term.year)
    .eq("term", term.term)
    .in("sub_strand_id", subIds);
  if (scErr) throw supabaseError(scErr, "Could not load scores.");
  const scoreMap = new Map((scores ?? []).map((s) => [String(s.sub_strand_id), Number(s.score)]));

  const results: LearnerAreaResult[] = [];
  for (const area of areaRows) {
    const strands: LearnerAreaResult["strands"] = [];
    for (const st of area.strands) {
      const subRows = st.subStrands.map((s) => {
        const score = scoreMap.get(s.id) ?? null;
        return { id: s.id, name: s.name, score, level: computeLevel(score) };
      });
      if (subRows.length === 0) continue;
      const avg = averageScore(subRows.map((r) => r.score));
      strands.push({
        strandId: st.id,
        strandName: st.name,
        averageScore: avg,
        level: computeLevel(avg),
        subStrands: subRows,
      });
    }
    if (strands.length === 0) continue;
    const all = strands.flatMap((st) => st.subStrands.map((s) => s.score));
    const avg = averageScore(all);
    results.push({
      areaId: area.id,
      areaName: area.name,
      areaCode: area.code,
      averageScore: avg,
      level: computeLevel(avg),
      strands,
    });
  }
  return results;
}

// --- Public API -------------------------------------------------------------

export async function getScoreGrid(
  term: Term,
  classId: string,
  learningAreaId?: string
): Promise<ScoreGridData> {
  if (supabaseEnabled()) return sbGetScoreGrid(term, classId, learningAreaId);
  await delay(250);
  const cls = db.classes.find((c) => c.id === classId);
  if (!cls) throw new ApiError(404, "Class not found.");

  const areaIds = learningAreaId ? [learningAreaId] : db.learningAreas.map((a) => a.id);

  const subs = db.subStrands
    .filter(
      (s) =>
        s.grade === cls.grade &&
        db.strands.some((st) => st.id === s.strandId && areaIds.includes(st.learningAreaId))
    )
    .map((s) => {
      const strand = db.strands.find((st) => st.id === s.strandId)!;
      return { ...s, strandName: strand.name, learningAreaId: strand.learningAreaId };
    })
    .sort((a, b) => a.strandName.localeCompare(b.strandName) || a.name.localeCompare(b.name));

  const learners = db.learners.filter((l) => l.classId === classId);
  const rows: ScoreGridRow[] = learners.map((l) => {
    const learnerRow = {
      id: l.id,
      upi: l.upi,
      firstName: l.firstName,
      middleName: l.middleName,
      lastName: l.lastName,
    };
    const cells: Record<string, number | null> = {};
    for (const sub of subs) {
      cells[sub.id] = (db.scoreByLearner[l.id] ?? {})[sub.id] ?? null;
    }
    return { learner: learnerRow, cells };
  });

  return { grade: cls.grade, stream: cls.stream, subStrands: subs, rows };
}

export async function saveScores(term: Term, inputs: ScoreInput[]): Promise<void> {
  if (supabaseEnabled()) return sbSaveScores(term, inputs);
  await delay(180);
  for (const inp of inputs) {
    const bucket = (db.scoreByLearner[inp.learnerId] ??= {});
    if (inp.score == null) {
      delete bucket[inp.subStrandId];
      db.scores = db.scores.filter(
        (s) =>
          !(
            s.learnerId === inp.learnerId &&
            s.subStrandId === inp.subStrandId &&
            s.term.year === term.year &&
            s.term.term === term.term
          )
      );
    } else {
      const existing = db.scores.find(
        (s) =>
          s.learnerId === inp.learnerId &&
          s.subStrandId === inp.subStrandId &&
          s.term.year === term.year &&
          s.term.term === term.term
      );
      if (existing) {
        existing.score = inp.score;
      } else {
        db.scores.push({
          id: `scr-${db.nextId.score++}`,
          term,
          learnerId: inp.learnerId,
          subStrandId: inp.subStrandId,
          score: inp.score,
        });
      }
      bucket[inp.subStrandId] = inp.score;
    }
  }
}

export interface LearnerAreaResult {
  areaId: string;
  areaName: string;
  areaCode: string;
  averageScore: number | null;
  level: CompetencyLevel | null;
  strands: Array<{
    strandId: string;
    strandName: string;
    averageScore: number | null;
    level: CompetencyLevel | null;
    subStrands: Array<{ id: string; name: string; score: number | null; level: CompetencyLevel | null }>;
  }>;
}

export async function getLearnerAssessment(learnerId: string, term: Term): Promise<LearnerAreaResult[]> {
  if (supabaseEnabled()) return sbGetLearnerAssessment(learnerId, term);
  await delay(200);
  const learner = db.learners.find((l) => l.id === learnerId);
  if (!learner) throw new ApiError(404, "Learner not found.");
  const cls = db.classes.find((c) => c.id === learner.classId);
  if (!cls) return [];

  const bucket = db.scoreByLearner[learnerId] ?? {};
  const results: LearnerAreaResult[] = [];

  for (const la of db.learningAreas.filter((a) => a.grades.includes(cls.grade))) {
    const strands: LearnerAreaResult["strands"] = [];
    for (const st of db.strands.filter((s) => s.learningAreaId === la.id)) {
      const subs = db.subStrands.filter((s) => s.strandId === st.id && s.grade === cls.grade);
      if (subs.length === 0) continue;
      const subRows = subs.map((s) => {
        const score = bucket[s.id] ?? null;
        return { id: s.id, name: s.name, score, level: computeLevel(score) };
      });
      strands.push({
        strandId: st.id,
        strandName: st.name,
        averageScore: averageScore(subRows.map((r) => r.score)),
        level: computeLevel(averageScore(subRows.map((r) => r.score))),
        subStrands: subRows,
      });
    }
    if (strands.length === 0) continue;
    const all = strands.flatMap((st) => st.subStrands.map((s) => s.score));
    results.push({
      areaId: la.id,
      areaName: la.name,
      areaCode: la.code,
      averageScore: averageScore(all),
      level: computeLevel(averageScore(all)),
      strands,
    });
  }
  return results;
}

export interface GridStats {
  averageBySubStrand: Record<string, number>;
  learnerAverages: Record<string, number>;
}

/** Per-class aggregates used by the assessment screen and analytics exports. */
export function computeGridStats(rows: ScoreGridRow[]): GridStats {
  const averageBySubStrand: Record<string, number> = {};
  const learnerAverages: Record<string, number> = {};

  const subIds = new Set(rows.flatMap((r) => Object.keys(r.cells)));
  for (const sid of subIds) {
    averageBySubStrand[sid] = averageScore(rows.map((r) => r.cells[sid])) ?? 0;
  }
  for (const row of rows) {
    learnerAverages[row.learner.id] = averageScore(Object.values(row.cells)) ?? 0;
  }
  return { averageBySubStrand, learnerAverages };
}

export interface LearnerSummary extends Pick<Learner, "id" | "upi" | "firstName" | "lastName" | "gender"> {
  averageScore: number | null;
  level: CompetencyLevel | null;
}

export async function listClassPerformance(term: Term, classId: string): Promise<LearnerSummary[]> {
  const grid = await getScoreGrid(term, classId);
  const stats = computeGridStats(grid.rows);
  const learners = supabaseEnabled()
    ? await supabase!.from("learners").select("id, gender").in("class_id", [classId])
    : null;
  const genderById = new Map((learners?.data ?? []).map((l) => [String(l.id), l.gender as "M" | "F"]));
  return grid.rows.map((r) => {
    const avg = stats.learnerAverages[r.learner.id];
    return {
      id: r.learner.id,
      upi: r.learner.upi,
      firstName: r.learner.firstName,
      lastName: r.learner.lastName,
      gender: genderById.get(r.learner.id) ?? "M",
      averageScore: avg,
      level: computeLevel(avg),
    };
  });
}