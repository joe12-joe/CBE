import { db } from "./mocks/db";
import { delay } from "./apiClient";
import { GRADE_ORDER } from "@/lib/format";
import type { County, School, SchoolType, SubCounty, User } from "@/lib/types";

export async function listCounties(): Promise<County[]> {
  await delay(80);
  return [...db.counties];
}

export async function listSubCounties(countyId?: string): Promise<SubCounty[]> {
  await delay(80);
  return db.subCounties.filter((s) => !countyId || s.countyId === countyId);
}

export async function listSchools(params?: {
  countyId?: string;
  subCountyId?: string;
}): Promise<School[]> {
  await delay();
  return db.schools
    .filter((s) => (!params?.countyId || s.countyId === params.countyId) && (!params?.subCountyId || s.subCountyId === params.subCountyId))
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((s) => ({ ...s, enrollmentCount: db.learners.filter((l) => l.schoolId === s.id).length }));
}

export function schoolTypeLabel(type: SchoolType): string {
  return type === "PRIMARY" ? "Primary School" : "Junior Secondary";
}

export async function getSchoolsForUser(user: User): Promise<School[]> {
  await delay();
  return db.schools
    .filter((s) => user.schoolIds.includes(s.id) || user.countyIds.includes(s.countyId))
    .map((s) => ({ ...s, enrollmentCount: db.learners.filter((l) => l.schoolId === s.id).length }));
}

export async function getSchool(id: string): Promise<School> {
  await delay(100);
  const s = db.schools.find((x) => x.id === id)!;
  return { ...s, enrollmentCount: db.learners.filter((l) => l.schoolId === id).length };
}

export interface GradeEnrollmentSummary {
  school: School;
  byGrade: Record<string, number>;
  academicYear: number;
}

export async function getGradeEnrollment(schoolId: string, year: number): Promise<GradeEnrollmentSummary> {
  await delay();
  const school = await getSchool(schoolId);
  const byGrade: Record<string, number> = {};
  for (const g of GRADE_ORDER) byGrade[g] = 0;
  for (const l of db.learners.filter((x) => x.schoolId === schoolId)) {
    const cls = db.classes.find((c) => c.id === l.classId);
    if (cls) byGrade[cls.grade] += 1;
  }
  return { school, byGrade, academicYear: year };
}