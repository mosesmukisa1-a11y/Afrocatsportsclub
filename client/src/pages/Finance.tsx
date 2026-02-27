import { Layout } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus, ArrowUpRight, ArrowDownRight, Trash2 } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { useState } from "react";

export default function Finance() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data: txns = [], isLoading } = useQuery({ queryKey: ["/api/finance"], queryFn: api.getFinanceTxns });

  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ txnDate: "", type: "INCOME" as string, category: "", amount: 0, description: "", reference: "" });

  const createMut = useMutation({
    mutationFn: () => api.createFinanceTxn({ ...form, amount: Number(form.amount) }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/finance"] }); setOpen(false); toast({ title: "Transaction added" }); },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => api.deleteFinanceTxn(id),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/finance"] }); toast({ title: "Deleted" }); },
  });

  const totalIncome = txns.filter((t: any) => t.type === "INCOME").reduce((a: number, c: any) => a + c.amount, 0);
  const totalExpense = txns.filter((t: any) => t.type === "EXPENSE").reduce((a: number, c: any) => a + c.amount, 0);

  return (
    <Layout>
      <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-display font-bold text-foreground tracking-tight">Finance</h1>
            <p className="text-muted-foreground mt-1">Income, expenses, and reporting</p>
          </div>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild><Button data-testid="button-add-txn"><Plus className="mr-2 h-4 w-4" /> Add Transaction</Button></DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Add Transaction</DialogTitle></DialogHeader>
              <form onSubmit={e => { e.preventDefault(); createMut.mutate(); }} className="space-y-3">
                <div><Label>Type</Label>
                  <Select value={form.type} onValueChange={v => setForm({...form, type: v})}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent><SelectItem value="INCOME">Income</SelectItem><SelectItem value="EXPENSE">Expense</SelectItem></SelectContent>
                  </Select>
                </div>
                <div><Label>Date</Label><Input type="date" value={form.txnDate} onChange={e => setForm({...form, txnDate: e.target.value})} required /></div>
                <div><Label>Category</Label><Input value={form.category} onChange={e => setForm({...form, category: e.target.value})} required placeholder="e.g. Sponsorship, Equipment" /></div>
                <div><Label>Amount</Label><Input type="number" value={form.amount} onChange={e => setForm({...form, amount: Number(e.target.value)})} required /></div>
                <div><Label>Description</Label><Input value={form.description} onChange={e => setForm({...form, description: e.target.value})} required /></div>
                <Button type="submit" disabled={createMut.isPending}>{createMut.isPending ? "Adding..." : "Add"}</Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Total Income</CardTitle></CardHeader>
            <CardContent><div className="text-2xl font-bold font-display text-green-600 flex items-center gap-1"><ArrowUpRight className="h-5 w-5" />${totalIncome}</div></CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Total Expenses</CardTitle></CardHeader>
            <CardContent><div className="text-2xl font-bold font-display text-red-600 flex items-center gap-1"><ArrowDownRight className="h-5 w-5" />${totalExpense}</div></CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Net Balance</CardTitle></CardHeader>
            <CardContent><div className={`text-2xl font-bold font-display ${totalIncome - totalExpense >= 0 ? 'text-green-600' : 'text-red-600'}`}>${totalIncome - totalExpense}</div></CardContent>
          </Card>
        </div>

        {isLoading ? (
          <div className="text-center py-10 text-muted-foreground">Loading...</div>
        ) : (
          <div className="bg-card border rounded-lg shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="text-xs text-muted-foreground uppercase bg-muted/50 border-b">
                  <tr>
                    <th className="px-6 py-4">Date</th>
                    <th className="px-6 py-4">Type</th>
                    <th className="px-6 py-4">Category</th>
                    <th className="px-6 py-4">Description</th>
                    <th className="px-6 py-4 text-right">Amount</th>
                    <th className="px-6 py-4"></th>
                  </tr>
                </thead>
                <tbody>
                  {txns.map((t: any) => (
                    <tr key={t.id} className="border-b last:border-0 hover:bg-muted/30">
                      <td className="px-6 py-4">{t.txnDate}</td>
                      <td className="px-6 py-4"><span className={`px-2 py-1 rounded text-xs font-bold ${t.type === 'INCOME' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>{t.type}</span></td>
                      <td className="px-6 py-4">{t.category}</td>
                      <td className="px-6 py-4">{t.description}</td>
                      <td className="px-6 py-4 text-right font-semibold">${t.amount}</td>
                      <td className="px-6 py-4"><Button variant="ghost" size="sm" onClick={() => deleteMut.mutate(t.id)} data-testid={`button-delete-txn-${t.id}`}><Trash2 className="h-4 w-4 text-destructive" /></Button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {txns.length === 0 && <div className="text-center py-10 text-muted-foreground">No transactions yet.</div>}
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}
