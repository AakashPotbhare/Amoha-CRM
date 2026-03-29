import { ReactNode, useState, useEffect } from "react";
import { Menu, Search } from "lucide-react";
import AppSidebar from "./AppSidebar";
import NotificationBell from "./NotificationBell";
import ChatWidget from "./ChatWidget";
import ThemeToggle from "./ThemeToggle";
import GlobalSearch from "./GlobalSearch";
import amohaLogo from "@/assets/amoha_logo.png";

export default function AppLayout({ children }: { children: ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);

  // Global Ctrl+K / Cmd+K shortcut
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key === "k") {
        e.preventDefault();
        setSearchOpen(true);
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  return (
    <div className="flex h-screen overflow-hidden">
      {/* ── Desktop sidebar: static left panel (md+) ── */}
      <div className="hidden md:flex md:flex-shrink-0">
        <AppSidebar />
      </div>

      {/* ── Mobile sidebar: overlay drawer (< md) ── */}
      {sidebarOpen && (
        <div className="md:hidden fixed inset-0 z-50 flex">
          {/* Dark backdrop — click to close */}
          <div
            className="absolute inset-0 bg-black/50"
            onClick={() => setSidebarOpen(false)}
            aria-hidden="true"
          />
          {/* Drawer panel — slides in from left */}
          <div className="relative z-10 flex h-full">
            <AppSidebar onClose={() => setSidebarOpen(false)} />
          </div>
        </div>
      )}

      {/* ── Right-side: header + main content ── */}
      <div className="flex-1 flex flex-col overflow-hidden min-w-0">
        <header className="flex items-center justify-between gap-1 border-b bg-card px-3 py-2 md:px-6 md:py-3 shadow-sm shrink-0">
          {/* Left side: hamburger (mobile only) + app name */}
          <div className="flex items-center gap-2">
            {/* Hamburger — mobile only */}
            <button
              className="md:hidden p-1.5 rounded-md hover:bg-muted transition-colors"
              onClick={() => setSidebarOpen(true)}
              aria-label="Open navigation menu"
            >
              <Menu className="w-5 h-5 text-muted-foreground" />
            </button>
            {/* App name/logo — shown on mobile between hamburger and right icons */}
            <div className="flex items-center gap-2 md:hidden">
              <img src={amohaLogo} alt="Amoha" className="h-7 w-7 object-contain shrink-0" />
              <span className="font-semibold text-sm tracking-tight text-foreground">
                RecruitHub
              </span>
            </div>
          </div>

          {/* Right side: search button | theme toggle | notification bell */}
          <div className="flex items-center gap-1">
            <button
              onClick={() => setSearchOpen(true)}
              className="p-1.5 rounded-md hover:bg-muted transition-colors"
              aria-label="Search (Ctrl+K)"
              title="Search (Ctrl+K)"
            >
              <Search className="w-5 h-5 text-muted-foreground" />
            </button>
            <ThemeToggle />
            <NotificationBell />
          </div>
        </header>

        <main className="flex-1 overflow-y-auto">
          {children}
        </main>
      </div>

      <ChatWidget />

      {/* Global search dialog */}
      <GlobalSearch open={searchOpen} onOpenChange={setSearchOpen} />
    </div>
  );
}
