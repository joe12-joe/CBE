import { db } from "./mocks/db";
import { delay } from "./apiClient";
import { GRADE_ORDER } from "@/lib/format";
import { supabase, supabaseEnabled, mapSchool, supabaseError } from "@/lib/supabase";
import type { County, School, SchoolType, SubCounty, User } from "@/lib/types";

// --- Live (Supabase) implementation -----------------------------------------

async function withEnrollmentCounts(rows: Array<Record<string, unknown>>): Promise<School[]> {
  const ids = rows.map((r) => String(r.id));
  const counts = new Map<string, number>();
  if (ids.length > 0) {
    const { data, error } = await supabase!.from("learners").select("school_id").in("school_id", ids);
    if (error) throw supabaseError(error, "Could not count learners.");
    for (const l of data ?? []) {
      const sid = String(l.school_id);
      counts.set(sid, (counts.get(sid) ?? 0) + 1);
    }
  }
  return rows.map((r) => ({ ...mapSchool(r), enrollmentCount: counts.get(String(r.id)) ?? 0 }));
}

async function sbListCounties(): Promise<County[]> {
  const { data, error } = await supabase!.from("counties").select("id, code, name").order("name");
  if (error) throw supabaseError(error, "Could not list counties.");
  return (data ?? []).map((c) => ({ id: String(c.id), code: String(c.code), name: String(c.name) }));
}

async function sbListSubCounties(countyId?: string): Promise<SubCounty[]> {
  const q = supabase!.from("sub_counties").select("id, county_id, name").order("name");
  const { data, error } = countyId ? await q.eq("county_id", countyId) : await q;
  if (error) throw supabaseError(error, "Could not list sub-counties.");
  return (data ?? []).map((s) => ({
    id: String(s.id),
    countyId: String(s.county_id),
    name: String(s.name),
  }));
}

async function sbListSchools(params?: {
  countyId?: string;
  subCountyId?: string;
}): Promise<School[]> {
  let q = supabase!.from("schools").select("*").order("name");
  if (params?.countyId) q = q.eq("county_id", params.countyId);
  if (params?.subCountyId) q = q.eq("sub_county_id", params.subCountyId);
  const { data, error } = await q;
  if (error) throw supabaseError(error, "Could not list schools.");
  return withEnrollmentCounts(data ?? []);
}

async function sbGetSchoolsForUser(user: User): Promise<School[]> {
  const schoolIds = user.schoolIds ?? [];
  const countyIds = user.countyIds ?? [];
  if (user.role === "SUPER_ADMIN" || (schoolIds.length === 0 && countyIds.length === 0)) {
    return sbListSchools();
  }
  const filters: string[] = [];
  if (schoolIds.length > 0) filters.push(`id.in.(${schoolIds.join(",")})`);
  if (countyIds.length > 0) filters.push(`county_id.in.(${countyIds.join(",")})`);
  const { data, error } = await supabase!
    .from("schools")
    .select("*")
    .or(filters.join(","))
    .order("name");
  if (error) throw supabaseError(error, "Could not list schools.");
  return withEnrollmentCounts(data ?? []);
}

async function sbGetSchool(id: string): Promise<School> {
  const { data, error } = await supabase!.from("schools").select("*").eq("id", id).maybeSingle();
  if (error) throw supabaseError(error, "Could not load the school.");
  if (!data) throw Object.assign(new Error("School not found."), { status: 404 });
  const { count } = await supabase!
    .from("learners")
    .select("id", { count: "exact", head: true })
    .eq("school_id", id);
  return { ...mapSchool(data), enrollmentCount: count ?? 0 };
}

async function sbGetGradeEnrollment(schoolId: string, year: number) {
  const school = await sbGetSchool(schoolId);
  const { data: classes, error: cErr } = await supabase!
    .from("classes")
    .select("id, grade")
    .eq("school_id", schoolId);
  if (cErr) throw supabaseError(cErr, "Could not load classes.");
  const { data: learners, error: lErr } = await supabase!
    .from("learners")
    .select("class_id")
    .eq("school_id", schoolId)
    .not("class_id", "is", null);
  if (lErr) throw supabaseError(lErr, "Could not load learners.");

  const gradeById = new Map((classes ?? []).map((c) => [String(c.id), String(c.grade)]));
  const byGrade: Record<string, number> = {};
  for (const g of GRADE_ORDER) byGrade[g] = 0;
  for (const l of learners ?? []) {
    const g = gradeById.get(String(l.class_id));
    if (g) byGrade[g] += 1;
  }
  return { school, byGrade, academicYear: year };
}

// --- Public API -------------------------------------------------------------

export async function listCounties(): Promise<County[]> {
  if (supabaseEnabled()) return sbListCounties();
  await delay(80);
  return [...db.counties];
}

export async function listSubCounties(countyId?: string): Promise<SubCounty[]> {
  if (supabaseEnabled()) return sbListSubCounties(countyId);
  await delay(80);
  return db.subCounties.filter((s) => !countyId || s.countyId === countyId);
}

export async function listSchools(params?: {
  countyId?: string;
  subCountyId?: string;
}): Promise<School[]> {
  if (supabaseEnabled()) return sbListSchools(params);
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
  if (supabaseEnabled()) return sbGetSchoolsForUser(user);
  await delay();
  return db.schools
    .filter((s) => user.schoolIds.includes(s.id) || user.countyIds.includes(s.countyId))
    .map((s) => ({ ...s, enrollmentCount: db.learners.filter((l) => l.schoolId === s.id).length }));
}

export async function getSchool(id: string): Promise<School> {
  if (supabaseEnabled()) return sbGetSchool(id);
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
  if (supabaseEnabled()) return sbGetGradeEnrollment(schoolId, year);
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