import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { Term } from "@/lib/types";

const CURRENT_YEAR = 2026;
const CURRENT_TERM = 3;

interface TermState {
  term: Term;
  setTerm: (term: Term) => void;
}

export const useTermStore = create<TermState>()(
  persist(
    (set) => ({
      term: { year: CURRENT_YEAR, term: CURRENT_TERM },
      setTerm: (term) => set({ term }),
    }),
    { name: "cbe-term" }
  )
);