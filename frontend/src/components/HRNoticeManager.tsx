import { useState, useEffect, useCallback } from "react";
import { api } from "@/lib/api.client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Plus, Trash2, Megaphone } from "lucide-react";
import { format, parseISO } from "date-fns";

interface Notice {
  id: string;
  title: string;
  body: string | null;
  notice_type: string;
  is_active: boolean;
  created_at: string;
  expires_at: string | null;
}

export default function HRNoticeManager() {
  const { employee } = useAuth();
  const { toast } = useToast();
  const [notices, setNotices] = useState<Notice[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [noticeType, setNoticeType] = useState("general");
  const [loading, setLoading] = useState(false);

  const fetchNotices = useCallback(async () => {
    const res = await api.get<Notice[]>("/api/hr/notices");
    if (res.success && res.data) setNotices(res.data);
  }, []);

  useEffect(() => { fetchNotices(); }, [fetchNotices]);

  const handleCreate = async () => {
    if (!title.trim() || !employee) return;
    setLoading(true);

    try {
      await api.post("/api/hr/notices", {
        title: title.trim(),
        body: body.trim() || null,
        notice_type: noticeType,
        created_by: employee.id,
      });
      toast({ title: "Notice published" });
      setTitle(""); setBody(""); setNoticeType("general");
      setDialogOpen(false);
      fetchNotices();
    } catch (err: any) {
      toast({ title: "Failed", description: err.message, variant: "destructive" });
    }
    setLoading(false);
  };

  const toggleActive = async (notice: Notice) => {
    await api.patch(`/api/hr/notices/${notice.id}`, { is_active: !notice.is_active }).catch(() => {});
    fetchNotices();
  };

  const deleteNotice = async (id: string) => {
    await api.delete(`/api/hr/notices/${id}`).catch(() => {});
    fetchNotices();
    toast({ title: "Notice deleted" });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-foreground flex items-center gap-2">
          <Megaphone className="w-5 h-5 text-primary" /> Notice Board Management
        </h3>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button size="sm" className="gap-2"><Plus className="w-4 h-4" /> New Notice</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Create Notice</DialogTitle></DialogHeader>
            <div className="space-y-4 pt-2">
              <div>
                <Label>Title *</Label>
                <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Notice title" maxLength={200} />
              </div>
              <div>
                <Label>Body</Label>
                <Textarea value={body} onChange={(e) => setBody(e.target.value)} placeholder="Notice details..." rows={3} maxLength={1000} />
              </div>
              <div>
                <Label>Type</Label>
                <Select value={noticeType} onValueChange={setNoticeType}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="general">General</SelectItem>
                    <SelectItem value="event">Event</SelectItem>
                    <SelectItem value="info">Info</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button onClick={handleCreate} disabled={loading || !title.trim()} className="w-full">
                Publish Notice
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardContent className="pt-4">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Title</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {notices.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground">No notices yet</TableCell>
                </TableRow>
              ) : notices.map((n) => (
                <TableRow key={n.id}>
                  <TableCell>
                    <p className="text-sm font-medium">{n.title}</p>
                    {n.body && <p className="text-xs text-muted-foreground line-clamp-1">{n.body}</p>}
                  </TableCell>
                  <TableCell><Badge variant="outline" className="text-xs capitalize">{n.notice_type}</Badge></TableCell>
                  <TableCell className="text-xs">{format(parseISO(n.created_at), "dd MMM yyyy")}</TableCell>
                  <TableCell>
                    <Badge className={n.is_active ? "bg-emerald-100 text-emerald-800" : "bg-muted text-muted-foreground"}>
                      {n.is_active ? "Active" : "Inactive"}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button size="sm" variant="ghost" onClick={() => toggleActive(n)} className="h-7 px-2 text-xs">
                        {n.is_active ? "Hide" : "Show"}
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => deleteNotice(n.id)} className="h-7 px-2 text-destructive">
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
