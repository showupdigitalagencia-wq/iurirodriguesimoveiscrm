import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Loader2 } from "lucide-react";

function initials(name: string) {
  return name.trim().split(/\s+/).slice(0, 2).map((p) => p[0]?.toUpperCase() ?? "").join("") || "?";
}

export function StoryViewsSheet({ storyId, onClose }: { storyId: string; onClose: () => void }) {
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<{ id: string; nome: string; viewed_at: string }[]>([]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("feed_story_views")
        .select("viewer_id, viewed_at")
        .eq("story_id", storyId)
        .order("viewed_at", { ascending: false });
      const list = (data ?? []) as { viewer_id: string; viewed_at: string }[];
      if (!list.length) { if (!cancelled) { setRows([]); setLoading(false); } return; }
      const { data: profs } = await supabase
        .from("profiles").select("id, nome").in("id", list.map((r) => r.viewer_id));
      const map = new Map<string, string>();
      for (const p of (profs ?? []) as { id: string; nome: string }[]) map.set(p.id, p.nome);
      if (!cancelled) {
        setRows(list.map((r) => ({ id: r.viewer_id, nome: map.get(r.viewer_id) ?? "—", viewed_at: r.viewed_at })));
        setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [storyId]);

  return (
    <Sheet open onOpenChange={(v) => { if (!v) onClose(); }}>
      <SheetContent side="bottom" className="max-h-[60vh] overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Visto por {rows.length}</SheetTitle>
        </SheetHeader>
        {loading ? (
          <div className="py-10 grid place-items-center text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" />
          </div>
        ) : rows.length === 0 ? (
          <div className="py-8 text-center text-sm text-muted-foreground">Ninguém visualizou ainda.</div>
        ) : (
          <ul className="mt-4 space-y-2">
            {rows.map((r) => (
              <li key={r.id} className="flex items-center gap-3">
                <span className="h-8 w-8 rounded-full bg-gradient-to-br from-gold/30 to-gold/10 border border-gold/20 grid place-items-center text-[10px] font-semibold text-gold">
                  {initials(r.nome)}
                </span>
                <span className="text-sm">{r.nome}</span>
                <span className="ml-auto text-[11px] text-muted-foreground">
                  {new Date(r.viewed_at).toLocaleString("pt-BR")}
                </span>
              </li>
            ))}
          </ul>
        )}
      </SheetContent>
    </Sheet>
  );
}
