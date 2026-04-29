import { useEffect, useMemo, useState } from "react";
import api from "../lib/api";
import { useAuth } from "../context/AuthContext";
import PageHeader from "../components/PageHeader";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "../components/ui/dialog";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "../components/ui/table";
import { Card } from "../components/ui/card";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "../components/ui/select";
import { Plus, Pencil, Trash2, Search } from "lucide-react";
import { toast } from "sonner";

const empty = {
  email: "", password: "student123", name: "", roll_no: "",
  course: "", year: 1, phone: "", parent_name: "", parent_phone: "",
  address: "", room_no: "",
};

export default function Students() {
  const { user } = useAuth();
  const [rows, setRows] = useState([]);
  const [rooms, setRooms] = useState([]);
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(empty);

  const load = () =>
    Promise.all([
      api.get("/students").then((r) => setRows(r.data)),
      api.get("/rooms").then((r) => setRooms(r.data)).catch(() => setRooms([])),
    ]);

  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => {
    const s = q.toLowerCase();
    return rows.filter((r) =>
      [r.name, r.roll_no, r.email, r.course, r.room_no || ""].some((x) =>
        String(x).toLowerCase().includes(s)
      )
    );
  }, [rows, q]);

  const openNew = () => { setEditing(null); setForm(empty); setOpen(true); };
  const openEdit = (s) => {
    setEditing(s);
    setForm({ ...empty, ...s, password: "" });
    setOpen(true);
  };

  const submit = async (e) => {
    e.preventDefault();
    try {
      if (editing) {
        const { email: _e, password: _p, ...payload } = form;
        await api.put(`/students/${editing.id}`, payload);
        toast.success("Student updated");
      } else {
        await api.post("/students", { ...form, year: Number(form.year) });
        toast.success("Student added");
      }
      setOpen(false);
      load();
    } catch (err) {
      toast.error(err?.response?.data?.detail || "Failed to save");
    }
  };

  const remove = async (id) => {
    if (!window.confirm("Delete this student? This will remove their account.")) return;
    await api.delete(`/students/${id}`);
    toast.success("Deleted");
    load();
  };

  const isAdmin = user.role === "admin";

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <PageHeader
        title="Students"
        subtitle="All registered hostel students."
        actions={
          isAdmin && (
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger asChild>
                <Button onClick={openNew} data-testid="add-student-btn">
                  <Plus className="size-4 mr-1.5" /> Add Student
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl">
                <DialogHeader>
                  <DialogTitle>{editing ? "Edit student" : "Add student"}</DialogTitle>
                </DialogHeader>
                <form onSubmit={submit} className="grid grid-cols-2 gap-4">
                  {!editing && (
                    <>
                      <Field label="Email" required>
                        <Input
                          type="email"
                          value={form.email}
                          onChange={(e) => setForm({ ...form, email: e.target.value })}
                          required
                          data-testid="student-email-input"
                        />
                      </Field>
                      <Field label="Password">
                        <Input
                          value={form.password}
                          onChange={(e) => setForm({ ...form, password: e.target.value })}
                          data-testid="student-password-input"
                        />
                      </Field>
                    </>
                  )}
                  <Field label="Full name" required>
                    <Input
                      value={form.name}
                      onChange={(e) => setForm({ ...form, name: e.target.value })}
                      required
                      data-testid="student-name-input"
                    />
                  </Field>
                  <Field label="Roll No" required>
                    <Input
                      value={form.roll_no}
                      onChange={(e) => setForm({ ...form, roll_no: e.target.value })}
                      required
                      data-testid="student-rollno-input"
                    />
                  </Field>
                  <Field label="Course">
                    <Input
                      value={form.course}
                      onChange={(e) => setForm({ ...form, course: e.target.value })}
                    />
                  </Field>
                  <Field label="Year">
                    <Input
                      type="number" min="1" max="6"
                      value={form.year}
                      onChange={(e) => setForm({ ...form, year: e.target.value })}
                    />
                  </Field>
                  <Field label="Phone">
                    <Input
                      value={form.phone}
                      onChange={(e) => setForm({ ...form, phone: e.target.value })}
                    />
                  </Field>
                  <Field label="Room">
                    <Select
                      value={form.room_no || "none"}
                      onValueChange={(v) => setForm({ ...form, room_no: v === "none" ? "" : v })}
                    >
                      <SelectTrigger data-testid="student-room-select">
                        <SelectValue placeholder="No room assigned" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">No room</SelectItem>
                        {rooms.map((r) => (
                          <SelectItem key={r.id} value={r.room_no}>
                            {r.room_no} ({(r.occupants?.length || 0)}/{r.capacity})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </Field>
                  <Field label="Parent name">
                    <Input
                      value={form.parent_name}
                      onChange={(e) => setForm({ ...form, parent_name: e.target.value })}
                    />
                  </Field>
                  <Field label="Parent phone">
                    <Input
                      value={form.parent_phone}
                      onChange={(e) => setForm({ ...form, parent_phone: e.target.value })}
                    />
                  </Field>
                  <Field label="Address" full>
                    <Input
                      value={form.address}
                      onChange={(e) => setForm({ ...form, address: e.target.value })}
                    />
                  </Field>
                  <DialogFooter className="col-span-2 mt-2">
                    <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                      Cancel
                    </Button>
                    <Button type="submit" data-testid="save-student-btn">
                      {editing ? "Save" : "Add student"}
                    </Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
          )
        }
      />

      <Card className="overflow-hidden">
        <div className="p-4 border-b flex items-center gap-3">
          <Search className="size-4 text-muted-foreground" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search by name, roll no, email, course or room..."
            className="border-0 focus-visible:ring-0 p-0 h-auto bg-transparent"
            data-testid="students-search"
          />
        </div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Roll No</TableHead>
              <TableHead>Name</TableHead>
              <TableHead>Course</TableHead>
              <TableHead>Year</TableHead>
              <TableHead>Room</TableHead>
              <TableHead>Phone</TableHead>
              {isAdmin && <TableHead className="text-right">Actions</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 && (
              <TableRow>
                <TableCell colSpan={isAdmin ? 7 : 6} className="text-center text-muted-foreground py-8">
                  No students yet.
                </TableCell>
              </TableRow>
            )}
            {filtered.map((s) => (
              <TableRow key={s.id} data-testid={`student-row-${s.roll_no}`}>
                <TableCell className="font-medium">{s.roll_no}</TableCell>
                <TableCell>
                  <div>{s.name}</div>
                  <div className="text-xs text-muted-foreground">{s.email}</div>
                </TableCell>
                <TableCell>{s.course || "—"}</TableCell>
                <TableCell>{s.year || "—"}</TableCell>
                <TableCell>{s.room_no || "—"}</TableCell>
                <TableCell>{s.phone || "—"}</TableCell>
                {isAdmin && (
                  <TableCell className="text-right">
                    <Button
                      variant="ghost" size="icon"
                      onClick={() => openEdit(s)}
                      data-testid={`edit-student-${s.roll_no}`}
                    >
                      <Pencil className="size-4" />
                    </Button>
                    <Button
                      variant="ghost" size="icon"
                      onClick={() => remove(s.id)}
                      data-testid={`delete-student-${s.roll_no}`}
                    >
                      <Trash2 className="size-4 text-red-600" />
                    </Button>
                  </TableCell>
                )}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}

function Field({ label, children, full, required }) {
  return (
    <div className={full ? "col-span-2 space-y-1.5" : "space-y-1.5"}>
      <Label>
        {label} {required && <span className="text-red-500">*</span>}
      </Label>
      {children}
    </div>
  );
}
