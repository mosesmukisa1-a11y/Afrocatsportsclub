import { Layout } from "@/components/Layout";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Camera, CheckCircle, XCircle, Plus, Tag, Upload, Eye } from "lucide-react";

export default function MediaManager() {
  const { user } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();
  const isAdmin = user && ["ADMIN", "MANAGER"].includes(user.role);
  const [tab, setTab] = useState<"all" | "pending" | "upload">("all");
  const [uploadForm, setUploadForm] = useState({ title: "", caption: "", imageUrl: "", visibility: "PUBLIC" });
  const [tagMediaId, setTagMediaId] = useState<string | null>(null);
  const [tagPlayerIds, setTagPlayerIds] = useState("");

  const { data: media = [] } = useQuery({ queryKey: ["/api/media"], queryFn: () => api.getMedia() });
  const { data: pendingMedia = [] } = useQuery({ queryKey: ["/api/media/pending"], queryFn: api.getPendingMedia, enabled: !!isAdmin });
  const { data: players = [] } = useQuery({ queryKey: ["/api/players"], queryFn: api.getPlayers });
  const { data: tagRequests = [] } = useQuery({ queryKey: ["/api/media/tag-requests"], queryFn: api.getMediaTagRequests, enabled: !!isAdmin });

  const uploadMut = useMutation({
    mutationFn: (data: any) => api.createMedia(data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["/api/media"] }); toast({ title: "Photo uploaded" }); setTab("all"); setUploadForm({ title: "", caption: "", imageUrl: "", visibility: "PUBLIC" }); },
  });

  const approveMut = useMutation({
    mutationFn: (id: string) => api.approveMedia(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["/api/media"] }); qc.invalidateQueries({ queryKey: ["/api/media/pending"] }); toast({ title: "Photo approved" }); },
  });

  const rejectMut = useMutation({
    mutationFn: (id: string) => api.rejectMedia(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["/api/media"] }); qc.invalidateQueries({ queryKey: ["/api/media/pending"] }); toast({ title: "Photo rejected" }); },
  });

  const tagMut = useMutation({
    mutationFn: (data: { mediaId: string; taggedPlayerIds: string[] }) => api.addMediaTags(data.mediaId, { taggedPlayerIds: data.taggedPlayerIds }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["/api/media"] }); toast({ title: "Tags added" }); setTagMediaId(null); setTagPlayerIds(""); },
  });

  const approveTagReq = useMutation({
    mutationFn: (id: string) => api.approveMediaTagRequest(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["/api/media/tag-requests"] }); qc.invalidateQueries({ queryKey: ["/api/media"] }); toast({ title: "Tag request approved" }); },
  });

  const rejectTagReq = useMutation({
    mutationFn: (id: string) => api.rejectMediaTagRequest(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["/api/media/tag-requests"] }); toast({ title: "Tag request rejected" }); },
  });

  return (
    <Layout>
      <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-display font-bold text-afrocat-text">Media Manager</h1>
            <p className="text-afrocat-muted mt-1">Upload, approve, and tag club photos</p>
          </div>
          <Button onClick={() => setTab("upload")} className="bg-afrocat-teal hover:bg-afrocat-teal-dark text-white" data-testid="button-upload-media">
            <Plus className="h-4 w-4 mr-1" /> Upload Photo
          </Button>
        </div>

        <div className="flex gap-2">
          {["all", "pending", "upload"].map(t => (
            <button key={t} onClick={() => setTab(t as any)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors cursor-pointer ${tab === t ? "bg-afrocat-teal text-white" : "bg-afrocat-white-5 text-afrocat-muted hover:text-afrocat-text"}`}
              data-testid={`tab-${t}`}>
              {t === "all" ? `All (${media.length})` : t === "pending" ? `Pending (${pendingMedia.length})` : "Upload"}
            </button>
          ))}
        </div>

        {tab === "upload" && (
          <div className="afrocat-card p-6 max-w-lg">
            <h3 className="text-lg font-bold text-afrocat-text mb-4 flex items-center gap-2"><Upload className="h-5 w-5 text-afrocat-teal" /> Upload Photo</h3>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label className="text-afrocat-muted text-sm">Image URL</Label>
                <Input value={uploadForm.imageUrl} onChange={e => setUploadForm(f => ({ ...f, imageUrl: e.target.value }))} placeholder="https://..." data-testid="input-image-url"
                  className="bg-afrocat-white-5 border-afrocat-border text-afrocat-text" />
              </div>
              <div className="space-y-2">
                <Label className="text-afrocat-muted text-sm">Title</Label>
                <Input value={uploadForm.title} onChange={e => setUploadForm(f => ({ ...f, title: e.target.value }))} placeholder="Photo title" data-testid="input-media-title"
                  className="bg-afrocat-white-5 border-afrocat-border text-afrocat-text" />
              </div>
              <div className="space-y-2">
                <Label className="text-afrocat-muted text-sm">Caption</Label>
                <Input value={uploadForm.caption} onChange={e => setUploadForm(f => ({ ...f, caption: e.target.value }))} placeholder="Caption" data-testid="input-media-caption"
                  className="bg-afrocat-white-5 border-afrocat-border text-afrocat-text" />
              </div>
              {isAdmin && (
                <div className="space-y-2">
                  <Label className="text-afrocat-muted text-sm">Visibility</Label>
                  <Select value={uploadForm.visibility} onValueChange={v => setUploadForm(f => ({ ...f, visibility: v }))}>
                    <SelectTrigger className="bg-afrocat-white-5 border-afrocat-border text-afrocat-text" data-testid="select-visibility">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="PUBLIC">Public</SelectItem>
                      <SelectItem value="TEAM_ONLY">Team Only</SelectItem>
                      <SelectItem value="PRIVATE">Private</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}
              <Button onClick={() => uploadMut.mutate(uploadForm)} disabled={!uploadForm.imageUrl || uploadMut.isPending}
                className="w-full bg-afrocat-teal hover:bg-afrocat-teal-dark text-white" data-testid="button-submit-upload">
                {uploadMut.isPending ? "Uploading..." : "Upload Photo"}
              </Button>
            </div>
          </div>
        )}

        {tab === "pending" && (
          <div className="space-y-6">
            {pendingMedia.length === 0 && <p className="text-afrocat-muted text-center py-8">No pending photos to review.</p>}
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {pendingMedia.map((post: any) => (
                <div key={post.id} className="afrocat-card overflow-hidden" data-testid={`pending-media-${post.id}`}>
                  <div className="aspect-square bg-afrocat-white-5 overflow-hidden">
                    <img src={post.imageUrl} alt={post.title || "Pending"} className="w-full h-full object-cover" />
                  </div>
                  <div className="p-3 space-y-2">
                    {post.title && <p className="text-sm font-medium text-afrocat-text truncate">{post.title}</p>}
                    <Badge className="bg-afrocat-gold-soft text-afrocat-gold border-0 text-xs">Pending Review</Badge>
                    <div className="flex gap-2">
                      <Button size="sm" onClick={() => approveMut.mutate(post.id)} className="flex-1 bg-afrocat-green-soft text-afrocat-green hover:bg-afrocat-green/20" data-testid={`button-approve-${post.id}`}>
                        <CheckCircle className="h-3 w-3 mr-1" /> Approve
                      </Button>
                      <Button size="sm" onClick={() => rejectMut.mutate(post.id)} className="flex-1 bg-afrocat-red-soft text-afrocat-red hover:bg-afrocat-red/20" data-testid={`button-reject-${post.id}`}>
                        <XCircle className="h-3 w-3 mr-1" /> Reject
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {tagRequests.length > 0 && (
              <div>
                <h3 className="text-lg font-bold text-afrocat-text mb-4">Tag Requests</h3>
                <div className="space-y-2">
                  {tagRequests.map((req: any) => (
                    <div key={req.id} className="afrocat-card p-4 flex items-center justify-between" data-testid={`tag-request-${req.id}`}>
                      <div>
                        <p className="text-sm text-afrocat-text">Player <span className="font-medium">{req.playerId}</span> wants to be tagged in media</p>
                      </div>
                      <div className="flex gap-2">
                        <Button size="sm" onClick={() => approveTagReq.mutate(req.id)} className="bg-afrocat-green-soft text-afrocat-green">Approve</Button>
                        <Button size="sm" onClick={() => rejectTagReq.mutate(req.id)} className="bg-afrocat-red-soft text-afrocat-red">Reject</Button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {tab === "all" && (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {media.map((post: any) => (
              <div key={post.id} className="afrocat-card overflow-hidden" data-testid={`media-item-${post.id}`}>
                <div className="aspect-square bg-afrocat-white-5 overflow-hidden">
                  <img src={post.imageUrl} alt={post.title || "Photo"} className="w-full h-full object-cover" />
                </div>
                <div className="p-3 space-y-2">
                  {post.title && <p className="text-sm font-medium text-afrocat-text truncate">{post.title}</p>}
                  <div className="flex items-center gap-1 flex-wrap">
                    <Badge className={`text-[10px] border-0 ${post.status === "APPROVED" ? "bg-afrocat-green-soft text-afrocat-green" : post.status === "PENDING_REVIEW" ? "bg-afrocat-gold-soft text-afrocat-gold" : "bg-afrocat-red-soft text-afrocat-red"}`}>
                      {post.status}
                    </Badge>
                    <Badge className="text-[10px] border-0 bg-afrocat-white-5 text-afrocat-muted">
                      <Eye className="h-2.5 w-2.5 mr-0.5" />{post.visibility}
                    </Badge>
                  </div>
                  {post.tags && post.tags.length > 0 && (
                    <div className="flex items-center gap-1 flex-wrap">
                      <Tag className="h-3 w-3 text-afrocat-teal" />
                      <span className="text-[10px] text-afrocat-muted">{post.tags.length} tagged</span>
                    </div>
                  )}
                  {isAdmin && (
                    <Button size="sm" variant="outline" onClick={() => { setTagMediaId(post.id); setTagPlayerIds(""); }}
                      className="w-full border-afrocat-border text-afrocat-muted text-xs hover:bg-afrocat-white-5" data-testid={`button-tag-${post.id}`}>
                      <Tag className="h-3 w-3 mr-1" /> Tag People
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {tagMediaId && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="afrocat-card p-6 w-full max-w-md">
              <h3 className="text-lg font-bold text-afrocat-text mb-4">Tag Players in Photo</h3>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label className="text-afrocat-muted text-sm">Select Players</Label>
                  <div className="max-h-48 overflow-y-auto space-y-1 bg-afrocat-white-5 rounded-lg p-2">
                    {players.map((p: any) => {
                      const selected = tagPlayerIds.split(",").filter(Boolean).includes(p.id);
                      return (
                        <button key={p.id} type="button"
                          onClick={() => {
                            const ids = tagPlayerIds.split(",").filter(Boolean);
                            setTagPlayerIds(selected ? ids.filter(i => i !== p.id).join(",") : [...ids, p.id].join(","));
                          }}
                          className={`w-full text-left px-3 py-2 rounded text-sm cursor-pointer transition-colors ${selected ? "bg-afrocat-teal/15 text-afrocat-teal" : "text-afrocat-text hover:bg-afrocat-white-10"}`}>
                          {p.firstName} {p.lastName} {p.jerseyNo ? `#${p.jerseyNo}` : ""}
                        </button>
                      );
                    })}
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button onClick={() => {
                    const ids = tagPlayerIds.split(",").filter(Boolean);
                    if (ids.length > 0) tagMut.mutate({ mediaId: tagMediaId, taggedPlayerIds: ids });
                  }} disabled={!tagPlayerIds || tagMut.isPending} className="flex-1 bg-afrocat-teal hover:bg-afrocat-teal-dark text-white">
                    {tagMut.isPending ? "Saving..." : "Save Tags"}
                  </Button>
                  <Button variant="outline" onClick={() => setTagMediaId(null)} className="border-afrocat-border text-afrocat-muted">Cancel</Button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}
