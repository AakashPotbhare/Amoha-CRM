import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useEmployeeAccess } from "@/hooks/useEmployeeAccess";
import { ClipboardList, PlusCircle, BarChart3, UserPlus, User } from "lucide-react";
import NoticeBoard from "@/components/NoticeBoard";

export default function Home() {
  const navigate = useNavigate();
  const { employee } = useAuth();
  const access = useEmployeeAccess();
  const role = employee?.role ?? "";
  const showEnrollCandidate = ["sales_head", "assistant_tl", "sales_executive", "lead_generator"].includes(role);

  const dashboardRoute = access?.getDashboardRoute() || "/dashboard";

  const actionCards = [
    {
      title: "Get Tasks",
      description: "View tasks assigned to you or your department",
      icon: ClipboardList,
      to: "/tasks/inbox",
      gradient: "from-primary to-accent-foreground",
    },
    {
      title: "Create Task",
      description: "Create and assign a task to any department",
      icon: PlusCircle,
      to: "/tasks/create",
      gradient: "from-info to-primary",
    },
    {
      title: "My Dashboard",
      description: "View your team & department performance",
      icon: BarChart3,
      to: dashboardRoute,
      gradient: "from-success to-accent-foreground",
    },
    {
      title: "My Profile",
      description: "View and update your personal details",
      icon: User,
      to: "/profile",
      gradient: "from-muted-foreground to-foreground",
    },
    ...(showEnrollCandidate
      ? [
          {
            title: "Enroll Candidate",
            description: "Add a new candidate to the system",
            icon: UserPlus,
            to: "/candidates/enroll",
            gradient: "from-warning to-primary",
          },
        ]
      : []),
  ];

  return (
    <div className="min-h-[80vh] flex flex-col items-center justify-center p-6 lg:p-8">
      <div className="text-center mb-10">
        <h1 className="text-3xl font-bold text-foreground">
          Welcome back, {employee?.full_name?.split(" ")[0] ?? "there"}!
        </h1>
        <p className="text-muted-foreground mt-2 text-sm">
          {employee?.departments?.name} · {employee?.teams?.name}
          <span className="ml-2 capitalize text-muted-foreground/70">
            ({employee?.role?.replace("_", " ")})
          </span>
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 max-w-5xl w-full">
        {actionCards.map((card) => (
          <button
            key={card.to}
            onClick={() => navigate(card.to)}
            className="group relative bg-card border border-border rounded-xl p-6 text-left card-elevated hover:-translate-y-1 transition-all duration-200"
          >
            <div
              className={`w-12 h-12 rounded-lg bg-gradient-to-br ${card.gradient} flex items-center justify-center mb-4 shadow-sm`}
            >
              <card.icon className="w-6 h-6 text-primary-foreground" />
            </div>
            <h2 className="text-lg font-semibold text-foreground">{card.title}</h2>
            <p className="text-sm text-muted-foreground mt-1">{card.description}</p>
          </button>
        ))}
      </div>

      {/* Notice Board */}
      <div className="w-full max-w-5xl mt-10">
        <NoticeBoard />
      </div>
    </div>
  );
}
