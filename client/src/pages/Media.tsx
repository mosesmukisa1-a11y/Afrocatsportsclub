import { useState, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Layout } from "@/components/Layout";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Image, Upload, X, FileVideo, FileText, Calendar, User, Eye } from "lucide-react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";

function getMimeIcon(url: string) {
  const ext = url.split(".").pop()?.toLowerCase() || "";
  if (["mp4", "webm", "mov", "avi"].includes(ext)) return FileVideo;
  if (["pdf", "doc", "docx"].includes(ext)) return FileText;
  return Image;
}

function isVideo(url: string) {
  const ext = url.split(".").pop()?.toLowerCase() || "";
  return ["mp4", "webm", "mov", "avi"].includes(ext);
}

function isImage(url: string) {
  const ext = url.split(".").pop()?.toLowerCase() || "";
  return ["jpg", "jpeg", "png", "gif", "webp", "svg", "bmp"].includes(ext);
}

export default function Media() {
  const { user } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const canUpload = user?.isSuperAdmin || ["ADMIN", "MANAGER"].includes(user?.role || "");

  const [showUpload, setShowUpload] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [viewMedia, setViewMedia] = useState<any>(null);

  const { data: media = [], isLoading } = useQuery({
    queryKey: ["/api/media"],
    queryFn: () => api.getMedia(),
  });

  const approvedMedia = media.filter((m: any) => m.status === "APPROVED");

  const uploadMut = useMutation({
    mutationFn: async () => {
      if (!selectedFile) throw new Error("No file selected");
      const formData = new FormData();
      formData.append("file", selectedFile);
      if (title) formData.append("title", title);
      if (description) formData.append("description", description);
      formData.append("isPublic", "true");
      return api.uploadMedia(formData);
    },
    onSuccess: () => {
      toast({ title: "Media uploaded successfully" });
      resetUpload();
      qc.invalidateQueries({ queryKey: ["/api/media"] });
    },
    onError: (e: any) => toast({ title: "Upload failed", description: e.message, variant: "destructive" }),
  });

  function resetUpload() {
    setShowUpload(false);
    setSelectedFile(null);
    setPreview(null);
    setTitle("");
    setDescription("");
    if (fileRef.current) fileRef.current.value = "";
  }

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setSelectedFile(file);
    if (file.type.startsWith("image/")) {
      const reader = new FileReader();
      reader.onload = (ev) => setPreview(ev.target?.result as string);
      reader.readAsDataURL(file);
    } else {
      setPreview(null);
    }
  }

  return (
    <Layout>
      <div className="p-6 max-w-5xl mx-auto space-y-6">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <Image className="h-7 w-7 text-afrocat-teal" />
            <div>
              <h1 className="text-2xl font-display font-bold text-afrocat-text" data-testid="text-media-title">
                Media Gallery
              </h1>
              <p className="text-xs text-afrocat-muted">Club photos, videos, and files</p>
            </div>
          </div>
          {canUpload && (
            <Button
              onClick={() => setShowUpload(true)}
              data-testid="button-upload-media"
              className="bg-afrocat-teal hover:bg-afrocat-teal/90 text-white"
            >
              <Upload className="h-4 w-4 mr-2" /> Upload Media
            </Button>
          )}
        </div>

        {isLoading ? (
          <div className="flex justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-afrocat-teal" />
          </div>
        ) : approvedMedia.length === 0 ? (
          <div className="afrocat-card p-12 text-center">
            <Image className="h-16 w-16 mx-auto mb-4 text-afrocat-muted opacity-30" />
            <h3 className="text-lg font-display font-bold text-afrocat-text mb-1">No media yet</h3>
            <p className="text-sm text-afrocat-muted">
              {canUpload ? "Upload photos and videos to share with the team." : "Check back later for club media."}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4" data-testid="media-grid">
            {approvedMedia.map((item: any) => {
              const url = item.imageUrl || item.url;
              const isImg = isImage(url);
              const isVid = isVideo(url);
              const Icon = getMimeIcon(url);

              return (
                <div
                  key={item.id}
                  onClick={() => setViewMedia(item)}
                  className="afrocat-card overflow-hidden cursor-pointer group hover:border-afrocat-teal/30 transition-colors"
                  data-testid={`media-item-${item.id}`}
                >
                  <div className="aspect-square bg-afrocat-white-5 flex items-center justify-center overflow-hidden relative">
                    {isImg ? (
                      <img src={url} alt={item.title || "Media"} className="w-full h-full object-cover group-hover:scale-105 transition-transform" />
                    ) : isVid ? (
                      <video src={url} className="w-full h-full object-cover" muted />
                    ) : (
                      <Icon className="h-12 w-12 text-afrocat-muted" />
                    )}
                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors flex items-center justify-center">
                      <Eye className="h-8 w-8 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                    </div>
                  </div>
                  <div className="p-3">
                    <p className="text-sm font-medium text-afrocat-text truncate" data-testid={`text-media-title-${item.id}`}>
                      {item.title || "Untitled"}
                    </p>
                    <p className="text-[10px] text-afrocat-muted mt-0.5 flex items-center gap-1">
                      <Calendar className="h-3 w-3" />
                      {new Date(item.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <Dialog open={showUpload} onOpenChange={(open) => { if (!open) resetUpload(); }}>
        <DialogContent className="bg-afrocat-card border-afrocat-border text-afrocat-text max-w-md">
          <DialogTitle className="text-lg font-display font-bold text-afrocat-gold">Upload Media</DialogTitle>
          <div className="space-y-4">
            <div
              onClick={() => fileRef.current?.click()}
              className="border-2 border-dashed border-afrocat-border rounded-xl p-6 text-center cursor-pointer hover:border-afrocat-teal/50 transition-colors"
              data-testid="dropzone-upload"
            >
              {preview ? (
                <img src={preview} alt="Preview" className="max-h-40 mx-auto rounded-lg" />
              ) : selectedFile ? (
                <div className="flex flex-col items-center gap-2">
                  <FileText className="h-10 w-10 text-afrocat-teal" />
                  <p className="text-sm text-afrocat-text">{selectedFile.name}</p>
                  <p className="text-xs text-afrocat-muted">{(selectedFile.size / 1024 / 1024).toFixed(1)} MB</p>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-2">
                  <Upload className="h-10 w-10 text-afrocat-muted" />
                  <p className="text-sm text-afrocat-muted">Click to select a file</p>
                  <p className="text-[10px] text-afrocat-muted">Images, videos, or documents (max 50MB)</p>
                </div>
              )}
            </div>
            <input
              ref={fileRef}
              type="file"
              accept="image/*,video/*,.pdf,.doc,.docx"
              onChange={handleFileSelect}
              className="hidden"
              data-testid="input-file-upload"
            />

            <div>
              <label className="text-xs text-afrocat-muted mb-1 block">Title (optional)</label>
              <input
                value={title}
                onChange={e => setTitle(e.target.value)}
                placeholder="Give it a title..."
                className="w-full px-3 py-2 rounded-lg bg-afrocat-white-5 border border-afrocat-border text-afrocat-text text-sm placeholder:text-afrocat-muted focus:outline-none focus:ring-1 focus:ring-afrocat-teal"
                data-testid="input-media-title"
              />
            </div>

            <div>
              <label className="text-xs text-afrocat-muted mb-1 block">Description (optional)</label>
              <textarea
                value={description}
                onChange={e => setDescription(e.target.value)}
                placeholder="Add a description..."
                rows={3}
                className="w-full px-3 py-2 rounded-lg bg-afrocat-white-5 border border-afrocat-border text-afrocat-text text-sm placeholder:text-afrocat-muted focus:outline-none focus:ring-1 focus:ring-afrocat-teal resize-none"
                data-testid="input-media-description"
              />
            </div>

            <div className="flex gap-3">
              <Button
                onClick={() => uploadMut.mutate()}
                disabled={!selectedFile || uploadMut.isPending}
                data-testid="button-submit-upload"
                className="flex-1 bg-afrocat-teal hover:bg-afrocat-teal/90 text-white"
              >
                <Upload className="h-4 w-4 mr-2" />
                {uploadMut.isPending ? "Uploading..." : "Upload"}
              </Button>
              <Button variant="outline" onClick={resetUpload} className="border-afrocat-border text-afrocat-text">
                Cancel
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={!!viewMedia} onOpenChange={(open) => { if (!open) setViewMedia(null); }}>
        <DialogContent className="bg-afrocat-card border-afrocat-border text-afrocat-text max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogTitle className="text-lg font-display font-bold text-afrocat-text">
            {viewMedia?.title || "Media"}
          </DialogTitle>
          {viewMedia && (() => {
            const url = viewMedia.imageUrl || viewMedia.url;
            return (
              <div className="space-y-4">
                <div className="rounded-xl overflow-hidden bg-black flex items-center justify-center">
                  {isImage(url) ? (
                    <img src={url} alt={viewMedia.title || "Media"} className="max-w-full max-h-[60vh] object-contain" />
                  ) : isVideo(url) ? (
                    <video src={url} controls className="max-w-full max-h-[60vh]" />
                  ) : (
                    <div className="p-8 text-center">
                      <FileText className="h-16 w-16 text-afrocat-muted mx-auto mb-3" />
                      <a href={url} target="_blank" rel="noopener noreferrer" className="text-afrocat-teal hover:underline text-sm">
                        Open file in new tab
                      </a>
                    </div>
                  )}
                </div>
                {viewMedia.caption && (
                  <p className="text-sm text-afrocat-muted">{viewMedia.caption}</p>
                )}
                <div className="flex items-center gap-4 text-xs text-afrocat-muted">
                  <span className="flex items-center gap-1">
                    <Calendar className="h-3 w-3" />
                    {new Date(viewMedia.createdAt).toLocaleDateString([], { month: "long", day: "numeric", year: "numeric" })}
                  </span>
                </div>
              </div>
            );
          })()}
        </DialogContent>
      </Dialog>
    </Layout>
  );
}
