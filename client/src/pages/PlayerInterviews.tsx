import { Layout } from "@/components/Layout";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/lib/auth";
import { useState, useMemo } from "react";
import {
  Mic, Plus, Star, Trash2, Edit3, Play, X,
  User, Tag, ChevronDown, ChevronUp, Search, Video, Camera
} from "lucide-react";
import { VideoRecorder } from "@/components/VideoRecorder";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import logo from "@assets/afrocate_logo_1772226294597.png";

function getInitials(firstName: string, lastName: string): string {
  return `${(firstName || "")[0] || ""}${(lastName || "")[0] || ""}`.toUpperCase();
}

const INTERVIEW_TAGS = ["Debut", "Pre-Match", "Post-Match", "Training", "Personal Story", "Motivation", "Season Review", "Comeback", "Captain's Chat", "Rookie Talk"];

export default function PlayerInterviews() {
  const { toast } = useToast();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const canManage = user && (user.role === "ADMIN" || user.role === "MANAGER" || user.role === "COACH" || user.roles?.some((r: string) => ["ADMIN", "MANAGER", "COACH"].includes(r)));

  const { data: interviews = [], isLoading } = useQuery({ queryKey: ["/api/interviews"], queryFn: api.getInterviews });
  const { data: players = [] } = useQuery({ queryKey: ["/api/players"], queryFn: api.getPlayers, enabled: !!canManage });
  const { data: teams = [] } = useQuery({ queryKey: ["/api/teams"], queryFn: api.getTeams });

  const [showCreate, setShowCreate] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterTag, setFilterTag] = useState("");
  const [filterFeatured, setFilterFeatured] = useState(false);

  const [formTitle, setFormTitle] = useState("");
  const [formPlayerId, setFormPlayerId] = useState("");
  const [formFormat, setFormFormat] = useState("TEXT");
  const [formVideoUrl, setFormVideoUrl] = useState("");
  const [formFeatured, setFormFeatured] = useState(false);
  const [formTags, setFormTags] = useState<string[]>([]);
  const [formQAs, setFormQAs] = useState<{ q: string; a: string }[]>([{ q: "", a: "" }]);
  const [showRecorder, setShowRecorder] = useState(false);
  const [isUploading, setIsUploading] = useState(false);

  const resetForm = () => {
    setFormTitle(""); setFormPlayerId(""); setFormFormat("TEXT");
    setFormVideoUrl(""); setFormFeatured(false); setFormTags([]);
    setFormQAs([{ q: "", a: "" }]); setEditingId(null);
    setShowRecorder(false); setIsUploading(false);
  };

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
        toast({ title: "Video Uploaded", description: "Your recorded video has been uploaded successfully." });
      }
    } catch (err: any) {
      toast({ title: "Upload Failed", description: err.message || "Could not upload recorded video.", variant: "destructive" });
    } finally {
      setIsUploading(false);
    }
  };

  const openCreate = () => { resetForm(); setShowCreate(true); };
  const openEdit = (interview: any) => {
    setFormTitle(interview.title);
    setFormPlayerId(interview.playerId);
    setFormFormat(interview.format);
    setFormVideoUrl(interview.videoUrl || "");
    setFormFeatured(interview.featured || false);
    setFormTags(interview.tags || []);
    setFormQAs(
      interview.questions.map((q: string, i: number) => ({
        q,
        a: interview.answers[i] || "",
      }))
    );
    setEditingId(interview.id);
    setShowCreate(true);
  };

  const createMut = useMutation({
    mutationFn: (data: any) => editingId ? api.updateInterview(editingId, data) : api.createInterview(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/interviews"] });
      toast({ title: editingId ? "Interview Updated" : "Interview Published" });
      setShowCreate(false);
      resetForm();
    },
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => api.deleteInterview(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/interviews"] });
      toast({ title: "Interview Deleted" });
    },
  });

  const toggleFeatured = useMutation({
    mutationFn: ({ id, featured }: { id: string; featured: boolean }) =>
      api.updateInterview(id, { featured }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/interviews"] }),
  });

  const handleSubmit = () => {
    const validQAs = formQAs.filter((qa) => qa.q.trim() && qa.a.trim());
    if (!formTitle.trim() || !formPlayerId || validQAs.length === 0) {
      toast({ title: "Missing fields", description: "Title, player, and at least one Q&A are required.", variant: "destructive" });
      return;
    }
    createMut.mutate({
      playerId: formPlayerId,
      title: formTitle.trim(),
      format: formFormat,
      videoUrl: formVideoUrl.trim() || null,
      questions: validQAs.map((qa) => qa.q.trim()),
      answers: validQAs.map((qa) => qa.a.trim()),
      tags: formTags,
      featured: formFeatured,
    });
  };

  const filtered = useMemo(() => {
    let list = [...interviews];
    if (searchTerm) {
      const lower = searchTerm.toLowerCase();
      list = list.filter((i: any) =>
        i.title.toLowerCase().includes(lower) ||
        i.playerName?.toLowerCase().includes(lower) ||
        i.questions?.some((q: string) => q.toLowerCase().includes(lower))
      );
    }
    if (filterTag) {
      list = list.filter((i: any) => i.tags?.includes(filterTag));
    }
    if (filterFeatured) {
      list = list.filter((i: any) => i.featured);
    }
    return list;
  }, [interviews, searchTerm, filterTag, filterFeatured]);

  const featuredInterviews = interviews.filter((i: any) => i.featured);

  return (
    <Layout>
      <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
        <div className="afrocat-card p-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-afrocat-teal-soft flex items-center justify-center">
                <Mic className="w-5 h-5 text-afrocat-teal" />
              </div>
              <div>
                <h1 className="text-xl font-display font-bold text-afrocat-text tracking-tight" data-testid="text-interviews-title">
                  Player Interviews
                </h1>
                <p className="text-xs text-afrocat-muted">Get to know the team — Q&As, stories, and video clips</p>
              </div>
            </div>
            {canManage && (
              <button
                onClick={openCreate}
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-afrocat-teal text-white font-bold text-sm hover:bg-afrocat-teal/90 transition-all cursor-pointer"
                data-testid="button-new-interview"
              >
                <Plus className="w-4 h-4" /> New Interview
              </button>
            )}
          </div>
        </div>

        {featuredInterviews.length > 0 && !searchTerm && !filterTag && (
          <div className="space-y-3">
            <h2 className="text-sm font-bold text-afrocat-gold uppercase tracking-wider flex items-center gap-2">
              <Star className="w-4 h-4 fill-afrocat-gold text-afrocat-gold" /> Featured
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {featuredInterviews.slice(0, 2).map((i: any) => (
                <div key={i.id} className="afrocat-card overflow-hidden border-afrocat-gold/20 hover:border-afrocat-gold/40 transition-all cursor-pointer" onClick={() => setExpandedId(expandedId === i.id ? null : i.id)} data-testid={`card-featured-interview-${i.id}`}>
                  <div className="bg-gradient-to-r from-afrocat-gold/10 to-afrocat-teal/10 p-5">
                    <div className="flex items-start gap-4">
                      <div className="relative shrink-0">
                        {i.playerPhotoUrl ? (
                          <img src={i.playerPhotoUrl} alt="" className="w-16 h-16 rounded-full object-cover border-2 border-afrocat-gold/30" />
                        ) : (
                          <div className="w-16 h-16 rounded-full bg-afrocat-white-5 flex items-center justify-center text-lg font-bold text-afrocat-gold border-2 border-afrocat-gold/30">
                            {getInitials(i.playerName?.split(" ")[0] || "", i.playerName?.split(" ")[1] || "")}
                          </div>
                        )}
                        <Star className="absolute -top-1 -right-1 w-5 h-5 text-afrocat-gold fill-afrocat-gold" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="font-display font-bold text-afrocat-text text-base">{i.title}</h3>
                        <p className="text-sm text-afrocat-muted mt-1">
                          {i.playerName} &bull; #{i.playerJerseyNo} &bull; {i.playerPosition || "-"}
                        </p>
                        {i.format === "VIDEO" && i.videoUrl && (
                          <div className="flex items-center gap-1.5 mt-2 text-xs text-afrocat-teal font-bold">
                            <Video className="w-3.5 h-3.5" /> Video Interview
                          </div>
                        )}
                        <div className="flex flex-wrap gap-1.5 mt-2">
                          {(i.tags || []).map((t: string) => (
                            <span key={t} className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-afrocat-gold-soft text-afrocat-gold">{t}</span>
                          ))}
                        </div>
                      </div>
                    </div>
                    {expandedId === i.id && (
                      <div className="mt-5 space-y-4 border-t border-afrocat-border pt-4">
                        {i.format === "VIDEO" && i.videoUrl && (
                          <div className="rounded-xl overflow-hidden bg-black aspect-video">
                            {i.videoUrl.startsWith("/uploads/") || i.videoUrl.endsWith(".webm") || i.videoUrl.endsWith(".mp4") ? (
                              <video src={i.videoUrl} controls playsInline className="w-full h-full object-contain" data-testid={`video-playback-${i.id}`} />
                            ) : (
                              <iframe src={i.videoUrl} className="w-full h-full" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowFullScreen />
                            )}
                          </div>
                        )}
                        {i.questions?.map((q: string, idx: number) => (
                          <div key={idx} className="space-y-1.5">
                            <p className="text-sm font-bold text-afrocat-teal">{q}</p>
                            <p className="text-sm text-afrocat-text leading-relaxed">{i.answers?.[idx] || ""}</p>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="afrocat-card p-4">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-afrocat-muted" />
              <input
                type="text"
                placeholder="Search interviews..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-afrocat-white-5 border border-afrocat-border text-sm text-afrocat-text placeholder:text-afrocat-muted focus:outline-none focus:ring-1 focus:ring-afrocat-teal"
                data-testid="input-search-interviews"
              />
            </div>
            <Select value={filterTag} onValueChange={(v) => setFilterTag(v === "ALL" ? "" : v)}>
              <SelectTrigger className="w-full sm:w-[180px]" data-testid="select-filter-tag">
                <SelectValue placeholder="All Tags" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All Tags</SelectItem>
                {INTERVIEW_TAGS.map((t) => (
                  <SelectItem key={t} value={t}>{t}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <button
              onClick={() => setFilterFeatured(!filterFeatured)}
              className={`flex items-center gap-1.5 px-4 py-2.5 rounded-xl border text-sm font-bold transition-all cursor-pointer ${
                filterFeatured
                  ? "bg-afrocat-gold-soft border-afrocat-gold/30 text-afrocat-gold"
                  : "bg-afrocat-white-5 border-afrocat-border text-afrocat-muted"
              }`}
              data-testid="button-filter-featured"
            >
              <Star className={`w-3.5 h-3.5 ${filterFeatured ? "fill-afrocat-gold" : ""}`} />
              Featured
            </button>
          </div>
        </div>

        {isLoading && (
          <div className="afrocat-card p-8 text-center text-afrocat-muted">Loading interviews...</div>
        )}

        {!isLoading && filtered.length === 0 && (
          <div className="afrocat-card p-8 text-center">
            <Mic className="w-12 h-12 text-afrocat-muted mx-auto mb-3 opacity-30" />
            <p className="text-afrocat-muted text-sm" data-testid="text-no-interviews">
              {interviews.length === 0 ? "No interviews yet. Start by creating one!" : "No interviews match your filters."}
            </p>
          </div>
        )}

        <div className="space-y-3">
          {filtered.map((i: any) => {
            const isExpanded = expandedId === i.id;
            const team = teams.find((t: any) => t.id === i.playerTeamId);
            return (
              <div key={i.id} className="afrocat-card overflow-hidden" data-testid={`card-interview-${i.id}`}>
                <div
                  className="p-4 flex items-center gap-4 cursor-pointer hover:bg-afrocat-white-3 transition-all"
                  onClick={() => setExpandedId(isExpanded ? null : i.id)}
                >
                  <div className="relative shrink-0">
                    {i.playerPhotoUrl ? (
                      <img src={i.playerPhotoUrl} alt="" className="w-12 h-12 rounded-full object-cover border-2 border-afrocat-teal/20" />
                    ) : (
                      <div className="w-12 h-12 rounded-full bg-afrocat-white-5 flex items-center justify-center text-sm font-bold text-afrocat-muted border-2 border-afrocat-teal/20">
                        {getInitials(i.playerName?.split(" ")[0] || "", i.playerName?.split(" ")[1] || "")}
                      </div>
                    )}
                    {i.playerJerseyNo && (
                      <div className="absolute -bottom-1 -right-1 bg-afrocat-teal text-white text-[10px] font-bold rounded-full w-5 h-5 flex items-center justify-center border-2 border-afrocat-card">
                        {i.playerJerseyNo}
                      </div>
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="font-bold text-sm text-afrocat-text truncate">{i.title}</h3>
                      {i.featured && <Star className="w-3.5 h-3.5 text-afrocat-gold fill-afrocat-gold shrink-0" />}
                      {i.format === "VIDEO" && <Video className="w-3.5 h-3.5 text-afrocat-teal shrink-0" />}
                    </div>
                    <p className="text-xs text-afrocat-muted mt-0.5">
                      {i.playerName} &bull; {i.playerPosition || "-"} {team ? `&bull; ${team.name}` : ""}
                    </p>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-[10px] text-afrocat-muted">{i.questions?.length || 0} questions</span>
                      <span className="text-[10px] text-afrocat-muted">&bull;</span>
                      <span className="text-[10px] text-afrocat-muted">{i.publishedAt ? new Date(i.publishedAt).toLocaleDateString() : ""}</span>
                    </div>
                    {(i.tags || []).length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-1.5">
                        {i.tags.slice(0, 3).map((t: string) => (
                          <span key={t} className="px-1.5 py-0.5 rounded-full text-[9px] font-bold bg-afrocat-teal-soft text-afrocat-teal">{t}</span>
                        ))}
                        {i.tags.length > 3 && <span className="text-[9px] text-afrocat-muted">+{i.tags.length - 3}</span>}
                      </div>
                    )}
                  </div>

                  <div className="flex items-center gap-1">
                    {canManage && (
                      <>
                        <button
                          onClick={(e) => { e.stopPropagation(); toggleFeatured.mutate({ id: i.id, featured: !i.featured }); }}
                          className="p-2 rounded-lg hover:bg-afrocat-white-5 text-afrocat-muted cursor-pointer"
                          data-testid={`button-toggle-featured-${i.id}`}
                        >
                          <Star className={`w-4 h-4 ${i.featured ? "text-afrocat-gold fill-afrocat-gold" : ""}`} />
                        </button>
                        <button
                          onClick={(e) => { e.stopPropagation(); openEdit(i); }}
                          className="p-2 rounded-lg hover:bg-afrocat-white-5 text-afrocat-muted cursor-pointer"
                          data-testid={`button-edit-interview-${i.id}`}
                        >
                          <Edit3 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={(e) => { e.stopPropagation(); if (confirm("Delete this interview?")) deleteMut.mutate(i.id); }}
                          className="p-2 rounded-lg hover:bg-afrocat-red-soft text-afrocat-muted hover:text-afrocat-red cursor-pointer"
                          data-testid={`button-delete-interview-${i.id}`}
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </>
                    )}
                    {isExpanded ? <ChevronUp className="w-4 h-4 text-afrocat-muted" /> : <ChevronDown className="w-4 h-4 text-afrocat-muted" />}
                  </div>
                </div>

                {isExpanded && (
                  <div className="border-t border-afrocat-border p-5 space-y-5 bg-afrocat-white-3">
                    {i.format === "VIDEO" && i.videoUrl && (
                      <div className="rounded-xl overflow-hidden bg-black aspect-video">
                        {i.videoUrl.startsWith("/uploads/") || i.videoUrl.endsWith(".webm") || i.videoUrl.endsWith(".mp4") ? (
                          <video src={i.videoUrl} controls playsInline className="w-full h-full object-contain" data-testid={`video-list-playback-${i.id}`} />
                        ) : (
                          <iframe src={i.videoUrl} className="w-full h-full" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowFullScreen />
                        )}
                      </div>
                    )}

                    <div className="space-y-4">
                      {i.questions?.map((q: string, idx: number) => (
                        <div key={idx} className="flex gap-3">
                          <div className="w-7 h-7 rounded-full bg-afrocat-teal-soft flex items-center justify-center shrink-0 mt-0.5">
                            <span className="text-[10px] font-bold text-afrocat-teal">Q{idx + 1}</span>
                          </div>
                          <div className="flex-1">
                            <p className="text-sm font-bold text-afrocat-teal">{q}</p>
                            <p className="text-sm text-afrocat-text leading-relaxed mt-1">{i.answers?.[idx] || ""}</p>
                          </div>
                        </div>
                      ))}
                    </div>

                    <div className="flex items-center justify-between pt-3 border-t border-afrocat-border text-[10px] text-afrocat-muted">
                      <span>Published by {i.publisherName}</span>
                      <span>{i.publishedAt ? new Date(i.publishedAt).toLocaleString() : ""}</span>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {showCreate && (
          <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
            <div className="bg-afrocat-card border border-afrocat-border rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto p-6 space-y-5">
              <div className="flex items-center justify-between">
                <h2 className="font-display font-bold text-lg text-afrocat-text">
                  {editingId ? "Edit Interview" : "New Player Interview"}
                </h2>
                <button onClick={() => { setShowCreate(false); resetForm(); }} className="p-2 rounded-lg hover:bg-afrocat-white-5 text-afrocat-muted cursor-pointer">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="text-xs font-semibold text-afrocat-muted uppercase tracking-wider mb-1 block">Player</label>
                  <Select value={formPlayerId} onValueChange={setFormPlayerId}>
                    <SelectTrigger data-testid="select-interview-player">
                      <SelectValue placeholder="Select a player" />
                    </SelectTrigger>
                    <SelectContent>
                      {players.map((p: any) => (
                        <SelectItem key={p.id} value={p.id}>
                          #{p.jerseyNo} {p.firstName} {p.lastName} ({p.position || "-"})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <label className="text-xs font-semibold text-afrocat-muted uppercase tracking-wider mb-1 block">Title</label>
                  <input
                    type="text"
                    value={formTitle}
                    onChange={(e) => setFormTitle(e.target.value)}
                    placeholder='e.g. "My Journey to Afrocat"'
                    className="w-full px-4 py-2.5 rounded-xl bg-afrocat-white-5 border border-afrocat-border text-sm text-afrocat-text placeholder:text-afrocat-muted focus:outline-none focus:ring-1 focus:ring-afrocat-teal"
                    data-testid="input-interview-title"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-semibold text-afrocat-muted uppercase tracking-wider mb-1 block">Format</label>
                    <Select value={formFormat} onValueChange={setFormFormat}>
                      <SelectTrigger data-testid="select-interview-format">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="TEXT">Text Q&A</SelectItem>
                        <SelectItem value="VIDEO">Video + Q&A</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex items-end">
                    <button
                      onClick={() => setFormFeatured(!formFeatured)}
                      className={`w-full py-2.5 rounded-xl border text-sm font-bold transition-all cursor-pointer ${
                        formFeatured
                          ? "bg-afrocat-gold-soft border-afrocat-gold/30 text-afrocat-gold"
                          : "bg-afrocat-white-5 border-afrocat-border text-afrocat-muted"
                      }`}
                      data-testid="button-toggle-featured-form"
                    >
                      <Star className={`w-4 h-4 inline mr-1 ${formFeatured ? "fill-afrocat-gold" : ""}`} />
                      {formFeatured ? "Featured" : "Not Featured"}
                    </button>
                  </div>
                </div>

                {formFormat === "VIDEO" && (
                  <div className="space-y-3">
                    <label className="text-xs font-semibold text-afrocat-muted uppercase tracking-wider mb-1 block">Video Source</label>

                    {!showRecorder && (
                      <div className="space-y-3">
                        <div>
                          <label className="text-[10px] font-semibold text-afrocat-muted uppercase tracking-wider mb-1 block">Paste Video URL (YouTube/Vimeo embed link)</label>
                          <input
                            type="url"
                            value={formVideoUrl}
                            onChange={(e) => setFormVideoUrl(e.target.value)}
                            placeholder="https://www.youtube.com/embed/..."
                            className="w-full px-4 py-2.5 rounded-xl bg-afrocat-white-5 border border-afrocat-border text-sm text-afrocat-text placeholder:text-afrocat-muted focus:outline-none focus:ring-1 focus:ring-afrocat-teal"
                            data-testid="input-interview-video"
                          />
                        </div>

                        <div className="flex items-center gap-3">
                          <div className="flex-1 h-px bg-afrocat-border" />
                          <span className="text-[10px] font-bold text-afrocat-muted uppercase">or</span>
                          <div className="flex-1 h-px bg-afrocat-border" />
                        </div>

                        <button
                          type="button"
                          onClick={() => setShowRecorder(true)}
                          disabled={isUploading}
                          className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl border-2 border-dashed border-afrocat-teal/30 bg-afrocat-teal-soft/30 text-afrocat-teal font-bold text-sm hover:bg-afrocat-teal-soft/50 hover:border-afrocat-teal/50 transition-all cursor-pointer disabled:opacity-50"
                          data-testid="button-open-video-recorder"
                        >
                          <Camera className="w-4 h-4" />
                          {isUploading ? "Uploading video..." : "Record from Camera"}
                        </button>

                        {isUploading && (
                          <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-afrocat-teal-soft/20 text-afrocat-teal text-xs font-bold">
                            <div className="w-3 h-3 border-2 border-afrocat-teal border-t-transparent rounded-full animate-spin" />
                            Uploading recorded video...
                          </div>
                        )}

                        {formVideoUrl && (
                          <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-afrocat-white-5 border border-afrocat-border">
                            <Video className="w-4 h-4 text-afrocat-teal shrink-0" />
                            <span className="text-xs text-afrocat-text truncate flex-1">{formVideoUrl}</span>
                            <button
                              type="button"
                              onClick={() => setFormVideoUrl("")}
                              className="p-1 rounded hover:bg-afrocat-white-10 text-afrocat-muted cursor-pointer"
                              data-testid="button-clear-video-url"
                            >
                              <X className="w-3 h-3" />
                            </button>
                          </div>
                        )}
                      </div>
                    )}

                    {showRecorder && (
                      <VideoRecorder
                        onVideoReady={handleRecordedVideo}
                        onClose={() => setShowRecorder(false)}
                      />
                    )}
                  </div>
                )}

                <div>
                  <label className="text-xs font-semibold text-afrocat-muted uppercase tracking-wider mb-1 block">Tags</label>
                  <div className="flex flex-wrap gap-1.5">
                    {INTERVIEW_TAGS.map((t) => (
                      <button
                        key={t}
                        onClick={() => setFormTags((prev) => prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t])}
                        className={`px-2.5 py-1 rounded-full text-[11px] font-bold transition-all cursor-pointer ${
                          formTags.includes(t)
                            ? "bg-afrocat-teal text-white"
                            : "bg-afrocat-white-5 text-afrocat-muted hover:bg-afrocat-teal-soft hover:text-afrocat-teal"
                        }`}
                        data-testid={`button-tag-${t}`}
                      >
                        {t}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-xs font-semibold text-afrocat-muted uppercase tracking-wider">Questions & Answers</label>
                    <button
                      onClick={() => setFormQAs((prev) => [...prev, { q: "", a: "" }])}
                      className="text-xs text-afrocat-teal font-bold cursor-pointer hover:text-afrocat-teal/80"
                      data-testid="button-add-qa"
                    >
                      + Add Question
                    </button>
                  </div>
                  <div className="space-y-4">
                    {formQAs.map((qa, idx) => (
                      <div key={idx} className="bg-afrocat-white-5 rounded-xl p-4 border border-afrocat-border space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] font-bold text-afrocat-teal uppercase">Q{idx + 1}</span>
                          {formQAs.length > 1 && (
                            <button
                              onClick={() => setFormQAs((prev) => prev.filter((_, i) => i !== idx))}
                              className="text-[10px] text-afrocat-red cursor-pointer hover:text-afrocat-red/80"
                            >
                              Remove
                            </button>
                          )}
                        </div>
                        <input
                          type="text"
                          value={qa.q}
                          onChange={(e) => setFormQAs((prev) => prev.map((item, i) => i === idx ? { ...item, q: e.target.value } : item))}
                          placeholder="What inspired you to play volleyball?"
                          className="w-full px-3 py-2 rounded-lg bg-afrocat-card border border-afrocat-border text-sm text-afrocat-text placeholder:text-afrocat-muted focus:outline-none focus:ring-1 focus:ring-afrocat-teal"
                          data-testid={`input-question-${idx}`}
                        />
                        <textarea
                          value={qa.a}
                          onChange={(e) => setFormQAs((prev) => prev.map((item, i) => i === idx ? { ...item, a: e.target.value } : item))}
                          placeholder="Player's answer..."
                          rows={3}
                          className="w-full px-3 py-2 rounded-lg bg-afrocat-card border border-afrocat-border text-sm text-afrocat-text placeholder:text-afrocat-muted focus:outline-none focus:ring-1 focus:ring-afrocat-teal resize-none"
                          data-testid={`input-answer-${idx}`}
                        />
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t border-afrocat-border">
                <button
                  onClick={() => { setShowCreate(false); resetForm(); }}
                  className="px-5 py-2.5 rounded-xl bg-afrocat-white-5 text-afrocat-muted font-bold text-sm hover:bg-afrocat-white-10 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSubmit}
                  disabled={createMut.isPending}
                  className="px-5 py-2.5 rounded-xl bg-afrocat-teal text-white font-bold text-sm hover:bg-afrocat-teal/90 disabled:opacity-50 cursor-pointer"
                  data-testid="button-submit-interview"
                >
                  {createMut.isPending ? "Saving..." : editingId ? "Update" : "Publish Interview"}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}