import { db } from "./mocks/db";
import { delay, ApiError } from "./apiClient";
import { computeLevel } from "@/lib/format";
import { averageScore, round1 } from "@/lib/score";
import { getLearnerAssessment } from "./assessment";
import { supabase, supabaseEnabled, mapLearner, mapSchool, supabaseError } from "@/lib/supabase";
import type {
  CommentEntry,
  CommentFormInput,
  Learner,
  ReportArea,
  ReportCardData,
  Term,
} from "@/lib/types";

// --- Live (Supabase) implementation -----------------------------------------

async function sbGetReportCard(learnerId: string, term: Term): Promise<ReportCardData> {
  const { data: learner, error: lErr } = await supabase!
    .from("learners")
    .select("*")
    .eq("id", learnerId)
    .maybeSingle();
  if (lErr) throw supabaseError(lErr, "Could not load the learner.");
  if (!learner) throw new ApiError(404, "Learner not found.");

  const cls = learner.class_id
    ? (await supabase!.from("classes").select("*").eq("id", learner.class_id).maybeSingle()).data
    : null;
  const school = (await supabase!.from("schools").select("*").eq("id", learner.school_id).maybeSingle())
    .data;
  if (!school) throw new ApiError(404, "School not found.");
  const comment = (
    await supabase!
      .from("comments")
      .select("*")
      .eq("learner_id", learnerId)
      .eq("year", term.year)
      .eq("term", term.term)
      .maybeSingle()
  ).data;

  const results = await getLearnerAssessment(learnerId, term);
  const areas: ReportArea[] = results.map((r) => ({
    learningAreaId: r.areaId,
    name: r.areaName,
    averageScore: round1(r.averageScore) ?? 0,
    level: r.level ?? "BE",
  }));

  const allScores = results.flatMap((r) => r.strands.flatMap((st) => st.subStrands.map((s) => s.score)));
  const overallAvg = averageScore(allScores);
  const totalLearners = cls
    ? await supabase!.from("learners").select("id", { count: "exact", head: true }).eq("class_id", cls.id)
    : null;

  return {
    school: mapSchool(school),
    learner: mapLearner(learner),
    term,
    grade: (cls?.grade ?? "G1") as ReportCardData["grade"],
    stream: cls?.stream ?? "",
    areas,
    overall: {
      averageScore: round1(overallAvg) ?? 0,
      level: overallAvg == null ? "BE" : (computeLevel(overallAvg) ?? "BE"),
      totalLearners: totalLearners?.count ?? 0,
    },
    teacherComment: comment?.teacher_comment ?? undefined,
    headComment: comment?.head_comment ?? undefined,
    nextTermFocus: comment?.next_term_focus ?? undefined,
    issuedAt: new Date().toISOString().slice(0, 10),
  };
}

function mapComment(row: Record<string, unknown>, term: Term): CommentEntry {
  return {
    id: String(row.id),
    term,
    learnerId: String(row.learner_id),
    teacherComment: row.teacher_comment ? String(row.teacher_comment) : undefined,
    headComment: row.head_comment ? String(row.head_comment) : undefined,
    nextTermFocus: row.next_term_focus ? String(row.next_term_focus) : undefined,
  };
}

async function sbSaveComments(learnerId: string, term: Term, input: CommentFormInput): Promise<CommentEntry> {
  const { data, error } = await supabase!
    .from("comments")
    .upsert(
      {
        learner_id: learnerId,
        year: term.year,
        term: term.term,
        teacher_comment: input.teacherComment || null,
        head_comment: input.headComment || null,
        next_term_focus: input.nextTermFocus || null,
      },
      { onConflict: "learner_id,year,term" }
    )
    .select("*")
    .single();
  if (error) throw supabaseError(error, "Could not save the comments.");
  return mapComment(data, term);
}

async function sbGetComments(learnerId: string, term: Term): Promise<CommentEntry | null> {
  const { data, error } = await supabase!
    .from("comments")
    .select("*")
    .eq("learner_id", learnerId)
    .eq("year", term.year)
    .eq("term", term.term)
    .maybeSingle();
  if (error) throw supabaseError(error, "Could not load the comments.");
  return data ? mapComment(data, term) : null;
}

async function sbListIssuableLearners(
  classId: string,
  term: Term
): Promise<Array<Learner & { status: "COMPLETE" | "PARTIAL" }>> {
  const { data: cls, error: cErr } = await supabase!
    .from("classes")
    .select("grade")
    .eq("id", classId)
    .maybeSingle();
  if (cErr) throw supabaseError(cErr, "Could not load the class.");
  if (!cls) throw new ApiError(404, "Class not found.");

  const { data: learners, error: lErr } = await supabase!
    .from("learners")
    .select("*")
    .eq("class_id", classId)
    .order("last_name")
    .order("first_name");
  if (lErr) throw supabaseError(lErr, "Could not list learners.");

  const { count: gradeSubs } = await supabase!
    .from("sub_strands")
    .select("id", { count: "exact", head: true })
    .eq("grade", cls.grade);

  const learnerIds = (learners ?? []).map((l) => String(l.id));
  const { data: scores } = await supabase!
    .from("scores")
    .select("learner_id")
    .eq("year", term.year)
    .eq("term", term.term)
    .in("learner_id", learnerIds);
  const scoredByLearner = new Map<string, number>();
  for (const s of scores ?? []) {
    scoredByLearner.set(String(s.learner_id), (scoredByLearner.get(String(s.learner_id)) ?? 0) + 1);
  }

  return (learners ?? []).map((l) => {
    const scored = scoredByLearner.get(String(l.id)) ?? 0;
    return {
      ...mapLearner(l),
      status: (gradeSubs ?? 0) > 0 && scored >= (gradeSubs ?? 0) ? "COMPLETE" : "PARTIAL",
    };
  });
}

// --- Public API -------------------------------------------------------------

export async function getReportCard(learnerId: string, term: Term): Promise<ReportCardData> {
  if (supabaseEnabled()) return sbGetReportCard(learnerId, term);
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
  if (supabaseEnabled()) return sbSaveComments(learnerId, term, input);
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
  if (supabaseEnabled()) return sbGetComments(learnerId, term);
  await delay(120);
  return db.comments.find((c) => c.learnerId === learnerId && termMatches(c.term, term)) ?? null;
}

export async function listIssuableLearners(
  classId: string,
  term: Term
): Promise<Array<Learner & { status: "COMPLETE" | "PARTIAL" }>> {
  if (supabaseEnabled()) return sbListIssuableLearners(classId, term);
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