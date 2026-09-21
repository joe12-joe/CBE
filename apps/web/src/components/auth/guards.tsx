import { useEffect } from "react";
import { Navigate, Outlet, useLocation } from "react-router-dom";
import { GraduationCap, Loader2 } from "lucide-react";
import { useAuthStore } from "@/stores/authStore";
import type { Role } from "@/lib/types";

export function RequireAuth() {
  const { status, restore } = useAuthStore();

  useEffect(() => {
    if (status === "idle") void restore();
  }, [status, restore]);

  const location = useLocation();

  if (status === "loading") {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3">
        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary text-primary-foreground">
          <GraduationCap className="h-7 w-7" />
        </div>
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        <p className="text-sm text-muted-foreground">Restoring your session…</p>
      </div>
    );
  }

  if (status !== "authenticated") {
    return <Navigate to="/login" state={{ from: location.pathname }} replace />;
  }

  return <Outlet />;
}

export function RequireRole({ roles, children }: { roles: Role[]; children: React.ReactNode }) {
  const user = useAuthStore((s) => s.user);
  if (!user || !roles.includes(user.role)) {
    return <Navigate to="/" replace />;
  }
  return <>{children}</>;
}