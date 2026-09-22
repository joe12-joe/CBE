/**
 * Edge function: `create-user`
 *
 * Creates a NEW login (Auth user + profile) on behalf of a SUPER_ADMIN.
 * Called by the web app's Users page when running in Supabase mode.
 *
 * Deploy:
 *   supabase functions deploy create-user
 *
 * The Supabase project must have SUPABASE_SERVICE_ROLE_KEY set as a secret
 * (the edge runtime injects it automatically as SUPABASE_SERVICE_ROLE_KEY —
 * verify via `supabase secrets list` after `supabase link`).
 */
import { createClient } from "npm:@supabase/supabase-js@2";

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

Deno.serve(async (req) => {
  const authHeader = req.headers.get("Authorization") ?? "";
  const token = authHeader.replace(/^Bearer\s+/i, "");
  if (!token) {
    return new Response(JSON.stringify({ message: "Missing bearer token." }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  const admin = createClient(supabaseUrl, serviceKey);
  const { data: caller, error: authError } = await admin.auth.getUser(token);
  if (authError || !caller?.user) {
    return new Response(JSON.stringify({ message: "Invalid session." }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  // Only SUPER_ADMIN may create users. Default `profiles` RLS lets super
  // admins read scoped profiles, so we resolve the caller's role directly.
  const { data: profile } = await admin
    .from("profiles")
    .select("role")
    .eq("id", caller.user.id)
    .maybeSingle();
  if (profile?.role !== "SUPER_ADMIN") {
    return new Response(JSON.stringify({ message: "Forbidden — super admin only." }), {
      status: 403,
      headers: { "Content-Type": "application/json" },
    });
  }

  let body;
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ message: "Invalid JSON body." }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const { name, email, role, schoolId, countyId } = body ?? {};
  if (!name || !email || !role) {
    return new Response(JSON.stringify({ message: "name, email and role are required." }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
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
  if (createError) {
    return new Response(JSON.stringify({ message: createError.message }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const { data: profileRow, error: profileError } = await admin
    .from("profiles")
    .upsert(
      {
        id: created.id,
        name,
        email,
        role,
        school_ids: schoolId ? [schoolId] : [],
        county_ids: countyId ? [countyId] : [],
        active: true,
      },
      { onConflict: "id" }
    )
    .select("id, name, email, role, school_ids, county_ids, active")
    .single();

  if (profileError) {
    return new Response(JSON.stringify({ message: profileError.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }

  return new Response(
    JSON.stringify({
      user: {
        id: profileRow.id,
        name: profileRow.name,
        email: profileRow.email,
        role: profileRow.role,
        schoolIds: profileRow.school_ids,
        countyIds: profileRow.county_ids,
        active: profileRow.active,
      },
      initialPassword: password,
    }),
    { status: 201, headers: { "Content-Type": "application/json" } }
  );
});