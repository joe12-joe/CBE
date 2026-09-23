/**
 * Supabase client + row→domain mappers.
 *
 * When VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY are set, the app runs in
 * "live" mode against the Supabase project (Auth + PostgREST + RLS). Without
 * them it falls back to the in-memory mock DB so the UI can be demoed with no
 * backend. The service layer in `src/services/*` picks the mode per call.
 */
import { createClient } from "@supabase/supabase-js";
import type { Learner, LoginEvent, School, SchoolClass, User } from "@/lib/types";

export const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
export const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

export const supabase =
  supabaseUrl && supabaseAnonKey ? createClient(supabaseUrl, supabaseAnonKey) : null;

export function supabaseEnabled(): boolean {
  return supabase !== null;
}

/** Live mode + a signed-in Supabase session (auth persist handle). */
export async function hasLiveSession(): Promise<boolean> {
  if (!supabase) return false;
  const { data } = await supabase.auth.getSession();
  return Boolean(data.session);
}

// ---------------------------------------------------------------------------
// Row → domain mappers (rows arrive in snake_case from PostgREST)
// ---------------------------------------------------------------------------

export interface ProfileRow {
  id: string;
  name: string;
  email: string;
  role: User["role"];
  school_ids: string[];
  county_ids: string[];
  sub_county_ids: string[];
  active: boolean;
}

export function mapProfile(row: ProfileRow): User {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    role: row.role,
    schoolIds: row.school_ids ?? [],
    countyIds: row.county_ids ?? [],
    subCountyIds: row.sub_county_ids ?? [],
    active: row.active,
  };
}

export interface LoginEventRow {
  id: string;
  user_id: string;
  email: string;
  created_at: string;
  ip?: string;
  user_agent?: string;
}

export function mapLoginEvent(row: LoginEventRow): LoginEvent {
  return {
    id: String(row.id),
    userId: String(row.user_id),
    email: String(row.email),
    createdAt: String(row.created_at),
    ip: row.ip ? String(row.ip) : undefined,
    userAgent: row.user_agent ? String(row.user_agent) : undefined,
  };
}

export function mapLearner(row: Record<string, unknown>): Learner {
  return {
    id: String(row.id),
    upi: String(row.upi),
    nemis: row.nemis ? String(row.nemis) : undefined,
    firstName: String(row.first_name),
    middleName: row.middle_name ? String(row.middle_name) : undefined,
    lastName: String(row.last_name),
    gender: row.gender as "M" | "F",
    dob: String(row.dob).slice(0, 10),
    schoolId: String(row.school_id),
    classId: row.class_id ? String(row.class_id) : undefined,
    guardianName: row.guardian_name ? String(row.guardian_name) : undefined,
    guardianPhone: row.guardian_phone ? String(row.guardian_phone) : undefined,
    admissionYear: Number(row.admission_year),
  };
}

export function mapSchool(row: Record<string, unknown>): School {
  return {
    id: String(row.id),
    code: String(row.code),
    name: String(row.name),
    type: row.type as School["type"],
    countyId: String(row.county_id),
    subCountyId: String(row.sub_county_id),
    address: row.address ? String(row.address) : undefined,
    phone: row.phone ? String(row.phone) : undefined,
  };
}

export function mapClass(row: Record<string, unknown>): SchoolClass {
  return {
    id: String(row.id),
    schoolId: String(row.school_id),
    grade: row.grade as SchoolClass["grade"],
    stream: String(row.stream),
    teacherId: row.teacher_id ? String(row.teacher_id) : undefined,
  };
}

/** Raise on Supabase errors with a message that maps to the app's ApiError. */
export function supabaseError(error: { message?: string } | null, fallback: string): Error {
  const message = error?.message ? `${fallback} (${error.message})` : fallback;
  const err = new Error(message) as Error & { status?: number };
  err.status = 400;
  return err;
}