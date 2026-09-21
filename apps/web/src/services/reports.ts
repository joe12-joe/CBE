import { db } from "./mocks/db";
import { delay, ApiError } from "./apiClient";
import { computeLevel } from "@/lib/format";
import { averageScore, round1 } from "@/lib/score";
import { getLearnerAssessment } from "./assessment";
import type {
  CommentEntry,
  CommentFormInput,
  Learner,
  ReportArea,
  ReportCardData,
  Term,
} from "@/lib/types";

export async function getReportCard(learnerId: string, term: Term): Promise<ReportCardData> {
  await delay(350);
  const learner = db.learners.find((l) => l.id === learnerId);
  if (!learner) throw new ApiError(404, "Learner not found.");
  const cls = db.classes.find((c) => c.id === learner.classId);
  const school = db.schools.find((s) => s.id === learner.schoolId);

  const results = await getLearnerAssessment(learnerId, term);
  const areas: ReportArea[] = results.map((r) => ({
    learningAreaId: r.areaId,
    name: r.areaName,
    averageScore: round1(r.averageScore) ?? 0,
    level: r.level ?? "BE",
  }));

  const allScores = results.flatMap((r) => r.strands.flatMap((st) => st.subStrands.map((s) => s.score)));
  const overallAvg = averageScore(allScores);

  const classLearners = db.learners.filter((l) => l.classId === learner.classId);
  const comment = db.comments.find((c) => c.learnerId === learnerId && termMatches(c.term, term));

  return {
    school: { ...school! },
    learner: { ...learner },
    term,
    grade: cls?.grade ?? "G1",
    stream: cls?.stream ?? "",
    areas,
    overall: {
      averageScore: round1(overallAvg) ?? 0,
      level: overallAvg == null ? "BE" : (computeLevel(overallAvg) ?? "BE"),
      totalLearners: classLearners.length,
    },
    teacherComment: comment?.teacherComment,
    headComment: comment?.headComment,
    nextTermFocus: comment?.nextTermFocus,
    issuedAt: new Date().toISOString().slice(0, 10),
  };
}

function termMatches(a: Term, b: Term): boolean {
  return a.year === b.year && a.term === b.term;
}

export async function saveComments(
  learnerId: string,
  term: Term,
  input: CommentFormInput
): Promise<CommentEntry> {
  await delay(250);
  let comment = db.comments.find((c) => c.learnerId === learnerId && termMatches(c.term, term));
  if (!comment) {
    comment = { id: `cmt-${db.nextId.comment++}`, term, learnerId };
    db.comments.push(comment);
  }
  comment.teacherComment = input.teacherComment || undefined;
  comment.nextTermFocus = input.nextTermFocus || undefined;
  comment.headComment = input.headComment || undefined;
  return { ...comment };
}

export async function getComments(learnerId: string, term: Term): Promise<CommentEntry | null> {
  await delay(120);
  return db.comments.find((c) => c.learnerId === learnerId && termMatches(c.term, term)) ?? null;
}

export async function listIssuableLearners(
  classId: string,
  _term: Term
): Promise<Array<Learner & { status: "COMPLETE" | "PARTIAL" }>> {
  await delay(220);
  const learners = db.learners.filter((l) => l.classId === classId);
  return learners.map((l) => {
    const cls = db.classes.find((c) => c.id === classId)!;
    const gradeSubs = db.subStrands.filter((s) => s.grade === cls.grade);
    const bucket = db.scoreByLearner[l.id] ?? {};
    const scored = gradeSubs.filter((s) => bucket[s.id] != null).length;
    return {
      ...l,
      status: scored >= gradeSubs.length ? "COMPLETE" : scored > 0 ? "PARTIAL" : "PARTIAL",
    };
  });
}