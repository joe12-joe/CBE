import { useQuery } from "@tanstack/react-query";
import { Phone, School, MapPin } from "lucide-react";
import { getSchoolsForUser, listSubCounties, schoolTypeLabel } from "@/services/schools";
import { useAuthStore } from "@/stores/authStore";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";

export function SchoolsPage() {
  const user = useAuthStore((s) => s.user)!;

  const { data: schools = [], isLoading } = useQuery({
    queryKey: ["schools", "for-user", user.id],
    queryFn: () => getSchoolsForUser(user),
  });

  const { data: subCounties = [] } = useQuery({
    queryKey: ["sub-counties"],
    queryFn: () => listSubCounties(),
  });

  const subCountyName = (id: string) => subCounties.find((s) => s.id === id)?.name ?? id;

  if (isLoading) {
    return (
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-40 rounded-xl" />
        ))}
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title="Schools"
        description="Institutions under your oversight."
      />

      {schools.length === 0 ? (
        <EmptyState title="No schools" description="No schools are assigned to your account." />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {schools.map((s) => (
            <Card key={s.id}>
              <CardContent className="p-5">
                <div className="flex items-start justify-between">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-accent text-accent-foreground">
                    <School className="h-5 w-5" />
                  </div>
                  <Badge variant="secondary">{schoolTypeLabel(s.type)}</Badge>
                </div>
                <h3 className="mt-3 font-semibold leading-tight">{s.name}</h3>
                <p className="mt-0.5 font-mono text-xs text-muted-foreground">NEMIS {s.code}</p>
                <div className="mt-4 space-y-1 text-sm text-muted-foreground">
                  <p className="flex items-center gap-2">
                    <MapPin className="h-3.5 w-3.5" /> {subCountyName(s.subCountyId)}
                  </p>
                  {s.phone && (
                    <p className="flex items-center gap-2">
                      <Phone className="h-3.5 w-3.5" /> {s.phone}
                    </p>
                  )}
                </div>
                <div className="mt-4 border-t pt-3">
                  <p className="text-2xl font-bold">{s.enrollmentCount ?? 0}</p>
                  <p className="text-xs text-muted-foreground">enrolled learners</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}