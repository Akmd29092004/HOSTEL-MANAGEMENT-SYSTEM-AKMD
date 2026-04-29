import { useEffect, useState } from "react";
import api from "../lib/api";
import { useAuth } from "../context/AuthContext";
import PageHeader from "../components/PageHeader";
import { Card } from "../components/ui/card";
import {
  Users, BedDouble, IndianRupee, MessageSquareWarning,
  UserCog, Building2, CheckCircle2, AlertCircle,
} from "lucide-react";

const ADMIN_TILES = [
  { key: "students", label: "Students", icon: Users, color: "bg-blue-50 text-blue-700" },
  { key: "rooms", label: "Total Rooms", icon: BedDouble, color: "bg-amber-50 text-amber-700" },
  { key: "occupied_rooms", label: "Occupied Rooms", icon: Building2, color: "bg-emerald-50 text-emerald-700" },
  { key: "staff", label: "Staff", icon: UserCog, color: "bg-slate-50 text-slate-700" },
  { key: "pending_fees", label: "Pending Fees", icon: IndianRupee, color: "bg-rose-50 text-rose-700" },
  { key: "open_complaints", label: "Open Complaints", icon: MessageSquareWarning, color: "bg-orange-50 text-orange-700" },
];

export default function Dashboard() {
  const { user } = useAuth();
  const [stats, setStats] = useState({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .get("/dashboard/stats")
      .then((r) => setStats(r.data))
      .finally(() => setLoading(false));
  }, []);

  if (user.role === "student") {
    return (
      <div className="p-8 max-w-6xl mx-auto">
        <PageHeader
          title={`Welcome, ${user.name.split(" ")[0]}`}
          subtitle="Here's a quick overview of your hostel life."
        />
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
          <StudentTile
            label="My Room"
            value={stats.room_no || "—"}
            icon={BedDouble}
            color="bg-blue-50 text-blue-700"
          />
          <StudentTile
            label="Pending Fees"
            value={stats.pending_fees ?? "—"}
            icon={IndianRupee}
            color="bg-rose-50 text-rose-700"
          />
          <StudentTile
            label="Open Complaints"
            value={stats.open_complaints ?? "—"}
            icon={MessageSquareWarning}
            color="bg-orange-50 text-orange-700"
          />
          <StudentTile
            label="Attendance"
            value={`${stats.attendance_pct ?? 0}%`}
            icon={CheckCircle2}
            color="bg-emerald-50 text-emerald-700"
          />
        </div>
        <Card className="mt-8 p-6">
          <h3 className="font-display font-semibold text-lg">Quick tips</h3>
          <ul className="mt-3 text-sm text-muted-foreground list-disc list-inside space-y-1">
            <li>Pay pending fees on time to avoid penalties.</li>
            <li>Raise complaints early — wardens respond faster on tracked tickets.</li>
            <li>Check the weekly menu for today's mess.</li>
          </ul>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <PageHeader
        title={`${user.role === "admin" ? "Administrator" : "Warden"} Dashboard`}
        subtitle="A quick snapshot of your hostel."
      />
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6" data-testid="dashboard-stats">
        {ADMIN_TILES.map((t) => (
          <Card key={t.key} className="p-6 border bg-card">
            <div className="flex items-start justify-between">
              <div>
                <div className="text-sm text-muted-foreground">{t.label}</div>
                <div
                  className="font-display font-bold text-3xl mt-2 tracking-tight"
                  data-testid={`stat-${t.key}`}
                >
                  {loading ? "—" : (stats[t.key] ?? 0)}
                </div>
              </div>
              <div className={`size-11 rounded-md flex items-center justify-center ${t.color}`}>
                <t.icon className="size-5" />
              </div>
            </div>
          </Card>
        ))}
      </div>
      {!loading && stats.open_complaints > 0 && (
        <Card className="mt-8 p-5 border-l-4 border-l-orange-500 bg-orange-50/50">
          <div className="flex items-start gap-3">
            <AlertCircle className="size-5 text-orange-700 mt-0.5" />
            <div>
              <div className="font-medium text-orange-900">
                {stats.open_complaints} open complaint{stats.open_complaints > 1 ? "s" : ""}
              </div>
              <div className="text-sm text-orange-800/80">
                Visit the Complaints page to review and respond.
              </div>
            </div>
          </div>
        </Card>
      )}
    </div>
  );
}

function StudentTile({ label, value, icon: Icon, color }) {
  return (
    <Card className="p-6">
      <div className="flex items-start justify-between">
        <div>
          <div className="text-sm text-muted-foreground">{label}</div>
          <div className="font-display font-bold text-2xl mt-2">{value}</div>
        </div>
        <div className={`size-10 rounded-md flex items-center justify-center ${color}`}>
          <Icon className="size-5" />
        </div>
      </div>
    </Card>
  );
}
