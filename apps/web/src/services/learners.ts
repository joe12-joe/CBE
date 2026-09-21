import { db } from "./mocks/db";
import { delay, ApiError, unauthorized } from "./apiClient";
import type { Learner, LearnerInput, SchoolClass } from "@/lib/types";

export async function listLearners(schoolId: string): Promise<Learner[]> {
  await delay();
  return db.learners.filter((l) => l.schoolId === schoolId);
}

export async function getLearner(id: string): Promise<Learner> {
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
  await delay();
  const rows = db.classes.filter((c) => c.schoolId === schoolId);
  return rows.map((c) => ({
    ...c,
    learnerCount: db.learners.filter((l) => l.classId === c.id).length,
  }));
}

export async function getClass(classId: string): Promise<SchoolClass> {
  await delay(120);
  const cls = db.classes.find((c) => c.id === classId);
  if (!cls) throw new ApiError(404, "Class not found.");
  return { ...cls, learnerCount: db.learners.filter((l) => l.classId === cls.id).length };
}

export async function getTeacherClasses(teacherId: string): Promise<SchoolClass[]> {
  await delay();
  const rows = db.classes.filter((c) => c.teacherId === teacherId);
  return rows.map((c) => ({
    ...c,
    learnerCount: db.learners.filter((l) => l.classId === c.id).length,
  }));
}

export async function assertCanEditClass(classId: string, user: { role: string; id: string }): Promise<void> {
  if (user.role === "TEACHER") {
    const cls = db.classes.find((c) => c.id === classId);
    if (!cls || cls.teacherId !== user.id) unauthorized("You can only assess your own class.");
  }
}