import { useState, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Layout } from "@/components/Layout";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import {
  BookOpen, Plus, Pin, Tag, Calendar, User, MessageSquare,
  Send, ArrowLeft, Trash2, Edit, X, Check, Layout as LayoutIcon, Circle, Move, Save
} from "lucide-react";

const CATEGORIES = [
  { value: "GENERAL", label: "General" },
  { value: "TACTICS", label: "Tactics & Strategy" },
  { value: "TRAINING", label: "Training Tips" },
  { value: "MOTIVATION", label: "Motivation" },
  { value: "ANALYSIS", label: "Match Analysis" },
  { value: "FITNESS", label: "Fitness & Conditioning" },
  { value: "MENTAL", label: "Mental Game" },
];

const CATEGORY_COLORS: Record<string, string> = {
  GENERAL: "bg-afrocat-white-10 text-afrocat-muted",
  TACTICS: "bg-blue-500/15 text-blue-400",
  TRAINING: "bg-afrocat-teal-soft text-afrocat-teal",
  MOTIVATION: "bg-afrocat-gold-soft text-afrocat-gold",
  ANALYSIS: "bg-purple-500/15 text-purple-400",
  FITNESS: "bg-green-500/15 text-green-400",
  MENTAL: "bg-pink-500/15 text-pink-400",
};

function roleBadgeColor(role: string) {
  switch (role) {
    case "ADMIN": return "bg-afrocat-gold/20 text-afrocat-gold border-afrocat-gold/30";
    case "COACH": return "bg-afrocat-teal/20 text-afrocat-teal border-afrocat-teal/30";
    case "MANAGER": return "bg-purple-500/20 text-purple-400 border-purple-500/30";
    default: return "bg-afrocat-white-5 text-afrocat-muted border-afrocat-border";
  }
}

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString([], { month: "short", day: "numeric" });
}

const COURT_W = 600;
const COURT_H = 400;
const PLAYER_R = 18;
const DEFAULT_POSITIONS = [
  { x: 100, y: 80, label: "S" }, { x: 300, y: 80, label: "MB" }, { x: 500, y: 80, label: "OH" },
  { x: 100, y: 200, label: "L" }, { x: 300, y: 200, label: "OP" }, { x: 500, y: 200, label: "OH2" },
];

function TacticBoardSection() {
  const { user } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();
  const canEdit = user?.isSuperAdmin || ["ADMIN", "MANAGER", "COACH"].includes(user?.role || "");

  const [activeBoard, setActiveBoard] = useState<any>(null);
  const [positions, setPositions] = useState(DEFAULT_POSITIONS);
  const [boardTitle, setBoardTitle] = useState("");
  const [dragging, setDragging] = useState<number | null>(null);
  const [annotations, setAnnotations] = useState<{x1:number;y1:number;x2:number;y2:number}[]>([]);
  const [drawing, setDrawing] = useState(false);
  const [drawStart, setDrawStart] = useState<{x:number;y:number}|null>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  const { data: teams = [] } = useQuery({ queryKey: ["/api/teams"], queryFn: api.getTeams });
  const [teamId, setTeamId] = useState("");

  const { data: fetchedBoards = [] } = useQuery({
    queryKey: ["/api/tactic-boards", teamId],
    queryFn: () => api.getTacticBoards(teamId || undefined),
  });

  const saveMut = useMutation({
    mutationFn: () => {
      const boardJson = { positions, annotations };
      if (activeBoard?.id) {
        return api.updateTacticBoard(activeBoard.id, { title: boardTitle, boardJson });
      }
      return api.createTacticBoard({ title: boardTitle || "Untitled", boardJson, teamId: teamId || undefined });
    },
    onSuccess: () => {
      toast({ title: "Tactic board saved" });
      qc.invalidateQueries({ queryKey: ["/api/tactic-boards", teamId] });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => api.deleteTacticBoard(id),
    onSuccess: () => {
      toast({ title: "Board deleted" });
      setActiveBoard(null);
      resetBoard();
      qc.invalidateQueries({ queryKey: ["/api/tactic-boards", teamId] });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  function resetBoard() {
    setPositions(DEFAULT_POSITIONS);
    setAnnotations([]);
    setBoardTitle("");
    setActiveBoard(null);
  }

  function loadBoard(board: any) {
    setActiveBoard(board);
    setBoardTitle(board.title || "");
    let json = board.boardJson || {};
    if (typeof json === "string") {
      try { json = JSON.parse(json); } catch { json = {}; }
    }
    setPositions(json.positions || DEFAULT_POSITIONS);
    setAnnotations(json.annotations || []);
  }

  function getSvgCoords(e: React.MouseEvent<SVGSVGElement>) {
    const svg = svgRef.current;
    if (!svg) return { x: 0, y: 0 };
    const rect = svg.getBoundingClientRect();
    return {
      x: ((e.clientX - rect.left) / rect.width) * COURT_W,
      y: ((e.clientY - rect.top) / rect.height) * COURT_H,
    };
  }

  function handleMouseDown(e: React.MouseEvent<SVGSVGElement>) {
    if (dragging !== null) return;
    if (!drawing) return;
    const coords = getSvgCoords(e);
    setDrawStart(coords);
  }

  function handleMouseUp(e: React.MouseEvent<SVGSVGElement>) {
    if (dragging !== null) { setDragging(null); return; }
    if (drawing && drawStart) {
      const coords = getSvgCoords(e);
      const dx = coords.x - drawStart.x;
      const dy = coords.y - drawStart.y;
      if (Math.sqrt(dx * dx + dy * dy) > 15) {
        setAnnotations(prev => [...prev, { x1: drawStart.x, y1: drawStart.y, x2: coords.x, y2: coords.y }]);
      }
      setDrawStart(null);
    }
  }

  function handleMouseMove(e: React.MouseEvent<SVGSVGElement>) {
    if (dragging !== null) {
      const coords = getSvgCoords(e);
      setPositions(prev => prev.map((p, i) => i === dragging ? { ...p, x: Math.max(PLAYER_R, Math.min(COURT_W - PLAYER_R, coords.x)), y: Math.max(PLAYER_R, Math.min(COURT_H - PLAYER_R, coords.y)) } : p));
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 flex-wrap">
        <select value={teamId} onChange={e => setTeamId(e.target.value)}
          className="px-3 py-1.5 rounded-lg bg-afrocat-white-5 border border-afrocat-border text-afrocat-text text-sm" data-testid="select-tactic-team">
          <option value="">All Teams</option>
          {teams.map((t: any) => <option key={t.id} value={t.id}>{t.name}</option>)}
        </select>
        {canEdit && (
          <>
            <button onClick={resetBoard} className="px-3 py-1.5 rounded-lg bg-afrocat-teal text-white text-xs font-bold cursor-pointer" data-testid="button-new-board">
              <Plus className="inline h-3 w-3 mr-1" /> New Board
            </button>
            <button onClick={() => setDrawing(!drawing)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold cursor-pointer ${drawing ? "bg-afrocat-gold text-white" : "bg-afrocat-white-5 text-afrocat-muted border border-afrocat-border"}`}
              data-testid="button-toggle-draw">
              {drawing ? "Drawing ON" : "Draw Arrows"}
            </button>
          </>
        )}
      </div>

      {fetchedBoards.length > 0 && (
        <div className="flex gap-2 overflow-x-auto pb-1">
          {fetchedBoards.map((b: any) => (
            <button key={b.id} onClick={() => loadBoard(b)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap cursor-pointer transition-colors ${activeBoard?.id === b.id ? "bg-afrocat-teal text-white" : "bg-afrocat-white-5 text-afrocat-muted border border-afrocat-border"}`}
              data-testid={`board-tab-${b.id}`}>
              {b.title || "Untitled"}
            </button>
          ))}
        </div>
      )}

      <div className="afrocat-card p-4 space-y-3">
        {canEdit && (
          <div className="flex gap-2">
            <input value={boardTitle} onChange={e => setBoardTitle(e.target.value)} placeholder="Board title..."
              className="flex-1 px-3 py-2 rounded-lg bg-afrocat-white-5 border border-afrocat-border text-afrocat-text text-sm" data-testid="input-board-title" />
            <button onClick={() => saveMut.mutate()} disabled={saveMut.isPending}
              className="px-4 py-2 rounded-lg bg-afrocat-teal text-white text-sm font-bold cursor-pointer disabled:opacity-50 flex items-center gap-1" data-testid="button-save-board">
              <Save className="h-4 w-4" /> Save
            </button>
            {activeBoard?.id && (
              <button onClick={() => { if (confirm("Delete this board?")) deleteMut.mutate(activeBoard.id); }}
                className="px-3 py-2 rounded-lg bg-afrocat-red-soft text-afrocat-red text-sm font-bold cursor-pointer" data-testid="button-delete-board">
                <Trash2 className="h-4 w-4" />
              </button>
            )}
          </div>
        )}

        <div className="border border-afrocat-border rounded-xl overflow-hidden bg-green-900/30">
          <svg ref={svgRef} viewBox={`0 0 ${COURT_W} ${COURT_H}`} className="w-full"
            onMouseDown={handleMouseDown} onMouseUp={handleMouseUp} onMouseMove={handleMouseMove}
            style={{ touchAction: "none" }}>
            <rect x={0} y={0} width={COURT_W} height={COURT_H} fill="#1a3a2a" />
            <line x1={COURT_W / 2} y1={0} x2={COURT_W / 2} y2={COURT_H} stroke="#4ade80" strokeWidth={2} opacity={0.4} />
            <rect x={10} y={10} width={COURT_W / 2 - 15} height={COURT_H - 20} fill="none" stroke="#4ade80" strokeWidth={1.5} opacity={0.5} rx={4} />
            <rect x={COURT_W / 2 + 5} y={10} width={COURT_W / 2 - 15} height={COURT_H - 20} fill="none" stroke="#4ade80" strokeWidth={1.5} opacity={0.5} rx={4} />
            <line x1={10} y1={COURT_H * 0.25} x2={COURT_W / 2 - 5} y2={COURT_H * 0.25} stroke="#4ade80" strokeWidth={1} opacity={0.3} strokeDasharray="6,4" />
            <line x1={COURT_W / 2 + 5} y1={COURT_H * 0.25} x2={COURT_W - 10} y2={COURT_H * 0.25} stroke="#4ade80" strokeWidth={1} opacity={0.3} strokeDasharray="6,4" />

            {annotations.map((a, i) => (
              <g key={`ann-${i}`}>
                <defs><marker id={`arrowhead-${i}`} markerWidth={8} markerHeight={6} refX={8} refY={3} orient="auto"><polygon points="0 0, 8 3, 0 6" fill="#facc15" /></marker></defs>
                <line x1={a.x1} y1={a.y1} x2={a.x2} y2={a.y2} stroke="#facc15" strokeWidth={2} markerEnd={`url(#arrowhead-${i})`} />
              </g>
            ))}

            {positions.map((p, i) => (
              <g key={i} style={{ cursor: canEdit ? "grab" : "default" }}
                onMouseDown={(e) => { if (canEdit) { e.stopPropagation(); setDragging(i); } }}>
                <circle cx={p.x} cy={p.y} r={PLAYER_R} fill="#14b8a6" stroke="#fff" strokeWidth={2} opacity={0.9} />
                <text x={p.x} y={p.y + 5} textAnchor="middle" fill="white" fontSize={11} fontWeight="bold">{p.label}</text>
              </g>
            ))}
          </svg>
        </div>

        {annotations.length > 0 && canEdit && (
          <button onClick={() => setAnnotations([])} className="text-xs text-afrocat-muted hover:text-afrocat-red cursor-pointer" data-testid="button-clear-arrows">
            Clear all arrows
          </button>
        )}
      </div>
    </div>
  );
}

export default function CoachBlog() {
  const { user } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();
  const canWrite = user?.isSuperAdmin || ["ADMIN", "MANAGER", "COACH"].includes(user?.role || "");

  const [topTab, setTopTab] = useState<"posts" | "tactics">("posts");
  const [view, setView] = useState<"list" | "detail" | "compose">("list");
  const [selectedPostId, setSelectedPostId] = useState<string | null>(null);
  const [filterCategory, setFilterCategory] = useState<string>("ALL");
  const [form, setForm] = useState({ title: "", body: "", category: "GENERAL", tags: "", pinned: false });
  const [editingId, setEditingId] = useState<string | null>(null);
  const [commentText, setCommentText] = useState("");

  const { data: posts = [], isLoading } = useQuery({
    queryKey: ["/api/coach-blog"],
    queryFn: api.getCoachBlogPosts,
  });

  const { data: postDetail } = useQuery({
    queryKey: ["/api/coach-blog", selectedPostId],
    queryFn: () => api.getCoachBlogPost(selectedPostId!),
    enabled: !!selectedPostId && view === "detail",
  });

  const filteredPosts = filterCategory === "ALL"
    ? posts
    : posts.filter((p: any) => p.category === filterCategory);

  const createMut = useMutation({
    mutationFn: () => {
      const tags = form.tags.split(",").map(t => t.trim()).filter(Boolean);
      if (editingId) {
        return api.updateCoachBlogPost(editingId, { ...form, tags });
      }
      return api.createCoachBlogPost({ ...form, tags });
    },
    onSuccess: () => {
      toast({ title: editingId ? "Post updated" : "Post published" });
      resetForm();
      setView("list");
      qc.invalidateQueries({ queryKey: ["/api/coach-blog"] });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => api.deleteCoachBlogPost(id),
    onSuccess: () => {
      toast({ title: "Post deleted" });
      setView("list");
      setSelectedPostId(null);
      qc.invalidateQueries({ queryKey: ["/api/coach-blog"] });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const commentMut = useMutation({
    mutationFn: () => api.addCoachBlogComment(selectedPostId!, commentText),
    onSuccess: () => {
      setCommentText("");
      qc.invalidateQueries({ queryKey: ["/api/coach-blog", selectedPostId] });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const deleteCommentMut = useMutation({
    mutationFn: (commentId: string) => api.deleteCoachBlogComment(selectedPostId!, commentId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["/api/coach-blog", selectedPostId] }),
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  function resetForm() {
    setForm({ title: "", body: "", category: "GENERAL", tags: "", pinned: false });
    setEditingId(null);
  }

  function openPost(id: string) {
    setSelectedPostId(id);
    setView("detail");
  }

  function startEdit(post: any) {
    setForm({
      title: post.title,
      body: post.body,
      category: post.category,
      tags: (post.tags || []).join(", "),
      pinned: post.pinned || false,
    });
    setEditingId(post.id);
    setView("compose");
  }

  function canEditPost(post: any) {
    if (user?.isSuperAdmin) return true;
    if (post.authorId === user?.id) return true;
    if (["ADMIN", "MANAGER"].includes(user?.role || "")) return true;
    return false;
  }

  if (view === "compose") {
    return (
      <Layout>
        <div className="p-6 max-w-3xl mx-auto space-y-6">
          <div className="flex items-center gap-3">
            <button onClick={() => { resetForm(); setView("list"); }} className="text-afrocat-muted hover:text-afrocat-text transition-colors">
              <ArrowLeft size={20} />
            </button>
            <BookOpen className="h-7 w-7 text-afrocat-teal" />
            <h1 className="text-2xl font-display font-bold text-afrocat-text">
              {editingId ? "Edit Post" : "Write Post"}
            </h1>
          </div>

          <div className="afrocat-card p-6 space-y-5">
            <div>
              <label className="text-xs text-afrocat-muted mb-1 block">Title</label>
              <input
                value={form.title}
                onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                placeholder="Post title..."
                className="w-full px-4 py-3 rounded-lg bg-afrocat-white-5 border border-afrocat-border text-afrocat-text text-lg font-display font-bold placeholder:text-afrocat-muted focus:outline-none focus:ring-1 focus:ring-afrocat-teal"
                data-testid="input-blog-title"
              />
            </div>

            <div className="flex gap-4">
              <div className="flex-1">
                <label className="text-xs text-afrocat-muted mb-1 block">Category</label>
                <Select value={form.category} onValueChange={v => setForm(f => ({ ...f, category: v }))}>
                  <SelectTrigger className="bg-afrocat-white-5 border-afrocat-border text-afrocat-text" data-testid="select-blog-category">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CATEGORIES.map(c => (
                      <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex-1">
                <label className="text-xs text-afrocat-muted mb-1 block">Tags (comma-separated)</label>
                <input
                  value={form.tags}
                  onChange={e => setForm(f => ({ ...f, tags: e.target.value }))}
                  placeholder="e.g. serve, rotation, defense"
                  className="w-full px-3 py-2 rounded-lg bg-afrocat-white-5 border border-afrocat-border text-afrocat-text text-sm placeholder:text-afrocat-muted focus:outline-none focus:ring-1 focus:ring-afrocat-teal"
                  data-testid="input-blog-tags"
                />
              </div>
            </div>

            <div>
              <label className="text-xs text-afrocat-muted mb-1 block">Content</label>
              <textarea
                value={form.body}
                onChange={e => setForm(f => ({ ...f, body: e.target.value }))}
                placeholder="Share your insights, strategies, and tips with the team..."
                rows={14}
                className="w-full px-4 py-3 rounded-lg bg-afrocat-white-5 border border-afrocat-border text-afrocat-text text-sm leading-relaxed placeholder:text-afrocat-muted focus:outline-none focus:ring-1 focus:ring-afrocat-teal resize-none"
                data-testid="input-blog-body"
              />
            </div>

            <div className="flex items-center justify-between">
              <label className="flex items-center gap-2 cursor-pointer text-sm text-afrocat-muted">
                <input
                  type="checkbox"
                  checked={form.pinned}
                  onChange={e => setForm(f => ({ ...f, pinned: e.target.checked }))}
                  className="rounded border-afrocat-border"
                  data-testid="checkbox-blog-pinned"
                />
                <Pin size={14} /> Pin to top
              </label>

              <div className="flex gap-3">
                <Button variant="outline" onClick={() => { resetForm(); setView("list"); }} className="border-afrocat-border text-afrocat-text">
                  Cancel
                </Button>
                <Button
                  onClick={() => createMut.mutate()}
                  disabled={!form.title || !form.body || createMut.isPending}
                  data-testid="button-publish-blog"
                  className="bg-afrocat-teal hover:bg-afrocat-teal/90 text-white"
                >
                  {createMut.isPending ? "Saving..." : editingId ? "Update Post" : "Publish Post"}
                </Button>
              </div>
            </div>
          </div>
        </div>
      </Layout>
    );
  }

  if (view === "detail" && postDetail) {
    return (
      <Layout>
        <div className="p-6 max-w-3xl mx-auto space-y-6">
          <button
            onClick={() => { setView("list"); setSelectedPostId(null); }}
            className="flex items-center gap-2 text-sm text-afrocat-muted hover:text-afrocat-text transition-colors"
            data-testid="button-back-to-list"
          >
            <ArrowLeft size={16} /> Back to Coach's Corner
          </button>

          <article className="afrocat-card p-6 space-y-4">
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-2 flex-wrap">
                  {postDetail.pinned && (
                    <span className="flex items-center gap-1 text-[10px] font-bold text-afrocat-gold bg-afrocat-gold-soft px-2 py-0.5 rounded-full">
                      <Pin size={10} /> PINNED
                    </span>
                  )}
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${CATEGORY_COLORS[postDetail.category] || CATEGORY_COLORS.GENERAL}`}>
                    {CATEGORIES.find(c => c.value === postDetail.category)?.label || postDetail.category}
                  </span>
                </div>
                <h1 className="text-2xl font-display font-bold text-afrocat-text" data-testid="text-blog-post-title">
                  {postDetail.title}
                </h1>
              </div>
              {canEditPost(postDetail) && (
                <div className="flex gap-2 shrink-0">
                  <button onClick={() => startEdit(postDetail)} data-testid="button-edit-post" className="p-2 rounded-lg bg-afrocat-white-5 text-afrocat-muted hover:text-afrocat-teal transition-colors">
                    <Edit size={16} />
                  </button>
                  <button
                    onClick={() => { if (confirm("Delete this post?")) deleteMut.mutate(postDetail.id); }}
                    data-testid="button-delete-post"
                    className="p-2 rounded-lg bg-afrocat-white-5 text-afrocat-muted hover:text-afrocat-red transition-colors"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              )}
            </div>

            <div className="flex items-center gap-3 text-xs text-afrocat-muted pb-4 border-b border-afrocat-border">
              <span className="flex items-center gap-1"><User size={12} /> {postDetail.authorName}</span>
              <span className="flex items-center gap-1"><Calendar size={12} /> {new Date(postDetail.publishedAt).toLocaleDateString([], { month: "long", day: "numeric", year: "numeric" })}</span>
              {postDetail.updatedAt && postDetail.updatedAt !== postDetail.publishedAt && (
                <span className="text-afrocat-muted/60">(edited)</span>
              )}
            </div>

            <div className="text-sm text-afrocat-text leading-relaxed whitespace-pre-wrap" data-testid="text-blog-post-body">
              {postDetail.body}
            </div>

            {postDetail.tags && postDetail.tags.length > 0 && (
              <div className="flex items-center gap-2 pt-2 flex-wrap">
                <Tag size={12} className="text-afrocat-muted" />
                {postDetail.tags.map((tag: string, i: number) => (
                  <span key={i} className="text-[10px] px-2 py-0.5 rounded-full bg-afrocat-white-5 text-afrocat-muted border border-afrocat-border">
                    {tag}
                  </span>
                ))}
              </div>
            )}
          </article>

          <div className="afrocat-card p-6 space-y-4">
            <h3 className="flex items-center gap-2 text-base font-display font-bold text-afrocat-text">
              <MessageSquare size={18} className="text-afrocat-teal" />
              Comments ({postDetail.comments?.length || 0})
            </h3>

            {postDetail.comments && postDetail.comments.length > 0 ? (
              <div className="space-y-3">
                {postDetail.comments.map((c: any) => (
                  <div key={c.id} className="flex gap-3 p-3 rounded-xl bg-afrocat-white-3" data-testid={`comment-${c.id}`}>
                    <div className="w-8 h-8 rounded-full bg-afrocat-teal-soft flex items-center justify-center text-xs font-bold text-afrocat-teal shrink-0">
                      {(c.authorName || "?").charAt(0).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-semibold text-afrocat-text">{c.authorName}</span>
                        {c.authorRole && (
                          <span className={`text-[10px] px-1.5 py-0.5 rounded border font-medium ${roleBadgeColor(c.authorRole)}`}>
                            {c.authorRole}
                          </span>
                        )}
                        <span className="text-[10px] text-afrocat-muted">{timeAgo(c.createdAt)}</span>
                      </div>
                      <p className="text-sm text-afrocat-text mt-1">{c.body}</p>
                    </div>
                    {(c.authorId === user?.id || user?.isSuperAdmin || ["ADMIN", "MANAGER"].includes(user?.role || "")) && (
                      <button
                        onClick={() => deleteCommentMut.mutate(c.id)}
                        className="text-afrocat-muted hover:text-afrocat-red transition-colors shrink-0 self-start"
                        data-testid={`button-delete-comment-${c.id}`}
                      >
                        <X size={14} />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-afrocat-muted">No comments yet. Be the first to share your thoughts!</p>
            )}

            <div className="flex gap-2 pt-2 border-t border-afrocat-border">
              <input
                value={commentText}
                onChange={e => setCommentText(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey && commentText.trim()) { e.preventDefault(); commentMut.mutate(); } }}
                placeholder="Add a comment..."
                className="flex-1 px-3 py-2 rounded-lg bg-afrocat-white-5 border border-afrocat-border text-afrocat-text text-sm placeholder:text-afrocat-muted focus:outline-none focus:ring-1 focus:ring-afrocat-teal"
                data-testid="input-blog-comment"
              />
              <Button
                onClick={() => commentMut.mutate()}
                disabled={!commentText.trim() || commentMut.isPending}
                data-testid="button-send-comment"
                className="bg-afrocat-teal hover:bg-afrocat-teal/90 text-white"
                size="sm"
              >
                <Send size={14} />
              </Button>
            </div>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="p-6 max-w-4xl mx-auto space-y-6">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <BookOpen className="h-7 w-7 text-afrocat-teal" />
            <div>
              <h1 className="text-2xl font-display font-bold text-afrocat-text" data-testid="text-coach-blog-title">
                Coach's Corner
              </h1>
              <p className="text-xs text-afrocat-muted">Insights, strategies, and tips from your coaching staff</p>
            </div>
          </div>
          <div className="flex gap-2">
            {canWrite && topTab === "posts" && (
              <Button
                onClick={() => { resetForm(); setView("compose"); }}
                data-testid="button-new-blog-post"
                className="bg-afrocat-teal hover:bg-afrocat-teal/90 text-white"
              >
                <Plus className="h-4 w-4 mr-2" /> Write Post
              </Button>
            )}
          </div>
        </div>

        <div className="flex gap-2 border-b border-afrocat-border pb-2">
          <button onClick={() => setTopTab("posts")}
            className={`px-4 py-2 rounded-t-lg text-sm font-bold cursor-pointer transition-colors ${topTab === "posts" ? "bg-afrocat-teal text-white" : "text-afrocat-muted hover:text-afrocat-text"}`}
            data-testid="tab-posts">
            <BookOpen className="inline h-4 w-4 mr-1" /> Blog Posts
          </button>
          <button onClick={() => setTopTab("tactics")}
            className={`px-4 py-2 rounded-t-lg text-sm font-bold cursor-pointer transition-colors ${topTab === "tactics" ? "bg-afrocat-teal text-white" : "text-afrocat-muted hover:text-afrocat-text"}`}
            data-testid="tab-tactics">
            <LayoutIcon className="inline h-4 w-4 mr-1" /> Tactic Board
          </button>
        </div>

        {topTab === "tactics" ? (
          <TacticBoardSection />
        ) : (
        <div className="space-y-4">
        <div className="flex items-center gap-2 overflow-x-auto pb-1" data-testid="blog-category-filter">
          <button
            onClick={() => setFilterCategory("ALL")}
            className={`text-xs px-3 py-1.5 rounded-full font-medium whitespace-nowrap transition-colors ${
              filterCategory === "ALL" ? "bg-afrocat-teal text-white" : "bg-afrocat-white-5 text-afrocat-muted hover:text-afrocat-text border border-afrocat-border"
            }`}
          >
            All Posts
          </button>
          {CATEGORIES.map(c => (
            <button
              key={c.value}
              onClick={() => setFilterCategory(c.value)}
              className={`text-xs px-3 py-1.5 rounded-full font-medium whitespace-nowrap transition-colors ${
                filterCategory === c.value ? "bg-afrocat-teal text-white" : "bg-afrocat-white-5 text-afrocat-muted hover:text-afrocat-text border border-afrocat-border"
              }`}
              data-testid={`filter-${c.value}`}
            >
              {c.label}
            </button>
          ))}
        </div>

        {isLoading ? (
          <div className="flex justify-center py-12"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-afrocat-teal" /></div>
        ) : filteredPosts.length === 0 ? (
          <div className="afrocat-card p-12 text-center">
            <BookOpen className="h-16 w-16 mx-auto mb-4 text-afrocat-muted opacity-30" />
            <h3 className="text-lg font-display font-bold text-afrocat-text mb-1">No posts yet</h3>
            <p className="text-sm text-afrocat-muted">
              {canWrite ? "Be the first to share an insight with the team!" : "Check back later for coaching insights and strategies."}
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {filteredPosts.map((post: any) => (
              <div
                key={post.id}
                onClick={() => openPost(post.id)}
                className="afrocat-card p-5 cursor-pointer hover:border-afrocat-teal/30 transition-colors group"
                data-testid={`blog-post-${post.id}`}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-2 flex-wrap">
                      {post.pinned && (
                        <span className="flex items-center gap-1 text-[10px] font-bold text-afrocat-gold bg-afrocat-gold-soft px-2 py-0.5 rounded-full">
                          <Pin size={10} /> PINNED
                        </span>
                      )}
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${CATEGORY_COLORS[post.category] || CATEGORY_COLORS.GENERAL}`}>
                        {CATEGORIES.find(c => c.value === post.category)?.label || post.category}
                      </span>
                    </div>
                    <h3 className="text-lg font-display font-bold text-afrocat-text group-hover:text-afrocat-teal transition-colors" data-testid={`text-post-title-${post.id}`}>
                      {post.title}
                    </h3>
                    <p className="text-sm text-afrocat-muted mt-1 line-clamp-2">{post.body}</p>
                    {post.tags && post.tags.length > 0 && (
                      <div className="flex items-center gap-1.5 mt-2 flex-wrap">
                        {post.tags.slice(0, 4).map((tag: string, i: number) => (
                          <span key={i} className="text-[10px] px-1.5 py-0.5 rounded bg-afrocat-white-5 text-afrocat-muted">
                            #{tag}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-4 mt-3 pt-3 border-t border-afrocat-border text-xs text-afrocat-muted">
                  <span className="flex items-center gap-1"><User size={12} /> {post.authorName}</span>
                  <span className="flex items-center gap-1"><Calendar size={12} /> {timeAgo(post.publishedAt)}</span>
                </div>
              </div>
            ))}
          </div>
        )}
        </div>
        )}
      </div>
    </Layout>
  );
}
