import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { User } from "@/lib/types";
import * as authService from "@/services/auth";

interface AuthState {
  user: User | null;
  token: string | null;
  status: "idle" | "loading" | "authenticated";
  login: (email: string, password: string) => Promise<void>;
  restore: () => Promise<void>;
  logout: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      token: null,
      status: "idle",
      async login(email, password) {
        const session = await authService.login(email, password);
        set({ user: session.user, token: session.token, status: "authenticated" });
      },
      async restore() {
        const { token } = get();
        if (!token) {
          set({ status: "idle" });
          return;
        }
        try {
          const session = await authService.getSession(token);
          set({ user: session.user, token: session.token, status: "authenticated" });
        } catch {
          set({ user: null, token: null, status: "idle" });
        }
      },
      logout() {
        set({ user: null, token: null, status: "idle" });
      },
    }),
    {
      name: "cbe-auth",
      partialize: (state) => ({ user: state.user, token: state.token }),
    }
  )
);

export const ROLE_LABEL: Record<User["role"], string> = {
  SUPER_ADMIN: "Super Admin",
  COUNTY_ADMIN: "County Admin",
  SUB_COUNTY_ADMIN: "Sub-County Admin",
  SCHOOL_ADMIN: "School Admin",
  TEACHER: "Teacher",
};