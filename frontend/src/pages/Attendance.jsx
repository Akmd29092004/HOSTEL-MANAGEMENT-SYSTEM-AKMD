import { useEffect, useState } from "react";
import api from "../lib/api";
import PageHeader from "../components/PageHeader";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Card } from "../components/ui/card";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "../components/ui/table";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "../components/ui/select";
import { toast } from "sonner";

const STATUSES = ["present", "absent", "leave"];

export default function Attendance() {
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [students, setStudents] = useState([]);
  const [marks, setMarks] = useState({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api.get("/students").then((r) => setStudents(r.data));
  }, []);

  useEffect(() => {
    if (!date) return;
    api.get("/attendance", { params: { date } }).then((r) => {
      const m = {};
      r.data.forEach((a) => (m[a.student_id] = a.status));
      setMarks(m);
    });
  }, [date]);

  const setStatus = (sid, st) => setMarks((m) => ({ ...m, [sid]: st }));

  const markAll = (st) => {
    const m = {};
    students.forEach((s) => (m[s.id] = st));
    setMarks(m);
  };

  const save = async () => {
    setSaving(true);
    try {
      const entries = students.map((s) => ({
        student_id: s.id,
        status: marks[s.id] || "absent",
      }));
      await api.post("/attendance", { date, entries });
      toast.success(`Attendance saved for ${date}`);
    } catch {
      toast.error("Failed to save");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <PageHeader
        title="Attendance"
        subtitle="Mark daily attendance for all students."
        actions={
          <Button onClick={save} disabled={saving} data-testid="save-attendance-btn">
            {saving ? "Saving..." : "Save attendance"}
          </Button>
        }
      />

      <Card className="p-4 mb-6 flex gap-3 flex-wrap items-center">
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">Date</span>
          <Input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="w-44"
            data-testid="attendance-date-input"
          />
        </div>
        <div className="flex gap-2 ml-auto">
          <Button variant="outline" size="sm" onClick={() => markAll("present")}>
            All Present
          </Button>
          <Button variant="outline" size="sm" onClick={() => markAll("absent")}>
            All Absent
          </Button>
        </div>
      </Card>

      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Roll</TableHead>
              <TableHead>Name</TableHead>
              <TableHead>Room</TableHead>
              <TableHead className="w-48">Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {students.length === 0 && (
              <TableRow>
                <TableCell colSpan={4} className="text-center text-muted-foreground py-8">
                  No students.
                </TableCell>
              </TableRow>
            )}
            {students.map((s) => (
              <TableRow key={s.id}>
                <TableCell>{s.roll_no}</TableCell>
                <TableCell>{s.name}</TableCell>
                <TableCell>{s.room_no || "—"}</TableCell>
                <TableCell>
                  <Select
                    value={marks[s.id] || ""}
                    onValueChange={(v) => setStatus(s.id, v)}
                  >
                    <SelectTrigger data-testid={`att-status-${s.roll_no}`}>
                      <SelectValue placeholder="Mark" />
                    </SelectTrigger>
                    <SelectContent>
                      {STATUSES.map((st) => (
                        <SelectItem key={st} value={st}>
                          {st}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
