import { useState, useEffect } from "react";
import { api } from "@/lib/api.client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Megaphone, Cake, Calendar, Info } from "lucide-react";
import { format, parseISO, addDays, isSameDay } from "date-fns";

interface Notice {
  id: string;
  title: string;
  body: string | null;
  notice_type: string;
  created_at: string;
}

interface BirthdayEntry {
  full_name: string;
  dob: string;
  department: string;
}

interface EmployeeWithDob {
  full_name: string;
  dob: string | null;
  departments?: { name: string } | null;
}

const typeIcon: Record<string, any> = {
  general: Megaphone,
  event: Calendar,
  birthday: Cake,
  info: Info,
};

const typeColor: Record<string, string> = {
  general: "bg-primary/10 text-primary",
  event: "bg-info/20 text-info",
  birthday: "bg-warning/20 text-warning",
  info: "bg-muted text-muted-foreground",
};

export default function NoticeBoard() {
  const [notices, setNotices] = useState<Notice[]>([]);
  const [birthdays, setBirthdays] = useState<BirthdayEntry[]>([]);

  useEffect(() => {
    fetchNotices();
    fetchUpcomingBirthdays();
  }, []);

  const fetchNotices = async () => {
    const res = await api.get<Notice[]>("/api/hr/notices?is_active=true&limit=10");
    if (res.success && res.data) setNotices(res.data);
  };

  const fetchUpcomingBirthdays = async () => {
    const res = await api.get<EmployeeWithDob[]>("/api/employees?is_active=true&has_dob=true");
    if (!res.success || !res.data) return;

    const today = new Date();
    const tomorrow = addDays(today, 1);

    const upcoming = res.data
      .filter((emp) => {
        if (!emp.dob) return false;
        const dob = parseISO(emp.dob);
        const dobThisYear = new Date(today.getFullYear(), dob.getMonth(), dob.getDate());
        return isSameDay(dobThisYear, today) || isSameDay(dobThisYear, tomorrow);
      })
      .map((emp) => ({
        full_name: emp.full_name,
        dob: emp.dob!,
        department: emp.departments?.name || "",
      }));

    setBirthdays(upcoming);
  };

  if (notices.length === 0 && birthdays.length === 0) return null;

  return (
    <Card className="border-primary/20">
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Megaphone className="w-4 h-4 text-primary" />
          Notice Board
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Birthday alerts */}
        {birthdays.map((b, i) => {
          const dob = parseISO(b.dob);
          const today = new Date();
          const isToday = dob.getMonth() === today.getMonth() && dob.getDate() === today.getDate();
          return (
            <div key={`bday-${i}`} className="flex items-start gap-3 p-3 rounded-lg bg-warning/10 border border-warning/20">
              <Cake className="w-5 h-5 text-warning mt-0.5 shrink-0" />
              <div>
                <p className="text-sm font-medium text-foreground">
                  {isToday ? "Happy Birthday" : "Upcoming Birthday"}: {b.full_name}
                </p>
                <p className="text-xs text-muted-foreground">
                  {b.department} · {isToday ? "Today!" : "Tomorrow"}
                </p>
              </div>
            </div>
          );
        })}

        {/* Regular notices */}
        {notices.map((notice) => {
          const Icon = typeIcon[notice.notice_type] || Megaphone;
          const color = typeColor[notice.notice_type] || typeColor.general;
          return (
            <div key={notice.id} className="flex items-start gap-3 p-3 rounded-lg bg-muted/50 border border-border">
              <div className={`p-1.5 rounded-md ${color} shrink-0`}>
                <Icon className="w-4 h-4" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-medium text-foreground">{notice.title}</p>
                  <Badge variant="outline" className="text-[10px] shrink-0">
                    {format(parseISO(notice.created_at), "dd MMM")}
                  </Badge>
                </div>
                {notice.body && (
                  <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{notice.body}</p>
                )}
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
