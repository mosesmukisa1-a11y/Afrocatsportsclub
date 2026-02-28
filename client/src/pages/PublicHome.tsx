import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useLocation } from "wouter";
import { ShoppingBag, Camera, LogIn, UserPlus, ChevronRight, MapPin, Mail, Phone } from "lucide-react";
import { Button } from "@/components/ui/button";
import logo from "@assets/afrocate_logo_1772226294597.png";

export default function PublicHome() {
  const [, setLocation] = useLocation();
  const { data: media = [] } = useQuery({ queryKey: ["/api/public/media"], queryFn: api.getPublicMedia });
  const { data: shop = [] } = useQuery({ queryKey: ["/api/public/shop"], queryFn: api.getPublicShop });

  return (
    <div className="min-h-screen bg-afrocat-bg">
      <header className="sticky top-0 z-50 bg-afrocat-card/90 backdrop-blur-md border-b border-afrocat-border">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img src={logo} alt="Afrocat" className="w-10 h-10 object-contain" />
            <div>
              <h1 className="text-lg font-display font-bold text-afrocat-teal tracking-tight">Afrocat Volleyball Club</h1>
              <p className="text-[10px] text-afrocat-muted hidden sm:block">One Team One Dream — Passion Discipline Victory</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => setLocation("/login")} className="border-afrocat-border text-afrocat-muted hover:bg-afrocat-white-5 hover:text-afrocat-text" data-testid="button-login">
              <LogIn className="h-4 w-4 mr-1" /> Sign In
            </Button>
            <Button size="sm" onClick={() => setLocation("/register")} className="bg-afrocat-teal hover:bg-afrocat-teal-dark text-white" data-testid="button-register">
              <UserPlus className="h-4 w-4 mr-1" /> Join
            </Button>
          </div>
        </div>
      </header>

      <section className="relative bg-afrocat-glow py-20 px-4">
        <div className="max-w-4xl mx-auto text-center">
          <img src={logo} alt="Afrocat" className="w-32 h-32 object-contain mx-auto mb-6 animate-in zoom-in-50 duration-700" />
          <h2 className="text-4xl md:text-5xl font-display font-bold text-afrocat-text mb-4">Afrocat Volleyball Club</h2>
          <p className="text-lg text-afrocat-muted mb-2">One Team One Dream — Passion Discipline Victory</p>
          <p className="text-sm text-afrocat-muted max-w-xl mx-auto mb-8">Namibia's premier volleyball club. Building champions through discipline, teamwork, and relentless pursuit of excellence.</p>
          <div className="flex justify-center gap-4">
            <Button onClick={() => setLocation("/register")} className="bg-afrocat-teal hover:bg-afrocat-teal-dark text-white px-8" data-testid="button-hero-register">
              Join the Club <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
            <Button variant="outline" onClick={() => setLocation("/login")} className="border-afrocat-border text-afrocat-text hover:bg-afrocat-white-5 px-8" data-testid="button-hero-login">
              Member Login
            </Button>
          </div>
        </div>
      </section>

      {media.length > 0 && (
        <section className="py-16 px-4 max-w-6xl mx-auto">
          <div className="flex items-center justify-between mb-8">
            <h3 className="flex items-center gap-2 text-2xl font-display font-bold text-afrocat-text">
              <Camera className="h-6 w-6 text-afrocat-teal" /> Media Gallery
            </h3>
            <button onClick={() => setLocation("/media")} className="flex items-center gap-1 text-sm text-afrocat-teal hover:underline cursor-pointer" data-testid="link-all-media">
              View All <ChevronRight className="h-4 w-4" />
            </button>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {media.slice(0, 8).map((post: any) => (
              <div key={post.id} className="afrocat-card overflow-hidden group" data-testid={`media-card-${post.id}`}>
                <div className="aspect-square bg-afrocat-white-5 overflow-hidden">
                  <img src={post.imageUrl} alt={post.title || "Media"} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                </div>
                {(post.title || post.caption) && (
                  <div className="p-3">
                    {post.title && <p className="text-sm font-medium text-afrocat-text truncate">{post.title}</p>}
                    {post.caption && <p className="text-xs text-afrocat-muted truncate">{post.caption}</p>}
                  </div>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      {shop.length > 0 && (
        <section className="py-16 px-4 max-w-6xl mx-auto">
          <div className="flex items-center justify-between mb-8">
            <h3 className="flex items-center gap-2 text-2xl font-display font-bold text-afrocat-text">
              <ShoppingBag className="h-6 w-6 text-afrocat-gold" /> Club Shop
            </h3>
            <button onClick={() => setLocation("/shop")} className="flex items-center gap-1 text-sm text-afrocat-teal hover:underline cursor-pointer" data-testid="link-all-shop">
              View All <ChevronRight className="h-4 w-4" />
            </button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {shop.slice(0, 6).map((item: any) => (
              <div key={item.id} className="afrocat-card overflow-hidden" data-testid={`shop-item-${item.id}`}>
                {item.imageUrl && (
                  <div className="aspect-video bg-afrocat-white-5 overflow-hidden">
                    <img src={item.imageUrl} alt={item.title} className="w-full h-full object-cover" />
                  </div>
                )}
                <div className="p-4">
                  <h4 className="font-bold text-afrocat-text">{item.title}</h4>
                  {item.description && <p className="text-sm text-afrocat-muted mt-1 line-clamp-2">{item.description}</p>}
                  {item.price != null && (
                    <p className="text-lg font-bold text-afrocat-gold mt-2">{item.currency || "NAD"} {item.price.toFixed(2)}</p>
                  )}
                  {item.category && <span className="inline-block mt-2 text-xs px-2 py-0.5 rounded-full bg-afrocat-teal-soft text-afrocat-teal">{item.category}</span>}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      <footer className="border-t border-afrocat-border py-12 px-4 bg-afrocat-card">
        <div className="max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-8">
          <div>
            <div className="flex items-center gap-3 mb-4">
              <img src={logo} alt="Afrocat" className="w-8 h-8 object-contain" />
              <span className="font-display font-bold text-afrocat-teal">Afrocat Volleyball Club</span>
            </div>
            <p className="text-sm text-afrocat-muted">Building champions through discipline, teamwork, and passion for the sport.</p>
          </div>
          <div>
            <h4 className="font-bold text-afrocat-text mb-3">Quick Links</h4>
            <div className="space-y-2">
              <button onClick={() => setLocation("/login")} className="block text-sm text-afrocat-muted hover:text-afrocat-teal cursor-pointer">Member Login</button>
              <button onClick={() => setLocation("/register")} className="block text-sm text-afrocat-muted hover:text-afrocat-teal cursor-pointer">Join the Club</button>
              {media.length > 0 && <button onClick={() => setLocation("/media")} className="block text-sm text-afrocat-muted hover:text-afrocat-teal cursor-pointer">Media Gallery</button>}
              {shop.length > 0 && <button onClick={() => setLocation("/shop")} className="block text-sm text-afrocat-muted hover:text-afrocat-teal cursor-pointer">Club Shop</button>}
            </div>
          </div>
          <div>
            <h4 className="font-bold text-afrocat-text mb-3">Contact</h4>
            <div className="space-y-2 text-sm text-afrocat-muted">
              <p className="flex items-center gap-2"><MapPin className="h-4 w-4 text-afrocat-teal" /> Windhoek, Namibia</p>
              <p className="flex items-center gap-2"><Mail className="h-4 w-4 text-afrocat-teal" /> info@afrocatvc.com</p>
              <p className="flex items-center gap-2"><Phone className="h-4 w-4 text-afrocat-teal" /> +264 81 000 0000</p>
            </div>
          </div>
        </div>
        <div className="max-w-6xl mx-auto mt-8 pt-6 border-t border-afrocat-border text-center text-xs text-afrocat-muted">
          &copy; {new Date().getFullYear()} Afrocat Volleyball Club. All rights reserved.
        </div>
      </footer>
    </div>
  );
}
