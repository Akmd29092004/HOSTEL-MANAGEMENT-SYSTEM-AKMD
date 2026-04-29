import { useEffect, useState } from "react";
import api from "../lib/api";
import { useAuth } from "../context/AuthContext";
import PageHeader from "../components/PageHeader";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Card } from "../components/ui/card";
import { UtensilsCrossed, Save } from "lucide-react";
import { toast } from "sonner";

const MEALS = [
  { key: "breakfast", label: "Breakfast", time: "7:30 – 9:30 AM" },
  { key: "lunch", label: "Lunch", time: "12:30 – 2:00 PM" },
  { key: "dinner", label: "Dinner", time: "7:30 – 9:30 PM" },
];

export default function Food() {
  const { user } = useAuth();
  const [days, setDays] = useState([]);
  const [edits, setEdits] = useState({});
  const [savingDay, setSavingDay] = useState(null);
  const canEdit = user.role === "admin" || user.role === "staff";

  useEffect(() => {
    api.get("/food").then((r) => setDays(r.data));
  }, []);

  const setMeal = (day, meal, value) => {
    setEdits((p) => ({
      ...p,
      [day]: { ...(p[day] || days.find((d) => d.day === day)), [meal]: value },
    }));
  };

  const saveDay = async (day) => {
    setSavingDay(day);
    try {
      const base = days.find((d) => d.day === day) || {
        breakfast: "", lunch: "", dinner: "",
      };
      const merged = { ...base, ...(edits[day] || {}) };
      await api.put(`/food/${day}`, {
        breakfast: merged.breakfast || "",
        lunch: merged.lunch || "",
        dinner: merged.dinner || "",
      });
      const r = await api.get("/food");
      setDays(r.data);
      setEdits((p) => {
        const c = { ...p };
        delete c[day];
        return c;
      });
      toast.success(`${day} menu saved`);
    } catch {
      toast.error("Failed to save");
    } finally {
      setSavingDay(null);
    }
  };

  const value = (day, meal) => {
    const e = edits[day]?.[meal];
    if (e !== undefined) return e;
    return days.find((d) => d.day === day)?.[meal] || "";
  };

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <PageHeader
        title="Hostel Food"
        subtitle={
          canEdit
            ? "Edit the weekly mess menu. Changes are visible to all students."
            : "This week's mess menu."
        }
      />

      <div className="grid gap-5">
        {days.map((d) => {
          const dirty = !!edits[d.day];
          return (
            <Card key={d.day} className="p-5" data-testid={`food-day-${d.day}`}>
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="size-10 rounded-md bg-primary/10 text-primary flex items-center justify-center">
                    <UtensilsCrossed className="size-5" />
                  </div>
                  <h3 className="font-display font-bold text-xl">{d.day}</h3>
                </div>
                {canEdit && (
                  <Button
                    size="sm"
                    onClick={() => saveDay(d.day)}
                    disabled={!dirty || savingDay === d.day}
                    data-testid={`save-food-${d.day}`}
                  >
                    <Save className="size-4 mr-1.5" />
                    {savingDay === d.day ? "Saving..." : dirty ? "Save changes" : "Saved"}
                  </Button>
                )}
              </div>
              <div className="grid md:grid-cols-3 gap-4">
                {MEALS.map((m) => (
                  <div key={m.key} className="space-y-1.5">
                    <div className="flex justify-between items-baseline">
                      <span className="font-medium text-sm">{m.label}</span>
                      <span className="text-xs text-muted-foreground">{m.time}</span>
                    </div>
                    {canEdit ? (
                      <Input
                        value={value(d.day, m.key)}
                        onChange={(e) => setMeal(d.day, m.key, e.target.value)}
                        placeholder={`Today's ${m.label.toLowerCase()}...`}
                        data-testid={`food-input-${d.day}-${m.key}`}
                      />
                    ) : (
                      <div className="px-3 py-2 rounded-md bg-muted/50 text-sm min-h-[40px]">
                        {value(d.day, m.key) || (
                          <span className="text-muted-foreground italic">Not set</span>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
