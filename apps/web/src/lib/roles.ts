import type { Role } from "./types";

/** Roles allowed to manage learners, curriculum and report issuances. */
export function isAdmin(role: Role): boolean {
  return role !== "TEACHER";
}

export function canManageOrg(role: Role): boolean {
  return role === "SUPER_ADMIN" || role === "COUNTY_ADMIN" || role === "SUB_COUNTY_ADMIN";
}

/** Roles that can view county-wide comparisons. */
export function canViewCountyData(role: Role): boolean {
  return role === "SUPER_ADMIN" || role === "COUNTY_ADMIN" || role === "SUB_COUNTY_ADMIN";
}