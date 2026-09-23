import type { Role } from "@/lib/types";

/**
 * User-management hierarchy — mirrors the `create-user` edge function.
 * Each role lists the target roles it may create; the edge function, plus RLS,
 * keep every created user inside the caller's own scope (school_ids /
 * county_ids / sub_county_ids on the profile).
 */
const HIERARCHY: Record<Role, Role[]> = {
  SUPER_ADMIN: ["SUPER_ADMIN", "COUNTY_ADMIN", "SUB_COUNTY_ADMIN", "SCHOOL_ADMIN", "TEACHER"],
  COUNTY_ADMIN: ["SUB_COUNTY_ADMIN", "SCHOOL_ADMIN", "TEACHER"],
  SUB_COUNTY_ADMIN: ["SCHOOL_ADMIN", "TEACHER"],
  SCHOOL_ADMIN: ["TEACHER"],
  TEACHER: [],
};

/** Roles the given caller may create. */
export function rolesUserMayCreate(role: Role): Role[] {
  return HIERARCHY[role];
}

/**
 * The scope id a target role needs when an account of that role is created
 * (which selector the Users page must show, matching REQUIRED_SCOPE in the
 * edge function).
 */
export const ROLE_SCOPE: Record<Role, "school" | "sub_county" | "county" | "none"> = {
  SUPER_ADMIN: "none",
  COUNTY_ADMIN: "county",
  SUB_COUNTY_ADMIN: "sub_county",
  SCHOOL_ADMIN: "school",
  TEACHER: "school",
};