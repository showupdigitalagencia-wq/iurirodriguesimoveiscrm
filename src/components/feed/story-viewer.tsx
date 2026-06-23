import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { supabase } from "@/integrations/supabase/client";
import type { AuthorGroup } from "./stories-bar";
import { Button } from "@/components/ui/button";
import { X, Eye, Trash2, ChevronLeft, ChevronRight, Volume2, VolumeX } from "lucide-react";
import { toast } from "sonner";
import { StoryViewsSheet } from "./story-views-sheet";
import { UserAvatar } from "@/components/user-avatar";

const BUCKET = "feed";
const IMAGE_DURATION_MS = 6000;
const FALLBACK_VIDEO_DURATION_MS = 15000;


function formatRelative(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "agora";
  if (m < 60) return `${m}min`;
  const h = Math.floor(m / 60);
  return `${h}h`;
}

export function StoryViewer({
  groups, startAuthorIndex, userId, isAdmin, onClose, onChanged,
}: {
  groups: AuthorGroup[];
  startAuthorIndex: number;
  userId: string | null;
  isAdmin: boolean;
  onClose: () => void;
  onChanged: () => void;
}) {
  const [authorIdx, setAuthorIdx] = useState(startAuthorIndex);
  const [storyIdx, setStoryIdx] = useState(0);
  const [progress, setProgress] = useState(0);
  const [paused, setPaused] = useState(false);
  const [muted, setMuted] = useState(true);
  const [urlCache, setUrlCache] = useState<Record<string, string>>({});
  const [showViews, setShowViews] = useState(false);
  const rafRef = useRef<number | null>(null);
  const startRef = useRef<number>(0);
  const accumRef = useRef<number>(0);
  const videoRef = useRef<HTMLVideoElement>(null);
  const touchStart = useRef<{ x: number; y: number } | null>(null);

  const group = groups[authorIdx];
  const story = group?.stories[storyIdx];
  const isOwner = !!story && userId === story.author_id;
  const isVideo = story?.media_type === "video";

  // resolve signed url + preload next
  useEffect(() => {
    if (!story) return;
    let cancelled = false;
    if (!urlCache[story.id]) {
      supabase.storage.from(BUCKET).createSignedUrl(story.image_path, 60 * 60).then(({ data }) => {
        if (!cancelled && data?.signedUrl) {
          setUrlCache((c) => ({ ...c, [story.id]: data.signedUrl }));
        }
      });
    }
    const next = group.stories[storyIdx + 1];
    if (next && !urlCache[next.id]) {
      supabase.storage.from(BUCKET).createSignedUrl(next.image_path, 60 * 60).then(({ data }) => {
        if (data?.signedUrl) setUrlCache((c) => ({ ...c, [next.id]: data.signedUrl }));
      });
    }
    return () => { cancelled = true; };
  }, [story, group, storyIdx, urlCache]);

  const goNext = useCallback(() => {
    if (!group) return;
    if (storyIdx + 1 < group.stories.length) {
      setStoryIdx((i) => i + 1);
    } else if (authorIdx + 1 < groups.length) {
      setAuthorIdx((i) => i + 1);
      setStoryIdx(0);
    } else {
      onClose();
    }
  }, [authorIdx, storyIdx, group, groups, onClose]);

  const goPrev = useCallback(() => {
    if (storyIdx > 0) {
      setStoryIdx((i) => i - 1);
    } else if (authorIdx > 0) {
      const prev = groups[authorIdx - 1];
      setAuthorIdx((i) => i - 1);
      setStoryIdx(Math.max(0, prev.stories.length - 1));
    }
  }, [authorIdx, storyIdx, groups]);

  // marca visualização
  useEffect(() => {
    if (!story || !userId || userId === story.author_id) return;
    supabase.from("feed_story_views").upsert(
      { story_id: story.id, viewer_id: userId },
      { onConflict: "story_id,viewer_id", ignoreDuplicates: true },
    ).then(() => null);
  }, [story, userId]);

  // duração efetiva do story atual
  const durationMs = isVideo
    ? (story?.duration_ms && story.duration_ms > 0 ? story.duration_ms : FALLBACK_VIDEO_DURATION_MS)
    : IMAGE_DURATION_MS;

  // progresso por rAF — para vídeo, lemos do elemento
  useEffect(() => {
    setProgress(0);
    accumRef.current = 0;
    startRef.current = performance.now();
    if (rafRef.current) cancelAnimationFrame(rafRef.current);

    const tick = (t: number) => {
      if (paused) {
        startRef.current = t;
        rafRef.current = requestAnimationFrame(tick);
        return;
      }
      let p: number;
      if (isVideo && videoRef.current && videoRef.current.duration > 0) {
        p = Math.min(1, videoRef.current.currentTime / videoRef.current.duration);
      } else {
        const elapsed = accumRef.current + (t - startRef.current);
        p = Math.min(1, elapsed / durationMs);
      }
      setProgress(p);
      if (p >= 1) {
        goNext();
        return;
      }
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, [story?.id, paused, goNext, isVideo, durationMs]);

  // controla play/pause do vídeo quando paused muda
  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    if (paused) v.pause(); else v.play().catch(() => null);
  }, [paused, story?.id]);

  // pausa atualiza acumulado
  useEffect(() => {
    if (paused) {
      accumRef.current += performance.now() - startRef.current;
    } else {
      startRef.current = performance.now();
    }
  }, [paused]);

  // teclado
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
      else if (e.key === "ArrowRight") goNext();
      else if (e.key === "ArrowLeft") goPrev();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [goNext, goPrev, onClose]);

  async function removeStory() {
    if (!story) return;
    const { error } = await supabase.from("feed_stories").delete().eq("id", story.id);
    if (error) return toast.error("Falha: " + error.message);
    supabase.storage.from(BUCKET).remove([story.image_path]).catch(() => null);
    toast.success("Story removido");
    onChanged();
    goNext();
  }

  if (!group || !story) return null;

  const mediaUrl = urlCache[story.id];

  function onTouchStart(e: React.TouchEvent) {
    const t = e.touches[0];
    touchStart.current = { x: t.clientX, y: t.clientY };
    setPaused(true);
  }
  function onTouchEnd(e: React.TouchEvent) {
    setPaused(false);
    const ts = touchStart.current;
    if (!ts) return;
    const t = e.changedTouches[0];
    const dx = t.clientX - ts.x;
    const dy = t.clientY - ts.y;
    touchStart.current = null;
    if (Math.abs(dy) > 80 && Math.abs(dy) > Math.abs(dx)) { onClose(); return; }
    if (Math.abs(dx) > 60) {
      if (dx < 0) goNext(); else goPrev();
      return;
    }
    if (Math.abs(dx) < 8 && Math.abs(dy) < 8) {
      const w = window.innerWidth;
      if (t.clientX < w / 3) goPrev(); else goNext();
    }
  }

  const node = (
    <div className="fixed inset-0 z-[100] bg-black text-white select-none" role="dialog" aria-modal>
      <button
        type="button"
        onClick={onClose}
        aria-label="Fechar"
        className="fixed top-3 right-3 z-[60] grid place-items-center h-11 w-11 rounded-full bg-black/55 hover:bg-black/75 backdrop-blur ring-1 ring-white/20 text-white shadow-lg"
        style={{ top: "max(0.75rem, env(safe-area-inset-top))", right: "max(0.75rem, env(safe-area-inset-right))" }}
      >
        <X className="h-6 w-6" />
      </button>
      <div
        className="absolute inset-0"
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
      />

      <div className="absolute inset-0 grid place-items-center">
        {mediaUrl ? (
          isVideo ? (
            <video
              ref={videoRef}
              key={story.id}
              src={mediaUrl}
              className="max-h-full max-w-full object-contain"
              autoPlay
              muted={muted}
              playsInline
              onEnded={goNext}
            />
          ) : (
            <img src={mediaUrl} alt="" className="max-h-full max-w-full object-contain" draggable={false} />
          )
        ) : (
          <div className="h-full w-full bg-neutral-900 animate-pulse" />
        )}
      </div>

      {/* Tap zones: esquerdo volta, direito avança. Ficam sob a barra de topo/rodapé. */}
      <button
        type="button"
        aria-label="Story anterior"
        onClick={goPrev}
        className="absolute left-0 top-16 bottom-20 w-1/3 z-10 bg-transparent focus:outline-none"
      />
      <button
        type="button"
        aria-label="Próximo story"
        onClick={goNext}
        className="absolute right-0 top-16 bottom-20 w-1/3 z-10 bg-transparent focus:outline-none"
      />

      <div className="pointer-events-none absolute inset-x-0 top-0 h-32 bg-gradient-to-b from-black/70 to-transparent" />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-32 bg-gradient-to-t from-black/70 to-transparent" />

      <div className="absolute top-3 inset-x-3 flex gap-1 z-20">
        {group.stories.map((_, i) => (
          <div key={i} className="flex-1 h-0.5 rounded-full bg-white/30 overflow-hidden">
            <div
              className="h-full bg-white"
              style={{ width: `${i < storyIdx ? 100 : i === storyIdx ? progress * 100 : 0}%` }}
            />
          </div>
        ))}
      </div>

      <div className="absolute top-6 inset-x-3 pr-14 flex items-center gap-3 pt-2 z-20">
        <UserAvatar
          name={group.authorName}
          url={group.authorAvatarUrl}
          className="h-9 w-9 text-xs"
          fallbackClassName="text-xs"
        />

        <div className="min-w-0">
          <div className="text-sm font-medium truncate">{group.authorName}</div>
          <div className="text-[11px] text-white/70">{formatRelative(story.created_at)}</div>
        </div>
        <div className="ml-auto flex items-center gap-1 pointer-events-auto">
          {isVideo && (
            <Button
              variant="ghost" size="icon" className="text-white hover:bg-white/10"
              onClick={() => setMuted((m) => !m)}
              aria-label={muted ? "Ativar som" : "Silenciar"}
            >
              {muted ? <VolumeX className="h-5 w-5" /> : <Volume2 className="h-5 w-5" />}
            </Button>
          )}
          {(isOwner || isAdmin) && (
            <Button
              variant="ghost" size="icon" className="text-white hover:bg-white/10"
              onClick={removeStory} aria-label="Excluir story"
            >
              <Trash2 className="h-5 w-5" />
            </Button>
          )}
        </div>
      </div>

      <div className="absolute bottom-4 inset-x-4 flex items-end justify-between gap-3 pointer-events-none">
        <div className="text-sm whitespace-pre-wrap max-w-[80%]">{story.caption ?? ""}</div>
        {(isOwner || isAdmin) && (
          <Button
            variant="ghost" size="sm"
            className="text-white hover:bg-white/10 gap-2 pointer-events-auto"
            onClick={() => { setPaused(true); setShowViews(true); }}
          >
            <Eye className="h-4 w-4" /> Visto por
          </Button>
        )}
      </div>

      <button
        onClick={goPrev}
        className="hidden md:grid absolute left-2 top-1/2 -translate-y-1/2 h-10 w-10 place-items-center rounded-full bg-white/10 hover:bg-white/20"
        aria-label="Anterior"
      ><ChevronLeft className="h-5 w-5" /></button>
      <button
        onClick={goNext}
        className="hidden md:grid absolute right-2 top-1/2 -translate-y-1/2 h-10 w-10 place-items-center rounded-full bg-white/10 hover:bg-white/20"
        aria-label="Próximo"
      ><ChevronRight className="h-5 w-5" /></button>

      {showViews && (
        <StoryViewsSheet
          storyId={story.id}
          onClose={() => { setShowViews(false); setPaused(false); }}
        />
      )}
    </div>
  );

  if (typeof document === "undefined") return null;
  return createPortal(node, document.body);
}
