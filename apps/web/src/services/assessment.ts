import { db } from "./mocks/db";
import { delay, ApiError } from "./apiClient";
import { computeLevel } from "@/lib/format";
import { averageScore } from "@/lib/score";
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

export async function getScoreGrid(
  _term: Term,
  classId: string,
  learningAreaId?: string
): Promise<ScoreGridData> {
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

export async function getLearnerAssessment(learnerId: string, _term: Term): Promise<LearnerAreaResult[]> {
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
  return grid.rows.map((r) => {
    const learner = db.learners.find((l) => l.id === r.learner.id);
    const avg = stats.learnerAverages[r.learner.id];
    return {
      id: r.learner.id,
      upi: r.learner.upi,
      firstName: r.learner.firstName,
      lastName: r.learner.lastName,
      gender: learner?.gender ?? "M",
      averageScore: avg,
      level: computeLevel(avg),
    };
  });
}