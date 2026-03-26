import { ReactNode } from "react";
import AppSidebar from "./AppSidebar";
import NotificationBell from "./NotificationBell";
import ChatWidget from "./ChatWidget";
import ThemeToggle from "./ThemeToggle";

export default function AppLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex h-screen overflow-hidden">
      <AppSidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        <header className="flex items-center justify-end gap-1 border-b bg-card px-6 py-2 shadow-sm">
          <ThemeToggle />
          <NotificationBell />
        </header>
        <main className="flex-1 overflow-y-auto">
          {children}
        </main>
      </div>
      <ChatWidget />
    </div>
  );
}
