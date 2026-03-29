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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { Plus, CheckCircle, XCircle, Pencil, Trash2 } from "lucide-react";
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
  employee_name?: string;
  employee_code?: string;
  tl_approved_by_name?: string | null;
  employees?: { full_name: string; employee_code: string };
}

function normalizeLeaveRequest(request: any): LeaveRequest {
  const startDate = request.start_date ?? request.from_date;
  const endDate = request.end_date ?? request.to_date;

  return {
    id: request.id,
    employee_id: request.employee_id,
    leave_type: request.leave_type,
    start_date: startDate,
    end_date: endDate,
    total_days:
      typeof request.total_days === "number"
        ? request.total_days
        : differenceInCalendarDays(parseISO(endDate), parseISO(startDate)) + 1,
    reason: request.reason ?? null,
    status: request.status,
    created_at: request.created_at,
    approved_by_tl: request.approved_by_tl ?? null,
    approved_by_manager: request.approved_by_manager ?? request.approved_by ?? null,
    rejected_by: request.rejected_by ?? null,
    rejection_reason: request.rejection_reason ?? null,
    employee_name: request.employee_name,
    employee_code: request.employee_code,
    tl_approved_by_name: request.tl_approved_by_name ?? null,
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

  // Apply form state
  const [leaveType, setLeaveType] = useState<string>("casual");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [reason, setReason] = useState("");

  // Edit dialog state
  const [editTarget, setEditTarget] = useState<LeaveRequest | null>(null);
  const [editLeaveType, setEditLeaveType] = useState<string>("casual");
  const [editFromDate, setEditFromDate] = useState("");
  const [editToDate, setEditToDate] = useState("");
  const [editReason, setEditReason] = useState("");
  const [editLoading, setEditLoading] = useState(false);

  // Withdraw confirmation state
  const [withdrawTarget, setWithdrawTarget] = useState<LeaveRequest | null>(null);
  const [withdrawLoading, setWithdrawLoading] = useState(false);

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
      const isManagerApprover = ["director", "ops_head", "hr_head"].includes(employee.role);
      const pendingRes = await api.get<LeaveRequest[]>(
        isManagerApprover ? "/api/leaves/pending-manager" : "/api/leaves/pending-tl"
      );
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

    if (leaveType === "paid" && totalDays > paidAvailable) {
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
        from_date: startDate,
        to_date: endDate,
        total_days: totalDays,
        reason: reason.trim(),
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

    try {
      if (isTL) {
        await api.patch(`/api/leaves/${request.id}/approve-tl`, {});
      } else {
        await api.patch(`/api/leaves/${request.id}/approve-manager`, {});
      }
      toast({ title: "Leave approved" });
      fetchData();
    } catch (err: any) {
      toast({ title: "Failed to approve", description: err.message, variant: "destructive" });
    }
  };

  const handleReject = async (requestId: string) => {
    if (!employee) return;
    try {
      await api.patch(`/api/leaves/${requestId}/reject`, { reason: "" });
      toast({ title: "Leave rejected" });
      fetchData();
    } catch (err: any) {
      toast({ title: "Failed", description: err.message, variant: "destructive" });
    }
  };

  // Open edit dialog and pre-populate fields
  const openEditDialog = (r: LeaveRequest) => {
    setEditTarget(r);
    setEditLeaveType(r.leave_type);
    setEditFromDate(r.start_date);
    setEditToDate(r.end_date);
    setEditReason(r.reason ?? "");
  };

  const closeEditDialog = () => {
    setEditTarget(null);
  };

  const editTotalDays =
    editFromDate && editToDate
      ? Math.max(differenceInCalendarDays(new Date(editToDate), new Date(editFromDate)) + 1, 0)
      : 0;

  const handleEditSave = async () => {
    if (!editTarget || !editFromDate || !editToDate || editTotalDays <= 0) return;
    setEditLoading(true);
    try {
      const res = await api.patch(`/api/leaves/${editTarget.id}`, {
        leave_type: editLeaveType,
        from_date: editFromDate,
        to_date: editToDate,
        total_days: editTotalDays,
        reason: editReason.trim() || null,
      });
      if ((res as any)?.success === false) {
        throw new Error((res as any).error ?? "Failed to update");
      }
      toast({ title: "Leave request updated" });
      closeEditDialog();
      fetchData();
    } catch (err: any) {
      toast({ title: "Failed to update", description: err.message, variant: "destructive" });
    }
    setEditLoading(false);
  };

  // Withdraw (delete) pending leave
  const openWithdrawDialog = (r: LeaveRequest) => {
    setWithdrawTarget(r);
  };

  const closeWithdrawDialog = () => {
    setWithdrawTarget(null);
  };

  const handleWithdrawConfirm = async () => {
    if (!withdrawTarget) return;
    setWithdrawLoading(true);
    try {
      const res = await api.delete(`/api/leaves/${withdrawTarget.id}`);
      if ((res as any)?.success === false) {
        throw new Error((res as any).error ?? "Failed to withdraw");
      }
      toast({ title: "Leave request withdrawn" });
      closeWithdrawDialog();
      fetchData();
    } catch (err: any) {
      toast({ title: "Failed to withdraw", description: err.message, variant: "destructive" });
    }
    setWithdrawLoading(false);
  };

  const statusBadge = (s: string) => {
    switch (s) {
      case "approved": return <Badge className="bg-emerald-100 text-emerald-800">Approved</Badge>;
      case "tl_approved": return <Badge className="bg-blue-100 text-blue-800">TL Approved</Badge>;
      case "rejected": return <Badge variant="destructive">Rejected</Badge>;
      default: return <Badge variant="secondary">Pending</Badge>;
    }
  };

  return (
    <div className="p-3 sm:p-6 space-y-6 max-w-5xl mx-auto">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between mb-4 md:mb-6">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-foreground">Leave Management</h1>
          <p className="text-sm text-muted-foreground">Apply for leaves and track your balance</p>
        </div>
      </div>

      {/* Balance Card */}
      {balance && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
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
        <div className="overflow-x-auto pb-1">
          <TabsList className="flex w-max min-w-full">
            <TabsTrigger value="apply" className="whitespace-nowrap">Apply for Leave</TabsTrigger>
            <TabsTrigger value="history" className="whitespace-nowrap">My Requests</TabsTrigger>
            {isApprover && <TabsTrigger value="approvals" className="whitespace-nowrap">Approvals</TabsTrigger>}
          </TabsList>
        </div>

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
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <Label>Leave Type</Label>
                  <Select value={leaveType} onValueChange={setLeaveType}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="casual">Casual Leave</SelectItem>
                      <SelectItem value="paid">Paid Leave</SelectItem>
                      <SelectItem value="sick">Sick Leave</SelectItem>
                      <SelectItem value="unpaid">Unpaid Leave</SelectItem>
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
                  {leaveType === "paid" && totalDays > paidAvailable && (
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
              <Button onClick={handleSubmit} disabled={loading || !startDate || !endDate || totalDays <= 0} className="w-full sm:w-auto">
                Submit Leave Request
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* My Requests Tab */}
        <TabsContent value="history">
          <Card>
            <CardContent className="pt-4">
              <div className="overflow-x-auto rounded-lg border">
              <Table className="min-w-[680px]">
                <TableHeader>
                  <TableRow>
                    <TableHead>Type</TableHead>
                    <TableHead>Dates</TableHead>
                    <TableHead>Days</TableHead>
                    <TableHead>Reason</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {myRequests.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center text-muted-foreground">No leave requests</TableCell>
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
                        <TableCell>
                          {r.status === "pending" && (
                            <div className="flex gap-1">
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-7 px-2 text-blue-600 hover:text-blue-700"
                                onClick={() => openEditDialog(r)}
                              >
                                <Pencil className="w-3.5 h-3.5 mr-1" />
                                <span className="hidden sm:inline">Edit</span>
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-7 px-2 text-destructive hover:text-destructive"
                                onClick={() => openWithdrawDialog(r)}
                              >
                                <Trash2 className="w-3.5 h-3.5 mr-1" />
                                <span className="hidden sm:inline">Withdraw</span>
                              </Button>
                            </div>
                          )}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Approvals Tab */}
        {isApprover && (
          <TabsContent value="approvals">
            <Card>
              <CardContent className="pt-4">
                <div className="overflow-x-auto rounded-lg border">
                <Table className="min-w-[700px]">
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
                            <p className="font-medium text-xs">{r.employee_name ?? r.employees?.full_name}</p>
                            <p className="text-[10px] text-muted-foreground">{r.employee_code ?? r.employees?.employee_code}</p>
                          </TableCell>
                          <TableCell className="capitalize">{r.leave_type}</TableCell>
                          <TableCell className="text-xs">
                            {format(parseISO(r.start_date), "dd MMM")} — {format(parseISO(r.end_date), "dd MMM")}
                          </TableCell>
                          <TableCell>{r.total_days}</TableCell>
                          <TableCell className="text-xs max-w-[150px] truncate">{r.reason || "—"}</TableCell>
                          <TableCell>{statusBadge(r.status)}</TableCell>
                          <TableCell>
                            <div className="flex flex-wrap gap-1">
                              <Button size="sm" variant="ghost" onClick={() => handleApprove(r)} className="text-emerald-600 h-7 px-2">
                                <CheckCircle className="w-3.5 h-3.5 mr-1" /><span className="hidden sm:inline">Approve</span>
                              </Button>
                              <Button size="sm" variant="ghost" onClick={() => handleReject(r.id)} className="text-destructive h-7 px-2">
                                <XCircle className="w-3.5 h-3.5 mr-1" /><span className="hidden sm:inline">Reject</span>
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        )}
      </Tabs>

      {/* Edit Dialog */}
      <Dialog open={!!editTarget} onOpenChange={(open) => { if (!open) closeEditDialog(); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Leave Request</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label>Leave Type</Label>
              <Select value={editLeaveType} onValueChange={setEditLeaveType}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="casual">Casual Leave</SelectItem>
                  <SelectItem value="paid">Paid Leave</SelectItem>
                  <SelectItem value="sick">Sick Leave</SelectItem>
                  <SelectItem value="unpaid">Unpaid Leave</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>From Date</Label>
                <Input
                  type="date"
                  value={editFromDate}
                  onChange={(e) => setEditFromDate(e.target.value)}
                />
              </div>
              <div>
                <Label>To Date</Label>
                <Input
                  type="date"
                  value={editToDate}
                  onChange={(e) => setEditToDate(e.target.value)}
                  min={editFromDate}
                />
              </div>
            </div>
            {editTotalDays > 0 && (
              <p className="text-sm text-muted-foreground">
                Total: <strong>{editTotalDays} day{editTotalDays > 1 ? "s" : ""}</strong>
              </p>
            )}
            <div>
              <Label>Reason (optional)</Label>
              <Textarea
                value={editReason}
                onChange={(e) => setEditReason(e.target.value)}
                placeholder="Reason for leave..."
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={closeEditDialog} disabled={editLoading}>
              Cancel
            </Button>
            <Button
              onClick={handleEditSave}
              disabled={editLoading || !editFromDate || !editToDate || editTotalDays <= 0}
            >
              {editLoading ? "Saving..." : "Save Changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Withdraw Confirmation Dialog */}
      <AlertDialog open={!!withdrawTarget} onOpenChange={(open) => { if (!open) closeWithdrawDialog(); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Withdraw this leave request?</AlertDialogTitle>
            <AlertDialogDescription>
              {withdrawTarget && (
                <>
                  This will permanently remove your{" "}
                  <strong className="capitalize">{withdrawTarget.leave_type}</strong> leave request
                  from{" "}
                  <strong>{format(parseISO(withdrawTarget.start_date), "dd MMM yyyy")}</strong> to{" "}
                  <strong>{format(parseISO(withdrawTarget.end_date), "dd MMM yyyy")}</strong>.
                  This action cannot be undone.
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={withdrawLoading}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleWithdrawConfirm}
              disabled={withdrawLoading}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {withdrawLoading ? "Withdrawing..." : "Yes, Withdraw"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
