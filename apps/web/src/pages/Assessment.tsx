import { useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, Loader2, Save, Undo2 } from "lucide-react";
import { toast } from "sonner";
import { useSchoolContext } from "@/lib/useSchool";
import { useTermStore } from "@/stores/termStore";
import { useAuthStore } from "@/stores/authStore";
import { getScoreGrid, saveScores, type ScoreGridData } from "@/services/assessment";
import { listClasses, getTeacherClasses, assertCanEditClass } from "@/services/learners";
import { listLearningAreas } from "@/services/curriculum";
import { computeLevel, GRADE_LABEL, termLabel, SCORE_MAX } from "@/lib/format";
import { averageScore } from "@/lib/score";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { LevelPill } from "@/components/ui/level-badge";
import { cn } from "@/lib/utils";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

type CellKey = `${string}:${string}`;

function parseScore(v: string | undefined): number | null {
  if (v == null || v.trim() === "") return null;
  const n = Number(v);
  if (Number.isNaN(n)) return null;
  return n;
}

/** Plain string-keyed draft/original maps (indexing by template-literal keys). */
type CellMap = Record<string, number | null>;

export function AssessmentPage() {
  const { schoolId } = useSchoolContext();
  const { term } = useTermStore();
  const user = useAuthStore((s) => s.user)!;
  const qc = useQueryClient();

  const isTeacher = user.role === "TEACHER";
  const [classId, setClassId] = useState<string>("");
  const [areaId, setAreaId] = useState<string>("all");
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const cellRefs = useRef<Record<CellKey, HTMLInputElement | null>>({});

  const { data: classes = [], isLoading: classesLoading } = useQuery({
    queryKey: [isTeacher ? "teacher-classes" : "classes", schoolId, user.id],
    queryFn: () => (isTeacher ? getTeacherClasses(user.id) : listClasses(schoolId!)),
    enabled: !!schoolId,
  });

  const { data: areas = [] } = useQuery({
    queryKey: ["learning-areas"],
    queryFn: () => listLearningAreas(),
  });

  const resolvedClassId = classId || classes[0]?.id || "";
  const currentClass = classes.find((c) => c.id === resolvedClassId);

  const { data: grid, isLoading } = useQuery<ScoreGridData>({
    queryKey: ["score-grid", resolvedClassId, areaId, term],
    queryFn: () => getScoreGrid(term, resolvedClassId, areaId === "all" ? undefined : areaId),
    enabled: !!resolvedClassId,
  });

  const original = useMemo(() => {
    const map: CellMap = {};
    for (const row of grid?.rows ?? []) {
      for (const [subId, score] of Object.entries(row.cells)) {
        map[`${row.learner.id}:${subId}`] = score;
      }
    }
    return map;
  }, [grid]);

  const dirtyCount = useMemo(() => {
    let n = 0;
    for (const [k, v] of Object.entries(draft)) {
      if (parseScore(v) !== original[k]) n += 1;
    }
    return n;
  }, [draft, original]);

  const mutation = useMutation({
    mutationFn: async () => {
      await assertCanEditClass(resolvedClassId, user);
      const inputs = Object.entries(draft)
        .filter(([k, v]) => parseScore(v) !== original[k])
        .map(([k, v]) => {
          const [learnerId, subStrandId] = k.split(":") as [string, string];
          return { term, learnerId, subStrandId, score: parseScore(v) };
        });
      if (inputs.length === 0) return;
      await saveScores(term, inputs);
    },
    onSuccess: () => {
      setDraft({});
      setSavedAt(new Date().toLocaleTimeString());
      toast.success("Scores saved");
      qc.invalidateQueries({ queryKey: ["score-grid"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
      qc.invalidateQueries({ queryKey: ["report-issuable"] });
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Could not save scores"),
  });

  const canEdit = isTeacher
    ? classes.some((c) => c.id === resolvedClassId && c.teacherId === user.id)
    : true;

  /** Enter key moves focus to the next cell in the same row. */
  function jumpToNextCell(key: CellKey, gridRef: ScoreGridData) {
    const flat: CellKey[] = [];
    for (const row of gridRef.rows) {
      for (const sub of gridRef.subStrands) flat.push(`${row.learner.id}:${sub.id}`);
    }
    const idx = flat.indexOf(key);
    const next = idx >= 0 ? flat[idx + 1] : undefined;
    const el = next ? cellRefs.current[next] : undefined;
    el?.focus();
    el?.select();
  }

  function setCell(learnerId: string, subStrandId: string, value: string) {
    const key = `${learnerId}:${subStrandId}`;
    setDraft((d) => {
      const raw = value === "" ? "" : clampInput(value);
      if (parseScore(raw) === original[key]) {
        const { [key]: _omit, ...rest } = d;
        return rest;
      }
      return { ...d, [key]: raw };
    });
  }

  if (classesLoading || resolvedClassId === "" || (isLoading && !grid)) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-full max-w-md" />
        <Skeleton className="h-96 w-full rounded-xl" />
      </div>
    );
  }

  if (!grid || !currentClass) {
    return (
      <div>
        <PageHeader title="Assessment" description="Record sub-strand scores per learner." />
        <Card>
          <CardContent className="flex flex-col items-center gap-2 p-10 text-center">
            <p className="text-sm font-medium">No class available</p>
            <p className="text-sm text-muted-foreground">
              {isTeacher ? "You are not assigned to a class." : "No classes have been created for this school."}
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const grade = grid.grade;
  const rows = grid.rows;

  return (
    <div>
      <PageHeader
        title="Assessment"
        description={`${GRADE_LABEL[grade]} · ${currentClass.stream} · ${termLabel(term)} · scores out of ${SCORE_MAX} per sub-strand`}
        actions={
          dirtyCount > 0 ? (
            <>
              <Button variant="outline" size="sm" onClick={() => { setDraft({}); toast.info("Changes discarded"); }} disabled={mutation.isPending}>
                <Undo2 /> Discard ({dirtyCount})
              </Button>
              <Button size="sm" onClick={() => mutation.mutate()} disabled={mutation.isPending}>
                {mutation.isPending ? <Loader2 className="animate-spin" /> : <Save />}
                Save {dirtyCount} change{dirtyCount === 1 ? "" : "s"}
              </Button>
            </>
          ) : savedAt ? (
            <Badge variant="secondary" className="gap-1.5">
              <Check className="h-3.5 w-3.5" /> Saved {savedAt}
            </Badge>
          ) : undefined
        }
      />

      <div className="mb-4 grid gap-3 sm:grid-cols-2">
        <Select value={resolvedClassId} onValueChange={(v) => { setClassId(v); setSavedAt(null); }}>
          <SelectTrigger className="w-full sm:w-72">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {classes.map((c) => (
              <SelectItem key={c.id} value={c.id}>
                {GRADE_LABEL[c.grade]} · {c.stream} ({c.learnerCount ?? 0})
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={areaId} onValueChange={setAreaId} disabled={!resolvedClassId}>
          <SelectTrigger className="w-full sm:w-72">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All learning areas</SelectItem>
            {areas.filter((a) => a.grades.includes(grade)).map((a) => (
              <SelectItem key={a.id} value={a.id}>
                {a.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {!canEdit && (
        <Badge variant="destructive" className="mb-3">
          Read-only — you can only score your own class.
        </Badge>
      )}

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <Table className="min-w-max">
            <TableHeader>
              <TableRow>
                <TableHead className="sticky left-0 z-10 min-w-48 bg-card">Learner</TableHead>
                {grid.subStrands.map((sub) => (
                  <TableHead key={sub.id} className="min-w-28 text-center" title={sub.name}>
                    <div className="text-xs font-semibold leading-tight">{sub.name}</div>
                    <div className="mt-0.5 text-[10px] font-normal text-muted-foreground">{sub.strandName}</div>
                  </TableHead>
                ))}
                <TableHead className="min-w-20 text-center">Avg</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => {
                const rowAverages = grid.subStrands.map((sub) => parseScore(draft[`${row.learner.id}:${sub.id}`]) ?? row.cells[sub.id]);
                const avg = averageScore(rowAverages);
                const level = avg == null ? null : computeLevel(avg);
                return (
                  <TableRow key={row.learner.id} className="group">
                    <TableCell className="sticky left-0 z-10 whitespace-nowrap bg-card">
                      <p className="font-medium">
                        {row.learner.firstName} {row.learner.lastName}
                      </p>
                      <p className="font-mono text-xs text-muted-foreground">{row.learner.upi}</p>
                    </TableCell>
                    {grid.subStrands.map((sub) => {
                      const key: CellKey = `${row.learner.id}:${sub.id}`;
                      const value = draft[key] ?? (row.cells[sub.id] == null ? "" : String(row.cells[sub.id]));
                      const score = parseScore(value);
                      const lvl = computeLevel(score);
                      const dirty = parseScore(draft[key]) !== original[key] && draft[key] !== undefined;
                      return (
                        <TableCell key={sub.id} className="p-1 text-center">
                          <div className="relative inline-flex flex-col items-center">
                            <input
                              ref={(el) => { cellRefs.current[key] = el; }}
                              type="number"
                              min={0}
                              max={SCORE_MAX}
                              step={1}
                              disabled={!canEdit}
                              value={value}
                              onChange={(e) => setCell(row.learner.id, sub.id, e.target.value)}
                              onFocus={(e) => e.target.select()}
                              onKeyDown={(e) => {
                                if (e.key === "Enter") {
                                  e.preventDefault();
                                  jumpToNextCell(key, grid);
                                }
                              }}
                              className={cn(
                                "h-8 w-14 rounded-md border bg-card text-center text-sm font-medium tabular-nums outline-none transition-colors focus:ring-2 focus:ring-ring disabled:opacity-60",
                                dirty && "border-primary ring-1 ring-primary bg-primary/5",
                                !dirty && !canEdit && "cursor-not-allowed"
                              )}
                            />
                            {lvl && <LevelPill level={lvl} className="mt-0.5 scale-90" />}
                          </div>
                        </TableCell>
                      );
                    })}
                    <TableCell className="text-center">
                      <span className="text-sm font-semibold tabular-nums">
                        {avg?.toFixed(1) ?? "—"}
                      </span>
                      {level && <LevelPill level={level} className="mt-0.5" />}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </Card>

      <p className="mt-3 text-xs text-muted-foreground">
        Tip: press <kbd className="rounded border bg-muted px-1 font-mono">Enter</kbd> to jump to the next cell. Levels:
        EE ≥ 8 · ME ≥ 6 · AE ≥ 4 · BE &lt; 4.
      </p>
    </div>
  );
}

function clampInput(value: string): string {
  const n = Number(value);
  if (Number.isNaN(n)) return value;
  if (n > SCORE_MAX) return String(SCORE_MAX);
  if (n < 0) return "0";
  return String(Math.trunc(n * 10) / 10);
}