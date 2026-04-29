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
import { Card } from "../components/ui/card";
import { Badge } from "../components/ui/badge";
import { Plus, Trash2, BedDouble } from "lucide-react";
import { toast } from "sonner";

const empty = { room_no: "", block: "A", floor: 1, capacity: 2, type: "Double", rent: 0 };

export default function Rooms() {
  const { user } = useAuth();
  const [rows, setRows] = useState([]);
  const [students, setStudents] = useState([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(empty);

  const load = () =>
    Promise.all([
      api.get("/rooms").then((r) => setRows(r.data)),
      api.get("/students").then((r) => setStudents(r.data)).catch(() => setStudents([])),
    ]);

  useEffect(() => { load(); }, []);

  const studentMap = useMemo(() => {
    const m = {};
    students.forEach((s) => (m[s.id] = s));
    return m;
  }, [students]);

  const submit = async (e) => {
    e.preventDefault();
    try {
      await api.post("/rooms", {
        ...form,
        floor: Number(form.floor),
        capacity: Number(form.capacity),
        rent: Number(form.rent),
      });
      toast.success("Room created");
      setOpen(false);
      setForm(empty);
      load();
    } catch (err) {
      toast.error(err?.response?.data?.detail || "Failed");
    }
  };

  const remove = async (id) => {
    if (!window.confirm("Delete this room?")) return;
    try {
      await api.delete(`/rooms/${id}`);
      toast.success("Deleted");
      load();
    } catch (err) {
      toast.error(err?.response?.data?.detail || "Failed");
    }
  };

  const isAdmin = user.role === "admin";

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <PageHeader
        title="Rooms"
        subtitle="Block-wise rooms with live occupancy."
        actions={
          isAdmin && (
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger asChild>
                <Button data-testid="add-room-btn">
                  <Plus className="size-4 mr-1.5" /> Add Room
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Add Room</DialogTitle>
                </DialogHeader>
                <form onSubmit={submit} className="grid grid-cols-2 gap-4">
                  <F label="Room No" required>
                    <Input
                      value={form.room_no}
                      onChange={(e) => setForm({ ...form, room_no: e.target.value })}
                      required
                      data-testid="room-no-input"
                    />
                  </F>
                  <F label="Block">
                    <Input
                      value={form.block}
                      onChange={(e) => setForm({ ...form, block: e.target.value })}
                    />
                  </F>
                  <F label="Floor">
                    <Input
                      type="number" min="0"
                      value={form.floor}
                      onChange={(e) => setForm({ ...form, floor: e.target.value })}
                    />
                  </F>
                  <F label="Type">
                    <Input
                      value={form.type}
                      onChange={(e) => setForm({ ...form, type: e.target.value })}
                      placeholder="Single / Double / Triple"
                    />
                  </F>
                  <F label="Capacity">
                    <Input
                      type="number" min="1"
                      value={form.capacity}
                      onChange={(e) => setForm({ ...form, capacity: e.target.value })}
                    />
                  </F>
                  <F label="Rent (₹/month)">
                    <Input
                      type="number" min="0"
                      value={form.rent}
                      onChange={(e) => setForm({ ...form, rent: e.target.value })}
                    />
                  </F>
                  <DialogFooter className="col-span-2 mt-2">
                    <Button variant="outline" type="button" onClick={() => setOpen(false)}>
                      Cancel
                    </Button>
                    <Button type="submit" data-testid="save-room-btn">Save</Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
          )
        }
      />

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
        {rows.length === 0 && (
          <div className="col-span-full text-center text-muted-foreground py-12">
            No rooms yet.
          </div>
        )}
        {rows.map((r) => {
          const occ = r.occupants?.length || 0;
          const full = occ >= r.capacity;
          return (
            <Card key={r.id} className="p-5" data-testid={`room-card-${r.room_no}`}>
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="size-11 rounded-md bg-primary/10 text-primary flex items-center justify-center">
                    <BedDouble className="size-5" />
                  </div>
                  <div>
                    <div className="font-display font-bold text-xl">Room {r.room_no}</div>
                    <div className="text-xs text-muted-foreground">
                      Block {r.block} · Floor {r.floor} · {r.type}
                    </div>
                  </div>
                </div>
                {isAdmin && !full && (
                  <Button
                    variant="ghost" size="icon"
                    onClick={() => remove(r.id)}
                    data-testid={`delete-room-${r.room_no}`}
                  >
                    <Trash2 className="size-4 text-red-600" />
                  </Button>
                )}
              </div>
              <div className="mt-4 flex items-center justify-between">
                <Badge variant={full ? "destructive" : "secondary"}>
                  {occ}/{r.capacity} occupied
                </Badge>
                <div className="text-sm text-muted-foreground">₹{r.rent}/mo</div>
              </div>
              {occ > 0 && (
                <div className="mt-3 pt-3 border-t text-xs text-muted-foreground space-y-1">
                  {r.occupants.map((sid) => {
                    const s = studentMap[sid];
                    return (
                      <div key={sid} className="flex justify-between">
                        <span className="truncate pr-2">{s?.name || sid}</span>
                        <span>{s?.roll_no || ""}</span>
                      </div>
                    );
                  })}
                </div>
              )}
            </Card>
          );
        })}
      </div>
    </div>
  );
}

function F({ label, children, required }) {
  return (
    <div className="space-y-1.5">
      <Label>{label} {required && <span className="text-red-500">*</span>}</Label>
      {children}
    </div>
  );
}
