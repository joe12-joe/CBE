import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { BookOpen, Loader2, Plus } from "lucide-react";
import { toast } from "sonner";
import { listCurriculumTree, listLearningAreas, addSubStrand } from "@/services/curriculum";
import { GRADE_LABEL, GRADE_ORDER } from "@/lib/format";
import { useAuthStore } from "@/stores/authStore";
import { isAdmin } from "@/lib/roles";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { FormField } from "@/components/ui/form-field";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tabs,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import type { GradeCode } from "@/lib/types";

export function CurriculumPage() {
  const [grade, setGrade] = useState<GradeCode>("G4");
  const user = useAuthStore((s) => s.user)!;
  const admin = isAdmin(user.role);

  const { data: tree, isLoading } = useQuery({
    queryKey: ["curriculum", grade],
    queryFn: () => listCurriculumTree(grade),
  });

  return (
    <div>
      <PageHeader
        title="Curriculum"
        description="Learning areas, strands and sub-strands per grade (starter data — verify against KICD)."
        actions={admin ? <AddSubStrandDialog grade={grade} /> : undefined}
      />

      <Tabs value={grade} onValueChange={(v) => setGrade(v as GradeCode)} className="mb-6">
        <TabsList className="scrollbar-thin inline-flex h-auto w-full justify-start overflow-x-auto rounded-lg">
          {GRADE_ORDER.map((g) => (
            <TabsTrigger key={g} value={g}>
              {g}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      {isLoading ? (
        <div className="grid gap-4 lg:grid-cols-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-48 rounded-xl" />
          ))}
        </div>
      ) : !tree || tree.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-2 p-10 text-center">
            <BookOpen className="h-6 w-6 text-muted-foreground" />
            <p className="text-sm font-medium">No learning areas for {GRADE_LABEL[grade]}</p>
            {admin && <p className="text-sm text-muted-foreground">Add a strand or sub-strand to get started.</p>}
          </CardContent>
        </Card>
      ) : (
        <div className="grid items-start gap-4 lg:grid-cols-2">
          {tree.map((la) => (
            <Card key={la.id}>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between gap-2">
                  <CardTitle className="text-base">{la.name}</CardTitle>
                  <Badge variant="secondary" className="font-mono">
                    {la.code}
                  </Badge>
                </div>
                <CardDescription>{la.strands.length} strands</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                {la.strands.map((st) => (
                  <div key={st.id} className="rounded-lg border p-3">
                    <p className="text-sm font-medium">{st.name}</p>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {st.subStrands.map((sub) => (
                        <Badge key={sub.id} variant="outline" className="font-normal">
                          {sub.name}
                        </Badge>
                      ))}
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

function AddSubStrandDialog({ grade }: { grade: GradeCode }) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [learningAreaId, setLearningAreaId] = useState<string>("");
  const [strandId, setStrandId] = useState<string>("");
  const [strandName, setStrandName] = useState("");
  const [name, setName] = useState("");

  const { data: areas = [] } = useQuery({
    queryKey: ["learning-areas"],
    queryFn: () => listLearningAreas(),
  });

  const mutation = useMutation({
    mutationFn: () =>
      addSubStrand({ learningAreaId, strandId: strandId === "__new__" ? undefined : strandId, strandName: strandName || "New strand", name, grade }),
    onSuccess: () => {
      toast.success("Sub-strand added to the curriculum");
      qc.invalidateQueries({ queryKey: ["curriculum"] });
      qc.invalidateQueries({ queryKey: ["learning-areas"] });
      setOpen(false);
      setName("");
      setStrandName("");
      setStrandId("");
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Could not add sub-strand"),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm">
          <Plus /> Add sub-strand
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Add a sub-strand</DialogTitle>
        </DialogHeader>

        <form
          id="add-substrand"
          onSubmit={(e) => {
            e.preventDefault();
            if (learningAreaId && name) mutation.mutate();
          }}
          className="space-y-4"
        >
          <FormField label="Learning area" required>
            <Select value={learningAreaId} onValueChange={(v) => { setLearningAreaId(v); setStrandId(""); setStrandName(""); }}>
              <SelectTrigger>
                <SelectValue placeholder="Select learning area" />
              </SelectTrigger>
              <SelectContent>
                {areas.filter((a) => a.grades.includes(grade)).map((a) => (
                  <SelectItem key={a.id} value={a.id}>
                    {a.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FormField>

          <FormField label="Strand">
            <Select value={strandId || "__new__"} onValueChange={setStrandId}>
              <SelectTrigger>
                <SelectValue placeholder="Create new strand" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__new__">➕ New strand</SelectItem>
              </SelectContent>
            </Select>
          </FormField>

          {strandId === "__new__" && (
            <FormField label="New strand name" required>
              <Input value={strandName} onChange={(e) => setStrandName(e.target.value)} placeholder="e.g. Number Patterns" />
            </FormField>
          )}

          <FormField label="Sub-strand name" required>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Counting in tens and hundreds" />
          </FormField>

          <p className="text-xs text-muted-foreground">
            Added to <Badge variant="secondary">{GRADE_LABEL[grade]}</Badge>
          </p>
        </form>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button
            type="submit"
            form="add-substrand"
            disabled={mutation.isPending || !learningAreaId || !name || (strandId === "__new__" && !strandName)}
          >
            {mutation.isPending && <Loader2 className="animate-spin" />}
            Add sub-strand
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}