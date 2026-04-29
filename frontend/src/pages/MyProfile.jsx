import { useEffect, useState } from "react";
import api from "../lib/api";
import PageHeader from "../components/PageHeader";
import { Card } from "../components/ui/card";
import { User, Mail, Phone, GraduationCap, Calendar, MapPin } from "lucide-react";

export default function MyProfile() {
  const [s, setS] = useState(null);
  useEffect(() => {
    api.get("/me/profile").then((r) => setS(r.data)).catch(() => setS(false));
  }, []);

  if (s === null) return <div className="p-8 text-muted-foreground">Loading...</div>;
  if (s === false)
    return <div className="p-8 text-muted-foreground">Profile not found.</div>;

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <PageHeader title="My Profile" subtitle="Your hostel registration details." />
      <Card className="p-8">
        <div className="flex items-center gap-5 pb-6 border-b">
          <div className="size-20 rounded-full bg-primary/10 text-primary flex items-center justify-center">
            <User className="size-9" />
          </div>
          <div>
            <div className="font-display font-bold text-2xl">{s.name}</div>
            <div className="text-muted-foreground">{s.roll_no}</div>
          </div>
        </div>
        <div className="grid sm:grid-cols-2 gap-6 mt-6">
          <Info icon={Mail} label="Email" value={s.email} />
          <Info icon={Phone} label="Phone" value={s.phone || "—"} />
          <Info icon={GraduationCap} label="Course" value={`${s.course || "—"} · Year ${s.year || "—"}`} />
          <Info icon={Calendar} label="Admission" value={
            s.admission_date ? new Date(s.admission_date).toLocaleDateString() : "—"
          } />
          <Info icon={User} label="Parent" value={s.parent_name || "—"} />
          <Info icon={Phone} label="Parent phone" value={s.parent_phone || "—"} />
          <div className="sm:col-span-2">
            <Info icon={MapPin} label="Address" value={s.address || "—"} />
          </div>
        </div>
      </Card>
    </div>
  );
}

function Info({ icon: Icon, label, value }) {
  return (
    <div className="flex items-start gap-3">
      <div className="size-9 rounded-md bg-muted flex items-center justify-center text-muted-foreground">
        <Icon className="size-4" />
      </div>
      <div>
        <div className="text-xs text-muted-foreground">{label}</div>
        <div className="font-medium">{value}</div>
      </div>
    </div>
  );
}
