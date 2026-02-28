import { Layout } from "@/components/Layout";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { ShoppingBag, Plus, Pencil, Trash2, X } from "lucide-react";

export default function ShopManager() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [editing, setEditing] = useState<any>(null);
  const [form, setForm] = useState({ title: "", description: "", price: "", currency: "NAD", imageUrl: "", category: "" });

  const { data: items = [] } = useQuery({ queryKey: ["/api/shop"], queryFn: api.getShopItems });

  const createMut = useMutation({
    mutationFn: (data: any) => api.createShopItem(data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["/api/shop"] }); toast({ title: "Item created" }); resetForm(); },
  });

  const updateMut = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => api.updateShopItem(id, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["/api/shop"] }); toast({ title: "Item updated" }); resetForm(); },
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => api.deleteShopItem(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["/api/shop"] }); toast({ title: "Item deleted" }); },
  });

  const resetForm = () => {
    setEditing(null);
    setForm({ title: "", description: "", price: "", currency: "NAD", imageUrl: "", category: "" });
  };

  const startEdit = (item: any) => {
    setEditing(item);
    setForm({ title: item.title, description: item.description || "", price: item.price?.toString() || "", currency: item.currency || "NAD", imageUrl: item.imageUrl || "", category: item.category || "" });
  };

  const handleSubmit = () => {
    const data = { ...form, price: form.price ? parseFloat(form.price) : undefined };
    if (editing) {
      updateMut.mutate({ id: editing.id, data });
    } else {
      createMut.mutate(data);
    }
  };

  return (
    <Layout>
      <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
        <div>
          <h1 className="text-3xl font-display font-bold text-afrocat-text">Shop Manager</h1>
          <p className="text-afrocat-muted mt-1">Manage club merchandise and services</p>
        </div>

        <div className="afrocat-card p-6 max-w-lg">
          <h3 className="text-lg font-bold text-afrocat-text mb-4 flex items-center gap-2">
            {editing ? <><Pencil className="h-5 w-5 text-afrocat-gold" /> Edit Item</> : <><Plus className="h-5 w-5 text-afrocat-teal" /> Add Item</>}
            {editing && <button onClick={resetForm} className="ml-auto cursor-pointer"><X className="h-4 w-4 text-afrocat-muted" /></button>}
          </h3>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label className="text-afrocat-muted text-sm">Title</Label>
              <Input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder="Item title" data-testid="input-shop-title"
                className="bg-afrocat-white-5 border-afrocat-border text-afrocat-text" />
            </div>
            <div className="space-y-1">
              <Label className="text-afrocat-muted text-sm">Description</Label>
              <Input value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="Description" data-testid="input-shop-desc"
                className="bg-afrocat-white-5 border-afrocat-border text-afrocat-text" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-afrocat-muted text-sm">Price</Label>
                <Input type="number" value={form.price} onChange={e => setForm(f => ({ ...f, price: e.target.value }))} placeholder="0.00" data-testid="input-shop-price"
                  className="bg-afrocat-white-5 border-afrocat-border text-afrocat-text" />
              </div>
              <div className="space-y-1">
                <Label className="text-afrocat-muted text-sm">Category</Label>
                <Input value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))} placeholder="Apparel" data-testid="input-shop-category"
                  className="bg-afrocat-white-5 border-afrocat-border text-afrocat-text" />
              </div>
            </div>
            <div className="space-y-1">
              <Label className="text-afrocat-muted text-sm">Image URL</Label>
              <Input value={form.imageUrl} onChange={e => setForm(f => ({ ...f, imageUrl: e.target.value }))} placeholder="https://..." data-testid="input-shop-image"
                className="bg-afrocat-white-5 border-afrocat-border text-afrocat-text" />
            </div>
            <Button onClick={handleSubmit} disabled={!form.title || createMut.isPending || updateMut.isPending}
              className="w-full bg-afrocat-teal hover:bg-afrocat-teal-dark text-white" data-testid="button-save-item">
              {editing ? "Update Item" : "Add Item"}
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {items.map((item: any) => (
            <div key={item.id} className="afrocat-card overflow-hidden" data-testid={`shop-manage-${item.id}`}>
              {item.imageUrl && (
                <div className="aspect-video bg-afrocat-white-5 overflow-hidden">
                  <img src={item.imageUrl} alt={item.title} className="w-full h-full object-cover" />
                </div>
              )}
              <div className="p-4">
                <div className="flex items-start justify-between">
                  <div>
                    <h4 className="font-bold text-afrocat-text">{item.title}</h4>
                    {item.price != null && <p className="text-lg font-bold text-afrocat-gold mt-1">{item.currency} {item.price.toFixed(2)}</p>}
                  </div>
                  <div className="flex gap-1">
                    <button onClick={() => startEdit(item)} className="p-1.5 rounded hover:bg-afrocat-white-5 cursor-pointer" data-testid={`button-edit-${item.id}`}>
                      <Pencil className="h-4 w-4 text-afrocat-muted" />
                    </button>
                    <button onClick={() => deleteMut.mutate(item.id)} className="p-1.5 rounded hover:bg-afrocat-red-soft cursor-pointer" data-testid={`button-delete-${item.id}`}>
                      <Trash2 className="h-4 w-4 text-afrocat-red" />
                    </button>
                  </div>
                </div>
                {item.description && <p className="text-sm text-afrocat-muted mt-1">{item.description}</p>}
                <div className="flex items-center gap-2 mt-2">
                  {item.category && <span className="text-xs px-2 py-0.5 rounded-full bg-afrocat-teal-soft text-afrocat-teal">{item.category}</span>}
                  <span className={`text-xs px-2 py-0.5 rounded-full ${item.isActive ? "bg-afrocat-green-soft text-afrocat-green" : "bg-afrocat-red-soft text-afrocat-red"}`}>
                    {item.isActive ? "Active" : "Inactive"}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </Layout>
  );
}
