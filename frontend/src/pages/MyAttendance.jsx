import { useEffect, useState } from "react";
import api from "../lib/api";
import PageHeader from "../components/PageHeader";
import { Card } from "../components/ui/card";
import { Badge } from "../components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "../components/ui/table";

const COLOR = {
  present: "bg-emerald-100 text-emerald-700",
  absent: "bg-rose-100 text-rose-700",
  leave: "bg-amber-100 text-amber-700",
};

export default function MyAttendance() {
  const [rows, setRows] = useState([]);
  useEffect(() => {
    api.get("/me/attendance").then((r) => setRows(r.data));
  }, []);

  const total = rows.length;
  const present = rows.filter((r) => r.status === "present").length;
  const pct = total ? Math.round((present / total) * 100) : 0;

  return (
    <div className="p-8 max-w-5xl mx-auto">
      <PageHeader title="My Attendance" subtitle="Your daily attendance record." />
      <div className="grid sm:grid-cols-3 gap-5 mb-6">
        <S label="Days marked" value={total} />
        <S label="Present" value={present} />
        <S label="Attendance %" value={`${pct}%`} tone="emerald" />
      </div>
      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 && (
              <TableRow>
                <TableCell colSpan={2} className="text-center text-muted-foreground py-8">
                  No attendance records yet.
                </TableCell>
              </TableRow>
            )}
            {rows.map((a) => (
              <TableRow key={a.id || `${a.date}`}>
                <TableCell>{a.date}</TableCell>
                <TableCell>
                  <Badge className={COLOR[a.status] || ""} variant="secondary">
                    {a.status}
                  </Badge>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}

function S({ label, value, tone }) {
  return (
    <Card className="p-5">
      <div className="text-sm text-muted-foreground">{label}</div>
      <div className={`font-display font-bold text-2xl mt-1 ${tone === "emerald" ? "text-emerald-700" : ""}`}>
        {value}
      </div>
    </Card>
  );
}
