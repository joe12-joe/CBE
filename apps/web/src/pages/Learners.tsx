import { useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { ChevronRight, Loader2, Plus, Search, UserPlus } from "lucide-react";
import { toast } from "sonner";
import { useSchoolContext } from "@/lib/useSchool";
import { learnerSchema, type LearnerFormValues } from "@/lib/schemas";
import { createLearner, listClasses, listLearners } from "@/services/learners";
import { GRADE_LABEL } from "@/lib/format";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { EmptyState } from "@/components/ui/empty-state";
import { FormField, FormGrid } from "@/components/ui/form-field";
import { Skeleton } from "@/components/ui/skeleton";

const GENDERS = [
  { value: "M", label: "Male" },
  { value: "F", label: "Female" },
];

export function LearnersPage() {
  const { schoolId } = useSchoolContext();
  const [search, setSearch] = useState("");
  const [grade, setGrade] = useState<string>("all");
  const [dialogOpen, setDialogOpen] = useState(false);

  const { data: learners = [], isLoading } = useQuery({
    queryKey: ["learners", schoolId],
    queryFn: () => listLearners(schoolId!),
    enabled: !!schoolId,
  });
  const { data: classes = [] } = useQuery({
    queryKey: ["classes", schoolId],
    queryFn: () => listClasses(schoolId!),
    enabled: !!schoolId,
  });

  const classByLearner = useMemo(() => {
    const map: Record<string, (typeof classes)[number]> = {};
    for (const c of classes) map[c.id] = c;
    return map;
  }, [classes]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return learners.filter((l) => {
      const cls = l.classId ? classByLearner[l.classId] : undefined;
      if (grade !== "all" && cls?.grade !== grade) return false;
      if (!q) return true;
      return `${l.firstName} ${l.middleName ?? ""} ${l.lastName} ${l.upi}`
        .toLowerCase()
        .includes(q);
    });
  }, [learners, classByLearner, search, grade]);

  const grades = useMemo(() => {
    const set = new Set(classes.map((c) => c.grade));
    return [...set];
  }, [classes]);

  return (
    <div>
      <PageHeader
        title="Learners"
        description="Learner registration and enrolment records for the selected school."
        actions={
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <UserPlus /> Register learner
              </Button>
            </DialogTrigger>
            <AddLearnerDialog schoolId={schoolId!} classes={classes} onDone={() => setDialogOpen(false)} />
          </Dialog>
        }
      />

      <Card className="mb-4 flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            className="pl-9"
            placeholder="Search by name or UPI…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <Select value={grade} onValueChange={setGrade}>
          <SelectTrigger className="w-44">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All grades</SelectItem>
            {grades.map((g) => (
              <SelectItem key={g} value={g}>
                {GRADE_LABEL[g]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Card>

      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-12 rounded-lg" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState
          title="No learners found"
          description={search || grade !== "all" ? "Try adjusting your search or filters." : "Register your first learner to get started."}
          action={search || grade !== "all" ? undefined : { label: "Register learner", onAction: () => setDialogOpen(true) }}
        />
      ) : (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Learner</TableHead>
                <TableHead>UPI</TableHead>
                <TableHead>Gender</TableHead>
                <TableHead>Grade / Class</TableHead>
                <TableHead>Guardian</TableHead>
                <TableHead className="w-10" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((l) => {
                const cls = l.classId ? classByLearner[l.classId] : undefined;
                return (
                  <TableRow key={l.id}>
                    <TableCell>
                      <Link to={`/learners/${l.id}`} className="font-medium hover:underline">
                        {l.firstName} {l.middleName && `${l.middleName} `}
                        {l.lastName}
                      </Link>
                      <p className="text-xs text-muted-foreground">{l.nemis ? `NEMIS ${l.nemis}` : "no NEMIS"}</p>
                    </TableCell>
                    <TableCell className="font-mono text-xs">{l.upi}</TableCell>
                    <TableCell>{l.gender === "M" ? "Male" : "Female"}</TableCell>
                    <TableCell>
                      {cls ? (
                        <Badge variant="secondary">
                          {GRADE_LABEL[cls.grade]} · {cls.stream}
                        </Badge>
                      ) : (
                        <span className="text-xs text-muted-foreground">Not enrolled</span>
                      )}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {l.guardianName ?? "—"}
                      {l.guardianPhone && <p className="text-xs">{l.guardianPhone}</p>}
                    </TableCell>
                    <TableCell>
                      <Link to={`/learners/${l.id}`} className="inline-flex items-center text-muted-foreground hover:text-foreground">
                        <ChevronRight className="h-4 w-4" />
                      </Link>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
          <p className="border-t px-4 py-3 text-xs text-muted-foreground">
            {filtered.length} learner{filtered.length === 1 ? "" : "s"}
          </p>
        </Card>
      )}
    </div>
  );
}

function AddLearnerDialog({
  schoolId,
  classes,
  onDone,
}: {
  schoolId: string;
  classes: Awaited<ReturnType<typeof listClasses>>;
  onDone: () => void;
}) {
  const qc = useQueryClient();
  const [classId, setClassId] = useState<string | undefined>();
  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors },
  } = useForm<LearnerFormValues>({
    resolver: zodResolver(learnerSchema),
    defaultValues: { gender: "M", admissionYear: new Date().getFullYear() },
  });

  const mutation = useMutation({
    mutationFn: (values: LearnerFormValues) => createLearner(schoolId, values, classId),
    onSuccess: () => {
      toast.success("Learner registered successfully");
      qc.invalidateQueries({ queryKey: ["learners", schoolId] });
      qc.invalidateQueries({ queryKey: ["classes", schoolId] });
      reset();
      onDone();
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Could not register learner"),
  });

  return (
    <DialogContent className="max-w-2xl">
      <DialogHeader>
        <DialogTitle>Register a learner</DialogTitle>
        <DialogDescription>
          Add a new learner and (optionally) place them in a class for the current term.
        </DialogDescription>
      </DialogHeader>
      <form
        id="add-learner"
        onSubmit={handleSubmit((values) => mutation.mutate(values))}
        className="space-y-4"
      >
        <FormGrid>
          <FormField label="First name" error={errors.firstName?.message} required>
            <Input {...register("firstName")} />
          </FormField>
          <FormField label="Middle name" error={errors.middleName?.message}>
            <Input {...register("middleName")} />
          </FormField>
          <FormField label="Last name" error={errors.lastName?.message} required>
            <Input {...register("lastName")} />
          </FormField>
          <FormField label="Gender" error={errors.gender?.message} required>
            <Select
              value={watch("gender")}
              onValueChange={(v) => setValue("gender", v as "M" | "F", { shouldValidate: true })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {GENDERS.map((g) => (
                  <SelectItem key={g.value} value={g.value}>
                    {g.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FormField>
          <FormField label="Date of birth" error={errors.dob?.message} required>
            <Input type="date" {...register("dob")} />
          </FormField>
          <FormField label="Admission year" error={errors.admissionYear?.message} required>
            <Input type="number" {...register("admissionYear")} />
          </FormField>
          <FormField label="UPI (10 digits)" error={errors.upi?.message} hint="Leave blank to auto-generate a placeholder.">
            <Input {...register("upi")} placeholder="6012345601" maxLength={10} />
          </FormField>
          <FormField label="NEMIS number" error={errors.nemis?.message}>
            <Input {...register("nemis")} placeholder="N80001" />
          </FormField>
          <FormField label="Guardian name" error={errors.guardianName?.message}>
            <Input {...register("guardianName")} />
          </FormField>
          <FormField label="Guardian phone" error={errors.guardianPhone?.message}>
            <Input {...register("guardianPhone")} placeholder="07XX XXX XXX" />
          </FormField>
        </FormGrid>

        <FormField label="Enrol into class (current term)" htmlFor="class-select">
          <Select value={classId} onValueChange={setClassId}>
            <SelectTrigger id="class-select">
              <SelectValue placeholder="Not enrolled yet" />
            </SelectTrigger>
            <SelectContent>
              {classes.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {GRADE_LABEL[c.grade]} · {c.stream}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </FormField>
      </form>
      <DialogFooter>
        <Button type="button" variant="outline" onClick={onDone}>
          Cancel
        </Button>
        <Button type="submit" form="add-learner" disabled={mutation.isPending}>
          {mutation.isPending && <Loader2 className="animate-spin" />}
          <Plus /> Register learner
        </Button>
      </DialogFooter>
    </DialogContent>
  );
}