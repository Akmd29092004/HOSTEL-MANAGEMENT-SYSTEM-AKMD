import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Building2, Loader2 } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Tabs, TabsList, TabsTrigger } from "../components/ui/tabs";
import { toast } from "sonner";

const HERO_URL =
  "https://images.unsplash.com/photo-1564273795917-fe399b763988?crop=entropy&cs=srgb&fm=jpg&ixid=M3w4NjAzMzV8MHwxfHNlYXJjaHwzfHxzdHVkZW50JTIwZG9ybSUyMHJvb218ZW58MHx8fHwxNzc3NDc3NDQxfDA&ixlib=rb-4.1.0&q=85";

const PRESETS = {
  admin: { email: "admin@hostel.edu", password: "admin123" },
  staff: { email: "warden@hostel.edu", password: "warden123" },
  student: { email: "student@hostel.edu", password: "student123" },
};

export default function Login() {
  const [role, setRole] = useState("admin");
  const [email, setEmail] = useState(PRESETS.admin.email);
  const [password, setPassword] = useState(PRESETS.admin.password);
  const [busy, setBusy] = useState(false);
  const { login } = useAuth();
  const nav = useNavigate();

  const handleRoleChange = (r) => {
    setRole(r);
    setEmail(PRESETS[r].email);
    setPassword(PRESETS[r].password);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      const u = await login(email.trim(), password);
      toast.success(`Welcome, ${u.name}`);
      nav(`/${u.role}`, { replace: true });
    } catch (err) {
      const detail = err?.response?.data?.detail;
      const msg = typeof detail === "string" ? detail : "Login failed. Check your credentials.";
      toast.error(msg);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen grid lg:grid-cols-2 bg-background">
      {/* Hero side */}
      <div className="relative hidden lg:block bg-sidebar overflow-hidden">
        <img
          src={HERO_URL}
          alt="Hostel"
          className="absolute inset-0 w-full h-full object-cover opacity-40"
        />
        <div className="absolute inset-0 bg-gradient-to-br from-[#0c1733]/90 via-[#0c1733]/60 to-transparent" />
        <div className="relative z-10 h-full flex flex-col justify-between p-12 text-white">
          <div className="flex items-center gap-3">
            <div className="size-11 rounded-lg bg-primary flex items-center justify-center">
              <Building2 className="size-5" />
            </div>
            <div>
              <div className="font-display font-bold text-xl leading-none">Hostel</div>
              <div className="text-[11px] uppercase tracking-widest text-white/60 mt-1">
                Management System
              </div>
            </div>
          </div>

          <div className="max-w-md">
            <h1 className="font-display font-black text-5xl leading-[1.05] tracking-tight">
              Run your hostel like clockwork.
            </h1>
            <p className="mt-6 text-white/70 text-base leading-relaxed">
              One unified portal for administrators, wardens and students. Manage
              rooms, fees, attendance, complaints and the weekly mess menu — all
              in one place.
            </p>
            <div className="mt-10 grid grid-cols-3 gap-6 text-sm">
              {[
                ["Students", "Profiles & rooms"],
                ["Fees", "Bills & ledger"],
                ["Mess", "Weekly menu"],
              ].map(([t, s]) => (
                <div key={t}>
                  <div className="font-display font-bold text-white">{t}</div>
                  <div className="text-white/50 text-xs mt-1">{s}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="text-xs text-white/40">
            © {new Date().getFullYear()} Hostel Management System. College project edition.
          </div>
        </div>
      </div>

      {/* Form side */}
      <div className="flex items-center justify-center p-6 sm:p-12">
        <div className="w-full max-w-md">
          <div className="lg:hidden mb-8 flex items-center gap-3">
            <div className="size-10 rounded-lg bg-primary text-primary-foreground flex items-center justify-center">
              <Building2 className="size-5" />
            </div>
            <div className="font-display font-bold text-xl">Hostel Management</div>
          </div>

          <h2 className="font-display font-bold text-3xl tracking-tight">Sign in</h2>
          <p className="text-muted-foreground text-sm mt-2">
            Choose your role and continue with your credentials.
          </p>

          <Tabs value={role} onValueChange={handleRoleChange} className="mt-6">
            <TabsList className="grid grid-cols-3 w-full" data-testid="role-tabs">
              <TabsTrigger value="admin" data-testid="role-tab-admin">
                Admin
              </TabsTrigger>
              <TabsTrigger value="staff" data-testid="role-tab-staff">
                Warden
              </TabsTrigger>
              <TabsTrigger value="student" data-testid="role-tab-student">
                Student
              </TabsTrigger>
            </TabsList>
          </Tabs>

          <form onSubmit={handleSubmit} className="mt-6 space-y-4" data-testid="login-form">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@hostel.edu"
                required
                data-testid="login-email-input"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                data-testid="login-password-input"
              />
            </div>
            <Button
              type="submit"
              className="w-full h-11"
              disabled={busy}
              data-testid="login-submit-btn"
            >
              {busy ? (
                <>
                  <Loader2 className="size-4 mr-2 animate-spin" /> Signing in...
                </>
              ) : (
                "Sign in"
              )}
            </Button>
          </form>

          <div className="mt-6 p-4 rounded-md bg-muted/60 border text-xs text-muted-foreground">
            <div className="font-medium text-foreground mb-1">Default admin credentials</div>
            admin@hostel.edu / admin123
            <div className="mt-2 text-[11px]">
              Staff and student accounts must be created by the admin from the dashboard.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
