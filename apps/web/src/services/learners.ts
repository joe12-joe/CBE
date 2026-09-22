import { db } from "./mocks/db";
import { delay, ApiError, unauthorized } from "./apiClient";
import {
  supabase,
  supabaseEnabled,
  mapLearner,
  mapClass,
  supabaseError,
} from "@/lib/supabase";
import type { Learner, LearnerInput, SchoolClass } from "@/lib/types";

// --- Live (Supabase) implementation -----------------------------------------

async function sbListLearners(schoolId: string): Promise<Learner[]> {
  const { data, error } = await supabase!
    .from("learners")
    .select("*")
    .eq("school_id", schoolId)
    .order("last_name")
    .order("first_name");
  if (error) throw supabaseError(error, "Could not list learners.");
  return (data ?? []).map(mapLearner);
}

async function sbGetLearner(id: string): Promise<Learner> {
  const { data, error } = await supabase!.from("learners").select("*").eq("id", id).maybeSingle();
  if (error) throw supabaseError(error, "Could not load the learner.");
  if (!data) throw new ApiError(404, "Learner not found.");
  return mapLearner(data);
}

async function sbLearnerCounts(
  classIds: string[],
  bySchool = false
): Promise<Map<string, number>> {
  const counts = new Map<string, number>();
  if (classIds.length === 0) return counts;
  const idCol = bySchool ? "school_id" : "class_id";
  const { data, error } = await supabase!
    .from("learners")
    .select(`${idCol}`)
    .in(idCol, classIds);
  if (error) throw supabaseError(error, "Could not count learners.");
  for (const row of data ?? []) {
    const key = String((row as Record<string, unknown>)[idCol]);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return counts;
}

async function sbListClasses(schoolId: string): Promise<SchoolClass[]> {
  const { data, error } = await supabase!
    .from("classes")
    .select("*")
    .eq("school_id", schoolId)
    .order("grade")
    .order("stream");
  if (error) throw supabaseError(error, "Could not list classes.");
  const counts = await sbLearnerCounts([...new Set((data ?? []).map((c) => String(c.id)))]);
  return (data ?? []).map((c) => ({
    ...mapClass(c),
    learnerCount: counts.get(String(c.id)) ?? 0,
  }));
}

async function sbGetClass(classId: string): Promise<SchoolClass> {
  const { data, error } = await supabase!.from("classes").select("*").eq("id", classId).maybeSingle();
  if (error) throw supabaseError(error, "Could not load the class.");
  if (!data) throw new ApiError(404, "Class not found.");
  const count = await supabase!.from("learners").select("id", { count: "exact", head: true }).eq("class_id", classId);
  return { ...mapClass(data), learnerCount: count.count ?? 0 };
}

async function sbGetTeacherClasses(teacherId: string): Promise<SchoolClass[]> {
  const { data, error } = await supabase!
    .from("classes")
    .select("*")
    .eq("teacher_id", teacherId)
    .order("grade")
    .order("stream");
  if (error) throw supabaseError(error, "Could not list your classes.");
  const counts = await sbLearnerCounts([...new Set((data ?? []).map((c) => String(c.id)))]);
  return (data ?? []).map((c) => ({
    ...mapClass(c),
    learnerCount: counts.get(String(c.id)) ?? 0,
  }));
}

function sbGenerateUpi(): string {
  return String(6000000000 + Math.floor(Math.random() * 90000000));
}

async function sbCreateLearner(schoolId: string, input: LearnerInput, classId?: string): Promise<Learner> {
  let upi = input.upi?.trim() || sbGenerateUpi();
  for (let tries = 0; tries < 5; tries++) {
    const { data } = await supabase!.from("learners").select("id").eq("upi", upi).maybeSingle();
    if (!data) break;
    upi = sbGenerateUpi();
  }
  const { data, error } = await supabase!
    .from("learners")
    .insert({
      upi,
      nemis: input.nemis?.trim() || null,
      first_name: input.firstName.trim(),
      middle_name: input.middleName?.trim() || null,
      last_name: input.lastName.trim(),
      gender: input.gender,
      dob: input.dob,
      school_id: schoolId,
      class_id: classId ?? null,
      guardian_name: input.guardianName?.trim() || null,
      guardian_phone: input.guardianPhone?.trim() || null,
      admission_year: input.admissionYear,
    })
    .select("*")
    .single();
  if (error) throw supabaseError(error, "Could not register the learner.");
  return mapLearner(data);
}

async function sbUpdateLearner(id: string, input: Partial<LearnerInput>): Promise<Learner> {
  const patch: Record<string, unknown> = {};
  if (input.firstName !== undefined) patch.first_name = input.firstName.trim();
  if (input.middleName !== undefined) patch.middle_name = input.middleName?.trim() || null;
  if (input.lastName !== undefined) patch.last_name = input.lastName.trim();
  if (input.gender !== undefined) patch.gender = input.gender;
  if (input.dob !== undefined) patch.dob = input.dob;
  if (input.guardianName !== undefined) patch.guardian_name = input.guardianName?.trim() || null;
  if (input.guardianPhone !== undefined) patch.guardian_phone = input.guardianPhone?.trim() || null;
  if (input.upi?.trim()) patch.upi = input.upi.trim();

  const { data, error } = await supabase!
    .from("learners")
    .update(patch)
    .eq("id", id)
    .select("*")
    .maybeSingle();
  if (error) throw supabaseError(error, "Could not update the learner.");
  if (!data) throw new ApiError(404, "Learner not found.");
  return mapLearner(data);
}

async function sbEnrollLearner(
  learnerId: string,
  classId: string,
  year: number,
  term: 1 | 2 | 3
): Promise<void> {
  const { data: cls, error: clsError } = await supabase!
    .from("classes")
    .select("school_id")
    .eq("id", classId)
    .maybeSingle();
  if (clsError) throw supabaseError(clsError, "Could not load the class.");
  if (!cls) throw new ApiError(404, "Learner or class not found.");

  const { error: closeErr } = await supabase!
    .from("enrollments")
    .update({ status: "COMPLETED" })
    .eq("learner_id", learnerId)
    .eq("status", "ACTIVE");
  if (closeErr) throw supabaseError(closeErr, "Could not close the previous enrolment.");

  const { error: enrollErr } = await supabase!
    .from("enrollments")
    .insert({ learner_id: learnerId, class_id: classId, year, term, status: "ACTIVE" });
  if (enrollErr) throw supabaseError(enrollErr, "Could not enrol the learner.");

  const { error: updateErr } = await supabase!
    .from("learners")
    .update({ class_id: classId, school_id: cls.school_id })
    .eq("id", learnerId);
  if (updateErr) throw supabaseError(updateErr, "Could not update the learner's class.");
}

async function sbAssertCanEditClass(
  classId: string,
  user: { role: string; id: string }
): Promise<void> {
  if (user.role === "TEACHER") {
    if (!supabase) return;
    const { data, error } = await supabase.from("classes").select("teacher_id").eq("id", classId).maybeSingle();
    if (error) throw supabaseError(error, "Could not load the class.");
    if (!data || String(data.teacher_id) !== user.id) unauthorized("You can only assess your own class.");
  }
}

// --- Mock fallback -----------------------------------------------------------

export async function listLearners(schoolId: string): Promise<Learner[]> {
  if (supabaseEnabled()) return sbListLearners(schoolId);
  await delay();
  return db.learners.filter((l) => l.schoolId === schoolId);
}

export async function getLearner(id: string): Promise<Learner> {
  if (supabaseEnabled()) return sbGetLearner(id);
  await delay(150);
  const learner = db.learners.find((l) => l.id === id);
  if (!learner) throw new ApiError(404, "Learner not found.");
  return { ...learner };
}

function generateUpi(): string {
  let upi: string;
  do {
    upi = String(6000000000 + Math.floor(Math.random() * 90000000));
  } while (db.learners.some((l) => l.upi === upi));
  return upi;
}

export async function createLearner(
  schoolId: string,
  input: LearnerInput,
  classId?: string
): Promise<Learner> {
  if (supabaseEnabled()) return sbCreateLearner(schoolId, input, classId);
  await delay(400);
  const learner: Learner = {
    id: `lnr-${db.nextId.learner++}`,
    upi: input.upi?.trim() || generateUpi(),
    nemis: input.nemis?.trim() || undefined,
    firstName: input.firstName.trim(),
    middleName: input.middleName?.trim() || undefined,
    lastName: input.lastName.trim(),
    gender: input.gender,
    dob: input.dob,
    schoolId,
    classId,
    guardianName: input.guardianName?.trim() || undefined,
    guardianPhone: input.guardianPhone?.trim() || undefined,
    admissionYear: input.admissionYear,
  };
  db.learners.push(learner);
  return learner;
}

export async function updateLearner(id: string, input: Partial<LearnerInput>): Promise<Learner> {
  if (supabaseEnabled()) return sbUpdateLearner(id, input);
  await delay(350);
  const learner = db.learners.find((l) => l.id === id);
  if (!learner) throw new ApiError(404, "Learner not found.");
  Object.assign(learner, {
    firstName: input.firstName?.trim() ?? learner.firstName,
    middleName: input.middleName?.trim() || undefined,
    lastName: input.lastName?.trim() ?? learner.lastName,
    gender: input.gender ?? learner.gender,
    dob: input.dob ?? learner.dob,
    guardianName: input.guardianName?.trim() || undefined,
    guardianPhone: input.guardianPhone?.trim() || undefined,
  });
  if (input.upi?.trim()) learner.upi = input.upi.trim();
  return { ...learner };
}

export async function enrollLearner(
  learnerId: string,
  classId: string,
  year: number,
  term: 1 | 2 | 3
): Promise<void> {
  if (supabaseEnabled()) return sbEnrollLearner(learnerId, classId, year, term);
  await delay(300);
  const learner = db.learners.find((l) => l.id === learnerId);
  const cls = db.classes.find((c) => c.id === classId);
  if (!learner || !cls) throw new ApiError(404, "Learner or class not found.");

  const existing = db.enrollments.filter((e) => e.learnerId === learnerId && e.status === "ACTIVE");
  for (const e of existing) e.status = "COMPLETED";

  db.enrollments.push({
    id: `enr-${db.nextId.enrollment++}`,
    learnerId,
    classId,
    year,
    term,
    status: "ACTIVE",
  });
  learner.classId = classId;
  learner.schoolId = cls.schoolId;
}

export async function listClasses(schoolId: string): Promise<SchoolClass[]> {
  if (supabaseEnabled()) return sbListClasses(schoolId);
  await delay();
  const rows = db.classes.filter((c) => c.schoolId === schoolId);
  return rows.map((c) => ({
    ...c,
    learnerCount: db.learners.filter((l) => l.classId === c.id).length,
  }));
}

export async function getClass(classId: string): Promise<SchoolClass> {
  if (supabaseEnabled()) return sbGetClass(classId);
  await delay(120);
  const cls = db.classes.find((c) => c.id === classId);
  if (!cls) throw new ApiError(404, "Class not found.");
  return { ...cls, learnerCount: db.learners.filter((l) => l.classId === cls.id).length };
}

export async function getTeacherClasses(teacherId: string): Promise<SchoolClass[]> {
  if (supabaseEnabled()) return sbGetTeacherClasses(teacherId);
  await delay();
  const rows = db.classes.filter((c) => c.teacherId === teacherId);
  return rows.map((c) => ({
    ...c,
    learnerCount: db.learners.filter((l) => l.classId === c.id).length,
  }));
}

export async function assertCanEditClass(classId: string, user: { role: string; id: string }): Promise<void> {
  if (supabaseEnabled()) return sbAssertCanEditClass(classId, user);
  if (user.role === "TEACHER") {
    const cls = db.classes.find((c) => c.id === classId);
    if (!cls || cls.teacherId !== user.id) unauthorized("You can only assess your own class.");
  }
}