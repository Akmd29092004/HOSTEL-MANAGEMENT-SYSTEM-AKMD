import { useEffect, useState, useCallback } from "react";
import api, { API_BASE } from "../lib/api";
import { loadRazorpay } from "../lib/razorpay";
import PageHeader from "../components/PageHeader";
import { Card } from "../components/ui/card";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "../components/ui/table";
import { CreditCard, FileDown, Loader2 } from "lucide-react";
import { toast } from "sonner";

export default function MyFees() {
  const [rows, setRows] = useState([]);
  const [paying, setPaying] = useState(null);

  const load = useCallback(
    () => api.get("/me/fees").then((r) => setRows(r.data)),
    []
  );

  useEffect(() => { load(); }, [load]);

  const total = rows.reduce((a, r) => a + r.amount, 0);
  const paid = rows.filter((r) => r.status === "paid").reduce((a, r) => a + r.amount, 0);

  const payNow = async (fee) => {
    setPaying(fee.id);
    try {
      const Razorpay = await loadRazorpay();
      const { data } = await api.post("/payments/order", { fee_id: fee.id });
      const rzp = new Razorpay({
        key: data.key_id,
        amount: data.amount,
        currency: data.currency,
        name: "Hostel Management System",
        description: `Hostel fee for ${data.month}`,
        order_id: data.order_id,
        prefill: {
          name: data.name,
          email: data.email,
          contact: data.phone || undefined,
        },
        theme: { color: "#1f3a93" },
        handler: async (resp) => {
          try {
            await api.post("/payments/verify", {
              fee_id: fee.id,
              razorpay_order_id: resp.razorpay_order_id,
              razorpay_payment_id: resp.razorpay_payment_id,
              razorpay_signature: resp.razorpay_signature,
            });
            toast.success("Payment successful! Receipt is ready.");
            load();
          } catch (err) {
            toast.error(err?.response?.data?.detail || "Payment verification failed");
            load();
          }
        },
        modal: {
          ondismiss: () => {
            setPaying(null);
            load();
          },
        },
      });
      rzp.on("payment.failed", () => {
        toast.error("Payment failed. Please try again.");
        setPaying(null);
        load();
      });
      rzp.open();
    } catch (err) {
      toast.error(err?.response?.data?.detail || "Could not start payment");
    } finally {
      setPaying(null);
    }
  };

  const receiptUrl = (id) =>
    `${API_BASE}/payments/receipt/${id}.pdf?t=${localStorage.getItem("hms_token") || ""}`;

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
              <TableHead className="text-right">Action</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                  No fee records.
                </TableCell>
              </TableRow>
            )}
            {rows.map((f) => (
              <TableRow key={f.id} data-testid={`my-fee-${f.id}`}>
                <TableCell>{f.month}</TableCell>
                <TableCell>₹{f.amount.toLocaleString()}</TableCell>
                <TableCell>{f.due_date}</TableCell>
                <TableCell>
                  <Badge
                    variant={
                      f.status === "paid"
                        ? "secondary"
                        : f.status === "processing"
                        ? "outline"
                        : "destructive"
                    }
                  >
                    {f.status}
                  </Badge>
                </TableCell>
                <TableCell>
                  {f.paid_date ? new Date(f.paid_date).toLocaleDateString() : "—"}
                </TableCell>
                <TableCell className="text-right">
                  {f.status === "paid" ? (
                    <ReceiptButton feeId={f.id} />
                  ) : (
                    <Button
                      size="sm"
                      onClick={() => payNow(f)}
                      disabled={paying === f.id}
                      data-testid={`pay-now-${f.id}`}
                    >
                      {paying === f.id ? (
                        <>
                          <Loader2 className="size-4 mr-1.5 animate-spin" /> Opening...
                        </>
                      ) : (
                        <>
                          <CreditCard className="size-4 mr-1.5" /> Pay now
                        </>
                      )}
                    </Button>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
      <p className="text-xs text-muted-foreground mt-4">
        Payments are processed securely by Razorpay. Test card: 4111 1111 1111 1111, CVV
        123, any future expiry.
      </p>
    </div>
  );
}

function ReceiptButton({ feeId }) {
  const [busy, setBusy] = useState(false);
  const download = async () => {
    setBusy(true);
    try {
      const res = await api.get(`/payments/receipt/${feeId}.pdf`, {
        responseType: "blob",
      });
      const url = URL.createObjectURL(new Blob([res.data], { type: "application/pdf" }));
      const a = document.createElement("a");
      a.href = url;
      a.download = `receipt-${feeId.slice(0, 8)}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch {
      toast.error("Could not download receipt");
    } finally {
      setBusy(false);
    }
  };
  return (
    <Button
      variant="outline" size="sm"
      onClick={download} disabled={busy}
      data-testid={`receipt-${feeId}`}
    >
      <FileDown className="size-4 mr-1.5" />
      {busy ? "..." : "Receipt"}
    </Button>
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
