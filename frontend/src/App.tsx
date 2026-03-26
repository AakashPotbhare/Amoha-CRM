import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { hasPermission, Permission } from "@/lib/permissions";
import type { EmployeeRole } from "@/types/domain.types";
import AppLayout from "@/components/AppLayout";
import Home from "@/pages/Home";
import Dashboard from "@/pages/Dashboard";
import TaskInbox from "@/pages/TaskInbox";
import CreateTask from "@/pages/CreateTask";
import CreateSupportTask from "@/pages/CreateSupportTask";
import Candidates from "@/pages/Candidates";
import MarketingDepartment from "@/pages/MarketingDepartment";
import TechnicalDashboard from "@/pages/TechnicalDashboard";
import MySupportQueue from "@/pages/MySupportQueue";
import SalesDashboard from "@/pages/SalesDashboard";
import ResumeDashboard from "@/pages/ResumeDashboard";
import ComplianceDashboard from "@/pages/ComplianceDashboard";
import HRDashboard from "@/pages/HRDashboard";
import CandidateEnrollment from "@/pages/CandidateEnrollment";
import Attendance from "@/pages/Attendance";
import ShiftManagement from "@/pages/ShiftManagement";
import AttendanceReport from "@/pages/AttendanceReport";
import LeaveManagement from "@/pages/LeaveManagement";
import Login from "@/pages/Login";
import ResetPassword from "@/pages/ResetPassword";
import Profile from "@/pages/Profile";
import Unauthorized from "@/pages/Unauthorized";
import NotFound from "./pages/NotFound";
import PlacementOffers from "@/pages/PlacementOffers";
import CreatePlacementOffer from "@/pages/CreatePlacementOffer";
import MyPerformance from "@/pages/MyPerformance";
import { Loader2 } from "lucide-react";
import ErrorBoundary from "@/components/shared/ErrorBoundary";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 1000 * 60 * 2, // 2 minutes
    },
  },
});

// Renders a full-screen spinner while auth resolves
function AuthLoader() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <Loader2 className="w-8 h-8 animate-spin text-primary" />
    </div>
  );
}

// Protects routes: requires authentication + optional role permission
function ProtectedRoute({
  children,
  requiredPermission,
}: {
  children: React.ReactNode;
  requiredPermission?: Permission;
}) {
  const { employee, loading } = useAuth();

  if (loading) return <AuthLoader />;
  if (!employee) return <Navigate to="/login" replace />;

  if (requiredPermission) {
    const allowed = hasPermission(employee.role as EmployeeRole, requiredPermission);
    if (!allowed) return <Navigate to="/unauthorized" replace />;
  }

  return <>{children}</>;
}

// Redirects authenticated users away from public pages (login)
function PublicRoute({ children }: { children: React.ReactNode }) {
  const { employee, loading } = useAuth();

  if (loading) return <AuthLoader />;
  if (employee) return <Navigate to="/" replace />;

  return <>{children}</>;
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            {/* Public */}
            <Route path="/login" element={<PublicRoute><Login /></PublicRoute>} />
            <Route path="/reset-password" element={<ResetPassword />} />
            <Route path="/unauthorized" element={<Unauthorized />} />

            {/* Protected */}
            <Route
              path="/*"
              element={
                <ProtectedRoute>
                  <AppLayout>
                    <ErrorBoundary>
                    <Routes>
                      {/* Home — all authenticated employees */}
                      <Route path="/" element={<Home />} />

                      {/* Global dashboard — leadership only */}
                      <Route
                        path="/dashboard"
                        element={
                          <ProtectedRoute requiredPermission="dashboard.global">
                            <Dashboard />
                          </ProtectedRoute>
                        }
                      />

                      {/* Tasks — all employees */}
                      <Route path="/tasks/inbox" element={<TaskInbox />} />
                      <Route path="/tasks/create" element={<CreateTask />} />
                      <Route
                        path="/tasks/create/support"
                        element={
                          <ProtectedRoute requiredPermission="support_tasks.write">
                            <CreateSupportTask />
                          </ProtectedRoute>
                        }
                      />

                      {/* Candidates */}
                      <Route
                        path="/candidates/enroll"
                        element={
                          <ProtectedRoute requiredPermission="candidates.enroll">
                            <CandidateEnrollment />
                          </ProtectedRoute>
                        }
                      />
                      <Route
                        path="/candidates"
                        element={
                          <ProtectedRoute requiredPermission="candidates.read">
                            <Candidates />
                          </ProtectedRoute>
                        }
                      />

                      {/* Department dashboards */}
                      <Route path="/departments/sales" element={<SalesDashboard />} />
                      <Route path="/departments/resume" element={<ResumeDashboard />} />
                      <Route path="/departments/marketing" element={<MarketingDepartment />} />
                      <Route path="/departments/technical" element={<TechnicalDashboard />} />
                      <Route path="/departments/compliance" element={<ComplianceDashboard />} />

                      {/* My Queue — support staff */}
                      <Route path="/my-queue" element={<MySupportQueue />} />

                      {/* HR */}
                      <Route
                        path="/hr"
                        element={
                          <ProtectedRoute requiredPermission="hr.read">
                            <HRDashboard />
                          </ProtectedRoute>
                        }
                      />

                      {/* Attendance */}
                      <Route path="/attendance" element={<Attendance />} />
                      <Route
                        path="/attendance/report"
                        element={
                          <ProtectedRoute requiredPermission="attendance.read_all">
                            <AttendanceReport />
                          </ProtectedRoute>
                        }
                      />
                      <Route
                        path="/shift-management"
                        element={
                          <ProtectedRoute requiredPermission="shift_management.manage">
                            <ShiftManagement />
                          </ProtectedRoute>
                        }
                      />

                      {/* Leaves */}
                      <Route path="/leaves" element={<LeaveManagement />} />

                      {/* Profile */}
                      <Route path="/profile" element={<Profile />} />

                      {/* Placement Offers */}
                      <Route path="/placement-orders" element={<PlacementOffers />} />
                      <Route path="/placement-orders/create" element={<CreatePlacementOffer />} />

                      {/* My Performance */}
                      <Route path="/my-performance" element={<MyPerformance />} />

                      {/* Fallback */}
                      <Route path="*" element={<NotFound />} />
                    </Routes>
                    </ErrorBoundary>
                  </AppLayout>
                </ProtectedRoute>
              }
            />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
