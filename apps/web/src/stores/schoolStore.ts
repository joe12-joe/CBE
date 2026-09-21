import { create } from "zustand";
import { persist } from "zustand/middleware";

interface SchoolState {
  schoolId: string | null;
  setSchoolId: (id: string) => void;
}

export const useSchoolStore = create<SchoolState>()(
  persist(
    (set) => ({
      schoolId: null,
      setSchoolId: (id) => set({ schoolId: id }),
    }),
    { name: "cbe-school" }
  )
);