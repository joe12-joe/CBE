import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Eye, FileText, GraduationCap } from "lucide-react";
import { useSchoolContext } from "@/lib/useSchool";
import { useTermStore } from "@/stores/termStore";
import { useAuthStore } from "@/stores/authStore";
import { listClasses, getTeacherClasses } from "@/services/learners";
import { listIssuableLearners } from "@/services/reports";
import { GRADE_LABEL, termLabel } from "@/lib/format";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
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
import { ReportCardPreview } from "@/components/features/ReportCardPreview";

export function ReportsPage() {
  const { schoolId } = useSchoolContext();
  const { term } = useTermStore();
  const user = useAuthStore((s) => s.user)!;
  const isTeacher = user.role === "TEACHER";

  const [classId, setClassId] = useState<string>("");
  const [previewId, setPreviewId] = useState<string | null>(null);

  const { data: classes = [], isLoading: classesLoading } = useQuery({
    queryKey: [isTeacher ? "teacher-classes" : "classes", schoolId, user.id],
    queryFn: () => (isTeacher ? getTeacherClasses(user.id) : listClasses(schoolId!)),
    enabled: !!schoolId,
  });

  const resolvedClassId = classId || classes[0]?.id || "";
  const currentClass = classes.find((c) => c.id === resolvedClassId);

  const { data: learners = [], isLoading: learnersLoading } = useQuery({
    queryKey: ["report-issuable", resolvedClassId, term],
    queryFn: () => listIssuableLearners(resolvedClassId, term),
    enabled: !!resolvedClassId,
  });

  const previewLearner = previewId ? learners.find((l) => l.id === previewId) : null;

  return (
    <div>
      <PageHeader
        title="Report Cards"
        description={`Preview, comment on and print CBC report cards for ${termLabel(term)}.`}
      />

      <div className="mb-4 flex items-center gap-3">
        <Select value={resolvedClassId} onValueChange={setClassId}>
          <SelectTrigger className="w-72">
            <SelectValue placeholder="Select class" />
          </SelectTrigger>
          <SelectContent>
            {classes.map((c) => (
              <SelectItem key={c.id} value={c.id}>
                {GRADE_LABEL[c.grade]} · {c.stream} ({c.learnerCount ?? 0})
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {currentClass && classesLoading === false && (
          <Badge variant="secondary">
            <GraduationCap className="h-3.5 w-3.5" /> {GRADE_LABEL[currentClass.grade]}
          </Badge>
        )}
      </div>

      {classesLoading || (resolvedClassId && learnersLoading) ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-12 rounded-lg" />
          ))}
        </div>
      ) : !resolvedClassId || learners.length === 0 ? (
        <EmptyState
          title="No learners in this class"
          description="Learners appear here when they are enrolled in the selected class."
        />
      ) : (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Learner</TableHead>
                <TableHead>UPI</TableHead>
                <TableHead>Gender</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-32 text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {learners.map((l) => (
                <TableRow key={l.id}>
                  <TableCell className="font-medium">
                    {l.firstName} {l.middleName && `${l.middleName} `}{l.lastName}
                  </TableCell>
                  <TableCell className="font-mono text-xs">{l.upi}</TableCell>
                  <TableCell>{l.gender === "M" ? "Male" : "Female"}</TableCell>
                  <TableCell>
                    <Badge variant={l.status === "COMPLETE" ? "secondary" : "destructive"} className="gap-1.5">
                      {l.status === "COMPLETE" ? "All scored" : "Partially scored"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <Button variant="outline" size="sm" onClick={() => setPreviewId(l.id)}>
                      <Eye /> Preview
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}

      <Dialog open={!!previewId} onOpenChange={(open) => !open && setPreviewId(null)}>
        <DialogContent className="max-w-4xl">
          <DialogHeader className="print:hidden">
            <DialogTitle className="flex items-center gap-2">
              <FileText className="h-4 w-4" />
              Report card — {previewLearner ? `${previewLearner.firstName} ${previewLearner.lastName}` : ""}
            </DialogTitle>
          </DialogHeader>
          <div className="max-h-[70vh] overflow-y-auto px-6 pb-6 print:max-h-none print:overflow-visible print:px-0">
            {previewId && <ReportCardPreview learnerId={previewId} term={term} />}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}