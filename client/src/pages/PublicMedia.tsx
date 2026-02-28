import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useLocation } from "wouter";
import { Camera, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import logo from "@assets/afrocate_logo_1772226294597.png";

export default function PublicMedia() {
  const [, setLocation] = useLocation();
  const { data: media = [], isLoading } = useQuery({ queryKey: ["/api/public/media"], queryFn: api.getPublicMedia });

  return (
    <div className="min-h-screen bg-afrocat-bg">
      <header className="sticky top-0 z-50 bg-afrocat-card/90 backdrop-blur-md border-b border-afrocat-border">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={() => setLocation("/")} className="text-afrocat-muted hover:text-afrocat-text cursor-pointer" data-testid="button-back">
              <ArrowLeft className="h-5 w-5" />
            </button>
            <img src={logo} alt="Afrocat" className="w-8 h-8 object-contain" />
            <h1 className="text-lg font-display font-bold text-afrocat-teal">Media Gallery</h1>
          </div>
          <Button size="sm" onClick={() => setLocation("/login")} className="bg-afrocat-teal hover:bg-afrocat-teal-dark text-white" data-testid="button-login">Sign In</Button>
        </div>
      </header>

      <div className="max-w-6xl mx-auto px-4 py-8">
        <div className="flex items-center gap-2 mb-8">
          <Camera className="h-6 w-6 text-afrocat-teal" />
          <h2 className="text-2xl font-display font-bold text-afrocat-text">Club Photos</h2>
          <span className="text-sm text-afrocat-muted ml-2">({media.length} photos)</span>
        </div>

        {isLoading && <p className="text-afrocat-muted text-center py-20">Loading photos...</p>}

        {!isLoading && media.length === 0 && (
          <div className="text-center py-20">
            <Camera className="h-12 w-12 text-afrocat-muted mx-auto mb-4" />
            <p className="text-afrocat-muted">No photos available yet.</p>
          </div>
        )}

        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {media.map((post: any) => (
            <div key={post.id} className="afrocat-card overflow-hidden group" data-testid={`media-card-${post.id}`}>
              <div className="aspect-square bg-afrocat-white-5 overflow-hidden">
                <img src={post.imageUrl} alt={post.title || "Photo"} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
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
      </div>
    </div>
  );
}
