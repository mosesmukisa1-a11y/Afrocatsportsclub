import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useLocation } from "wouter";
import { ShoppingBag, ArrowLeft, MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import logo from "@assets/afrocate_logo_1772226294597.png";

export default function PublicShop() {
  const [, setLocation] = useLocation();
  const { data: shop = [], isLoading } = useQuery({ queryKey: ["/api/public/shop"], queryFn: api.getPublicShop });

  return (
    <div className="min-h-screen bg-afrocat-bg">
      <header className="sticky top-0 z-50 bg-afrocat-card/90 backdrop-blur-md border-b border-afrocat-border">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={() => setLocation("/")} className="text-afrocat-muted hover:text-afrocat-text cursor-pointer" data-testid="button-back">
              <ArrowLeft className="h-5 w-5" />
            </button>
            <img src={logo} alt="Afrocat" className="w-8 h-8 object-contain" />
            <h1 className="text-lg font-display font-bold text-afrocat-gold">Club Shop</h1>
          </div>
          <Button size="sm" onClick={() => setLocation("/login")} className="bg-afrocat-teal hover:bg-afrocat-teal-dark text-white" data-testid="button-login">Sign In</Button>
        </div>
      </header>

      <div className="max-w-6xl mx-auto px-4 py-8">
        <div className="flex items-center gap-2 mb-8">
          <ShoppingBag className="h-6 w-6 text-afrocat-gold" />
          <h2 className="text-2xl font-display font-bold text-afrocat-text">Merchandise & Services</h2>
        </div>

        {isLoading && <p className="text-afrocat-muted text-center py-20">Loading shop items...</p>}

        {!isLoading && shop.length === 0 && (
          <div className="text-center py-20">
            <ShoppingBag className="h-12 w-12 text-afrocat-muted mx-auto mb-4" />
            <p className="text-afrocat-muted">No items available yet.</p>
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {shop.map((item: any) => (
            <div key={item.id} className="afrocat-card overflow-hidden" data-testid={`shop-item-${item.id}`}>
              {item.imageUrl && (
                <div className="aspect-video bg-afrocat-white-5 overflow-hidden">
                  <img src={item.imageUrl} alt={item.title} className="w-full h-full object-cover" />
                </div>
              )}
              <div className="p-5">
                <h3 className="text-lg font-bold text-afrocat-text">{item.title}</h3>
                {item.description && <p className="text-sm text-afrocat-muted mt-2">{item.description}</p>}
                {item.price != null && (
                  <p className="text-2xl font-bold text-afrocat-gold mt-3">{item.currency || "NAD"} {item.price.toFixed(2)}</p>
                )}
                {item.category && <span className="inline-block mt-3 text-xs px-2 py-0.5 rounded-full bg-afrocat-teal-soft text-afrocat-teal">{item.category}</span>}
                <div className="mt-4">
                  <Button variant="outline" size="sm" className="border-afrocat-border text-afrocat-muted hover:bg-afrocat-white-5" data-testid={`button-contact-${item.id}`}>
                    <MessageCircle className="h-4 w-4 mr-1" /> Contact Admin
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
