import { db } from "./mocks/db";
import { delay, ApiError } from "./apiClient";
import { users } from "./mocks/db";
import {
  supabase,
  supabaseUrl,
  supabaseEnabled,
  mapProfile,
  supabaseError,
  type ProfileRow,
} from "@/lib/supabase";
import type { User } from "@/lib/types";

export interface Session {
  user: User;
  token: string;
}

// --- Live (Supabase) implementation -----------------------------------------

async function profileFor(userId: string): Promise<User> {
  const { data, error } = await supabase!
    .from("profiles")
    .select("*")
    .eq("id", userId)
    .maybeSingle();
  if (error) throw supabaseError(error, "Could not load your profile.");
  if (!data) throw new ApiError(404, "Profile not found.");
  return mapProfile(data as ProfileRow);
}

async function sbLogin(email: string, password: string): Promise<Session> {
  const { data, error } = await supabase!.auth.signInWithPassword({ email, password });
  if (error || !data.user) {
    throw new ApiError(401, error?.message === "Invalid login credentials"
      ? "Unknown user or wrong password."
      : error?.message ?? "Login failed."
    );
  }
  const user = await profileFor(data.user.id);
  if (!user.active) throw new ApiError(403, "This account has been deactivated.");
  return { user, token: data.session?.access_token ?? "" };
}

async function sbGetSession(_token?: string): Promise<Session> {
  const { data, error } = await supabase!.auth.getSession();
  if (error) throw new ApiError(401, error.message);
  const session = data.session;
  if (!session?.user) throw new ApiError(401, "Session expired — please log in again.");
  const user = await profileFor(session.user.id);
  if (!user.active) throw new ApiError(403, "This account has been deactivated.");
  return { user, token: session.access_token };
}

async function sbSignOut(): Promise<void> {
  await supabase!.auth.signOut();
}

async function sbListUsers(schoolId?: string): Promise<User[]> {
  let query = supabase!.from("profiles").select("*").order("name");
  if (schoolId) {
    // Profiles whose school_ids contain this school.
    query = query.contains("school_ids", [schoolId]);
  }
  const { data, error } = await query;
  if (error) throw supabaseError(error, "Could not list users.");
  return (data as ProfileRow[]).map(mapProfile);
}

async function sbCreateUser(input: {
  name: string;
  email: string;
  role: User["role"];
  schoolId: string;
  countyId: string;
}): Promise<User> {
  const { data } = await supabase!.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new ApiError(401, "Not authenticated.");
  const res = await fetch(`${supabaseUrl}/functions/v1/create-user`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      name: input.name,
      email: input.email,
      role: input.role,
      schoolId: input.schoolId,
      countyId: input.countyId,
    }),
  });
  let json: { message?: string; user?: User } = {};
  try {
    json = await res.json();
  } catch {
    /* non-JSON error body */
  }
  if (!res.ok) {
    throw new ApiError(
      res.status,
      json.message ?? "Could not create the user. Deploy the `create-user` edge function."
    );
  }
  if (!json.user) throw new ApiError(502, "Edge function returned no user.");
  return json.user;
}

async function sbSetUserActive(id: string, active: boolean): Promise<User> {
  const { data, error } = await supabase!
    .from("profiles")
    .update({ active })
    .eq("id", id)
    .select("*")
    .maybeSingle();
  if (error) throw supabaseError(error, "Could not update the user.");
  if (!data) throw new ApiError(404, "User not found.");
  return mapProfile(data as ProfileRow);
}

// --- Mock fallback -----------------------------------------------------------

/** Mock login — only accepts users present in the mock DB (none by default). */
export async function login(email: string, password: string): Promise<Session> {
  if (supabaseEnabled()) return sbLogin(email, password);
  await delay(600);
  const user = users.find((u) => u.email.toLowerCase() === email.trim().toLowerCase());
  if (!user) throw new ApiError(401, "Unknown user or wrong password.");
  if (!user.active) throw new ApiError(403, "This account has been deactivated.");
  return { user, token: `mock-token-${user.id}` };
}

export async function getSession(token?: string): Promise<Session> {
  if (supabaseEnabled()) return sbGetSession(token);
  await delay(120);
  const id = (token ?? "").replace("mock-token-", "");
  const user = users.find((u) => u.id === id);
  if (!user) throw new ApiError(401, "Session expired — please log in again.");
  return { user, token: token ?? "" };
}

export async function signOut(): Promise<void> {
  if (supabaseEnabled()) return sbSignOut();
  await delay(80);
}

export async function listUsers(schoolId?: string): Promise<User[]> {
  if (supabaseEnabled()) return sbListUsers(schoolId);
  await delay();
  return users.filter((u) => !schoolId || u.schoolIds.includes(schoolId));
}

export async function createUser(input: {
  name: string;
  email: string;
  role: User["role"];
  schoolId: string;
  countyId: string;
}): Promise<User> {
  if (supabaseEnabled()) return sbCreateUser(input);
  await delay();
  if (users.some((u) => u.email.toLowerCase() === input.email.toLowerCase())) {
    throw new ApiError(409, "A user with this email already exists.");
  }
  const user: User = {
    id: `usr-${db.nextId.user++}`,
    name: input.name,
    email: input.email,
    role: input.role,
    schoolIds: [input.schoolId],
    countyIds: [input.countyId],
    active: true,
  };
  users.push(user);
  return user;
}

export async function setUserActive(id: string, active: boolean): Promise<User> {
  if (supabaseEnabled()) return sbSetUserActive(id, active);
  await delay(150);
  const user = users.find((u) => u.id === id);
  if (!user) throw new ApiError(404, "User not found.");
  user.active = active;
  return user;
}

export { supabaseUrl };