import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { UserAvatar } from "@/components/user-avatar";
import { signAvatarMap } from "@/lib/avatar-url";
import { Loader2 } from "lucide-react";

type Liker = { id: string; nome: string; avatar_url: string | null };

export function LikesDialog({
  postId, open, onOpenChange,
}: {
  postId: string;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const [loading, setLoading] = useState(false);
  const [likers, setLikers] = useState<Liker[]>([]);
  const [avatars, setAvatars] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      const { data: likes } = await supabase
        .from("feed_likes")
        .select("user_id, created_at")
        .eq("post_id", postId)
        .order("created_at", { ascending: false });
      const ids = Array.from(new Set((likes ?? []).map((l: { user_id: string }) => l.user_id)));
      if (!ids.length) {
        if (!cancelled) { setLikers([]); setAvatars({}); setLoading(false); }
        return;
      }
      const { data: profs } = await supabase
        .from("profiles")
        .select("id, nome, avatar_url")
        .in("id", ids);
      const map = new Map<string, Liker>();
      for (const p of (profs ?? []) as Liker[]) map.set(p.id, p);
      const ordered = ids.map((id) => map.get(id) ?? { id, nome: "—", avatar_url: null });
      const signed = await signAvatarMap(ordered.map((p) => ({ id: p.id, path: p.avatar_url })));
      if (!cancelled) { setLikers(ordered); setAvatars(signed); setLoading(false); }
    })();
    return () => { cancelled = true; };
  }, [open, postId]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Curtidas</DialogTitle>
        </DialogHeader>
        {loading ? (
          <div className="flex items-center justify-center py-8 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" />
          </div>
        ) : likers.length === 0 ? (
          <div className="text-sm text-muted-foreground py-6 text-center">Nenhuma curtida ainda.</div>
        ) : (
          <ul className="max-h-[60vh] overflow-y-auto divide-y divide-border">
            {likers.map((l) => (
              <li key={l.id} className="flex items-center gap-3 py-2.5">
                <UserAvatar
                  name={l.nome}
                  url={avatars[l.id] ?? null}
                  className="h-9 w-9 text-xs"
                  fallbackClassName="text-xs"
                />
                <div className="text-sm font-medium truncate">{l.nome}</div>
              </li>
            ))}
          </ul>
        )}
      </DialogContent>
    </Dialog>
  );
}
