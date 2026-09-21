import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useParams } from "react-router-dom";
import { ArrowLeft, Loader2, RefreshCcw } from "lucide-react";
import { toast } from "sonner";
import { useSchoolContext } from "@/lib/useSchool";
import { useTermStore } from "@/stores/termStore";
import { getLearner, listClasses, enrollLearner } from "@/services/learners";
import { getLearnerAssessment } from "@/services/assessment";
import { GRADE_LABEL, formatDate, termLabel, formatUp } from "@/lib/format";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { LevelPill } from "@/components/ui/level-badge";
import { EmptyState } from "@/components/ui/empty-state";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuthStore } from "@/stores/authStore";
import { isAdmin } from "@/lib/roles";

export function LearnerDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { schoolId } = useSchoolContext();
  const { term } = useTermStore();
  const user = useAuthStore((s) => s.user)!;

  const { data: learner, isLoading } = useQuery({
    queryKey: ["learner", id],
    queryFn: () => getLearner(id!),
    enabled: !!id,
  });
  const { data: classes = [] } = useQuery({
    queryKey: ["classes", schoolId],
    queryFn: () => listClasses(schoolId!),
    enabled: !!schoolId,
  });
  const { data: assessment } = useQuery({
    queryKey: ["learner-assessment", id, term],
    queryFn: () => getLearnerAssessment(id!, term),
    enabled: !!id,
  });

  if (isLoading || !learner) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-40 w-full rounded-xl" />
      </div>
    );
  }

  const cls = classes.find((c) => c.id === learner.classId);

  return (
    <div>
      <PageHeader
        title={`${learner.firstName} ${learner.middleName ?? ""} ${learner.lastName}`}
        description={`UPI ${formatUp(learner.upi)} · ${learner.gender === "M" ? "Male" : "Female"} · Born ${formatDate(learner.dob)}`}
        actions={
          <>
            <Button variant="ghost" size="sm" onClick={() => window.history.back()}>
              <ArrowLeft /> Back
            </Button>
            {isAdmin(user.role) && cls && <ChangeClassDialog learnerId={learner.id} classes={classes} currentClassId={cls.id} />}
          </>
        }
      />

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Current placement</CardTitle>
          </CardHeader>
          <CardContent>
            {cls ? (
              <>
                <Badge variant="secondary">{GRADE_LABEL[cls.grade]} · {cls.stream}</Badge>
                <p className="mt-2 text-xs text-muted-foreground">Admitted {learner.admissionYear}</p>
              </>
            ) : (
              <p className="text-xs text-muted-foreground">Not enrolled in any class this term.</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Guardian</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm">{learner.guardianName ?? "Not recorded"}</p>
            <p className="text-xs text-muted-foreground">{learner.guardianPhone ?? "No phone number"}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Identifiers</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1 font-mono text-xs">
            <p>UPI: {learner.upi}</p>
            <p>NEMIS: {learner.nemis ?? "—"}</p>
          </CardContent>
        </Card>
      </div>

      <div className="mt-6">
        <Tabs defaultValue="assessment">
          <TabsList>
            <TabsTrigger value="assessment">Assessment · {termLabel(term)}</TabsTrigger>
            <TabsTrigger value="records">Records</TabsTrigger>
          </TabsList>

          <TabsContent value="assessment">
            {!assessment || assessment.length === 0 ? (
              <EmptyState
                title="No assessment data"
                description="Scores for this learner in the selected term will appear here once recorded."
              />
            ) : (
              <div className="grid gap-4 lg:grid-cols-2">
                {assessment.map((area) => (
                  <Card key={area.areaId}>
                    <CardHeader className="pb-2">
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-sm">{area.areaName}</CardTitle>
                        <LevelPill level={area.level} />
                      </div>
                      <CardDescription>
                        Average {area.averageScore?.toFixed(1) ?? "—"} / 10
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      {area.strands.map((st) => (
                        <div key={st.strandId} className="rounded-lg border p-3">
                          <div className="flex items-center justify-between">
                            <p className="text-sm font-medium">{st.strandName}</p>
                            <LevelPill level={st.level} />
                          </div>
                          <div className="mt-2 space-y-1">
                            {st.subStrands.map((sub) => (
                              <div key={sub.id} className="flex items-center justify-between text-sm">
                                <span className="text-muted-foreground">{sub.name}</span>
                                <span className="flex items-center gap-2">
                                  <span className="font-mono text-xs">{sub.score?.toFixed(1) ?? "—"}</span>
                                  <LevelPill level={sub.level} />
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      ))}
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="records">
            <Card>
              <CardContent className="grid gap-x-8 gap-y-3 p-6 text-sm sm:grid-cols-2">
                <Info label="Full name" value={`${learner.firstName} ${learner.middleName ?? ""} ${learner.lastName}`.trim()} />
                <Info label="Date of birth" value={formatDate(learner.dob)} />
                <Info label="Gender" value={learner.gender === "M" ? "Male" : "Female"} />
                <Info label="Admission year" value={String(learner.admissionYear)} />
                <Info label="Guardian" value={learner.guardianName ?? "—"} />
                <Info label="Guardian phone" value={learner.guardianPhone ?? "—"} />
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-0.5 font-medium">{value}</p>
    </div>
  );
}

function ChangeClassDialog({
  learnerId,
  classes,
  currentClassId,
}: {
  learnerId: string;
  classes: Awaited<ReturnType<typeof listClasses>>;
  currentClassId: string;
}) {
  const qc = useQueryClient();
  const [classId, setClassId] = useState<string | undefined>(currentClassId);
  const { term } = useTermStore();

  const mutation = useMutation({
    mutationFn: () => enrollLearner(learnerId, classId!, term.year, term.term),
    onSuccess: () => {
      toast.success("Learner moved to the new class");
      qc.invalidateQueries({ queryKey: ["learner", learnerId] });
      qc.invalidateQueries({ queryKey: ["learners"] });
      qc.invalidateQueries({ queryKey: ["classes"] });
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Could not move learner"),
  });

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <RefreshCcw /> Change class
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Move learner to another class</DialogTitle>
        </DialogHeader>
        <Select value={classId} onValueChange={setClassId}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {classes.map((c) => (
              <SelectItem key={c.id} value={c.id}>
                {GRADE_LABEL[c.grade]} · {c.stream}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <p className="text-xs text-muted-foreground">
          The previous active enrolment is completed automatically.
        </p>
        <DialogFooter>
          <Button onClick={() => mutation.mutate()} disabled={mutation.isPending || !classId || classId === currentClassId}>
            {mutation.isPending && <Loader2 className="animate-spin" />}
            Move learner
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}