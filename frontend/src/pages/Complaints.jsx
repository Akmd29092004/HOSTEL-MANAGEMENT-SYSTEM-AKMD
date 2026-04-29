import { useEffect, useState } from "react";
import api from "../lib/api";
import { useAuth } from "../context/AuthContext";
import PageHeader from "../components/PageHeader";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Textarea } from "../components/ui/textarea";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "../components/ui/dialog";
import { Card } from "../components/ui/card";
import { Badge } from "../components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "../components/ui/select";
import { Plus, MessageSquare } from "lucide-react";
import { toast } from "sonner";

const STATUS_COLORS = {
  open: "bg-rose-100 text-rose-700",
  in_progress: "bg-amber-100 text-amber-700",
  resolved: "bg-emerald-100 text-emerald-700",
};

export default function Complaints() {
  const { user } = useAuth();
  const [rows, setRows] = useState([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ title: "", description: "", category: "Maintenance" });
  const [filter, setFilter] = useState("all");

  const load = () =>
    api
      .get("/complaints", filter !== "all" ? { params: { status_filter: filter } } : {})
      .then((r) => setRows(r.data));
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [filter]);

  const submit = async (e) => {
    e.preventDefault();
    try {
      await api.post("/complaints", form);
      toast.success("Complaint submitted");
      setOpen(false);
      setForm({ title: "", description: "", category: "Maintenance" });
      load();
    } catch (err) {
      toast.error(err?.response?.data?.detail || "Failed");
    }
  };

  const updateStatus = async (id, status, response) => {
    await api.put(`/complaints/${id}/status`, { status, response });
    toast.success("Updated");
    load();
  };

  const isStudent = user.role === "student";
  const canManage = user.role === "admin" || user.role === "staff";

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <PageHeader
        title="Complaints"
        subtitle={
          isStudent
            ? "Raise an issue and track its resolution."
            : "Manage student complaints."
        }
        actions={
          isStudent && (
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger asChild>
                <Button data-testid="new-complaint-btn">
                  <Plus className="size-4 mr-1.5" /> New Complaint
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Raise a complaint</DialogTitle>
                </DialogHeader>
                <form onSubmit={submit} className="space-y-4">
                  <div className="space-y-1.5">
                    <Label>Title</Label>
                    <Input
                      required
                      value={form.title}
                      onChange={(e) => setForm({ ...form, title: e.target.value })}
                      data-testid="complaint-title-input"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Category</Label>
                    <Select
                      value={form.category}
                      onValueChange={(v) => setForm({ ...form, category: v })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {["Maintenance", "Mess Food", "Electricity", "Water", "Cleanliness", "Other"].map(
                          (c) => (
                            <SelectItem key={c} value={c}>{c}</SelectItem>
                          )
                        )}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label>Description</Label>
                    <Textarea
                      rows={4}
                      required
                      value={form.description}
                      onChange={(e) => setForm({ ...form, description: e.target.value })}
                      data-testid="complaint-desc-input"
                    />
                  </div>
                  <DialogFooter>
                    <Button variant="outline" type="button" onClick={() => setOpen(false)}>
                      Cancel
                    </Button>
                    <Button type="submit" data-testid="submit-complaint-btn">Submit</Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
          )
        }
      />

      <div className="flex gap-2 mb-5 flex-wrap">
        {["all", "open", "in_progress", "resolved"].map((v) => (
          <Button
            key={v} size="sm"
            variant={filter === v ? "default" : "outline"}
            onClick={() => setFilter(v)}
            data-testid={`complaint-filter-${v}`}
          >
            {v.replace("_", " ")}
          </Button>
        ))}
      </div>

      <div className="space-y-4">
        {rows.length === 0 && (
          <Card className="p-12 text-center text-muted-foreground">
            <MessageSquare className="size-8 mx-auto mb-2 opacity-50" />
            No complaints to show.
          </Card>
        )}
        {rows.map((c) => (
          <Card key={c.id} className="p-5" data-testid={`complaint-${c.id}`}>
            <div className="flex items-start justify-between gap-4 flex-wrap">
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="font-display font-semibold text-lg">{c.title}</h3>
                  <span className={`text-xs px-2 py-0.5 rounded-full ${STATUS_COLORS[c.status]}`}>
                    {c.status.replace("_", " ")}
                  </span>
                  <Badge variant="outline">{c.category}</Badge>
                </div>
                {!isStudent && (
                  <div className="text-xs text-muted-foreground mt-1">
                    {c.roll_no} · {c.student_name}
                  </div>
                )}
                <p className="text-sm text-foreground/80 mt-2">{c.description}</p>
                {c.response && (
                  <div className="mt-3 p-3 rounded-md bg-muted text-sm">
                    <span className="font-medium">Warden's response:</span> {c.response}
                  </div>
                )}
              </div>
              <div className="text-xs text-muted-foreground shrink-0">
                {new Date(c.created_at).toLocaleString()}
              </div>
            </div>
            {canManage && c.status !== "resolved" && (
              <ManageBar c={c} onUpdate={updateStatus} />
            )}
          </Card>
        ))}
      </div>
    </div>
  );
}

function ManageBar({ c, onUpdate }) {
  const [resp, setResp] = useState(c.response || "");
  return (
    <div className="mt-4 pt-4 border-t flex flex-col sm:flex-row gap-2">
      <Input
        placeholder="Add a response..."
        value={resp}
        onChange={(e) => setResp(e.target.value)}
        data-testid={`response-input-${c.id}`}
      />
      <Button
        variant="outline" size="sm"
        onClick={() => onUpdate(c.id, "in_progress", resp)}
        data-testid={`progress-${c.id}`}
      >
        In Progress
      </Button>
      <Button
        size="sm"
        onClick={() => onUpdate(c.id, "resolved", resp)}
        data-testid={`resolve-${c.id}`}
      >
        Resolve
      </Button>
    </div>
  );
}
