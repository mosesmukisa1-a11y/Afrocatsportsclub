import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Layout } from "@/components/Layout";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import {
  BookOpen, Plus, Pin, Tag, Calendar, User, MessageSquare,
  Send, ArrowLeft, Trash2, Edit, X, Check
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

export default function CoachBlog() {
  const { user } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();
  const canWrite = user?.isSuperAdmin || ["ADMIN", "MANAGER", "COACH"].includes(user?.role || "");

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
          {canWrite && (
            <Button
              onClick={() => { resetForm(); setView("compose"); }}
              data-testid="button-new-blog-post"
              className="bg-afrocat-teal hover:bg-afrocat-teal/90 text-white"
            >
              <Plus className="h-4 w-4 mr-2" /> Write Post
            </Button>
          )}
        </div>

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
    </Layout>
  );
}
