import { useEffect, useMemo, useState } from "react";
import api from "../lib/api";
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
import { Badge } from "../components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "../components/ui/select";
import { Plus, CheckCircle2, Trash2 } from "lucide-react";
import { toast } from "sonner";

const MS_PER_DAY = 86400000;
const DEFAULT_DUE_DAYS = 14;

export default function Fees() {
  const [rows, setRows] = useState([]);
  const [students, setStudents] = useState([]);
  const [open, setOpen] = useState(false);
  const [filter, setFilter] = useState("all");
  const [form, setForm] = useState({
    student_id: "",
    month: new Date().toISOString().slice(0, 7),
    amount: 5000,
    due_date: new Date(Date.now() + DEFAULT_DUE_DAYS * MS_PER_DAY).toISOString().slice(0, 10),
  });

  const load = () =>
    Promise.all([
      api.get("/fees").then((r) => setRows(r.data)),
      api.get("/students").then((r) => setStudents(r.data)),
    ]);
  useEffect(() => { load(); }, []);

  const filtered = useMemo(
    () => (filter === "all" ? rows : rows.filter((r) => r.status === filter)),
    [rows, filter]
  );

  const total = rows.reduce((a, r) => a + (r.amount || 0), 0);
  const paid = rows.filter((r) => r.status === "paid").reduce((a, r) => a + r.amount, 0);
  const pending = total - paid;

  const submit = async (e) => {
    e.preventDefault();
    try {
      await api.post("/fees", { ...form, amount: Number(form.amount) });
      toast.success("Fee record created");
      setOpen(false);
      load();
    } catch (err) {
      toast.error(err?.response?.data?.detail || "Failed");
    }
  };

  const markPaid = async (id) => {
    await api.put(`/fees/${id}/pay`);
    toast.success("Marked as paid");
    load();
  };

  const remove = async (id) => {
    if (!window.confirm("Delete this fee record?")) return;
    await api.delete(`/fees/${id}`);
    toast.success("Deleted");
    load();
  };

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <PageHeader
        title="Fees"
        subtitle="Generate and track student fee records."
        actions={
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button data-testid="add-fee-btn">
                <Plus className="size-4 mr-1.5" /> New Fee
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Generate Fee Record</DialogTitle>
              </DialogHeader>
              <form onSubmit={submit} className="space-y-4">
                <div className="space-y-1.5">
                  <Label>Student</Label>
                  <Select
                    value={form.student_id}
                    onValueChange={(v) => setForm({ ...form, student_id: v })}
                  >
                    <SelectTrigger data-testid="fee-student-select">
                      <SelectValue placeholder="Select student" />
                    </SelectTrigger>
                    <SelectContent>
                      {students.map((s) => (
                        <SelectItem key={s.id} value={s.id}>
                          {s.roll_no} — {s.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div className="space-y-1.5">
                    <Label>Month</Label>
                    <Input
                      type="month"
                      value={form.month}
                      onChange={(e) => setForm({ ...form, month: e.target.value })}
                      required
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Amount (₹)</Label>
                    <Input
                      type="number" min="0"
                      value={form.amount}
                      onChange={(e) => setForm({ ...form, amount: e.target.value })}
                      required
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Due date</Label>
                    <Input
                      type="date"
                      value={form.due_date}
                      onChange={(e) => setForm({ ...form, due_date: e.target.value })}
                      required
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" type="button" onClick={() => setOpen(false)}>
                    Cancel
                  </Button>
                  <Button type="submit" disabled={!form.student_id} data-testid="save-fee-btn">
                    Create
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        }
      />

      <div className="grid sm:grid-cols-3 gap-5 mb-6">
        <Card className="p-5">
          <div className="text-sm text-muted-foreground">Total billed</div>
          <div className="font-display font-bold text-2xl mt-1">₹{total.toLocaleString()}</div>
        </Card>
        <Card className="p-5">
          <div className="text-sm text-muted-foreground">Collected</div>
          <div className="font-display font-bold text-2xl mt-1 text-emerald-700">
            ₹{paid.toLocaleString()}
          </div>
        </Card>
        <Card className="p-5">
          <div className="text-sm text-muted-foreground">Pending</div>
          <div className="font-display font-bold text-2xl mt-1 text-rose-700">
            ₹{pending.toLocaleString()}
          </div>
        </Card>
      </div>

      <Card>
        <div className="p-3 border-b flex gap-2">
          {["all", "pending", "paid"].map((v) => (
            <Button
              key={v}
              size="sm"
              variant={filter === v ? "default" : "outline"}
              onClick={() => setFilter(v)}
              data-testid={`fee-filter-${v}`}
            >
              {v[0].toUpperCase() + v.slice(1)}
            </Button>
          ))}
        </div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Roll</TableHead>
              <TableHead>Student</TableHead>
              <TableHead>Month</TableHead>
              <TableHead>Amount</TableHead>
              <TableHead>Due</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 && (
              <TableRow>
                <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                  No fee records.
                </TableCell>
              </TableRow>
            )}
            {filtered.map((f) => (
              <TableRow key={f.id} data-testid={`fee-row-${f.id}`}>
                <TableCell>{f.roll_no}</TableCell>
                <TableCell>{f.student_name}</TableCell>
                <TableCell>{f.month}</TableCell>
                <TableCell>₹{f.amount.toLocaleString()}</TableCell>
                <TableCell>{f.due_date}</TableCell>
                <TableCell>
                  <Badge variant={f.status === "paid" ? "secondary" : "destructive"}>
                    {f.status}
                  </Badge>
                </TableCell>
                <TableCell className="text-right">
                  {f.status !== "paid" && (
                    <Button
                      size="sm" variant="outline"
                      onClick={() => markPaid(f.id)}
                      data-testid={`pay-fee-${f.id}`}
                    >
                      <CheckCircle2 className="size-4 mr-1" /> Mark Paid
                    </Button>
                  )}
                  <Button
                    variant="ghost" size="icon"
                    onClick={() => remove(f.id)}
                    data-testid={`delete-fee-${f.id}`}
                  >
                    <Trash2 className="size-4 text-red-600" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
