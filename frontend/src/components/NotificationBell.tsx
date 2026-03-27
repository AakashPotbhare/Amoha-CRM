import { useState, useRef, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Bell, CheckCheck, X } from "lucide-react";
import { api } from "@/lib/api.client";

interface Notification {
  id: string;
  title: string;
  body: string | null;
  type: "info" | "success" | "warning" | "error";
  entity_type: string | null;
  entity_id: string | null;
  is_read: boolean;
  created_at: string;
}

function entityPath(entity_type: string | null): string {
  if (entity_type === "support_task") return "/my-queue";
  if (entity_type === "task")         return "/tasks/inbox";
  if (entity_type === "placement_offer") return "/placement-orders";
  return "/";
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1)  return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24)  return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

const TYPE_DOT: Record<string, string> = {
  info:    "bg-blue-500",
  success: "bg-green-500",
  warning: "bg-yellow-500",
  error:   "bg-red-500",
};

export default function NotificationBell() {
  const navigate = useNavigate();
  const [open, setOpen]                   = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount]     = useState(0);
  const ref = useRef<HTMLDivElement>(null);

  const fetchNotifications = useCallback(async () => {
    try {
      const res = await api.get<Notification[]>("/api/notifications");
      if (res.success && res.data) {
        setNotifications(res.data);
        setUnreadCount(res.data.filter((n) => !n.is_read).length);
      }
    } catch {
      // silently ignore — network issue shouldn't crash the app
    }
  }, []);

  // Initial fetch + 60s polling
  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 60_000);
    return () => clearInterval(interval);
  }, [fetchNotifications]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleOutside = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handleOutside);
    return () => document.removeEventListener("mousedown", handleOutside);
  }, []);

  const markRead = async (n: Notification) => {
    if (!n.is_read) {
      try {
        await api.patch(`/api/notifications/${n.id}/read`, {});
        setNotifications((prev) =>
          prev.map((x) => (x.id === n.id ? { ...x, is_read: true } : x))
        );
        setUnreadCount((c) => Math.max(0, c - 1));
      } catch { /* non-blocking */ }
    }
    setOpen(false);
    navigate(entityPath(n.entity_type));
  };

  const markAllRead = async () => {
    try {
      await api.patch("/api/notifications/read-all", {});
      setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
      setUnreadCount(0);
    } catch { /* non-blocking */ }
  };

  const dismissNotification = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    try {
      await api.delete(`/api/notifications/${id}`);
      setNotifications((prev) => prev.filter((n) => n.id !== id));
      setUnreadCount((prev) =>
        Math.max(0, prev - (notifications.find((n) => n.id === id && !n.is_read) ? 1 : 0))
      );
    } catch { /* non-blocking */ }
  };

  const clearAllNotifications = async () => {
    try {
      await api.delete("/api/notifications/all");
      setNotifications([]);
      setUnreadCount(0);
    } catch { /* non-blocking */ }
  };

  return (
    <div ref={ref} className="relative">
      {/* Bell button */}
      <button
        onClick={() => setOpen((o) => !o)}
        className="relative p-2 rounded-lg hover:bg-muted transition-colors"
        aria-label="Notifications"
      >
        <Bell className="h-5 w-5 text-muted-foreground" />
        {unreadCount > 0 && (
          <span className="absolute top-1 right-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white leading-none">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown */}
      {open && (
        <div className="absolute right-0 top-full mt-2 w-80 rounded-lg border border-border bg-popover shadow-xl z-50 overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-border px-4 py-3">
            <h3 className="text-sm font-semibold text-foreground">
              Notifications
              {unreadCount > 0 && (
                <span className="ml-2 rounded-full bg-red-100 px-1.5 py-0.5 text-[11px] font-medium text-red-600">
                  {unreadCount} unread
                </span>
              )}
            </h3>
            <div className="flex items-center gap-1">
              {unreadCount > 0 && (
                <button
                  onClick={markAllRead}
                  title="Mark all as read"
                  className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                >
                  <CheckCheck className="h-4 w-4" />
                </button>
              )}
              {notifications.length > 0 && (
                <button
                  onClick={clearAllNotifications}
                  title="Clear all notifications"
                  className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-destructive transition-colors text-[11px] font-medium px-1.5"
                >
                  Clear all
                </button>
              )}
              <button
                onClick={() => setOpen(false)}
                className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* List */}
          <div className="max-h-96 overflow-y-auto divide-y divide-border">
            {notifications.length === 0 ? (
              <p className="p-6 text-center text-sm text-muted-foreground">
                You're all caught up! 🎉
              </p>
            ) : (
              notifications.map((n) => (
                <div
                  key={n.id}
                  className={`relative flex gap-3 items-start px-4 py-3 hover:bg-muted/60 transition-colors group ${
                    !n.is_read ? "bg-blue-50/50 dark:bg-blue-950/20" : ""
                  }`}
                >
                  {/* Main clickable area */}
                  <button
                    onClick={() => markRead(n)}
                    className="flex gap-3 items-start flex-1 text-left min-w-0"
                  >
                    {/* Colour dot */}
                    <span
                      className={`mt-1.5 h-2 w-2 flex-shrink-0 rounded-full ${TYPE_DOT[n.type] ?? "bg-blue-500"} ${
                        n.is_read ? "opacity-30" : ""
                      }`}
                    />
                    <div className="min-w-0 flex-1">
                      <p
                        className={`text-sm leading-snug ${
                          n.is_read ? "text-muted-foreground" : "font-medium text-foreground"
                        }`}
                      >
                        {n.title}
                      </p>
                      {n.body && (
                        <p className="mt-0.5 text-xs text-muted-foreground line-clamp-2">
                          {n.body}
                        </p>
                      )}
                      <p className="mt-1 text-[11px] text-muted-foreground/70">
                        {timeAgo(n.created_at)}
                      </p>
                    </div>
                    {!n.is_read && (
                      <span className="mt-1.5 h-2 w-2 flex-shrink-0 rounded-full bg-blue-500" />
                    )}
                  </button>
                  {/* Dismiss button */}
                  <button
                    onClick={(e) => dismissNotification(e, n.id)}
                    title="Dismiss"
                    className="flex-shrink-0 mt-0.5 p-0.5 rounded opacity-0 group-hover:opacity-100 hover:bg-muted text-muted-foreground hover:text-foreground transition-all"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
