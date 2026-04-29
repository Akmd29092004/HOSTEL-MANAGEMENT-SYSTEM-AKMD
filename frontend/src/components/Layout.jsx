import { NavLink, useNavigate, Outlet } from "react-router-dom";
import {
  LayoutDashboard, Users, BedDouble, IndianRupee, UserCog,
  CalendarCheck2, MessageSquareWarning, UtensilsCrossed,
  LogOut, Building2, User, FileDown,
} from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { API_BASE } from "../lib/api";

const NAV = {
  admin: [
    { to: "/admin", end: true, icon: LayoutDashboard, label: "Dashboard" },
    { to: "/admin/students", icon: Users, label: "Students" },
    { to: "/admin/rooms", icon: BedDouble, label: "Rooms" },
    { to: "/admin/fees", icon: IndianRupee, label: "Fees" },
    { to: "/admin/staff", icon: UserCog, label: "Staff" },
    { to: "/admin/attendance", icon: CalendarCheck2, label: "Attendance" },
    { to: "/admin/complaints", icon: MessageSquareWarning, label: "Complaints" },
    { to: "/admin/food", icon: UtensilsCrossed, label: "Hostel Food" },
  ],
  staff: [
    { to: "/staff", end: true, icon: LayoutDashboard, label: "Dashboard" },
    { to: "/staff/students", icon: Users, label: "Students" },
    { to: "/staff/rooms", icon: BedDouble, label: "Rooms" },
    { to: "/staff/attendance", icon: CalendarCheck2, label: "Attendance" },
    { to: "/staff/complaints", icon: MessageSquareWarning, label: "Complaints" },
    { to: "/staff/food", icon: UtensilsCrossed, label: "Hostel Food" },
  ],
  student: [
    { to: "/student", end: true, icon: LayoutDashboard, label: "Dashboard" },
    { to: "/student/profile", icon: User, label: "My Profile" },
    { to: "/student/room", icon: BedDouble, label: "My Room" },
    { to: "/student/fees", icon: IndianRupee, label: "My Fees" },
    { to: "/student/attendance", icon: CalendarCheck2, label: "My Attendance" },
    { to: "/student/complaints", icon: MessageSquareWarning, label: "Complaints" },
    { to: "/student/food", icon: UtensilsCrossed, label: "Hostel Food" },
  ],
};

const ROLE_LABEL = {
  admin: "Administrator",
  staff: "Warden",
  student: "Student",
};

export default function Layout() {
  const { user, logout } = useAuth();
  const nav = useNavigate();
  const items = NAV[user.role] || [];

  const handleLogout = async () => {
    await logout();
    nav("/login");
  };

  return (
    <div className="min-h-screen flex bg-background">
      {/* Sidebar */}
      <aside
        className="w-64 shrink-0 bg-sidebar text-sidebar-foreground flex flex-col border-r border-sidebar-border"
        data-testid="app-sidebar"
      >
        <div className="px-6 py-6 border-b border-sidebar-border">
          <div className="flex items-center gap-3">
            <div className="size-10 rounded-lg bg-primary text-primary-foreground flex items-center justify-center">
              <Building2 className="size-5" />
            </div>
            <div>
              <div className="font-display font-bold text-lg leading-none">Hostel</div>
              <div className="text-[11px] uppercase tracking-widest text-white/50 mt-1">
                Management System
              </div>
            </div>
          </div>
        </div>

        <nav className="flex-1 py-4 px-3 space-y-1">
          {items.map((it) => (
            <NavLink
              key={it.to}
              to={it.to}
              end={it.end}
              data-testid={`nav-${it.label.toLowerCase().replace(/\s+/g, "-")}`}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-md text-sm transition-colors ${
                  isActive
                    ? "bg-sidebar-accent text-white border-l-4 border-primary pl-2"
                    : "text-white/70 hover:bg-sidebar-accent hover:text-white"
                }`
              }
            >
              <it.icon className="size-4 shrink-0" />
              <span>{it.label}</span>
            </NavLink>
          ))}
        </nav>

        <div className="p-3 border-t border-sidebar-border space-y-2">
          <a
            href={`${API_BASE}/project-report.pdf`}
            target="_blank"
            rel="noreferrer"
            data-testid="download-report-btn"
            className="flex items-center gap-3 px-3 py-2.5 rounded-md text-sm text-white/70 hover:bg-sidebar-accent hover:text-white transition-colors"
          >
            <FileDown className="size-4" />
            <span>Project Report</span>
          </a>
          <div className="px-3 py-2 rounded-md bg-sidebar-accent">
            <div className="text-xs text-white/60">{ROLE_LABEL[user.role]}</div>
            <div className="text-sm font-medium truncate">{user.name}</div>
            <div className="text-xs text-white/50 truncate">{user.email}</div>
          </div>
          <button
            onClick={handleLogout}
            data-testid="logout-btn"
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-md text-sm text-white/70 hover:bg-red-500/10 hover:text-red-300 transition-colors"
          >
            <LogOut className="size-4" />
            <span>Logout</span>
          </button>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 min-w-0 overflow-x-hidden">
        <Outlet />
      </main>
    </div>
  );
}
