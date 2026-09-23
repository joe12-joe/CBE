/**
 * Edge function: `create-user`
 *
 * Creates a NEW login (Auth user + profile) on behalf of an admin.
 * Called by the web app's Users page when running in Supabase mode.
 *
 * Hierarchical rules (who may create whom, and only inside their scope):
 *   SUPER_ADMIN      -> any role            (national scope)
 *   COUNTY_ADMIN     -> SUB_COUNTY_ADMIN, SCHOOL_ADMIN, TEACHER  (within own counties)
 *   SUB_COUNTY_ADMIN -> SCHOOL_ADMIN, TEACHER                    (within own sub-counties)
 *   SCHOOL_ADMIN     -> TEACHER                                  (within own schools)
 *
 * Deploy:
 *   supabase functions deploy create-user
 *
 * The Supabase project must have SUPABASE_SERVICE_ROLE_KEY set as a secret
 * (the edge runtime injects it automatically — verify via `supabase secrets list`).
 */
import { createClient } from "npm:@supabase/supabase-js@2";

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const ALL_ROLES = ["SUPER_ADMIN", "COUNTY_ADMIN", "SUB_COUNTY_ADMIN", "SCHOOL_ADMIN", "TEACHER"];

// Caller role -> which target roles it may create, and the scope gate to enforce.
const HIERARCHY: Record<string, { roles: string[]; gate: "all" | "county" | "sub_county" | "school" }> = {
  SUPER_ADMIN: { roles: ALL_ROLES, gate: "all" },
  COUNTY_ADMIN: { roles: ["SUB_COUNTY_ADMIN", "SCHOOL_ADMIN", "TEACHER"], gate: "county" },
  SUB_COUNTY_ADMIN: { roles: ["SCHOOL_ADMIN", "TEACHER"], gate: "sub_county" },
  SCHOOL_ADMIN: { roles: ["TEACHER"], gate: "school" },
};

// Which roles require which scope id to be supplied.
const REQUIRED_SCOPE: Record<string, "school" | "sub_county" | "county" | "none"> = {
  SUPER_ADMIN: "none",
  COUNTY_ADMIN: "county",
  SUB_COUNTY_ADMIN: "sub_county",
  SCHOOL_ADMIN: "school",
  TEACHER: "school",
};

const json = (message: string, status: number) =>
  new Response(JSON.stringify({ message }), { status, headers: { "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  const authHeader = req.headers.get("Authorization") ?? "";
  const token = authHeader.replace(/^Bearer\s+/i, "");
  if (!token) return json("Missing bearer token.", 401);

  const admin = createClient(supabaseUrl, serviceKey);

  const { data: callerAuth, error: authError } = await admin.auth.getUser(token);
  if (authError || !callerAuth?.user) return json("Invalid session.", 401);

  const { data: caller, error: callerErr } = await admin
    .from("profiles")
    .select("id, role, school_ids, county_ids, sub_county_ids")
    .eq("id", callerAuth.user.id)
    .maybeSingle();
  if (callerErr || !caller) return json("Forbidden — unable to resolve your profile.", 403);

  const callerRole = caller.role as string;
  const rule = HIERARCHY[callerRole];
  if (!rule) return json("Forbidden — your role cannot create users.", 403);

  let body;
  try {
    body = await req.json();
  } catch {
    return json("Invalid JSON body.", 400);
  }

  const { name, email, role, schoolId, countyId, subCountyId } = body ?? {};
  if (!name || !email || !role) return json("name, email and role are required.", 400);
  if (!rule.roles.includes(role)) {
    return json(`Forbidden — ${callerRole} may only create ${rule.roles.join(", ")}.`, 403);
  }

  // Resolve the scope a new user will live in (county/sub-county can be derived
  // from the school or sub-county instead of being passed directly).
  let schoolIdFinal: string | null = schoolId ?? null;
  let countyIdFinal: string | null = countyId ?? null;
  let subCountyIdFinal: string | null = subCountyId ?? null;

  if (schoolIdFinal) {
    const { data: row } = await admin
      .from("schools")
      .select("id, county_id, sub_county_id")
      .eq("id", schoolIdFinal)
      .maybeSingle();
    if (!row) return json("School not found.", 400);
    countyIdFinal = row.county_id;
    subCountyIdFinal = row.sub_county_id;
  } else if (subCountyIdFinal) {
    const { data: row } = await admin
      .from("sub_counties")
      .select("id, county_id")
      .eq("id", subCountyIdFinal)
      .maybeSingle();
    if (!row) return json("Sub-county not found.", 400);
    countyIdFinal = row.county_id;
  }

  // Scope gates — the created user must live inside the caller's own scope.
  const hasSchool = (id: string) => caller.school_ids?.includes(id) ?? false;
  const hasCounty = (id: string) => caller.county_ids?.includes(id) ?? false;
  const hasSubCounty = (id: string) => caller.sub_county_ids?.includes(id) ?? false;

  const required = REQUIRED_SCOPE[role];
  if (required === "school" && !schoolIdFinal) return json("schoolId is required for this role.", 400);
  if (required === "sub_county" && !subCountyIdFinal) return json("subCountyId is required for this role.", 400);
  if (required === "county" && !countyIdFinal) return json("countyId is required for this role.", 400);

  switch (rule.gate) {
    case "all":
      break;
    case "county":
      if (countyIdFinal && !hasCounty(countyIdFinal)) {
        return json("Forbidden — school/county is outside your county.", 403);
      }
      break;
    case "sub_county":
      if (subCountyIdFinal && !hasSubCounty(subCountyIdFinal)) {
        return json("Forbidden — school/sub-county is outside your sub-county.", 403);
      }
      break;
    case "school":
      if (schoolIdFinal && !hasSchool(schoolIdFinal)) {
        return json("Forbidden — school is outside your school.", 403);
      }
      break;
  }

  // Random 12-char initial password, returned once so the admin can share it.
  const CHARS = "abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const password = Array.from(
    { length: 12 },
    () => CHARS[Math.floor(Math.random() * CHARS.length)]
  ).join("");

  const { data: created, error: createError } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { name },
  });
  if (createError) return json(createError.message, 400);

  const { data: profileRow, error: profileError } = await admin
    .from("profiles")
    .upsert(
      {
        id: created.id,
        name,
        email,
        role,
        school_ids: schoolIdFinal ? [schoolIdFinal] : [],
        county_ids: countyIdFinal ? [countyIdFinal] : [],
        sub_county_ids: subCountyIdFinal ? [subCountyIdFinal] : [],
        active: true,
      },
      { onConflict: "id" }
    )
    .select("id, name, email, role, school_ids, county_ids, sub_county_ids, active")
    .single();

  if (profileError) return json(profileError.message, 500);

  return new Response(
    JSON.stringify({
      user: {
        id: profileRow.id,
        name: profileRow.name,
        email: profileRow.email,
        role: profileRow.role,
        schoolIds: profileRow.school_ids,
        countyIds: profileRow.county_ids,
        subCountyIds: profileRow.sub_county_ids,
        active: profileRow.active,
      },
      initialPassword: password,
    }),
    { status: 201, headers: { "Content-Type": "application/json" } }
  );
});