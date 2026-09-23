import { lazy, Suspense } from "react";
import { createBrowserRouter } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { RequireAuth, RequireRole } from "@/components/auth/guards";
import { LoginPage } from "@/pages/Login";

const Dashboard = lazy(() => import("@/pages/Dashboard").then((m) => ({ default: m.DashboardPage })));
const Learners = lazy(() => import("@/pages/Learners").then((m) => ({ default: m.LearnersPage })));
const LearnerDetail = lazy(() => import("@/pages/LearnerDetail").then((m) => ({ default: m.LearnerDetailPage })));
const Curriculum = lazy(() => import("@/pages/Curriculum").then((m) => ({ default: m.CurriculumPage })));
const Assessment = lazy(() => import("@/pages/Assessment").then((m) => ({ default: m.AssessmentPage })));
const Reports = lazy(() => import("@/pages/Reports").then((m) => ({ default: m.ReportsPage })));
const Analytics = lazy(() => import("@/pages/Analytics").then((m) => ({ default: m.AnalyticsPage })));
const Schools = lazy(() => import("@/pages/Schools").then((m) => ({ default: m.SchoolsPage })));
const Users = lazy(() => import("@/pages/Users").then((m) => ({ default: m.UsersPage })));
const LoginHistory = lazy(() => import("@/pages/LoginHistory").then((m) => ({ default: m.LoginHistoryPage })));

function PageLoader() {
  return (
    <div className="flex flex-col items-center justify-center py-24 gap-2">
      <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      <p className="text-sm text-muted-foreground">Loading…</p>
    </div>
  );
}

function withSuspense(node: React.ReactNode) {
  return <Suspense fallback={<PageLoader />}>{node}</Suspense>;
}

export const router = createBrowserRouter([
  {
    path: "/login",
    element: <LoginPage />,
  },
  {
    element: <RequireAuth />,
    children: [
      {
        element: <AppShell />,
        children: [
          { index: true, element: withSuspense(<Dashboard />) },
          { path: "learners", element: withSuspense(<Learners />) },
          { path: "learners/:id", element: withSuspense(<LearnerDetail />) },
          {
            path: "curriculum",
            element: (
              <RequireRole roles={["SUPER_ADMIN", "COUNTY_ADMIN", "SUB_COUNTY_ADMIN", "SCHOOL_ADMIN"]}>
                {withSuspense(<Curriculum />)}
              </RequireRole>
            ),
          },
          { path: "assessment", element: withSuspense(<Assessment />) },
          { path: "reports", element: withSuspense(<Reports />) },
          {
            path: "analytics",
            element: (
              <RequireRole roles={["SUPER_ADMIN", "COUNTY_ADMIN", "SUB_COUNTY_ADMIN", "SCHOOL_ADMIN"]}>
                {withSuspense(<Analytics />)}
              </RequireRole>
            ),
          },
          {
            path: "schools",
            element: (
              <RequireRole roles={["SUPER_ADMIN", "COUNTY_ADMIN", "SUB_COUNTY_ADMIN"]}>
                {withSuspense(<Schools />)}
              </RequireRole>
            ),
          },
          {
            path: "users",
            element: (
              <RequireRole roles={["SUPER_ADMIN", "COUNTY_ADMIN", "SUB_COUNTY_ADMIN", "SCHOOL_ADMIN"]}>
                {withSuspense(<Users />)}
              </RequireRole>
            ),
          },
          { path: "logins", element: withSuspense(<LoginHistory />) },
          { path: "*", element: withSuspense(<Dashboard />) },
        ],
      },
    ],
  },
]);