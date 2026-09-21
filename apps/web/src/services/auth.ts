import { db } from "./mocks/db";
import { delay, ApiError } from "./apiClient";
import { users } from "./mocks/db";
import type { User } from "@/lib/types";

export interface Session {
  user: User;
  token: string;
}

/** Mock login — accepts any seeded user email with any password. */
export async function login(email: string, _password: string): Promise<Session> {
  await delay(600);
  const user = users.find((u) => u.email.toLowerCase() === email.trim().toLowerCase());
  if (!user) throw new ApiError(401, "Unknown user. Use one of the demo accounts below.");
  if (!user.active) throw new ApiError(403, "This account has been deactivated.");
  return { user, token: `mock-token-${user.id}` };
}

export async function getSession(token: string): Promise<Session> {
  await delay(120);
  const id = token.replace("mock-token-", "");
  const user = users.find((u) => u.id === id);
  if (!user) throw new ApiError(401, "Session expired — please log in again.");
  return { user, token };
}

export async function listUsers(schoolId?: string): Promise<User[]> {
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
  await delay(150);
  const user = users.find((u) => u.id === id);
  if (!user) throw new ApiError(404, "User not found.");
  user.active = active;
  return user;
}