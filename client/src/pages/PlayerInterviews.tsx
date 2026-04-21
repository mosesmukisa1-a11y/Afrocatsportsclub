import { Layout } from "@/components/Layout";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/lib/auth";
import { useState, useMemo, useEffect, useRef } from "react";
import {
  Mic, Plus, Star, Trash2, Edit3, Play, X,
  Tag, Search, Video, Camera, Heart, Eye,
  ChevronDown, ChevronRight, Share2, Clock,
  Quote, BookOpen, Zap, TrendingUp, User,
  MessageSquare
} from "lucide-react";
import { VideoRecorder } from "@/components/VideoRecorder";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import logo from "@assets/afrocate_logo_1772226294597.png";

function getInitials(name: string): string {
  const parts = (name || "").trim().split(" ");
  return (parts[0]?.[0] || "") + (parts[1]?.[0] || "");
}

function readingTime(questions: string[], answers: string[]): number {
  const text = [...(questions || []), ...(answers || [])].join(" ");
  const words = text.split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.round(words / 180));
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const days = Math.floor(diff / 86400000);
  if (days === 0) return "Today";
  if (days === 1) return "Yesterday";
  if (days < 7) return `${days}d ago`;
  if (days < 30) return `${Math.floor(days / 7)}w ago`;
  if (days < 365) return `${Math.floor(days / 30)}mo ago`;
  return `${Math.floor(days / 365)}y ago`;
}

const INTERVIEW_TAGS = ["Debut", "Pre-Match", "Post-Match", "Training", "Personal Story", "Motivation", "Season Review", "Comeback", "Captain's Chat", "Rookie Talk"];

const TAG_COLORS: Record<string, string> = {
  "Debut": "bg-purple-500/20 text-purple-300",
  "Pre-Match": "bg-blue-500/20 text-blue-300",
  "Post-Match": "bg-orange-500/20 text-orange-300",
  "Training": "bg-green-500/20 text-green-300",
  "Personal Story": "bg-pink-500/20 text-pink-300",
  "Motivation": "bg-yellow-500/20 text-yellow-300",
  "Season Review": "bg-red-500/20 text-red-300",
  "Comeback": "bg-afrocat-teal/20 text-afrocat-teal",
  "Captain's Chat": "bg-afrocat-gold/20 text-afrocat-gold",
  "Rookie Talk": "bg-indigo-500/20 text-indigo-300",
};

function TagChip({ tag }: { tag: string }) {
  const cls = TAG_COLORS[tag] || "bg-afrocat-white-5 text-afrocat-muted";
  return <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${cls}`}>{tag}</span>;
}

function PlayerAvatar({ photoUrl, name, size = "md" }: { photoUrl?: string; name: string; size?: "sm" | "md" | "lg" | "xl" }) {
  const sizes = { sm: "w-10 h-10 text-sm", md: "w-14 h-14 text-base", lg: "w-20 h-20 text-xl", xl: "w-28 h-28 text-2xl" };
  if (photoUrl) return <img src={photoUrl} alt={name} className={`${sizes[size]} rounded-full object-cover ring-2 ring-afrocat-teal/30`} />;
  return (
    <div className={`${sizes[size]} rounded-full bg-gradient-to-br from-afrocat-teal/30 to-afrocat-gold/20 flex items-center justify-center font-bold text-afrocat-gold ring-2 ring-afrocat-teal/20`}>
      {getInitials(name).toUpperCase()}
    </div>
  );
}

// ─── DETAIL MODAL ────────────────────────────────────────────────────────
function InterviewModal({
  interview, liked, onClose, onLike, onEdit, onDelete, canManage
}: {
  interview: any; liked: boolean; onClose: () => void;
  onLike: () => void; onEdit: () => void; onDelete: () => void; canManage: boolean;
}) {
  const viewMut = useMutation({ mutationFn: () => api.viewInterview(interview.id) });
  const didView = useRef(false);

  useEffect(() => {
    if (!didView.current) { didView.current = true; viewMut.mutate(); }
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = ""; };
  }, []);

  const handleShare = () => {
    navigator.clipboard?.writeText(`${window.location.origin}/interviews#${interview.id}`);
  };

  const mins = readingTime(interview.questions || [], interview.answers || []);

  return (
    <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-3 sm:p-6" onClick={onClose}>
      <div className="bg-afrocat-card border border-afrocat-border rounded-2xl w-full max-w-2xl max-h-[92vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="relative">
          <div className="h-32 bg-gradient-to-br from-afrocat-teal/20 via-afrocat-gold/10 to-transparent rounded-t-2xl" />
          <button onClick={onClose} className="absolute top-4 right-4 p-2 rounded-full bg-black/40 text-white hover:bg-black/60 cursor-pointer" data-testid="button-close-modal">
            <X className="w-4 h-4" />
          </button>
          <div className="absolute bottom-0 left-6 translate-y-1/2">
            <div className="relative">
              <PlayerAvatar photoUrl={interview.playerPhotoUrl} name={interview.playerName || ""} size="lg" />
              {interview.format === "VIDEO" && (
                <div className="absolute -bottom-1 -right-1 bg-afrocat-teal rounded-full w-7 h-7 flex items-center justify-center border-2 border-afrocat-card">
                  <Video className="w-3.5 h-3.5 text-white" />
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="pt-12 px-6 pb-6 space-y-5">
          {/* Player info */}
          <div>
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-afrocat-teal font-bold text-sm">{interview.playerName}</p>
                <h2 className="font-display font-bold text-xl text-afrocat-text leading-tight mt-1">{interview.title}</h2>
                <div className="flex items-center gap-3 mt-2 text-xs text-afrocat-muted">
                  {interview.playerPosition && <span>{interview.playerPosition}</span>}
                  {interview.playerJerseyNo && <span>#{interview.playerJerseyNo}</span>}
                  {interview.format === "TEXT" && <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{mins} min read</span>}
                  {interview.publishedAt && <span>{timeAgo(interview.publishedAt)}</span>}
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {canManage && (
                  <>
                    <button onClick={onEdit} className="p-2 rounded-lg hover:bg-afrocat-white-5 text-afrocat-muted cursor-pointer" data-testid="button-modal-edit"><Edit3 className="w-4 h-4" /></button>
                    <button onClick={onDelete} className="p-2 rounded-lg hover:bg-red-500/10 text-afrocat-muted hover:text-red-400 cursor-pointer" data-testid="button-modal-delete"><Trash2 className="w-4 h-4" /></button>
                  </>
                )}
                <button onClick={handleShare} className="p-2 rounded-lg hover:bg-afrocat-white-5 text-afrocat-muted cursor-pointer" title="Copy link" data-testid="button-share-interview"><Share2 className="w-4 h-4" /></button>
              </div>
            </div>
            {(interview.tags || []).length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-3">
                {interview.tags.map((t: string) => <TagChip key={t} tag={t} />)}
              </div>
            )}
          </div>

          {/* Video */}
          {interview.format === "VIDEO" && interview.videoUrl && (
            <div className="rounded-xl overflow-hidden bg-black aspect-video">
              {/^\/uploads\/|\.webm$|\.mp4$/i.test(interview.videoUrl) ? (
                <video src={interview.videoUrl} controls playsInline className="w-full h-full object-contain" data-testid={`video-modal-${interview.id}`} />
              ) : (
                <iframe src={interview.videoUrl} className="w-full h-full" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowFullScreen />
              )}
            </div>
          )}

          {/* Q&A */}
          <div className="space-y-5">
            {(interview.questions || []).map((q: string, idx: number) => (
              <div key={idx} className="relative pl-5">
                <div className="absolute left-0 top-0 bottom-0 w-0.5 bg-gradient-to-b from-afrocat-teal/60 to-transparent rounded-full" />
                <p className="text-sm font-bold text-afrocat-teal flex items-start gap-2">
                  <MessageSquare className="w-3.5 h-3.5 mt-0.5 shrink-0" />{q}
                </p>
                <p className="text-sm text-afrocat-text leading-relaxed mt-2 ml-5">
                  {interview.answers?.[idx] || ""}
                </p>
              </div>
            ))}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between pt-4 border-t border-afrocat-border">
            <div className="flex items-center gap-4">
              <button
                onClick={onLike}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-bold transition-all cursor-pointer ${liked ? "bg-red-500/15 text-red-400" : "bg-afrocat-white-5 text-afrocat-muted hover:text-red-400"}`}
                data-testid={`button-like-modal-${interview.id}`}
              >
                <Heart className={`w-4 h-4 ${liked ? "fill-red-400" : ""}`} />
                {interview.likesCount || 0}
              </button>
              <div className="flex items-center gap-1.5 text-xs text-afrocat-muted">
                <Eye className="w-3.5 h-3.5" />
                {(interview.viewCount || 0) + 1} views
              </div>
            </div>
            <span className="text-[10px] text-afrocat-muted">
              By {interview.publisherName} · {interview.publishedAt ? new Date(interview.publishedAt).toLocaleDateString() : ""}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── INTERVIEW CARD ────────────────────────────────────────────────────────
function InterviewCard({
  interview, liked, onOpen, onLike, onEdit, onDelete, onToggleFeatured, canManage
}: {
  interview: any; liked: boolean;
  onOpen: () => void; onLike: (e: React.MouseEvent) => void;
  onEdit: (e: React.MouseEvent) => void; onDelete: (e: React.MouseEvent) => void;
  onToggleFeatured: (e: React.MouseEvent) => void; canManage: boolean;
}) {
  const mins = readingTime(interview.questions || [], interview.answers || []);
  const preview = interview.answers?.[0]?.slice(0, 120);

  return (
    <div
      className="afrocat-card overflow-hidden group hover:border-afrocat-teal/30 transition-all duration-200 cursor-pointer flex flex-col"
      onClick={onOpen}
      data-testid={`card-interview-${interview.id}`}
    >
      {/* Top accent bar */}
      <div className={`h-1 w-full ${interview.featured ? "bg-gradient-to-r from-afrocat-gold to-afrocat-teal" : "bg-afrocat-teal/20 group-hover:bg-afrocat-teal/40 transition-all"}`} />

      <div className="p-4 flex-1 flex flex-col gap-3">
        {/* Player row */}
        <div className="flex items-center gap-3">
          <div className="relative shrink-0">
            <PlayerAvatar photoUrl={interview.playerPhotoUrl} name={interview.playerName || ""} size="sm" />
            {interview.playerJerseyNo && (
              <div className="absolute -bottom-1 -right-1 bg-afrocat-teal text-white text-[9px] font-bold rounded-full w-4 h-4 flex items-center justify-center border border-afrocat-card">
                {interview.playerJerseyNo}
              </div>
            )}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-bold text-afrocat-teal truncate">{interview.playerName}</p>
            <p className="text-[10px] text-afrocat-muted">{interview.playerPosition || "Player"}</p>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            {interview.featured && <Star className="w-3.5 h-3.5 text-afrocat-gold fill-afrocat-gold" />}
            {interview.format === "VIDEO" ? (
              <span className="flex items-center gap-0.5 px-1.5 py-0.5 rounded-md bg-afrocat-teal/15 text-afrocat-teal text-[9px] font-bold"><Video className="w-2.5 h-2.5" />VIDEO</span>
            ) : (
              <span className="flex items-center gap-0.5 px-1.5 py-0.5 rounded-md bg-afrocat-white-5 text-afrocat-muted text-[9px] font-bold"><BookOpen className="w-2.5 h-2.5" />Q&A</span>
            )}
          </div>
        </div>

        {/* Title + preview */}
        <div className="flex-1">
          <h3 className="font-display font-bold text-sm text-afrocat-text leading-snug line-clamp-2">{interview.title}</h3>
          {preview && (
            <p className="text-xs text-afrocat-muted leading-relaxed mt-1.5 line-clamp-3 italic">
              <Quote className="w-2.5 h-2.5 inline mr-1 text-afrocat-teal/50" />{preview}{preview.length >= 120 ? "…" : ""}
            </p>
          )}
        </div>

        {/* Tags */}
        {(interview.tags || []).length > 0 && (
          <div className="flex flex-wrap gap-1">
            {interview.tags.slice(0, 3).map((t: string) => <TagChip key={t} tag={t} />)}
            {interview.tags.length > 3 && <span className="text-[9px] text-afrocat-muted">+{interview.tags.length - 3}</span>}
          </div>
        )}

        {/* Footer */}
        <div className="flex items-center justify-between pt-2 border-t border-afrocat-border/50">
          <div className="flex items-center gap-3">
            <button
              onClick={onLike}
              className={`flex items-center gap-1 text-xs font-bold transition-all cursor-pointer hover:scale-110 ${liked ? "text-red-400" : "text-afrocat-muted hover:text-red-400"}`}
              data-testid={`button-like-${interview.id}`}
            >
              <Heart className={`w-3.5 h-3.5 ${liked ? "fill-red-400" : ""}`} />
              {interview.likesCount || 0}
            </button>
            <span className="flex items-center gap-1 text-[10px] text-afrocat-muted">
              <Eye className="w-3 h-3" />{interview.viewCount || 0}
            </span>
            {interview.format === "TEXT" && (
              <span className="flex items-center gap-1 text-[10px] text-afrocat-muted">
                <Clock className="w-3 h-3" />{mins}m
              </span>
            )}
          </div>
          <div className="flex items-center gap-1">
            {canManage && (
              <>
                <button onClick={onToggleFeatured} className="p-1.5 rounded hover:bg-afrocat-white-5 text-afrocat-muted cursor-pointer" data-testid={`button-feature-${interview.id}`}>
                  <Star className={`w-3 h-3 ${interview.featured ? "text-afrocat-gold fill-afrocat-gold" : ""}`} />
                </button>
                <button onClick={onEdit} className="p-1.5 rounded hover:bg-afrocat-white-5 text-afrocat-muted cursor-pointer" data-testid={`button-edit-${interview.id}`}>
                  <Edit3 className="w-3 h-3" />
                </button>
                <button onClick={onDelete} className="p-1.5 rounded hover:bg-red-500/10 text-afrocat-muted hover:text-red-400 cursor-pointer" data-testid={`button-delete-${interview.id}`}>
                  <Trash2 className="w-3 h-3" />
                </button>
              </>
            )}
            <button onClick={onOpen} className="flex items-center gap-0.5 text-[10px] text-afrocat-teal font-bold cursor-pointer hover:underline" data-testid={`button-read-${interview.id}`}>
              Read <ChevronRight className="w-3 h-3" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── SPOTLIGHT HERO ────────────────────────────────────────────────────────
function SpotlightHero({ interview, liked, onOpen, onLike }: {
  interview: any; liked: boolean; onOpen: () => void; onLike: (e: React.MouseEvent) => void;
}) {
  const mins = readingTime(interview.questions || [], interview.answers || []);
  return (
    <div
      className="relative overflow-hidden rounded-2xl cursor-pointer group"
      onClick={onOpen}
      data-testid={`card-spotlight-${interview.id}`}
    >
      <div className="absolute inset-0 bg-gradient-to-br from-afrocat-teal/30 via-afrocat-gold/10 to-afrocat-card" />
      <div className="absolute inset-0 bg-gradient-to-t from-afrocat-card via-transparent to-transparent" />
      <div className="relative p-6 sm:p-8 flex flex-col sm:flex-row gap-6 items-center">
        {/* Big avatar */}
        <div className="relative shrink-0">
          <div className="w-28 h-28 sm:w-36 sm:h-36 rounded-2xl overflow-hidden ring-4 ring-afrocat-gold/30 shadow-2xl">
            {interview.playerPhotoUrl ? (
              <img src={interview.playerPhotoUrl} alt="" className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full bg-gradient-to-br from-afrocat-teal/40 to-afrocat-gold/20 flex items-center justify-center text-3xl font-bold text-afrocat-gold">
                {getInitials(interview.playerName || "").toUpperCase()}
              </div>
            )}
          </div>
          {interview.playerJerseyNo && (
            <div className="absolute -bottom-2 -right-2 bg-afrocat-gold text-black font-black text-sm rounded-xl px-2 py-1 shadow-lg">
              #{interview.playerJerseyNo}
            </div>
          )}
        </div>

        {/* Content */}
        <div className="flex-1 text-center sm:text-left">
          <div className="flex items-center justify-center sm:justify-start gap-2 mb-2">
            <span className="flex items-center gap-1 text-[10px] font-black uppercase tracking-widest text-afrocat-gold bg-afrocat-gold/10 px-2.5 py-1 rounded-full">
              <Zap className="w-3 h-3 fill-afrocat-gold" /> Player Spotlight
            </span>
            {interview.format === "VIDEO" && (
              <span className="flex items-center gap-1 text-[10px] font-bold text-afrocat-teal bg-afrocat-teal/10 px-2 py-1 rounded-full">
                <Video className="w-3 h-3" /> Video
              </span>
            )}
          </div>
          <h2 className="font-display font-black text-2xl sm:text-3xl text-afrocat-text leading-tight">{interview.title}</h2>
          <p className="text-afrocat-teal font-bold text-sm mt-1">{interview.playerName} · {interview.playerPosition}</p>
          {interview.answers?.[0] && (
            <p className="text-afrocat-muted text-sm leading-relaxed mt-3 line-clamp-2 italic">
              <Quote className="w-3.5 h-3.5 inline mr-1.5 text-afrocat-teal/40" />
              {interview.answers[0].slice(0, 140)}{interview.answers[0].length > 140 ? "…" : ""}
            </p>
          )}
          <div className="flex items-center justify-center sm:justify-start gap-4 mt-4">
            <button
              onClick={onLike}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-bold transition-all cursor-pointer ${liked ? "bg-red-500/20 text-red-400" : "bg-black/20 text-afrocat-muted hover:text-red-400"}`}
              data-testid={`button-like-spotlight-${interview.id}`}
            >
              <Heart className={`w-4 h-4 ${liked ? "fill-red-400" : ""}`} />
              {interview.likesCount || 0} likes
            </button>
            <span className="flex items-center gap-1 text-xs text-afrocat-muted"><Eye className="w-3.5 h-3.5" />{interview.viewCount || 0}</span>
            {interview.format === "TEXT" && <span className="flex items-center gap-1 text-xs text-afrocat-muted"><Clock className="w-3.5 h-3.5" />{mins} min read</span>}
            <div className="flex flex-wrap gap-1">
              {(interview.tags || []).slice(0, 2).map((t: string) => <TagChip key={t} tag={t} />)}
            </div>
          </div>
        </div>

        {/* Read more arrow */}
        <div className="hidden sm:flex items-center justify-center w-12 h-12 rounded-xl bg-afrocat-teal/20 group-hover:bg-afrocat-teal/40 transition-all">
          <ChevronRight className="w-6 h-6 text-afrocat-teal group-hover:translate-x-0.5 transition-transform" />
        </div>
      </div>
    </div>
  );
}

// ─── CREATE/EDIT FORM ──────────────────────────────────────────────────────
function InterviewForm({
  players, editingId, initialData, onClose, onSaved
}: {
  players: any[]; editingId: string | null; initialData?: any;
  onClose: () => void; onSaved: () => void;
}) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [formTitle, setFormTitle] = useState(initialData?.title || "");
  const [formPlayerId, setFormPlayerId] = useState(initialData?.playerId || "");
  const [formFormat, setFormFormat] = useState(initialData?.format || "TEXT");
  const [formVideoUrl, setFormVideoUrl] = useState(initialData?.videoUrl || "");
  const [formFeatured, setFormFeatured] = useState(initialData?.featured || false);
  const [formTags, setFormTags] = useState<string[]>(initialData?.tags || []);
  const [formQAs, setFormQAs] = useState<{ q: string; a: string }[]>(
    initialData?.questions?.length
      ? initialData.questions.map((q: string, i: number) => ({ q, a: initialData.answers?.[i] || "" }))
      : [{ q: "", a: "" }]
  );
  const [showRecorder, setShowRecorder] = useState(false);
  const [isUploading, setIsUploading] = useState(false);

  const handleRecordedVideo = async (file: File) => {
    setShowRecorder(false);
    setIsUploading(true);
    try {
      const formData = new FormData();
      formData.append("files", file);
      formData.append("category", "interview");
      const result = await api.uploadMedia(formData);
      const mediaUrl = result?.item?.url || result?.items?.[0]?.url || (Array.isArray(result) ? result[0]?.url : null);
      if (mediaUrl) {
        setFormVideoUrl(mediaUrl);
        toast({ title: "Video Uploaded", description: "Recorded video uploaded successfully." });
      }
    } catch (err: any) {
      toast({ title: "Upload Failed", description: err.message, variant: "destructive" });
    } finally { setIsUploading(false); }
  };

  const saveMut = useMutation({
    mutationFn: (data: any) => editingId ? api.updateInterview(editingId, data) : api.createInterview(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/interviews"] });
      toast({ title: editingId ? "Interview Updated" : "Interview Published! 🎤" });
      onSaved();
    },
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const handleSubmit = () => {
    const validQAs = formQAs.filter(qa => qa.q.trim() && qa.a.trim());
    if (!formTitle.trim() || !formPlayerId || validQAs.length === 0) {
      toast({ title: "Missing fields", description: "Title, player, and at least one Q&A required.", variant: "destructive" });
      return;
    }
    saveMut.mutate({
      playerId: formPlayerId, title: formTitle.trim(), format: formFormat,
      videoUrl: formVideoUrl.trim() || null,
      questions: validQAs.map(qa => qa.q.trim()),
      answers: validQAs.map(qa => qa.a.trim()),
      tags: formTags, featured: formFeatured,
    });
  };

  const toggleTag = (t: string) => setFormTags(prev => prev.includes(t) ? prev.filter(x => x !== t) : [...prev, t]);

  return (
    <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-3 sm:p-6">
      <div className="bg-afrocat-card border border-afrocat-border rounded-2xl w-full max-w-2xl max-h-[92vh] overflow-y-auto p-6 space-y-5">
        <div className="flex items-center justify-between">
          <h2 className="font-display font-bold text-lg text-afrocat-text">
            {editingId ? "Edit Interview" : "New Player Interview"}
          </h2>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-afrocat-white-5 text-afrocat-muted cursor-pointer"><X className="w-5 h-5" /></button>
        </div>

        {/* Player */}
        <div>
          <label className="text-xs font-semibold text-afrocat-muted uppercase tracking-wider mb-1.5 block">Player *</label>
          <Select value={formPlayerId} onValueChange={setFormPlayerId}>
            <SelectTrigger data-testid="select-interview-player"><SelectValue placeholder="Select a player" /></SelectTrigger>
            <SelectContent>
              {players.map((p: any) => (
                <SelectItem key={p.id} value={p.id}>#{p.jerseyNo} {p.firstName} {p.lastName} ({p.position || "-"})</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Title */}
        <div>
          <label className="text-xs font-semibold text-afrocat-muted uppercase tracking-wider mb-1.5 block">Title *</label>
          <input type="text" value={formTitle} onChange={e => setFormTitle(e.target.value)}
            placeholder='e.g. "My Journey to Afrocat"'
            className="w-full px-4 py-2.5 rounded-xl bg-afrocat-white-5 border border-afrocat-border text-sm text-afrocat-text placeholder:text-afrocat-muted focus:outline-none focus:ring-1 focus:ring-afrocat-teal"
            data-testid="input-interview-title" />
        </div>

        {/* Format */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs font-semibold text-afrocat-muted uppercase tracking-wider mb-1.5 block">Format</label>
            <Select value={formFormat} onValueChange={setFormFormat}>
              <SelectTrigger data-testid="select-interview-format"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="TEXT">Text Q&A</SelectItem>
                <SelectItem value="VIDEO">Video + Q&A</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-end">
            <button
              type="button"
              onClick={() => setFormFeatured(!formFeatured)}
              className={`w-full flex items-center justify-center gap-2 py-2.5 rounded-xl border text-sm font-bold transition-all cursor-pointer ${formFeatured ? "bg-afrocat-gold-soft border-afrocat-gold/30 text-afrocat-gold" : "bg-afrocat-white-5 border-afrocat-border text-afrocat-muted"}`}
              data-testid="button-toggle-featured-form"
            >
              <Star className={`w-4 h-4 ${formFeatured ? "fill-afrocat-gold" : ""}`} /> Featured
            </button>
          </div>
        </div>

        {/* Video */}
        {formFormat === "VIDEO" && (
          <div className="space-y-3">
            <label className="text-xs font-semibold text-afrocat-muted uppercase tracking-wider block">Video</label>
            {showRecorder ? (
              <VideoRecorder onRecorded={handleRecordedVideo} onCancel={() => setShowRecorder(false)} />
            ) : (
              <div className="space-y-2">
                <input type="url" value={formVideoUrl} onChange={e => setFormVideoUrl(e.target.value)}
                  placeholder="https://youtube.com/... or leave blank to record"
                  className="w-full px-4 py-2.5 rounded-xl bg-afrocat-white-5 border border-afrocat-border text-sm text-afrocat-text placeholder:text-afrocat-muted focus:outline-none focus:ring-1 focus:ring-afrocat-teal"
                  data-testid="input-video-url" />
                <button type="button" onClick={() => setShowRecorder(true)}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl bg-afrocat-teal/10 border border-afrocat-teal/20 text-afrocat-teal text-sm font-bold hover:bg-afrocat-teal/20 transition-all cursor-pointer"
                  data-testid="button-record-video"
                  disabled={isUploading}>
                  <Camera className="w-4 h-4" /> {isUploading ? "Uploading…" : "Record from Camera"}
                </button>
                {formVideoUrl && <p className="text-[10px] text-afrocat-teal font-medium truncate">{formVideoUrl}</p>}
              </div>
            )}
          </div>
        )}

        {/* Tags */}
        <div>
          <label className="text-xs font-semibold text-afrocat-muted uppercase tracking-wider mb-2 block flex items-center gap-1.5"><Tag className="w-3 h-3" /> Tags</label>
          <div className="flex flex-wrap gap-1.5">
            {INTERVIEW_TAGS.map(t => (
              <button key={t} type="button" onClick={() => toggleTag(t)}
                className={`px-2.5 py-1 rounded-full text-xs font-bold transition-all cursor-pointer border ${formTags.includes(t) ? "bg-afrocat-teal text-white border-afrocat-teal" : "bg-transparent border-afrocat-border text-afrocat-muted hover:border-afrocat-teal/40"}`}
                data-testid={`tag-${t.replace(/\s+/g, "-").toLowerCase()}`}>
                {t}
              </button>
            ))}
          </div>
        </div>

        {/* Q&As */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <label className="text-xs font-semibold text-afrocat-muted uppercase tracking-wider flex items-center gap-1.5">
              <MessageSquare className="w-3 h-3" /> Questions & Answers *
            </label>
            <button type="button" onClick={() => setFormQAs(prev => [...prev, { q: "", a: "" }])}
              className="text-xs text-afrocat-teal font-bold hover:underline cursor-pointer" data-testid="button-add-qa">
              + Add Q&A
            </button>
          </div>
          {formQAs.map((qa, i) => (
            <div key={i} className="space-y-2 p-4 rounded-xl bg-afrocat-white-3 border border-afrocat-border/50">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold text-afrocat-teal uppercase">Q{i + 1}</span>
                {formQAs.length > 1 && (
                  <button type="button" onClick={() => setFormQAs(prev => prev.filter((_, j) => j !== i))}
                    className="text-[10px] text-afrocat-muted hover:text-red-400 cursor-pointer" data-testid={`button-remove-qa-${i}`}>
                    Remove
                  </button>
                )}
              </div>
              <input type="text" value={qa.q} onChange={e => setFormQAs(prev => prev.map((x, j) => j === i ? { ...x, q: e.target.value } : x))}
                placeholder="Question..."
                className="w-full px-3 py-2 rounded-lg bg-afrocat-white-5 border border-afrocat-border text-sm text-afrocat-text placeholder:text-afrocat-muted focus:outline-none focus:ring-1 focus:ring-afrocat-teal"
                data-testid={`input-question-${i}`} />
              <textarea value={qa.a} onChange={e => setFormQAs(prev => prev.map((x, j) => j === i ? { ...x, a: e.target.value } : x))}
                placeholder="Answer..."
                rows={3}
                className="w-full px-3 py-2 rounded-lg bg-afrocat-white-5 border border-afrocat-border text-sm text-afrocat-text placeholder:text-afrocat-muted focus:outline-none focus:ring-1 focus:ring-afrocat-teal resize-none"
                data-testid={`input-answer-${i}`} />
            </div>
          ))}
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-3 pt-2">
          <button type="button" onClick={onClose} className="px-4 py-2 rounded-xl border border-afrocat-border text-sm text-afrocat-muted hover:bg-afrocat-white-5 cursor-pointer">Cancel</button>
          <button type="button" onClick={handleSubmit} disabled={saveMut.isPending}
            className="px-6 py-2 rounded-xl bg-afrocat-teal text-white font-bold text-sm hover:bg-afrocat-teal/90 disabled:opacity-50 cursor-pointer"
            data-testid="button-save-interview">
            {saveMut.isPending ? "Saving…" : editingId ? "Save Changes" : "Publish Interview"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── MAIN PAGE ──────────────────────────────────────────────────────────────
export default function PlayerInterviews() {
  const { toast } = useToast();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const canManage = user && ["ADMIN", "MANAGER", "COACH"].includes(user.role || "") ||
    user?.roles?.some((r: string) => ["ADMIN", "MANAGER", "COACH"].includes(r));

  const { data: interviews = [], isLoading } = useQuery({ queryKey: ["/api/interviews"], queryFn: api.getInterviews });
  const { data: players = [] } = useQuery({ queryKey: ["/api/players"], queryFn: api.getPlayers, enabled: !!canManage });
  const { data: myLikesData } = useQuery({ queryKey: ["/api/interviews-my-likes"], queryFn: api.getMyInterviewLikes });
  const likedIds = useMemo(() => new Set<string>(myLikesData?.likedIds || []), [myLikesData]);

  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingData, setEditingData] = useState<any>(null);
  const [openInterviewId, setOpenInterviewId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterTag, setFilterTag] = useState("");
  const [filterFeatured, setFilterFeatured] = useState(false);
  const [filterFormat, setFilterFormat] = useState("");

  const likeMut = useMutation({
    mutationFn: (id: string) => api.likeInterview(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/interviews"] });
      queryClient.invalidateQueries({ queryKey: ["/api/interviews-my-likes"] });
    },
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => api.deleteInterview(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/interviews"] });
      setOpenInterviewId(null);
      toast({ title: "Interview Deleted" });
    },
  });

  const featureMut = useMutation({
    mutationFn: ({ id, featured }: { id: string; featured: boolean }) => api.updateInterview(id, { featured }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/interviews"] }),
  });

  const filtered = useMemo(() => {
    let list = [...interviews] as any[];
    if (searchTerm) {
      const lower = searchTerm.toLowerCase();
      list = list.filter(i => i.title.toLowerCase().includes(lower) || i.playerName?.toLowerCase().includes(lower) || i.questions?.some((q: string) => q.toLowerCase().includes(lower)));
    }
    if (filterTag) list = list.filter(i => i.tags?.includes(filterTag));
    if (filterFeatured) list = list.filter(i => i.featured);
    if (filterFormat) list = list.filter(i => i.format === filterFormat);
    return list;
  }, [interviews, searchTerm, filterTag, filterFeatured, filterFormat]);

  const spotlight = useMemo(() => {
    const sorted = [...interviews].sort((a: any, b: any) => (b.likesCount || 0) - (a.likesCount || 0));
    return sorted.find((i: any) => i.featured) || sorted[0] || null;
  }, [interviews]);

  const openInterview = openInterviewId ? (interviews as any[]).find(i => i.id === openInterviewId) : null;

  const openCreate = () => { setEditingId(null); setEditingData(null); setShowForm(true); };
  const openEdit = (interview: any) => { setEditingId(interview.id); setEditingData(interview); setShowForm(true); setOpenInterviewId(null); };

  const stats = useMemo(() => ({
    total: interviews.length,
    videos: (interviews as any[]).filter(i => i.format === "VIDEO").length,
    totalLikes: (interviews as any[]).reduce((s, i: any) => s + (i.likesCount || 0), 0),
    totalViews: (interviews as any[]).reduce((s, i: any) => s + (i.viewCount || 0), 0),
  }), [interviews]);

  return (
    <Layout>
      <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">

        {/* ─── Header ─── */}
        <div className="afrocat-card p-5">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-afrocat-teal-soft flex items-center justify-center">
                <Mic className="w-5 h-5 text-afrocat-teal" />
              </div>
              <div>
                <h1 className="text-xl font-display font-bold text-afrocat-text tracking-tight" data-testid="text-interviews-title">
                  Player Interviews
                </h1>
                <p className="text-xs text-afrocat-muted">Get to know the squad — stories, motivations &amp; moments</p>
              </div>
            </div>
            <div className="flex items-center gap-4">
              {/* Stats */}
              <div className="hidden sm:flex items-center gap-4">
                <div className="text-center">
                  <p className="text-base font-black text-afrocat-text">{stats.total}</p>
                  <p className="text-[10px] text-afrocat-muted">Interviews</p>
                </div>
                <div className="text-center">
                  <p className="text-base font-black text-afrocat-teal">{stats.totalLikes}</p>
                  <p className="text-[10px] text-afrocat-muted">Likes</p>
                </div>
                <div className="text-center">
                  <p className="text-base font-black text-afrocat-gold">{stats.totalViews}</p>
                  <p className="text-[10px] text-afrocat-muted">Views</p>
                </div>
              </div>
              {canManage && (
                <button onClick={openCreate}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl bg-afrocat-teal text-white font-bold text-sm hover:bg-afrocat-teal/90 transition-all cursor-pointer"
                  data-testid="button-new-interview">
                  <Plus className="w-4 h-4" /> New Interview
                </button>
              )}
            </div>
          </div>
        </div>

        {/* ─── Spotlight Hero ─── */}
        {spotlight && !searchTerm && !filterTag && !filterFeatured && !filterFormat && (
          <SpotlightHero
            interview={spotlight}
            liked={likedIds.has(spotlight.id)}
            onOpen={() => setOpenInterviewId(spotlight.id)}
            onLike={e => { e.stopPropagation(); likeMut.mutate(spotlight.id); }}
          />
        )}

        {/* ─── Filters ─── */}
        <div className="afrocat-card p-4">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-afrocat-muted" />
              <input type="text" placeholder="Search by player, title, or question…" value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-afrocat-white-5 border border-afrocat-border text-sm text-afrocat-text placeholder:text-afrocat-muted focus:outline-none focus:ring-1 focus:ring-afrocat-teal"
                data-testid="input-search-interviews" />
            </div>
            <Select value={filterTag} onValueChange={v => setFilterTag(v === "ALL" ? "" : v)}>
              <SelectTrigger className="w-full sm:w-[160px]" data-testid="select-filter-tag">
                <SelectValue placeholder="All Tags" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All Tags</SelectItem>
                {INTERVIEW_TAGS.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={filterFormat} onValueChange={v => setFilterFormat(v === "ALL" ? "" : v)}>
              <SelectTrigger className="w-full sm:w-[130px]" data-testid="select-filter-format">
                <SelectValue placeholder="All Types" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All Types</SelectItem>
                <SelectItem value="TEXT">Text Q&A</SelectItem>
                <SelectItem value="VIDEO">Video</SelectItem>
              </SelectContent>
            </Select>
            <button onClick={() => setFilterFeatured(!filterFeatured)}
              className={`flex items-center gap-1.5 px-4 py-2.5 rounded-xl border text-sm font-bold transition-all cursor-pointer ${filterFeatured ? "bg-afrocat-gold-soft border-afrocat-gold/30 text-afrocat-gold" : "bg-afrocat-white-5 border-afrocat-border text-afrocat-muted"}`}
              data-testid="button-filter-featured">
              <Star className={`w-3.5 h-3.5 ${filterFeatured ? "fill-afrocat-gold" : ""}`} /> Featured
            </button>
          </div>
        </div>

        {/* ─── Trending bar (most liked) ─── */}
        {!searchTerm && !filterTag && !filterFeatured && !filterFormat && stats.total > 2 && (
          <div className="afrocat-card p-4">
            <div className="flex items-center gap-2 mb-3">
              <TrendingUp className="w-4 h-4 text-afrocat-gold" />
              <span className="text-xs font-black uppercase tracking-wider text-afrocat-gold">Trending</span>
            </div>
            <div className="flex gap-3 overflow-x-auto pb-1">
              {([...interviews] as any[])
                .sort((a, b) => (b.likesCount || 0) - (a.likesCount || 0))
                .slice(0, 5)
                .map(i => (
                  <button key={i.id} onClick={() => setOpenInterviewId(i.id)}
                    className="flex items-center gap-2 px-3 py-2 rounded-xl bg-afrocat-white-5 hover:bg-afrocat-white-5 border border-afrocat-border text-left shrink-0 transition-all cursor-pointer"
                    data-testid={`button-trending-${i.id}`}>
                    <PlayerAvatar photoUrl={i.playerPhotoUrl} name={i.playerName || ""} size="sm" />
                    <div>
                      <p className="text-xs font-bold text-afrocat-text whitespace-nowrap max-w-[120px] truncate">{i.title}</p>
                      <p className="text-[10px] text-afrocat-muted flex items-center gap-1"><Heart className="w-2.5 h-2.5 fill-red-400 text-red-400" />{i.likesCount || 0}</p>
                    </div>
                  </button>
                ))}
            </div>
          </div>
        )}

        {/* ─── Loading ─── */}
        {isLoading && (
          <div className="afrocat-card p-8 text-center text-afrocat-muted">Loading interviews…</div>
        )}

        {/* ─── Empty ─── */}
        {!isLoading && filtered.length === 0 && (
          <div className="afrocat-card p-12 text-center space-y-3">
            <Mic className="w-14 h-14 text-afrocat-muted mx-auto opacity-20" />
            <p className="font-bold text-afrocat-text text-lg" data-testid="text-no-interviews">
              {interviews.length === 0 ? "No interviews yet" : "No interviews match your filters"}
            </p>
            <p className="text-sm text-afrocat-muted">
              {interviews.length === 0 ? "Start by publishing the first player interview!" : "Try adjusting your search or filters."}
            </p>
            {canManage && interviews.length === 0 && (
              <button onClick={openCreate}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-afrocat-teal text-white font-bold text-sm hover:bg-afrocat-teal/90 cursor-pointer mt-2">
                <Plus className="w-4 h-4" /> Create First Interview
              </button>
            )}
          </div>
        )}

        {/* ─── Card Grid ─── */}
        {!isLoading && filtered.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtered.map(i => (
              <InterviewCard
                key={i.id}
                interview={i}
                liked={likedIds.has(i.id)}
                canManage={!!canManage}
                onOpen={() => setOpenInterviewId(i.id)}
                onLike={e => { e.stopPropagation(); likeMut.mutate(i.id); }}
                onEdit={e => { e.stopPropagation(); openEdit(i); }}
                onDelete={e => { e.stopPropagation(); if (confirm("Delete this interview?")) deleteMut.mutate(i.id); }}
                onToggleFeatured={e => { e.stopPropagation(); featureMut.mutate({ id: i.id, featured: !i.featured }); }}
              />
            ))}
          </div>
        )}

        {/* ─── Detail Modal ─── */}
        {openInterview && (
          <InterviewModal
            interview={openInterview}
            liked={likedIds.has(openInterview.id)}
            canManage={!!canManage}
            onClose={() => setOpenInterviewId(null)}
            onLike={() => likeMut.mutate(openInterview.id)}
            onEdit={() => openEdit(openInterview)}
            onDelete={() => { if (confirm("Delete this interview?")) deleteMut.mutate(openInterview.id); }}
          />
        )}

        {/* ─── Create/Edit Form ─── */}
        {showForm && (
          <InterviewForm
            players={players}
            editingId={editingId}
            initialData={editingData}
            onClose={() => { setShowForm(false); setEditingId(null); setEditingData(null); }}
            onSaved={() => { setShowForm(false); setEditingId(null); setEditingData(null); }}
          />
        )}
      </div>
    </Layout>
  );
}
