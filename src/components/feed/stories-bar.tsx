import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Plus } from "lucide-react";
import { StoryViewer } from "./story-viewer";
import { StoryUploadDialog } from "./story-upload-dialog";
import { signAvatarMap } from "@/lib/avatar-url";
import { UserAvatar } from "@/components/user-avatar";

export type StoryRow = {
  id: string;
  author_id: string;
  image_path: string;
  caption: string | null;
  created_at: string;
  expires_at: string;
  media_type: "image" | "video";
  duration_ms: number | null;
};

export type AuthorGroup = {
  authorId: string;
  authorName: string;
  authorAvatarUrl: string | null;
  stories: StoryRow[];
  hasUnseen: boolean;
};


export function StoriesBar({
  userId,
  userName,
  isAdmin,
}: {
  userId: string | null;
  userName: string;
  isAdmin: boolean;
}) {
  const [stories, setStories] = useState<StoryRow[]>([]);
  const [profiles, setProfiles] = useState<Record<string, string>>({});
  const [seen, setSeen] = useState<Set<string>>(new Set());
  const [openUpload, setOpenUpload] = useState(false);
  const [viewerAuthorIndex, setViewerAuthorIndex] = useState<number | null>(null);

  const load = useCallback(async () => {
    const nowIso = new Date().toISOString();
    const { data } = await supabase
      .from("feed_stories")
      .select("id, author_id, image_path, caption, created_at, expires_at, hidden_at, media_type, duration_ms")
      .gt("expires_at", nowIso)
      .is("hidden_at", null)
      .order("created_at", { ascending: true });
    const list = (data ?? []) as (StoryRow & { hidden_at: string | null })[];
    setStories(list.map(({ hidden_at: _h, ...rest }) => rest));
    const authorIds = Array.from(new Set(list.map((s) => s.author_id)));
    if (authorIds.length) {
      const { data: profs } = await supabase.from("profiles").select("id, nome").in("id", authorIds);
      const map: Record<string, string> = {};
      for (const p of (profs ?? []) as { id: string; nome: string }[]) map[p.id] = p.nome;
      setProfiles(map);
    }
    if (userId && list.length) {
      const { data: views } = await supabase
        .from("feed_story_views")
        .select("story_id")
        .eq("viewer_id", userId)
        .in("story_id", list.map((s) => s.id));
      setSeen(new Set((views ?? []).map((v) => v.story_id)));
    }
  }, [userId]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    const ch = supabase
      .channel("stories-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "feed_stories" }, () => load())
      .on("postgres_changes", { event: "*", schema: "public", table: "feed_story_views" }, () => load())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [load]);

  const groups = useMemo<AuthorGroup[]>(() => {
    const byAuthor = new Map<string, StoryRow[]>();
    for (const s of stories) {
      if (!byAuthor.has(s.author_id)) byAuthor.set(s.author_id, []);
      byAuthor.get(s.author_id)!.push(s);
    }
    const arr: AuthorGroup[] = [];
    for (const [authorId, items] of byAuthor) {
      const hasUnseen = items.some((s) => !seen.has(s.id));
      arr.push({
        authorId,
        authorName: profiles[authorId] ?? "—",
        stories: items,
        hasUnseen,
      });
    }
    // ordenar: não-vistos primeiro, depois mais recente
    arr.sort((a, b) => {
      if (a.hasUnseen !== b.hasUnseen) return a.hasUnseen ? -1 : 1;
      const al = a.stories[a.stories.length - 1]?.created_at ?? "";
      const bl = b.stories[b.stories.length - 1]?.created_at ?? "";
      return bl.localeCompare(al);
    });
    // próprio usuário sempre primeiro (se tiver story)
    if (userId) {
      const idx = arr.findIndex((g) => g.authorId === userId);
      if (idx > 0) { const [me] = arr.splice(idx, 1); arr.unshift(me); }
    }
    return arr;
  }, [stories, profiles, seen, userId]);

  function openViewer(authorId: string) {
    const i = groups.findIndex((g) => g.authorId === authorId);
    if (i >= 0) setViewerAuthorIndex(i);
  }

  return (
    <div className="-mx-4 md:mx-0">
      <div className="px-4 md:px-0 flex gap-4 overflow-x-auto pb-3 scroll-px-4 snap-x [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {userId && (
          <button
            onClick={() => setOpenUpload(true)}
            className="snap-start shrink-0 flex flex-col items-center gap-1.5 group"
            aria-label="Adicionar story"
          >
            <span className="relative h-16 w-16 rounded-full bg-card border border-border grid place-items-center overflow-hidden">
              <span className="absolute inset-0 grid place-items-center text-xs font-semibold text-muted-foreground group-hover:opacity-60 transition">
                {initials(userName)}
              </span>
              <span className="absolute -bottom-0 -right-0 h-6 w-6 rounded-full bg-gold text-gold-foreground grid place-items-center border-2 border-background shadow">
                <Plus className="h-3.5 w-3.5" />
              </span>
            </span>
            <span className="text-[10px] text-muted-foreground max-w-[64px] truncate">Seu story</span>
          </button>
        )}

        {groups.map((g) => (
          <button
            key={g.authorId}
            onClick={() => openViewer(g.authorId)}
            className="snap-start shrink-0 flex flex-col items-center gap-1.5"
            aria-label={`Ver stories de ${g.authorName}`}
          >
            <span
              className={`relative h-16 w-16 rounded-full p-[2px] ${
                g.hasUnseen
                  ? "bg-[conic-gradient(from_180deg_at_50%_50%,#d4af37,#f7d774,#a07e1c,#d4af37)]"
                  : "bg-border"
              }`}
            >
              <span className="block h-full w-full rounded-full bg-background p-[2px]">
                <span className="block h-full w-full rounded-full bg-gradient-to-br from-gold/30 to-gold/10 border border-gold/20 grid place-items-center text-xs font-semibold text-gold">
                  {initials(g.authorName)}
                </span>
              </span>
            </span>
            <span className="text-[10px] text-muted-foreground max-w-[64px] truncate">
              {g.authorId === userId ? "Você" : g.authorName.split(" ")[0]}
            </span>
          </button>
        ))}
      </div>

      {openUpload && userId && (
        <StoryUploadDialog
          open={openUpload}
          onOpenChange={setOpenUpload}
          userId={userId}
          onPosted={load}
        />
      )}

      {viewerAuthorIndex !== null && (
        <StoryViewer
          groups={groups}
          startAuthorIndex={viewerAuthorIndex}
          userId={userId}
          isAdmin={isAdmin}
          onClose={() => setViewerAuthorIndex(null)}
          onChanged={load}
        />
      )}
    </div>
  );
}
