import { lazy, Suspense } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "./context/AuthContext";
import { ToastProvider } from "./context/ToastContext";
import { AcademyProvider } from "./context/AcademyContext";
import ProtectedRoute from "./components/ProtectedRoute";
import Login from "./pages/Login";
const Account = lazy(() => import("./pages/Account"));
const ArchiveHistory = lazy(() => import("./pages/ArchiveHistory"));
const Dashboard = lazy(() => import("./pages/Dashboard"));
import ComingSoon from "./pages/ComingSoon";
const AcademicSessions = lazy(() => import("./pages/AcademicSessions"));
const Classes = lazy(() => import("./pages/Classes"));
const Subjects = lazy(() => import("./pages/Subjects"));
const Designations = lazy(() => import("./pages/Designations"));
const Staff = lazy(() => import("./pages/Staff"));
const Students = lazy(() => import("./pages/Students"));
const Fees = lazy(() => import("./pages/Fees"));
const Tests = lazy(() => import("./pages/Tests"));
const Salaries = lazy(() => import("./pages/Salaries"));
const Reports = lazy(() => import("./pages/Reports"));
import { NAV_SECTIONS, CURRENT_PHASE } from "./lib/nav";

// Real screens for modules that are wired up this phase.
const LIVE_PAGES = {
  "/account": Account,
  "/archive": ArchiveHistory,
  "/academic-sessions": AcademicSessions,
  "/classes": Classes,
  "/subjects": Subjects,
  "/designations": Designations,
  "/staff": Staff,
  "/students": Students,
  "/fees": Fees,
  "/tests": Tests,
  "/salaries": Salaries,
  "/reports": Reports,
};

// Every nav item beyond the current build phase still gets a real route,
// pointed at the placeholder screen — so the sidebar always reflects the
// full planned app, not just what's live today.
const upcomingRoutes = NAV_SECTIONS.flatMap((s) => s.items).filter(
  (item) => item.phase > CURRENT_PHASE || !LIVE_PAGES[item.to]
);
const liveRoutes = NAV_SECTIONS.flatMap((s) => s.items).filter(
  (item) => item.phase <= CURRENT_PHASE && LIVE_PAGES[item.to]
);

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AcademyProvider><ToastProvider>
          <Suspense fallback={<p role="status" className="p-6">Loading…</p>}><Routes>
            <Route path="/login" element={<Login />} />
            <Route
              path="/"
              element={
                <ProtectedRoute>
                  <Dashboard />
                </ProtectedRoute>
              }
            />
            {liveRoutes.map((item) => {
              const Page = LIVE_PAGES[item.to];
              return (
                <Route
                  key={item.to}
                  path={item.to}
                  element={
                    <ProtectedRoute adminOnly={item.adminOnly}>
                      <Page />
                    </ProtectedRoute>
                  }
                />
              );
            })}
            {upcomingRoutes.map((item) => (
              <Route
                key={item.to}
                path={item.to}
                element={
                  <ProtectedRoute adminOnly={item.adminOnly}>
                    <ComingSoon title={item.label} phase={item.phase} />
                  </ProtectedRoute>
                }
              />
            ))}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes></Suspense>
        </ToastProvider></AcademyProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}
