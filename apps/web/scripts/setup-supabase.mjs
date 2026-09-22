#!/usr/bin/env node
/**
 * CBE Manager — one-shot Supabase setup.
 *
 * Run from `apps/web` with the service-role key available:
 *   node --env-file .env.local scripts/setup-supabase.mjs
 *
 * What it does:
 *   1. Applies supabase/schema.sql (tables, indexes, RLS helpers + policies).
 *   2. Applies supabase/seed.sql (starter geography / schools / classes /
 *      curriculum / learners / scores) unless run with `--schema-only`.
 *
 * It NEVER creates accounts — no demo users. Add your own real users in the
 * Supabase dashboard (Authentication → Users → Add user) and grant them a role
 * with the profile snippet printed at the end (or use the `create-user` edge
 * function from the Users page as a SUPER_ADMIN).
 *
 * The service-role key is read from SUPABASE_SERVICE_ROLE_KEY (put it in
 * apps/web/.env.local). It is NEVER used by the browser app.
 */
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const url = process.env.VITE_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const schemaOnly = process.argv.includes("--schema-only");

if (!url || !serviceKey) {
  console.error("Missing configuration.");
  console.error("  Add to apps/web/.env.local:");
  console.error("    VITE_SUPABASE_URL=<your project url>");
  console.error("    SUPABASE_SERVICE_ROLE_KEY=<your service_role key>");
  console.error("  Then run:  node --env-file .env.local scripts/setup-supabase.mjs");
  process.exit(1);
}

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, "../../../"); // repo root

async function applySql(title, file) {
  const sql = readFileSync(resolve(root, "supabase", file), "utf8");
  const res = await fetch(`${url}/pg/meta/default/query`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${serviceKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ query: sql }),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    console.log(`⚠  Could not auto-apply ${file} (HTTP ${res.status}).`);
    console.log(`   ${body.slice(0, 200)}`);
    console.log(
      `   → Open Supabase Dashboard → SQL Editor → paste supabase/${file} → Run.`
    );
    return false;
  }
  console.log(`✔ Applied ${title} (${file}).`);
  return true;
}

async function main() {
  console.log(`Setting up ${url}\n`);

  await applySql("schema", "schema.sql");
  if (!schemaOnly) await applySql("seed", "seed.sql");
  else console.log("`--schema-only` set — skipping seed data.");

  console.log(`
No demo accounts were created (by design). To bring the system online:

  1. Create a user:
     Dashboard → Authentication → Users → Add user (email + password).

  2. Grant that user a role — SQL Editor:

     insert into public.profiles (id, name, email, role, school_ids, county_ids)
     select id, coalesce(raw_user_meta_data->>'name', email), email,
            'SUPER_ADMIN', '{}', '{}'
     from auth.users
     where email = '<the user email>';

     Roles: SUPER_ADMIN | COUNTY_ADMIN | SUB_COUNTY_ADMIN | SCHOOL_ADMIN | TEACHER
     - SCHOOL_ADMIN / TEACHER: set school_ids to the school's uuid.
     - COUNTY_ADMIN / SUB_COUNTY_ADMIN: set county_ids.

  Tip: from a SUPER_ADMIN, the in-app Users page creates further users via the
  create-user edge function (see supabase/README.md).
`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});