import { useEffect, useState } from "react";
import api from "../lib/api";
import PageHeader from "../components/PageHeader";
import { Card } from "../components/ui/card";
import { Badge } from "../components/ui/badge";
import { BedDouble, Users } from "lucide-react";

export default function MyRoom() {
  const [r, setR] = useState(undefined);
  useEffect(() => {
    api.get("/me/room").then((res) => setR(res.data));
  }, []);

  if (r === undefined) return <div className="p-8 text-muted-foreground">Loading...</div>;
  if (!r)
    return (
      <div className="p-8 max-w-3xl mx-auto">
        <PageHeader title="My Room" />
        <Card className="p-8 text-center text-muted-foreground">
          You haven't been assigned a room yet. Please contact the warden.
        </Card>
      </div>
    );

  return (
    <div className="p-8 max-w-3xl mx-auto">
      <PageHeader title="My Room" subtitle="Your hostel room details." />
      <Card className="p-8">
        <div className="flex items-center gap-4">
          <div className="size-14 rounded-md bg-primary/10 text-primary flex items-center justify-center">
            <BedDouble className="size-7" />
          </div>
          <div>
            <div className="font-display font-bold text-3xl">Room {r.room_no}</div>
            <div className="text-muted-foreground">
              Block {r.block} · Floor {r.floor} · {r.type}
            </div>
          </div>
          <Badge variant="secondary" className="ml-auto">
            {r.occupants?.length || 0}/{r.capacity}
          </Badge>
        </div>
        <div className="mt-6 grid grid-cols-2 gap-4">
          <Stat label="Type" value={r.type} />
          <Stat label="Rent" value={`₹${r.rent}/mo`} />
        </div>
        <div className="mt-6">
          <div className="flex items-center gap-2 mb-2">
            <Users className="size-4 text-muted-foreground" />
            <span className="text-sm font-medium">Roommates</span>
          </div>
          <div className="space-y-2">
            {(r.occupant_details || []).map((o, i) => (
              <div
                key={i}
                className="flex justify-between items-center px-3 py-2 rounded-md bg-muted/40 text-sm"
              >
                <span>{o.name}</span>
                <span className="text-muted-foreground">{o.roll_no}</span>
              </div>
            ))}
            {(r.occupant_details?.length || 0) === 0 && (
              <div className="text-sm text-muted-foreground">No other occupants yet.</div>
            )}
          </div>
        </div>
      </Card>
    </div>
  );
}

function Stat({ label, value }) {
  return (
    <div className="px-4 py-3 rounded-md bg-muted/40">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="font-semibold mt-0.5">{value}</div>
    </div>
  );
}
