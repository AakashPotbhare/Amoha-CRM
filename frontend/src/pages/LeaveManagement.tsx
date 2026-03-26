import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { api } from "@/lib/api.client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { CalendarDays, Plus, CheckCircle, XCircle } from "lucide-react";
import { format, differenceInCalendarDays, parseISO } from "date-fns";

interface LeaveBalance {
  id: string;
  paid_leave_credited: number;
  paid_leave_used: number;
  unpaid_leave_used: number;
  year: number;
  month: number;
}

interface LeaveRequest {
  id: string;
  employee_id: string;
  leave_type: string;
  start_date: string;
  end_date: string;
  total_days: number;
  reason: string | null;
  status: string;
  created_at: string;
  approved_by_tl: string | null;
  approved_by_manager: string | null;
  rejected_by: string | null;
  rejection_reason: string | null;
  employees?: { full_name: string; employee_code: string };
}

function normalizeLeaveRequest(request: any): LeaveRequest {
  return {
    id: request.id,
    employee_id: request.employee_id,
    leave_type: request.leave_type,
    start_date: request.start_date,
    end_date: request.end_date,
    total_days:
      typeof request.total_days === "number"
        ? request.total_days
        : differenceInCalendarDays(parseISO(request.end_date), parseISO(request.start_date)) + 1,
    reason: request.reason ?? null,
    status: request.status,
    created_at: request.created_at,
    approved_by_tl: request.approved_by_tl ?? null,
    approved_by_manager: request.approved_by_manager ?? request.approved_by ?? null,
    rejected_by: request.rejected_by ?? null,
    rejection_reason: request.rejection_reason ?? null,
    employees: request.employees,
  };
}

export default function LeaveManagement() {
  const { employee } = useAuth();
  const { toast } = useToast();
  const [balance, setBalance] = useState<LeaveBalance | null>(null);
  const [myRequests, setMyRequests] = useState<LeaveRequest[]>([]);
  const [pendingApprovals, setPendingApprovals] = useState<LeaveRequest[]>([]);
  const [loading, setLoading] = useState(false);

  // Form state
  const [leaveType, setLeaveType] = useState<string>("annual");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [reason, setReason] = useState("");

  const APPROVER_ROLES = ["director", "ops_head", "hr_head", "sales_head", "technical_head", "marketing_tl", "resume_head", "assistant_tl"];
  const isApprover = employee && APPROVER_ROLES.includes(employee.role);

  const fetchData = useCallback(async () => {
    if (!employee) return;

    // Get leave balance
    const balRes = await api.get<LeaveBalance[]>(`/api/hr/leave-balance/${employee.id}`);
    if (balRes.success && balRes.data && balRes.data.length > 0) {
      setBalance(balRes.data[0]);
    }

    // My requests
    const myReqRes = await api.get<LeaveRequest[]>(`/api/leaves?employee_id=${employee.id}`);
    if (myReqRes.success && myReqRes.data) {
      setMyRequests(myReqRes.data.map(normalizeLeaveRequest));
    }

    // Pending approvals (for approvers)
    if (isApprover) {
      const statusFilter = employee.role === "team_lead" ? "pending" : "pending,approved_by_tl";
      const pendingRes = await api.get<LeaveRequest[]>(`/api/leaves?status=${statusFilter}`);
      if (pendingRes.success && pendingRes.data) {
        setPendingApprovals(pendingRes.data.map(normalizeLeaveRequest));
      }
    }
  }, [employee]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const totalDays = startDate && endDate
    ? Math.max(differenceInCalendarDays(new Date(endDate), new Date(startDate)) + 1, 0)
    : 0;

  const paidAvailable = balance ? balance.paid_leave_credited - balance.paid_leave_used : 0;

  const handleSubmit = async () => {
    if (!employee || !startDate || !endDate || totalDays <= 0) return;
    setLoading(true);

    if (leaveType === "annual" && totalDays > paidAvailable) {
      toast({
        title: "Insufficient paid leave balance",
        description: `You have ${paidAvailable} paid leaves available but requested ${totalDays}.`,
        variant: "destructive",
      });
      setLoading(false);
      return;
    }

    try {
      await api.post("/api/leaves", {
        employee_id: employee.id,
        leave_type: leaveType,
        start_date: startDate,
        end_date: endDate,
        total_days: totalDays,
        reason: reason || null,
      });
      toast({ title: "Leave request submitted" });
      setStartDate("");
      setEndDate("");
      setReason("");
      fetchData();
    } catch (err: any) {
      toast({ title: "Failed to submit", description: err.message, variant: "destructive" });
    }
    setLoading(false);
  };

  const handleApprove = async (request: LeaveRequest) => {
    if (!employee) return;

    const TL_ROLES = ["marketing_tl", "sales_head", "technical_head", "resume_head", "assistant_tl"];
    const isTL = TL_ROLES.includes(employee.role);
    const needsManagerApproval = request.total_days >= 3;

    const updateData: Record<string, any> = isTL
      ? {
          status: needsManagerApproval ? "approved_by_tl" : "approved",
          approved_by_tl: employee.id,
          approved_by_tl_at: new Date().toISOString(),
        }
      : {
          status: "approved",
          approved_by_manager: employee.id,
          approved_by_manager_at: new Date().toISOString(),
        };

    try {
      await api.patch(`/api/leaves/${request.id}`, updateData);
      toast({ title: "Leave approved" });
      fetchData();
    } catch (err: any) {
      toast({ title: "Failed to approve", description: err.message, variant: "destructive" });
    }
  };

  const handleReject = async (requestId: string) => {
    if (!employee) return;
    try {
      await api.patch(`/api/leaves/${requestId}`, {
        status: "rejected",
        rejected_by: employee.id,
      });
      toast({ title: "Leave rejected" });
      fetchData();
    } catch (err: any) {
      toast({ title: "Failed", description: err.message, variant: "destructive" });
    }
  };

  const statusBadge = (s: string) => {
    switch (s) {
      case "approved": return <Badge className="bg-emerald-100 text-emerald-800">Approved</Badge>;
      case "approved_by_tl": return <Badge className="bg-blue-100 text-blue-800">TL Approved</Badge>;
      case "rejected": return <Badge variant="destructive">Rejected</Badge>;
      default: return <Badge variant="secondary">Pending</Badge>;
    }
  };

  return (
    <div className="p-6 space-y-6 max-w-5xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Leave Management</h1>
        <p className="text-sm text-muted-foreground">Apply for leaves and track your balance</p>
      </div>

      {/* Balance Card */}
      {balance && (
        <div className="grid sm:grid-cols-3 gap-4">
          <Card>
            <CardContent className="pt-4">
              <div className="text-sm text-muted-foreground mb-1">Paid Leave Available</div>
              <p className="text-3xl font-bold text-primary">{paidAvailable}</p>
              <p className="text-xs text-muted-foreground mt-1">
                Credited: {balance.paid_leave_credited} · Used: {balance.paid_leave_used}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="text-sm text-muted-foreground mb-1">Unpaid Leaves Taken</div>
              <p className="text-3xl font-bold text-amber-600">{balance.unpaid_leave_used}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="text-sm text-muted-foreground mb-1">Monthly Credits</div>
              <p className="text-3xl font-bold">1<span className="text-sm font-normal text-muted-foreground">/month</span></p>
              <p className="text-xs text-muted-foreground mt-1">Compiles if unused</p>
            </CardContent>
          </Card>
        </div>
      )}

      <Tabs defaultValue="apply">
        <TabsList>
          <TabsTrigger value="apply">Apply for Leave</TabsTrigger>
          <TabsTrigger value="history">My Requests</TabsTrigger>
          {isApprover && <TabsTrigger value="approvals">Approvals</TabsTrigger>}
        </TabsList>

        {/* Apply Tab */}
        <TabsContent value="apply">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Plus className="w-4 h-4 text-primary" />
                New Leave Request
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid sm:grid-cols-3 gap-4">
                <div>
                  <Label>Leave Type</Label>
                  <Select value={leaveType} onValueChange={setLeaveType}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="annual">Annual Leave</SelectItem>
                      <SelectItem value="sick">Sick Leave</SelectItem>
                      <SelectItem value="casual">Casual Leave</SelectItem>
                      <SelectItem value="unpaid">Unpaid Leave</SelectItem>
                      <SelectItem value="maternity">Maternity Leave</SelectItem>
                      <SelectItem value="paternity">Paternity Leave</SelectItem>
                      <SelectItem value="emergency">Emergency Leave</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Start Date</Label>
                  <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
                </div>
                <div>
                  <Label>End Date</Label>
                  <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} min={startDate} />
                </div>
              </div>
              {totalDays > 0 && (
                <p className="text-sm">
                  Total: <strong>{totalDays} day{totalDays > 1 ? "s" : ""}</strong>
                  {leaveType === "annual" && totalDays > paidAvailable && (
                    <span className="text-destructive ml-2">Exceeds available balance</span>
                  )}
                  {totalDays >= 3 && (
                    <span className="text-muted-foreground ml-2">(Requires Ops Head approval)</span>
                  )}
                </p>
              )}
              <div>
                <Label>Reason (optional)</Label>
                <Textarea value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Reason for leave..." />
              </div>
              <Button onClick={handleSubmit} disabled={loading || !startDate || !endDate || totalDays <= 0}>
                Submit Leave Request
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* History Tab */}
        <TabsContent value="history">
          <Card>
            <CardContent className="pt-4">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Type</TableHead>
                    <TableHead>Dates</TableHead>
                    <TableHead>Days</TableHead>
                    <TableHead>Reason</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {myRequests.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center text-muted-foreground">No leave requests</TableCell>
                    </TableRow>
                  ) : (
                    myRequests.map((r) => (
                      <TableRow key={r.id}>
                        <TableCell className="capitalize">{r.leave_type}</TableCell>
                        <TableCell className="text-xs">
                          {format(parseISO(r.start_date), "dd MMM")} — {format(parseISO(r.end_date), "dd MMM yyyy")}
                        </TableCell>
                        <TableCell>{r.total_days}</TableCell>
                        <TableCell className="text-xs max-w-[200px] truncate">{r.reason || "—"}</TableCell>
                        <TableCell>{statusBadge(r.status)}</TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Approvals Tab */}
        {isApprover && (
          <TabsContent value="approvals">
            <Card>
              <CardContent className="pt-4">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Employee</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Dates</TableHead>
                      <TableHead>Days</TableHead>
                      <TableHead>Reason</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {pendingApprovals.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={7} className="text-center text-muted-foreground">No pending approvals</TableCell>
                      </TableRow>
                    ) : (
                      pendingApprovals.map((r) => (
                        <TableRow key={r.id}>
                          <TableCell>
                            <p className="font-medium text-xs">{r.employees?.full_name}</p>
                            <p className="text-[10px] text-muted-foreground">{r.employees?.employee_code}</p>
                          </TableCell>
                          <TableCell className="capitalize">{r.leave_type}</TableCell>
                          <TableCell className="text-xs">
                            {format(parseISO(r.start_date), "dd MMM")} — {format(parseISO(r.end_date), "dd MMM")}
                          </TableCell>
                          <TableCell>{r.total_days}</TableCell>
                          <TableCell className="text-xs max-w-[150px] truncate">{r.reason || "—"}</TableCell>
                          <TableCell>{statusBadge(r.status)}</TableCell>
                          <TableCell>
                            <div className="flex gap-1">
                              <Button size="sm" variant="ghost" onClick={() => handleApprove(r)} className="text-emerald-600 h-7 px-2">
                                <CheckCircle className="w-3.5 h-3.5 mr-1" /> Approve
                              </Button>
                              <Button size="sm" variant="ghost" onClick={() => handleReject(r.id)} className="text-destructive h-7 px-2">
                                <XCircle className="w-3.5 h-3.5 mr-1" /> Reject
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}
