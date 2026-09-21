import { useQuery } from "@tanstack/react-query";
import { Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { useSchoolContext } from "@/lib/useSchool";
import { useTermStore } from "@/stores/termStore";
import { useAuthStore } from "@/stores/authStore";
import { getDashboardStats, getGradePerformance, getCountyComparison } from "@/services/analytics";
import { canViewCountyData } from "@/lib/roles";
import { GRADE_LABEL, termLabel, levelDot } from "@/lib/format";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { LevelBadge } from "@/components/ui/level-badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

const LEVEL_COLORS: Record<string, string> = {
  EE: "#10b981",
  ME: "#0ea5e9",
  AE: "#f59e0b",
  BE: "#ef4444",
};

export function AnalyticsPage() {
  const { schoolId } = useSchoolContext();
  const { term } = useTermStore();
  const user = useAuthStore((s) => s.user)!;
  const countyView = canViewCountyData(user.role);
  const countyId = user.countyIds[0];

  return (
    <div>
      <PageHeader
        title="Analytics"
        description={countyView ? "School and county-level performance analysis." : "School-level performance analysis."}
      />

      <Tabs defaultValue="school">
        <TabsList className="mb-4">
          <TabsTrigger value="school">School performance</TabsTrigger>
          {countyView && countyId && <TabsTrigger value="county">County comparison</TabsTrigger>}
        </TabsList>

        <TabsContent value="school">
          <SchoolAnalytics schoolId={schoolId} term={term} />
        </TabsContent>

        {countyView && countyId && (
          <TabsContent value="county">
            <CountyAnalytics countyId={countyId} term={term} />
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}

function SchoolAnalytics({ schoolId, term }: { schoolId: string | null; term: ReturnType<typeof useTermStore.getState>["term"] }) {
  const { data: stats, isLoading } = useQuery({
    queryKey: ["dashboard", schoolId, term],
    queryFn: () => getDashboardStats(schoolId!, term),
    enabled: !!schoolId,
  });
  const { data: grades } = useQuery({
    queryKey: ["grade-performance", schoolId, term],
    queryFn: () => getGradePerformance(schoolId!, term),
    enabled: !!schoolId,
  });

  if (isLoading || !stats) {
    return (
      <div className="grid gap-6 lg:grid-cols-2">
        <Skeleton className="h-80 rounded-xl" />
        <Skeleton className="h-80 rounded-xl" />
      </div>
    );
  }

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle>Average score by grade</CardTitle>
          <CardDescription>Mean sub-strand score (out of 10) per grade across all classes.</CardDescription>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={grades ?? []} margin={{ top: 8, right: 8, left: -24, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="grade" fontSize={12} />
              <YAxis domain={[0, 10]} fontSize={12} />
              <Tooltip
                formatter={(v) => [`${v} / 10`, "Average"]}
                labelFormatter={(g) => GRADE_LABEL[g as keyof typeof GRADE_LABEL] ?? g}
              />
              <Bar dataKey="avgScore" radius={[6, 6, 0, 0]} maxBarSize={48}>
                {(grades ?? []).map((g) => (
                  <Cell key={g.grade} fill={g.level ? LEVEL_COLORS[g.level] : "oklch(0.52 0.13 156)"} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Performance level distribution</CardTitle>
          <CardDescription>Across all sub-strand scores for {termLabel(term)}.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={stats.levelDistribution} dataKey="count" nameKey="level" innerRadius={52} outerRadius={80} paddingAngle={3}>
                  {stats.levelDistribution.map((d) => (
                    <Cell key={d.level} fill={LEVEL_COLORS[d.level]} />
                  ))}
                </Pie>
                <Tooltip formatter={(v, n) => [`${v} scores`, `${n} (${["Below", "Approaching", "Meeting", "Exceeding"][["BE", "AE", "ME", "EE"].indexOf(String(n))]} Expectation)`]} />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-4 grid grid-cols-2 gap-2">
            {stats.levelDistribution
              .slice()
              .sort((a, b) => ["BE", "AE", "ME", "EE"].indexOf(a.level) - ["BE", "AE", "ME", "EE"].indexOf(b.level))
              .map((d) => (
                <div key={d.level} className="flex items-center gap-2 text-sm">
                  <span className={`h-2.5 w-2.5 rounded-full ${levelDot(d.level)}`} />
                  <span className="font-medium">{d.level}</span>
                  <span className="ml-auto text-muted-foreground">{d.count}</span>
                </div>
              ))}
          </div>
        </CardContent>
      </Card>

      <Card className="lg:col-span-2">
        <CardHeader>
          <CardTitle>Learning areas needing focus</CardTitle>
          <CardDescription>Lowest average scores school-wide.</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Learning area</TableHead>
                <TableHead className="text-right">Average score</TableHead>
                <TableHead className="text-right">Level</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {stats.weakestAreas.map((a) => (
                <TableRow key={a.learningAreaId}>
                  <TableCell className="font-medium">{a.name}</TableCell>
                  <TableCell className="text-right tabular-nums">{a.averageScore.toFixed(1)}</TableCell>
                  <TableCell className="text-right">
                    <LevelBadge level={a.level} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

function CountyAnalytics({ countyId, term }: { countyId: string; term: ReturnType<typeof useTermStore.getState>["term"] }) {
  const { data, isLoading } = useQuery({
    queryKey: ["county-comparison", countyId, term],
    queryFn: () => getCountyComparison(countyId, term),
  });

  if (isLoading || !data) {
    return <Skeleton className="h-96 w-full rounded-xl" />;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Schools in this county</CardTitle>
        <CardDescription>
          Learner counts, average sub-strand scores and Exceeding-Expectation (EE) rates for {termLabel(term)}.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>School</TableHead>
              <TableHead className="text-right">Learners</TableHead>
              <TableHead className="text-right">Avg score</TableHead>
              <TableHead className="text-right">EE rate</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.rows.map((r) => (
              <TableRow key={r.schoolId}>
                <TableCell className="font-medium">{r.schoolName}</TableCell>
                <TableCell className="text-right tabular-nums">{r.learners}</TableCell>
                <TableCell className="text-right tabular-nums">
                  {r.avgPerformance == null ? "—" : r.avgPerformance.toFixed(1)}
                </TableCell>
                <TableCell className="text-right">
                  {r.eeRate == null ? (
                    "—"
                  ) : (
                    <Badge variant="secondary">{r.eeRate}%</Badge>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}