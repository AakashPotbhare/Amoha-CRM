import { NavLink, useLocation } from "react-router-dom";
import {
  Home,
  ClipboardList,
  PlusCircle,
  BarChart3,
  Users,
  DollarSign,
  FileText,
  Megaphone,
  Cpu,
  ShieldCheck,
  ChevronLeft,
  LogOut,
  UserPlus,
  Headphones,
  Clock,
  Settings,
  CalendarDays,
  BadgeDollarSign,
  TrendingUp,
  X,
} from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";
import { useEmployeeAccess } from "@/hooks/useEmployeeAccess";
import amohaLogo from "@/assets/amoha_logo.png";

const deptConfig: Record<string, { to: string; icon: React.ElementType; label: string }> = {
  sales: { to: "/departments/sales", icon: DollarSign, label: "Sales" },
  resume: { to: "/departments/resume", icon: FileText, label: "Resume" },
  marketing: { to: "/departments/marketing", icon: Megaphone, label: "Marketing" },
  technical: { to: "/departments/technical", icon: Cpu, label: "Technical" },
  compliance: { to: "/departments/compliance", icon: ShieldCheck, label: "Compliance" },
};

interface NavItem {
  to: string;
  icon: React.ElementType;
  label: string;
}

interface AppSidebarProps {
  /** Called when a nav link is tapped on mobile — used to close the drawer */
  onClose?: () => void;
}

export default function AppSidebar({ onClose }: AppSidebarProps) {
  const [collapsed, setCollapsed] = useState(false);
  const location = useLocation();
  const { employee, signOut } = useAuth();
  const access = useEmployeeAccess();
  const role = employee?.role ?? "";
  const showEnrollCandidate = ["director", "hr_head", "sales_head", "assistant_tl", "sales_executive"].includes(role);
  const showCandidateBoard = !!access?.hasPermission("candidates.read");
  const showSupportTaskCreator = ["director", "hr_head", "sales_head", "assistant_tl", "sales_executive", "lead_generator", "marketing_tl", "recruiter", "senior_recruiter", "resume_head", "resume_builder", "compliance_officer"].includes(role);

  // ─── Core nav (all authenticated employees) ──────────────────────────────
  const coreItems: NavItem[] = [
    { to: "/", icon: Home, label: "Home" },
    { to: "/tasks/inbox", icon: ClipboardList, label: "Task Inbox" },
    { to: "/tasks/create", icon: PlusCircle, label: "Create Task" },
  ];

  // ─── Department / dashboard links ────────────────────────────────────────
  const deptItems: NavItem[] = [];
  if (access) {
    if (access.canViewAllDepartments) {
      deptItems.push({ to: "/dashboard", icon: BarChart3, label: "Overview" });
      Object.values(deptConfig).forEach((d) => deptItems.push(d));
    } else {
      const myDept = deptConfig[access.departmentSlug];
      if (myDept) deptItems.push(myDept);
    }
  }

  // ─── Action shortcuts (permission-gated) ─────────────────────────────────
  const actionItems: NavItem[] = [];

  if (showEnrollCandidate) {
    actionItems.push({ to: "/candidates/enroll", icon: UserPlus, label: "Enroll Candidate" });
  }
  if (showCandidateBoard) {
    actionItems.push({ to: "/candidates", icon: Users, label: "Candidates" });
  }

  if (access?.hasPermission("support_tasks.read_own") || access?.hasPermission("support_tasks.read")) {
    actionItems.push({ to: "/my-queue", icon: Headphones, label: "My Queue" });
  }

  if (showSupportTaskCreator) {
    actionItems.push({ to: "/tasks/create/support", icon: PlusCircle, label: "Create Support Task" });
  }

  // Attendance & leaves — all employees
  actionItems.push({ to: "/attendance", icon: Clock, label: "Attendance" });
  actionItems.push({ to: "/leaves", icon: CalendarDays, label: "Leaves" });
  actionItems.push({ to: "/profile", icon: Users, label: "My Profile" });

  // Admin-gated items
  if (access?.hasPermission("attendance.read_all")) {
    actionItems.push({ to: "/attendance/report", icon: BarChart3, label: "Attendance Report" });
  }
  if (access?.hasPermission("shift_management.manage")) {
    actionItems.push({ to: "/shift-management", icon: Settings, label: "Shift Settings" });
  }
  if (access?.hasPermission("hr.read")) {
    actionItems.push({ to: "/hr", icon: Users, label: "HR Management" });
  }

  // My Performance — visible to all employees
  actionItems.push({ to: "/my-performance", icon: TrendingUp, label: "My Performance" });

  // Placement Offers — leadership, team leads, compliance
  if (employee) {
    const poRoles = ["director","ops_head","hr_head","marketing_tl","sales_head","technical_head","resume_head","compliance_officer"];
    if (poRoles.includes(employee.role)) {
      actionItems.push({ to: "/placement-orders", icon: BadgeDollarSign, label: "Placement Offers" });
    }
  }

  // ─── Render helper ───────────────────────────────────────────────────────
  const renderNavItem = (item: NavItem) => {
    const isActive =
      item.to === "/" ? location.pathname === "/" : location.pathname.startsWith(item.to);
    return (
      <NavLink
        key={item.to}
        to={item.to}
        onClick={() => onClose?.()}
        className={cn(
          "flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors",
          isActive
            ? "bg-sidebar-accent text-sidebar-active"
            : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-active"
        )}
      >
        <item.icon className="w-4 h-4 shrink-0" />
        {!collapsed && <span>{item.label}</span>}
      </NavLink>
    );
  };

  const renderSection = (label: string, items: NavItem[]) => {
    if (items.length === 0) return null;
    return (
      <>
        {!collapsed && (
          <p className="text-[10px] uppercase tracking-wider text-sidebar-foreground/50 px-3 pt-4 pb-1">
            {label}
          </p>
        )}
        {collapsed && <div className="border-t border-sidebar-border my-2" />}
        {items.map(renderNavItem)}
      </>
    );
  };

  return (
    <aside
      className={cn(
        "h-screen bg-sidebar text-sidebar-foreground flex flex-col transition-all duration-300 border-r border-sidebar-border shrink-0",
        collapsed ? "w-16" : "w-60"
      )}
    >
      {/* Logo row — includes mobile close button */}
      <div className="flex items-center gap-3 px-4 h-16 border-b border-sidebar-border">
        <img src={amohaLogo} alt="Amoha" className="shrink-0 h-8 w-8 object-contain" />
        {!collapsed && (
          <span className="font-semibold text-sidebar-active text-sm tracking-tight flex-1 min-w-0">
            RecruitHub
          </span>
        )}
        {/* Close button — only visible when used as a mobile drawer (onClose prop present) */}
        {onClose && (
          <button
            onClick={onClose}
            className="md:hidden ml-auto p-1 rounded-md text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-active transition-colors shrink-0"
            aria-label="Close navigation menu"
          >
            <X className="w-5 h-5" />
          </button>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 py-4 px-2 space-y-1 overflow-y-auto">
        {coreItems.map(renderNavItem)}
        {renderSection(access?.canViewAllDepartments ? "Departments" : "My Department", deptItems)}
        {renderSection("Quick Actions", actionItems)}
      </nav>

      {/* User info + controls */}
      <div className="px-2 py-3 border-t border-sidebar-border space-y-1">
        {!collapsed && employee && (
          <div className="px-3 py-2">
            <p className="text-xs font-medium text-sidebar-active truncate">{employee.full_name}</p>
            <p className="text-[10px] text-sidebar-foreground truncate">
              {employee.employee_code} · {employee.departments?.name}
            </p>
            <p className="text-[10px] text-sidebar-foreground/60 capitalize">
              {employee.role.replace(/_/g, " ")}
            </p>
          </div>
        )}
        <button
          onClick={signOut}
          className="flex items-center gap-3 px-3 py-2 rounded-md text-sm text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-active transition-colors w-full"
        >
          <LogOut className="w-4 h-4 shrink-0" />
          {!collapsed && <span>Sign Out</span>}
        </button>
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="flex items-center gap-3 px-3 py-2 rounded-md text-sm text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-active transition-colors w-full"
        >
          <ChevronLeft className={cn("w-4 h-4 transition-transform shrink-0", collapsed && "rotate-180")} />
          {!collapsed && <span>Collapse</span>}
        </button>
      </div>
    </aside>
  );
}
