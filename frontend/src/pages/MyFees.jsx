import { useEffect, useState } from "react";
import api from "../lib/api";
import PageHeader from "../components/PageHeader";
import { Card } from "../components/ui/card";
import { Badge } from "../components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "../components/ui/table";

export default function MyFees() {
  const [rows, setRows] = useState([]);
  useEffect(() => {
    api.get("/me/fees").then((r) => setRows(r.data));
  }, []);

  const total = rows.reduce((a, r) => a + r.amount, 0);
  const paid = rows.filter((r) => r.status === "paid").reduce((a, r) => a + r.amount, 0);

  return (
    <div className="p-8 max-w-5xl mx-auto">
      <PageHeader title="My Fees" subtitle="Your fee ledger and payment history." />
      <div className="grid sm:grid-cols-3 gap-5 mb-6">
        <S label="Total billed" value={`₹${total.toLocaleString()}`} />
        <S label="Paid" value={`₹${paid.toLocaleString()}`} tone="emerald" />
        <S label="Pending" value={`₹${(total - paid).toLocaleString()}`} tone="rose" />
      </div>
      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Month</TableHead>
              <TableHead>Amount</TableHead>
              <TableHead>Due date</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Paid on</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                  No fee records.
                </TableCell>
              </TableRow>
            )}
            {rows.map((f) => (
              <TableRow key={f.id}>
                <TableCell>{f.month}</TableCell>
                <TableCell>₹{f.amount.toLocaleString()}</TableCell>
                <TableCell>{f.due_date}</TableCell>
                <TableCell>
                  <Badge variant={f.status === "paid" ? "secondary" : "destructive"}>
                    {f.status}
                  </Badge>
                </TableCell>
                <TableCell>
                  {f.paid_date ? new Date(f.paid_date).toLocaleDateString() : "—"}
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
  const cls = tone === "emerald" ? "text-emerald-700" : tone === "rose" ? "text-rose-700" : "";
  return (
    <Card className="p-5">
      <div className="text-sm text-muted-foreground">{label}</div>
      <div className={`font-display font-bold text-2xl mt-1 ${cls}`}>{value}</div>
    </Card>
  );
}
