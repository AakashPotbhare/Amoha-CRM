import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { api } from "@/lib/api.client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { ClipboardList, Headphones, FileText } from "lucide-react";

interface Department {
  id: string;
  name: string;
}

interface Team {
  id: string;
  name: string;
  department_id: string;
}

interface EmployeeOption {
  id: string;
  full_name: string;
  employee_code: string;
  team_id: string;
}

export default function CreateTask() {
  const { employee } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState("medium");
  const [dueDate, setDueDate] = useState("");
  const [selectedDept, setSelectedDept] = useState("");
  const [selectedTeam, setSelectedTeam] = useState("");
  const [selectedEmployee, setSelectedEmployee] = useState("");
  const [departments, setDepartments] = useState<Department[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [employees, setEmployees] = useState<EmployeeOption[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [validationError, setValidationError] = useState("");

  useEffect(() => {
    Promise.all([
      api.get<Department[]>("/api/departments"),
      api.get<Team[]>("/api/teams"),
      api.get<EmployeeOption[]>("/api/employees?is_active=true"),
    ]).then(([deptRes, teamRes, empRes]) => {
      if (deptRes.success && deptRes.data) setDepartments(deptRes.data);
      if (teamRes.success && teamRes.data) setTeams(teamRes.data);
      if (empRes.success && empRes.data) setEmployees(empRes.data);
    }).catch(() => {});
  }, []);

  const filteredTeams = selectedDept
    ? teams.filter((t) => t.department_id === selectedDept)
    : teams;

  const filteredEmployees = selectedTeam
    ? employees.filter((e) => e.team_id === selectedTeam)
    : selectedDept
    ? employees.filter((e) =>
        teams.some((t) => t.department_id === selectedDept && t.id === e.team_id)
      )
    : employees;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setValidationError("");

    if (!employee || !title.trim()) {
      setValidationError("Task title is required");
      return;
    }

    if (!selectedDept && !selectedTeam && !selectedEmployee) {
      setValidationError("Please assign the task to at least a Department, Team, or Person");
      toast({
        title: "Validation Error",
        description: "Please assign the task to at least a Department, Team, or Person",
        variant: "destructive"
      });
      return;
    }

    if (selectedEmployee && !selectedTeam) {
      setValidationError("Please select a Team when assigning to a specific person");
      toast({
        title: "Validation Error",
        description: "Please select a Team when assigning to a specific person",
        variant: "destructive"
      });
      return;
    }

    setSubmitting(true);
    try {
      await api.post("/api/tasks", {
        title: title.trim(),
        description: description.trim() || null,
        created_by: employee.id,
        assigned_to_department_id: selectedDept || null,
        assigned_to_team_id: selectedTeam || null,
        assigned_to_employee_id: selectedEmployee || null,
        priority,
        due_date: dueDate || null,
      });

      toast({ title: "Success", description: "Task has been created and assigned successfully!" });
      navigate("/tasks/inbox?tab=created");
    } catch (err: any) {
      const msg = err.message || "Unexpected error occurred while creating task";
      setValidationError(msg);
      toast({ title: "Error", description: msg, variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  const selectClass = "w-full border border-input rounded-md px-3 py-2 text-sm bg-background text-foreground";

  return (
    <div className="p-4 md:p-6 lg:p-8 max-w-3xl mx-auto space-y-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between mb-4 md:mb-6">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-foreground">Create Task</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Choose the type of task you want to create
          </p>
        </div>
      </div>

      {/* Task Type Selector Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <button
          type="button"
          onClick={() => navigate("/tasks/create/support")}
          className="bg-card border-2 border-primary/20 hover:border-primary rounded-lg p-5 text-left transition-all group card-elevated hover:-translate-y-0.5"
        >
          <Headphones className="w-8 h-8 text-primary mb-3" />
          <h3 className="font-semibold text-foreground group-hover:text-primary transition-colors">Support Task</h3>
          <p className="text-xs text-muted-foreground mt-1">
            Interview Support, Assessment, RUC, Mock Call, Preparation Call
          </p>
        </button>

        <button
          type="button"
          onClick={() => navigate("/tasks/create/support?type=resume")}
          className="bg-card border-2 border-accent/20 hover:border-accent rounded-lg p-5 text-left transition-all group card-elevated hover:-translate-y-0.5"
        >
          <FileText className="w-8 h-8 text-accent-foreground mb-3" />
          <h3 className="font-semibold text-foreground group-hover:text-accent-foreground transition-colors">Resume Task</h3>
          <p className="text-xs text-muted-foreground mt-1">
            Request resume building or rebuilding for a candidate
          </p>
        </button>

        <div className="bg-card border border-border rounded-lg p-5 card-elevated">
          <ClipboardList className="w-8 h-8 text-muted-foreground mb-3" />
          <h3 className="font-semibold text-foreground">General Task</h3>
          <p className="text-xs text-muted-foreground mt-1">
            Assign a general task to any department, team, or person
          </p>
        </div>
      </div>

      {/* General Task Form */}
      <form onSubmit={handleSubmit} className="bg-card border border-border rounded-lg p-4 sm:p-6 space-y-5 card-elevated">
        <h2 className="text-lg font-semibold text-foreground">General Task</h2>

        {validationError && (
          <div className="bg-destructive/10 border border-destructive/30 rounded-md p-3">
            <p className="text-sm text-destructive font-medium">{validationError}</p>
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-2 col-span-full">
            <Label htmlFor="title">Task Title *</Label>
            <Input
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Enter task title"
              required
            />
          </div>

          <div className="space-y-2 col-span-full">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe the task..."
              rows={4}
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="priority">Priority</Label>
            <select id="priority" value={priority} onChange={(e) => setPriority(e.target.value)} className={selectClass}>
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
              <option value="urgent">Urgent</option>
            </select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="due_date">Due Date</Label>
            <Input id="due_date" type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
          </div>
        </div>

        <div className="border-t border-border pt-5 space-y-4">
          <p className="text-sm font-medium text-foreground">Assign To</p>

          <div className="space-y-2">
            <Label htmlFor="dept">Department</Label>
            <select
              id="dept"
              value={selectedDept}
              onChange={(e) => { setSelectedDept(e.target.value); setSelectedTeam(""); setSelectedEmployee(""); }}
              className={selectClass}
            >
              <option value="">All Departments</option>
              {departments.map((d) => (
                <option key={d.id} value={d.id}>{d.name}</option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="team">Team</Label>
            <select
              id="team"
              value={selectedTeam}
              onChange={(e) => { setSelectedTeam(e.target.value); setSelectedEmployee(""); }}
              className={selectClass}
            >
              <option value="">All Teams</option>
              {filteredTeams.map((t) => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="employee">Person (optional)</Label>
            <select id="employee" value={selectedEmployee} onChange={(e) => setSelectedEmployee(e.target.value)} className={selectClass}>
              <option value="">No specific person</option>
              {filteredEmployees.map((emp) => (
                <option key={emp.id} value={emp.id}>{emp.full_name} ({emp.employee_code})</option>
              ))}
            </select>
          </div>
        </div>

        <div className="space-y-2">
          <div className="text-sm text-muted-foreground">
            <p>Task title is {title.trim() ? "provided" : "required"}</p>
            <p>Assignment is {(selectedDept || selectedTeam || selectedEmployee) ? "set" : "required (Department, Team, or Person)"}</p>
          </div>

          <div className="flex flex-col-reverse sm:flex-row gap-2 justify-end pt-2">
            <Button type="button" variant="outline" onClick={() => navigate("/")} className="w-full sm:w-auto">
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={submitting || !title.trim() || (!selectedDept && !selectedTeam && !selectedEmployee)}
              className="w-full sm:w-auto"
            >
              {submitting ? "Creating..." : "Create Task"}
            </Button>
          </div>
        </div>
      </form>
    </div>
  );
}
