import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import {
  Heart, MessageCircle, ImagePlus, Send, MoreVertical, EyeOff, Eye, Trash2, Loader2, Info, ShieldAlert,
} from "lucide-react";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export const Route = createFileRoute("/_authenticated/inicio")({
  head: () => ({ meta: [{ title: "Início — Sistema NEXUS" }] }),
  component: InicioPage,
});

const BUCKET = "feed";

type Post = {
  id: string;
  author_id: string;
  caption: string | null;
  image_path: string;
  source: string;
  hidden_at: string | null;
  created_at: string;
};

type Comment = {
  id: string;
  post_id: string;
  author_id: string;
  body: string;
  created_at: string;
};

type ProfileLite = { id: string; nome: string };

async function signedUrl(path: string): Promise<string> {
  if (/^https?:\/\//i.test(path)) return path;
  const { data } = await supabase.storage.from(BUCKET).createSignedUrl(path, 60 * 60);
  return data?.signedUrl ?? "";
}

function initials(name: string) {
  return name.trim().split(/\s+/).slice(0, 2).map((p) => p[0]?.toUpperCase() ?? "").join("") || "?";
}

function formatRelative(iso: string) {
  const d = new Date(iso).getTime();
  const diff = Date.now() - d;
  const m = Math.floor(diff / 60000);
  if (m < 1) return "agora";
  if (m < 60) return `${m}min`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  const days = Math.floor(h / 24);
  if (days < 7) return `${days}d`;
  return new Date(iso).toLocaleDateString("pt-BR");
}

function InicioPage() {
  const [userId, setUserId] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [profiles, setProfiles] = useState<Record<string, ProfileLite>>({});
  const [imageUrls, setImageUrls] = useState<Record<string, string>>({});
  const [likes, setLikes] = useState<Record<string, { count: number; mine: boolean }>>({});
  const [commentsByPost, setCommentsByPost] = useState<Record<string, Comment[]>>({});
  const [openComments, setOpenComments] = useState<Record<string, boolean>>({});
  const [newComment, setNewComment] = useState<Record<string, string>>({});
  const [showCompose, setShowCompose] = useState(false);

  const loadAll = useCallback(async () => {
    setLoading(true);
    const { data: posts } = await supabase
      .from("feed_posts")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(60);
    const list = (posts ?? []) as Post[];
    setPosts(list);
    setLoading(false);

    if (!list.length) return;
    const ids = list.map((p) => p.id);
    const authorIds = Array.from(new Set(list.map((p) => p.author_id)));

    const [profRes, likesRes, myLikesRes, commentsRes] = await Promise.all([
      supabase.from("profiles").select("id, nome").in("id", authorIds),
      supabase.from("feed_likes").select("post_id").in("post_id", ids),
      userId
        ? supabase.from("feed_likes").select("post_id").in("post_id", ids).eq("user_id", userId)
        : Promise.resolve({ data: [] as { post_id: string }[] }),
      supabase.from("feed_comments").select("*").in("post_id", ids).order("created_at", { ascending: true }),
    ]);

    const profMap: Record<string, ProfileLite> = {};
    for (const p of (profRes.data ?? []) as ProfileLite[]) profMap[p.id] = p;
    setProfiles(profMap);

    const counts: Record<string, { count: number; mine: boolean }> = {};
    for (const id of ids) counts[id] = { count: 0, mine: false };
    for (const r of (likesRes.data ?? []) as { post_id: string }[]) {
      if (counts[r.post_id]) counts[r.post_id].count += 1;
    }
    for (const r of (myLikesRes.data ?? []) as { post_id: string }[]) {
      if (counts[r.post_id]) counts[r.post_id].mine = true;
    }
    setLikes(counts);

    const grouped: Record<string, Comment[]> = {};
    for (const c of (commentsRes.data ?? []) as Comment[]) {
      (grouped[c.post_id] ??= []).push(c);
    }
    setCommentsByPost(grouped);

    // Inclui autores de comentários nos profiles
    const commentAuthors = Array.from(
      new Set((commentsRes.data ?? []).map((c: Comment) => c.author_id).filter((id) => !profMap[id])),
    );
    if (commentAuthors.length) {
      const { data } = await supabase.from("profiles").select("id, nome").in("id", commentAuthors);
      setProfiles((prev) => {
        const next = { ...prev };
        for (const p of (data ?? []) as ProfileLite[]) next[p.id] = p;
        return next;
      });
    }

    // resolve image urls
    const urlEntries = await Promise.all(
      list.map(async (p) => [p.id, await signedUrl(p.image_path)] as const),
    );
    setImageUrls(Object.fromEntries(urlEntries));
  }, [userId]);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      const uid = data.user?.id ?? null;
      setUserId(uid);
      if (uid) {
        supabase.rpc("has_role", { _user_id: uid, _role: "admin" }).then(({ data }) => {
          setIsAdmin(data === true);
        });
      }
    });
  }, []);

  useEffect(() => { loadAll(); }, [loadAll]);

  // Realtime
  useEffect(() => {
    const channel = supabase
      .channel("feed-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "feed_posts" }, () => loadAll())
      .on("postgres_changes", { event: "*", schema: "public", table: "feed_likes" }, () => loadAll())
      .on("postgres_changes", { event: "*", schema: "public", table: "feed_comments" }, () => loadAll())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [loadAll]);

  async function toggleLike(postId: string) {
    if (!userId) return;
    const current = likes[postId];
    if (current?.mine) {
      setLikes((p) => ({ ...p, [postId]: { count: Math.max(0, (p[postId]?.count ?? 1) - 1), mine: false } }));
      await supabase.from("feed_likes").delete().eq("post_id", postId).eq("user_id", userId);
    } else {
      setLikes((p) => ({ ...p, [postId]: { count: (p[postId]?.count ?? 0) + 1, mine: true } }));
      await supabase.from("feed_likes").insert({ post_id: postId, user_id: userId });
    }
  }

  async function sendComment(postId: string) {
    const body = (newComment[postId] ?? "").trim();
    if (!body || !userId) return;
    setNewComment((p) => ({ ...p, [postId]: "" }));
    const { error } = await supabase.from("feed_comments").insert({
      post_id: postId, author_id: userId, body,
    });
    if (error) toast.error("Falha ao comentar: " + error.message);
  }

  async function deleteComment(c: Comment) {
    const { error } = await supabase.from("feed_comments").delete().eq("id", c.id);
    if (error) toast.error("Falha ao remover comentário");
  }

  async function toggleHide(post: Post) {
    if (!isAdmin) return;
    if (post.hidden_at) {
      const { error } = await supabase
        .from("feed_posts")
        .update({ hidden_at: null, hidden_by: null })
        .eq("id", post.id);
      if (error) return toast.error("Falha: " + error.message);
      toast.success("Post restaurado");
    } else {
      const { error } = await supabase
        .from("feed_posts")
        .update({ hidden_at: new Date().toISOString(), hidden_by: userId })
        .eq("id", post.id);
      if (error) return toast.error("Falha: " + error.message);
      toast.success("Post ocultado");
    }
  }

  async function deletePost(post: Post) {
    const { error } = await supabase.from("feed_posts").delete().eq("id", post.id);
    if (error) return toast.error("Falha: " + error.message);
    // remove storage best-effort
    if (!/^https?:\/\//i.test(post.image_path)) {
      supabase.storage.from(BUCKET).remove([post.image_path]).catch(() => null);
    }
    toast.success("Post excluído");
  }

  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-6 md:py-10 space-y-6">
      <header className="flex items-end justify-between gap-4">
        <div>
          <div className="text-[10px] uppercase tracking-[0.4em] text-muted-foreground">Mural</div>
          <h1 className="text-2xl md:text-3xl font-semibold tracking-tight mt-1">Início</h1>
          <p className="text-sm text-muted-foreground mt-1">
            O dia a dia do time. Compartilhe visitas, captações, entregas e bastidores.
          </p>
        </div>
        <ComposeButton open={showCompose} setOpen={setShowCompose} userId={userId} onPosted={loadAll} />
      </header>

      {loading ? (
        <div className="space-y-4">
          {[0, 1].map((i) => (
            <div key={i} className="rounded-2xl border border-border bg-card p-4 animate-pulse h-64" />
          ))}
        </div>
      ) : posts.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-card/50 p-10 text-center">
          <p className="text-sm text-muted-foreground">
            Nada por aqui ainda. Seja o primeiro a postar algo do dia.
          </p>
        </div>
      ) : (
        <ul className="space-y-6">
          {posts.map((p) => {
            const author = profiles[p.author_id];
            const url = imageUrls[p.id];
            const lk = likes[p.id] ?? { count: 0, mine: false };
            const cs = commentsByPost[p.id] ?? [];
            const isOwner = userId === p.author_id;
            const canModerate = isAdmin || isOwner;
            return (
              <li
                key={p.id}
                className={`rounded-2xl border border-border bg-card overflow-hidden ${
                  p.hidden_at ? "opacity-60 ring-1 ring-amber-500/30" : ""
                }`}
              >
                <div className="flex items-center justify-between gap-3 px-4 py-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="h-9 w-9 rounded-full bg-gradient-to-br from-gold/30 to-gold/10 border border-gold/30 grid place-items-center text-xs font-semibold text-gold">
                      {initials(author?.nome ?? "?")}
                    </div>
                    <div className="min-w-0">
                      <div className="text-sm font-medium truncate">{author?.nome ?? "—"}</div>
                      <div className="text-[11px] text-muted-foreground">
                        {formatRelative(p.created_at)}
                        {p.source !== "manual" && (
                          <span className="ml-2 px-1.5 py-0.5 rounded bg-muted text-[10px] uppercase tracking-wider">
                            auto · {p.source}
                          </span>
                        )}
                        {p.hidden_at && (
                          <span className="ml-2 px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-600 text-[10px] uppercase tracking-wider">
                            oculto
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  {canModerate && (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        {isAdmin && (
                          <DropdownMenuItem onClick={() => toggleHide(p)}>
                            {p.hidden_at ? (
                              <><Eye className="h-4 w-4 mr-2" /> Restaurar</>
                            ) : (
                              <><EyeOff className="h-4 w-4 mr-2" /> Ocultar</>
                            )}
                          </DropdownMenuItem>
                        )}
                        <DeleteAction onConfirm={() => deletePost(p)} />
                      </DropdownMenuContent>
                    </DropdownMenu>
                  )}
                </div>

                {url ? (
                  <img src={url} alt="" className="w-full max-h-[640px] object-cover bg-muted" />
                ) : (
                  <div className="w-full h-64 bg-muted animate-pulse" />
                )}

                {p.caption && (
                  <div className="px-4 pt-3 text-sm whitespace-pre-wrap">{p.caption}</div>
                )}

                <div className="flex items-center gap-2 px-2 py-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    className={`gap-2 ${lk.mine ? "text-rose-500" : ""}`}
                    onClick={() => toggleLike(p.id)}
                  >
                    <Heart className={`h-4 w-4 ${lk.mine ? "fill-current" : ""}`} />
                    <span className="tabular-nums">{lk.count}</span>
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="gap-2"
                    onClick={() => setOpenComments((s) => ({ ...s, [p.id]: !s[p.id] }))}
                  >
                    <MessageCircle className="h-4 w-4" />
                    <span className="tabular-nums">{cs.length}</span>
                  </Button>
                </div>

                {openComments[p.id] && (
                  <div className="border-t border-border px-4 py-3 space-y-3 bg-muted/20">
                    {cs.length === 0 && (
                      <div className="text-xs text-muted-foreground">Sem comentários ainda.</div>
                    )}
                    {cs.map((c) => {
                      const ca = profiles[c.author_id];
                      const canDelete = isAdmin || userId === c.author_id;
                      return (
                        <div key={c.id} className="flex items-start gap-2">
                          <div className="h-7 w-7 rounded-full bg-muted border border-border grid place-items-center text-[10px] font-semibold shrink-0">
                            {initials(ca?.nome ?? "?")}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="text-xs">
                              <span className="font-medium">{ca?.nome ?? "—"}</span>
                              <span className="text-muted-foreground ml-2">{formatRelative(c.created_at)}</span>
                            </div>
                            <div className="text-sm whitespace-pre-wrap">{c.body}</div>
                          </div>
                          {canDelete && (
                            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => deleteComment(c)}>
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          )}
                        </div>
                      );
                    })}
                    <form
                      className="flex items-center gap-2 pt-1"
                      onSubmit={(e) => { e.preventDefault(); sendComment(p.id); }}
                    >
                      <Input
                        value={newComment[p.id] ?? ""}
                        onChange={(e) => setNewComment((s) => ({ ...s, [p.id]: e.target.value }))}
                        placeholder="Escrever um comentário…"
                        className="h-9"
                      />
                      <Button type="submit" size="icon" className="h-9 w-9" disabled={!(newComment[p.id] ?? "").trim()}>
                        <Send className="h-4 w-4" />
                      </Button>
                    </form>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function DeleteAction({ onConfirm }: { onConfirm: () => void }) {
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <DropdownMenuItem onSelect={(e) => e.preventDefault()} className="text-destructive focus:text-destructive">
          <Trash2 className="h-4 w-4 mr-2" /> Excluir post
        </DropdownMenuItem>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Excluir post?</AlertDialogTitle>
          <AlertDialogDescription>
            Esta ação é permanente. O post será removido do mural junto com curtidas e comentários.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancelar</AlertDialogCancel>
          <AlertDialogAction onClick={onConfirm}>Excluir</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

function ComposeButton({
  open, setOpen, userId, onPosted,
}: {
  open: boolean; setOpen: (v: boolean) => void; userId: string | null; onPosted: () => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [caption, setCaption] = useState("");
  const [submitting, setSubmitting] = useState(false);

  function reset() {
    setFile(null); setPreview(null); setCaption(""); setSubmitting(false);
    if (fileRef.current) fileRef.current.value = "";
  }

  function pickFile(f: File | null) {
    setFile(f);
    if (preview) URL.revokeObjectURL(preview);
    setPreview(f ? URL.createObjectURL(f) : null);
  }

  async function submit() {
    if (!file || !userId) return;
    setSubmitting(true);
    const ext = file.name.split(".").pop() || "jpg";
    const path = `${userId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
    const { error: upErr } = await supabase.storage.from(BUCKET).upload(path, file, { upsert: false });
    if (upErr) { setSubmitting(false); return toast.error("Falha no upload: " + upErr.message); }
    const { error } = await supabase.from("feed_posts").insert({
      author_id: userId, caption: caption.trim() || null, image_path: path, source: "manual",
    });
    if (error) {
      setSubmitting(false);
      supabase.storage.from(BUCKET).remove([path]).catch(() => null);
      return toast.error("Falha ao publicar: " + error.message);
    }
    toast.success("Publicado no mural");
    reset();
    setOpen(false);
    onPosted();
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) reset(); }}>
      <DialogTrigger asChild>
        <Button className="shrink-0 gap-2"><ImagePlus className="h-4 w-4" /> Postar</Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Novo post no mural</DialogTitle>
          <DialogDescription>Foto + uma legenda curta.</DialogDescription>
        </DialogHeader>

        <div className="rounded-lg border border-amber-500/40 bg-amber-500/5 p-3 flex gap-2">
          <ShieldAlert className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
          <p className="text-xs text-amber-700 dark:text-amber-300 leading-relaxed">
            Sua foto deve estar relacionada ao trabalho — visitas, captação, atendimento ao cliente,
            reuniões, entregas. Fotos genéricas sem relação com o trabalho serão removidas.
          </p>
        </div>

        <div className="space-y-3">
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => pickFile(e.target.files?.[0] ?? null)}
          />
          {preview ? (
            <div className="relative">
              <img src={preview} alt="" className="w-full max-h-80 object-cover rounded-lg border border-border" />
              <Button
                type="button"
                variant="secondary"
                size="sm"
                className="absolute top-2 right-2"
                onClick={() => pickFile(null)}
              >
                Trocar
              </Button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="w-full border-2 border-dashed border-border rounded-lg p-8 text-center hover:bg-muted/40 transition-colors"
            >
              <ImagePlus className="h-6 w-6 mx-auto text-muted-foreground" />
              <div className="text-sm mt-2">Selecionar foto</div>
              <div className="text-xs text-muted-foreground mt-1">PNG, JPG ou HEIC</div>
            </button>
          )}

          <Textarea
            placeholder="Escreva uma legenda (opcional)…"
            value={caption}
            onChange={(e) => setCaption(e.target.value)}
            rows={3}
            maxLength={500}
          />
          <div className="flex items-center gap-1 text-[11px] text-muted-foreground">
            <Info className="h-3 w-3" /> Máx. 500 caracteres
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => { reset(); setOpen(false); }}>Cancelar</Button>
          <Button onClick={submit} disabled={!file || submitting} className="gap-2">
            {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            Publicar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
