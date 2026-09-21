import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Printer, Save } from "lucide-react";
import { toast } from "sonner";
import { getReportCard, getComments, saveComments } from "@/services/reports";
import { GRADE_LABEL, termLabel, formatUp, formatDate, LEVELS } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import type { Term } from "@/lib/types";

export function ReportCardPreview({ learnerId, term }: { learnerId: string; term: Term }) {
  const qc = useQueryClient();
  const [teacherComment, setTeacherComment] = useState<string>();
  const [headComment, setHeadComment] = useState<string>();
  const [nextTermFocus, setNextTermFocus] = useState<string>();

  const { data: card, isLoading } = useQuery({
    queryKey: ["report-card", learnerId, term],
    queryFn: () => getReportCard(learnerId, term),
    enabled: !!learnerId,
  });

  const { data: comments } = useQuery({
    queryKey: ["comments", learnerId, term],
    queryFn: () => getComments(learnerId, term),
    enabled: !!learnerId,
  });

  useEffect(() => {
    if (comments) {
      setTeacherComment(comments.teacherComment);
      setHeadComment(comments.headComment);
      setNextTermFocus(comments.nextTermFocus);
    }
  }, [comments]);

  const saveMutation = useMutation({
    mutationFn: () =>
      saveComments(learnerId, term, {
        teacherComment,
        headComment,
        nextTermFocus,
      }),
    onSuccess: () => {
      toast.success("Comments saved");
      qc.invalidateQueries({ queryKey: ["comments"] });
    },
    onError: () => toast.error("Could not save comments"),
  });

  if (isLoading || !card) {
    return (
      <div className="space-y-3 p-4">
        <Skeleton className="h-8 w-2/3" />
        <Skeleton className="h-4 w-1/2" />
        <Skeleton className="h-72 w-full" />
      </div>
    );
  }

  return (
    <div>
      <div className="mb-4 flex items-center justify-between gap-2 print:hidden">
        <p className="text-sm text-muted-foreground">
          {card.learner.firstName} {card.learner.lastName} · {termLabel(card.term)}
        </p>
        <Button size="sm" variant="outline" onClick={() => window.print()}>
          <Printer /> Print report card
        </Button>
      </div>

      {/* The printable report card */}
      <div className="print-area rounded-lg border bg-white p-6 text-left text-slate-900 shadow-sm">
        {/* Header */}
        <div className="flex items-start justify-between gap-4 border-b-2 border-slate-800 pb-4">
          <div className="flex items-center gap-3">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-emerald-700 text-white">
              <span className="text-lg font-black">CBC</span>
            </div>
            <div>
              <p className="text-lg font-bold leading-tight">{card.school.name}</p>
              <p className="text-xs text-slate-600">NEMIS Code: {card.school.code}</p>
              <p className="text-xs text-slate-600">
                {card.school.address} · {card.school.phone}
              </p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-sm font-bold tracking-wide">COMPETENCY-BASED ASSESSMENT</p>
            <p className="text-xs text-slate-600">Report Card — {termLabel(card.term)}</p>
            <p className="mt-1 text-xs text-slate-500">Date issued: {formatDate(card.issuedAt)}</p>
          </div>
        </div>

        {/* Learner info */}
        <div className="grid grid-cols-2 gap-x-8 gap-y-1 border-b py-3 text-sm sm:grid-cols-4">
          <Info label="Learner" value={`${card.learner.firstName} ${card.learner.middleName ?? ""} ${card.learner.lastName}`} />
          <Info label="UPI" value={formatUp(card.learner.upi)} />
          <Info label="Grade" value={GRADE_LABEL[card.grade]} />
          <Info label="Stream" value={card.stream} />
          <Info label="Gender" value={card.learner.gender === "M" ? "Male" : "Female"} />
          <Info label="Date of birth" value={formatDate(card.learner.dob)} />
          <Info label="Class size" value={`${card.overall.totalLearners} learners`} />
          <Info label="NEMIS" value={card.learner.nemis ?? "—"} />
        </div>

        {/* Results table */}
        <table className="mt-4 w-full border-collapse text-sm">
          <thead>
            <tr className="bg-slate-100">
              <th className="border border-slate-300 px-3 py-2 text-left font-semibold">Learning Area</th>
              <th className="border border-slate-300 px-3 py-2 text-center font-semibold">Average Score</th>
              <th className="border border-slate-300 px-3 py-2 text-center font-semibold">Performance Level</th>
            </tr>
          </thead>
          <tbody>
            {card.areas.map((area) => (
              <tr key={area.learningAreaId}>
                <td className="border border-slate-300 px-3 py-2">{area.name}</td>
                <td className="border border-slate-300 px-3 py-2 text-center tabular-nums">{area.averageScore.toFixed(1)}</td>
                <td className="border border-slate-300 px-3 py-2 text-center font-semibold">{area.level}</td>
              </tr>
            ))}
            <tr className="bg-slate-50 font-semibold">
              <td className="border border-slate-300 px-3 py-2">Overall Performance</td>
              <td className="border border-slate-300 px-3 py-2 text-center tabular-nums">
                {card.overall.averageScore.toFixed(1)}
              </td>
              <td className="border border-slate-300 px-3 py-2 text-center">{card.overall.level}</td>
            </tr>
          </tbody>
        </table>

        {/* Legend */}
        <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-[11px] text-slate-600">
          {LEVELS.map((l) => (
            <span key={l.level}>
              <strong>{l.level}</strong> — {l.label}
            </span>
          ))}
        </div>

        {/* Comments */}
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <CommentBox
            title="Class Teacher's Comment"
            value={teacherComment}
            readOnly={false}
            onChange={setTeacherComment}
          />
          <CommentBox title="Head of Institution's Comment" value={headComment} readOnly={false} onChange={setHeadComment} />
        </div>
        <CommentBox
          title="Focus for Next Term"
          value={nextTermFocus}
          readOnly={false}
          onChange={setNextTermFocus}
          className="mt-3"
        />

        {/* Signatures */}
        <div className="mt-8 grid grid-cols-2 gap-8 text-sm">
          <div>
            <div className="h-10" />
            <p className="border-t border-slate-400 pt-1 text-xs text-slate-600">Class Teacher's Signature</p>
          </div>
          <div>
            <div className="h-10" />
            <p className="border-t border-slate-400 pt-1 text-xs text-slate-600">Head of Institution's Signature</p>
          </div>
        </div>
      </div>

      <div className="mt-4 flex justify-end gap-2 print:hidden">
        <Button variant="outline" size="sm" onClick={() => qc.invalidateQueries({ queryKey: ["report-card"] })}>
          Refresh
        </Button>
        <Button size="sm" onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}>
          {saveMutation.isPending ? <Loader2 className="animate-spin" /> : <Save />}
          Save comments
        </Button>
      </div>
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[11px] uppercase tracking-wide text-slate-500">{label}</p>
      <p className="font-medium">{value}</p>
    </div>
  );
}

function CommentBox({
  title,
  value,
  readOnly,
  onChange,
  className = "",
}: {
  title: string;
  value: string | undefined;
  readOnly: boolean;
  onChange: (v: string) => void;
  className?: string;
}) {
  return (
    <div className={className}>
      <p className="text-xs font-semibold text-slate-600">{title}</p>
      <textarea
        readOnly={readOnly}
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1 min-h-[72px] w-full resize-none rounded border border-slate-300 bg-transparent p-2 text-sm outline-none focus:border-slate-500"
        placeholder="—"
      />
    </div>
  );
}