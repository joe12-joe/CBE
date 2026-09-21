import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  AlertTriangle,
  ArrowRight,
  BookOpen,
  ClipboardList,
  School,
  Target,
  Users,
} from "lucide-react";
import { useSchoolContext } from "@/lib/useSchool";
import { useTermStore } from "@/stores/termStore";
import { getDashboardStats } from "@/services/analytics";
import { GRADE_LABEL, termLabel, levelDot, levelLabel } from "@/lib/format";
import type { CompetencyLevel } from "@/lib/types";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { LevelBadge } from "@/components/ui/level-badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";

const LEVEL_COLORS: Record<string, string> = {
  EE: "#10b981",
  ME: "#0ea5e9",
  AE: "#f59e0b",
  BE: "#ef4444",
};

export function DashboardPage() {
  const { schoolId } = useSchoolContext();
  const { term } = useTermStore();

  const { data: stats, isLoading } = useQuery({
    queryKey: ["dashboard", schoolId, term],
    queryFn: () => getDashboardStats(schoolId!, term),
    enabled: !!schoolId,
  });

  return (
    <div>
      <PageHeader
        title="Dashboard"
        description={schoolId ? `${termLabel(term)} · School overview` : undefined}
        actions={
          <Badge variant="secondary" className="gap-1.5">
            <Target className="h-3.5 w-3.5" />
            {termLabel(term)}
          </Badge>
        }
      />

      {isLoading || !stats ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-28 rounded-xl" />
          ))}
        </div>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard icon={<Users />} label="Learners" value={stats.totalLearners} />
            <StatCard icon={<School />} label="Classes" value={stats.totalClasses} />
            <StatCard icon={<BookOpen />} label="Learning Areas" value={stats.totalLearningAreas} />
            <StatCard
              icon={<ClipboardList />}
              label="Average Score"
              value={stats.avgPerformance?.toFixed(1) ?? "—"}
              sub="out of 10 per sub-strand"
            />
          </div>

          <div className="mt-6 grid gap-6 lg:grid-cols-3">
            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle>Learner enrolment by grade</CardTitle>
                <CardDescription>Active learners per grade in the current term.</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart data={stats.enrollmentByGrade} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis
                      dataKey="grade"
                      tickFormatter={(g: string) => GRADE_LABEL[g as keyof typeof GRADE_LABEL]?.replace("Grade ", "G") ?? g}
                      fontSize={12}
                    />
                    <YAxis allowDecimals={false} fontSize={12} />
                    <Tooltip
                      formatter={(v) => [`${v} learners`, "Enrolment"]}
                      labelFormatter={(g) => GRADE_LABEL[g as keyof typeof GRADE_LABEL] ?? g}
                    />
                    <Bar dataKey="count" fill="oklch(0.52 0.13 156)" radius={[6, 6, 0, 0]} maxBarSize={44} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Performance levels</CardTitle>
                <CardDescription>Distribution of sub-strand scores (KKEC levels).</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-44">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={stats.levelDistribution}
                        dataKey="count"
                        nameKey="level"
                        innerRadius={48}
                        outerRadius={72}
                        paddingAngle={3}
                      >
                        {stats.levelDistribution.map((entry) => (
                          <Cell key={entry.level} fill={LEVEL_COLORS[entry.level]} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(v, n) => [`${v} scores`, levelLabel(n as unknown as CompetencyLevel)]} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="mt-4 grid grid-cols-2 gap-2">
                  {stats.levelDistribution.map((d) => (
                    <div key={d.level} className="flex items-center gap-2 text-sm">
                      <span className={`h-2.5 w-2.5 rounded-full ${levelDot(d.level)}`} />
                      <span className="font-medium">{d.level}</span>
                      <span className="ml-auto text-muted-foreground">{d.count}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>

          <Card className="mt-6">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-amber-500" />
                Learning areas needing focus
              </CardTitle>
              <CardDescription>
                Lowest average sub-strand scores across all classes in this school.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {stats.weakestAreas.length === 0 ? (
                <p className="text-sm text-muted-foreground">No assessment data yet.</p>
              ) : (
                <div className="space-y-3">
                  {stats.weakestAreas.map((area) => (
                    <div key={area.learningAreaId} className="flex items-center gap-3 rounded-lg border p-3">
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">{area.name}</p>
                      </div>
                      <span className="text-sm font-semibold">{area.averageScore.toFixed(1)}</span>
                      <LevelBadge level={area.level} className="w-14 justify-center" />
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <div className="mt-6 flex flex-wrap gap-3">
            <QuickLink to="/assessment" label="Enter assessment scores" />
            <QuickLink to="/learners" label="Manage learner records" />
            <QuickLink to="/reports" label="Generate report cards" />
            <QuickLink to="/analytics" label="View analytics" />
          </div>
        </>
      )}
    </div>
  );
}

function StatCard({
  icon,
  label,
  value,
  sub,
}: {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  sub?: string;
}) {
  return (
    <Card>
      <CardContent className="flex items-start gap-4 p-5">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-accent text-accent-foreground [&_svg]:h-5 [&_svg]:w-5">
          {icon}
        </div>
        <div className="min-w-0">
          <p className="text-sm text-muted-foreground">{label}</p>
          <p className="text-2xl font-bold tracking-tight">{value}</p>
          {sub && <p className="text-xs text-muted-foreground">{sub}</p>}
        </div>
      </CardContent>
    </Card>
  );
}

function QuickLink({ to, label }: { to: string; label: string }) {
  return (
    <Link
      to={to}
      className="group inline-flex items-center gap-2 rounded-lg border bg-card px-4 py-2.5 text-sm font-medium shadow-sm transition-colors hover:bg-accent"
    >
      {label}
      <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
    </Link>
  );
}