import { useState, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Layout } from "@/components/Layout";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import { Image, Upload, X, FileVideo, FileText, Calendar, Download, ChevronLeft, ChevronRight, Maximize2, Eye } from "lucide-react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";

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
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [viewMedia, setViewMedia] = useState<any>(null);
  const [slideIndex, setSlideIndex] = useState(0);
  const [showSlideshow, setShowSlideshow] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<Record<string, string>>({});

  const { data: media = [], isLoading } = useQuery({
    queryKey: ["/api/media"],
    queryFn: () => api.getMedia(),
  });

  const approvedMedia = media.filter((m: any) => m.status === "APPROVED");
  const imageMedia = approvedMedia.filter((m: any) => isImage(m.imageUrl || m.url));

  const uploadMut = useMutation({
    mutationFn: async () => {
      if (selectedFiles.length === 0) throw new Error("No files selected");
      const formData = new FormData();
      for (const file of selectedFiles) {
        formData.append("files", file);
      }
      if (title) formData.append("title", title);
      if (description) formData.append("description", description);
      formData.append("isPublic", "true");

      const progress: Record<string, string> = {};
      selectedFiles.forEach(f => { progress[f.name] = "uploading"; });
      setUploadProgress(progress);

      const result = await api.uploadMediaMulti(formData);

      selectedFiles.forEach(f => { progress[f.name] = "done"; });
      setUploadProgress({ ...progress });

      return result;
    },
    onSuccess: () => {
      toast({ title: `${selectedFiles.length} file(s) uploaded successfully` });
      resetUpload();
      qc.invalidateQueries({ queryKey: ["/api/media"] });
    },
    onError: (e: any) => {
      toast({ title: "Upload failed", description: e.message, variant: "destructive" });
      setUploadProgress({});
    },
  });

  function resetUpload() {
    setShowUpload(false);
    setSelectedFiles([]);
    setTitle("");
    setDescription("");
    setUploadProgress({});
    if (fileRef.current) fileRef.current.value = "";
  }

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;
    setSelectedFiles(files);
  }

  function removeFile(index: number) {
    setSelectedFiles(prev => prev.filter((_, i) => i !== index));
  }

  return (
    <Layout>
      <div className="p-6 max-w-5xl mx-auto space-y-6">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <Image className="h-7 w-7 text-afrocat-teal" />
            <div>
              <h1 className="text-2xl font-display font-bold text-afrocat-text" data-testid="text-media-title">Media Gallery</h1>
              <p className="text-xs text-afrocat-muted">Club photos, videos, and files</p>
            </div>
          </div>
          <div className="flex gap-2">
            {imageMedia.length > 0 && (
              <button onClick={() => { setSlideIndex(0); setShowSlideshow(true); }}
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-afrocat-gold text-white font-bold text-sm cursor-pointer" data-testid="button-slideshow">
                <Maximize2 className="h-4 w-4" /> Slideshow
              </button>
            )}
            {canUpload && (
              <button onClick={() => setShowUpload(true)}
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-afrocat-teal text-white font-bold text-sm cursor-pointer" data-testid="button-upload-media">
                <Upload className="h-4 w-4" /> Upload Media
              </button>
            )}
          </div>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-12"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-afrocat-teal" /></div>
        ) : approvedMedia.length === 0 ? (
          <div className="afrocat-card p-12 text-center">
            <Image className="h-16 w-16 mx-auto mb-4 text-afrocat-muted opacity-30" />
            <h3 className="text-lg font-display font-bold text-afrocat-text mb-1">No media yet</h3>
            <p className="text-sm text-afrocat-muted">{canUpload ? "Upload photos and videos to share." : "Check back later."}</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4" data-testid="media-grid">
            {approvedMedia.map((item: any) => {
              const url = item.imageUrl || item.url;
              return (
                <div key={item.id} className="afrocat-card overflow-hidden group hover:border-afrocat-teal/30 transition-colors" data-testid={`media-item-${item.id}`}>
                  <div className="aspect-square bg-afrocat-white-5 flex items-center justify-center overflow-hidden relative cursor-pointer" onClick={() => setViewMedia(item)}>
                    {isImage(url) ? (
                      <img src={url} alt={item.title || "Media"} className="w-full h-full object-cover group-hover:scale-105 transition-transform" />
                    ) : isVideo(url) ? (
                      <video src={url} className="w-full h-full object-cover" muted />
                    ) : (
                      <FileText className="h-12 w-12 text-afrocat-muted" />
                    )}
                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors flex items-center justify-center">
                      <Eye className="h-8 w-8 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                    </div>
                  </div>
                  <div className="p-3 flex items-center justify-between">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-afrocat-text truncate">{item.title || "Untitled"}</p>
                      <p className="text-[10px] text-afrocat-muted flex items-center gap-1">
                        <Calendar className="h-3 w-3" /> {new Date(item.createdAt).toLocaleDateString()}
                      </p>
                    </div>
                    <a href={url} download title="Download" onClick={e => e.stopPropagation()}
                      className="p-1.5 rounded-lg hover:bg-afrocat-white-5 text-afrocat-muted hover:text-afrocat-teal transition-colors" data-testid={`button-download-${item.id}`}>
                      <Download className="h-4 w-4" />
                    </a>
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
            <div onClick={() => fileRef.current?.click()}
              className="border-2 border-dashed border-afrocat-border rounded-xl p-6 text-center cursor-pointer hover:border-afrocat-teal/50 transition-colors" data-testid="dropzone-upload">
              {selectedFiles.length > 0 ? (
                <div className="space-y-2">
                  <p className="text-sm font-bold text-afrocat-teal">{selectedFiles.length} file(s) selected</p>
                  <p className="text-xs text-afrocat-muted">Click to change selection</p>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-2">
                  <Upload className="h-10 w-10 text-afrocat-muted" />
                  <p className="text-sm text-afrocat-muted">Click to select files</p>
                  <p className="text-[10px] text-afrocat-muted">Select multiple files (max 10, 50MB each)</p>
                </div>
              )}
            </div>
            <input ref={fileRef} type="file" multiple accept="image/*,video/*,.pdf,.doc,.docx" onChange={handleFileSelect} className="hidden" data-testid="input-file-upload" />

            {selectedFiles.length > 0 && (
              <div className="space-y-1 max-h-40 overflow-y-auto">
                {selectedFiles.map((f, i) => (
                  <div key={i} className="flex items-center gap-2 p-2 rounded-lg bg-afrocat-white-3 border border-afrocat-border">
                    <span className="flex-1 text-xs text-afrocat-text truncate">{f.name}</span>
                    <span className="text-[10px] text-afrocat-muted">{(f.size / 1024 / 1024).toFixed(1)}MB</span>
                    {uploadProgress[f.name] === "done" && <span className="text-[10px] text-green-400 font-bold">Done</span>}
                    {uploadProgress[f.name] === "uploading" && <span className="text-[10px] text-afrocat-gold font-bold">...</span>}
                    {!uploadProgress[f.name] && (
                      <button onClick={(e) => { e.stopPropagation(); removeFile(i); }} className="text-afrocat-muted hover:text-afrocat-red cursor-pointer"><X className="h-3 w-3" /></button>
                    )}
                  </div>
                ))}
              </div>
            )}

            <div>
              <label className="text-xs text-afrocat-muted mb-1 block">Title prefix (optional)</label>
              <input value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g. Match Day Photos"
                className="w-full px-3 py-2 rounded-lg bg-afrocat-white-5 border border-afrocat-border text-afrocat-text text-sm placeholder:text-afrocat-muted focus:outline-none focus:ring-1 focus:ring-afrocat-teal" data-testid="input-media-title" />
            </div>
            <div>
              <label className="text-xs text-afrocat-muted mb-1 block">Description (optional)</label>
              <textarea value={description} onChange={e => setDescription(e.target.value)} placeholder="Add a description..." rows={2}
                className="w-full px-3 py-2 rounded-lg bg-afrocat-white-5 border border-afrocat-border text-afrocat-text text-sm placeholder:text-afrocat-muted focus:outline-none focus:ring-1 focus:ring-afrocat-teal resize-none" data-testid="input-media-description" />
            </div>
            <div className="flex gap-3">
              <button onClick={() => uploadMut.mutate()} disabled={selectedFiles.length === 0 || uploadMut.isPending}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-afrocat-teal text-white font-bold text-sm cursor-pointer disabled:opacity-50" data-testid="button-submit-upload">
                <Upload className="h-4 w-4" /> {uploadMut.isPending ? `Uploading ${selectedFiles.length} file(s)...` : `Upload ${selectedFiles.length} file(s)`}
              </button>
              <button onClick={resetUpload} className="px-4 py-2 rounded-xl bg-afrocat-white-5 text-afrocat-muted font-bold text-sm cursor-pointer">Cancel</button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={!!viewMedia} onOpenChange={(open) => { if (!open) setViewMedia(null); }}>
        <DialogContent className="bg-afrocat-card border-afrocat-border text-afrocat-text max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogTitle className="text-lg font-display font-bold text-afrocat-text">{viewMedia?.title || "Media"}</DialogTitle>
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
                      <a href={url} target="_blank" rel="noopener noreferrer" className="text-afrocat-teal hover:underline text-sm">Open file</a>
                    </div>
                  )}
                </div>
                {viewMedia.caption && <p className="text-sm text-afrocat-muted">{viewMedia.caption}</p>}
                <div className="flex items-center justify-between">
                  <span className="text-xs text-afrocat-muted flex items-center gap-1">
                    <Calendar className="h-3 w-3" /> {new Date(viewMedia.createdAt).toLocaleDateString([], { month: "long", day: "numeric", year: "numeric" })}
                  </span>
                  <a href={url} download className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-afrocat-teal text-white text-xs font-bold cursor-pointer">
                    <Download className="h-3 w-3" /> Download
                  </a>
                </div>
              </div>
            );
          })()}
        </DialogContent>
      </Dialog>

      {showSlideshow && imageMedia.length > 0 && (
        <div className="fixed inset-0 bg-black z-[100] flex flex-col">
          <div className="flex items-center justify-between p-4">
            <span className="text-white text-sm font-bold">{slideIndex + 1} / {imageMedia.length}</span>
            <button onClick={() => setShowSlideshow(false)} className="text-white p-2 cursor-pointer"><X className="h-6 w-6" /></button>
          </div>
          <div className="flex-1 flex items-center justify-center relative">
            <button onClick={() => setSlideIndex(i => (i - 1 + imageMedia.length) % imageMedia.length)}
              className="absolute left-4 p-3 rounded-full bg-white/10 text-white hover:bg-white/20 cursor-pointer z-10" data-testid="button-slide-prev">
              <ChevronLeft className="h-6 w-6" />
            </button>
            <img src={imageMedia[slideIndex]?.imageUrl || imageMedia[slideIndex]?.url} alt=""
              className="max-w-full max-h-[80vh] object-contain" />
            <button onClick={() => setSlideIndex(i => (i + 1) % imageMedia.length)}
              className="absolute right-4 p-3 rounded-full bg-white/10 text-white hover:bg-white/20 cursor-pointer z-10" data-testid="button-slide-next">
              <ChevronRight className="h-6 w-6" />
            </button>
          </div>
          <div className="p-4 text-center">
            <p className="text-white text-sm font-bold">{imageMedia[slideIndex]?.title || ""}</p>
          </div>
        </div>
      )}
    </Layout>
  );
}
