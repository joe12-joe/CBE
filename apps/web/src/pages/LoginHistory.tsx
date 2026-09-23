import { useQuery } from "@tanstack/react-query";
import { RefreshCw } from "lucide-react";
import { getLoginEvents } from "@/services/loginHistory";
import { useAuthStore } from "@/stores/authStore";
import { formatDateTime } from "@/lib/format";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { EmptyState } from "@/components/ui/empty-state";

export function LoginHistoryPage() {
  const me = useAuthStore((s) => s.user)!;

  const { data: events = [], isLoading, isFetching, refetch } = useQuery({
    queryKey: ["login-events"],
    queryFn: () => getLoginEvents(),
  });

  return (
    <div>
      <PageHeader
        title="Sign-in Log"
        description="Every successful login, recorded automatically. You see your own sign-ins and those of users beneath you."
        actions={
          <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching}>
            <RefreshCw className={isFetching ? "animate-spin" : ""} /> Refresh
          </Button>
        }
      />

      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-12 rounded-lg" />
          ))}
        </div>
      ) : events.length === 0 ? (
        <EmptyState
          title="No sign-ins recorded yet"
          description="Successful logins will appear here as they happen."
        />
      ) : (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Account</TableHead>
                <TableHead>Signed in at</TableHead>
                <TableHead className="text-right">Recorded</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {events.map((e) => {
                const isMe = e.userId === me.id;
                return (
                  <TableRow key={e.id}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{e.email}</span>
                        {isMe && <Badge variant="outline">you</Badge>}
                      </div>
                    </TableCell>
                    <TableCell className="text-muted-foreground">{formatDateTime(e.createdAt)}</TableCell>
                    <TableCell className="text-right text-muted-foreground">
                      {isMe ? "your session" : "in your scope"}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </Card>
      )}
    </div>
  );
}