import { delay } from "./apiClient";
import { supabase, supabaseEnabled, supabaseError, mapLoginEvent, type LoginEventRow } from "@/lib/supabase";
import type { LoginEvent } from "@/lib/types";

// --- Live (Supabase) implementation -----------------------------------------
// RLS scopes the rows: everyone sees their own sign-ins, admins additionally
// see the sign-ins of every user beneath them in the hierarchy.

async function sbGetLoginEvents(limit = 100): Promise<LoginEvent[]> {
  const { data, error } = await supabase!
    .from("login_events")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw supabaseError(error, "Could not load login history.");
  return (data as LoginEventRow[]).map(mapLoginEvent);
}

// --- Public API -------------------------------------------------------------

export async function getLoginEvents(limit = 100): Promise<LoginEvent[]> {
  if (supabaseEnabled()) return sbGetLoginEvents(limit);
  await delay(200);
  return [];
}