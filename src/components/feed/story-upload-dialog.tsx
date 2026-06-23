import { useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { ImagePlus, Loader2, ShieldAlert } from "lucide-react";

const BUCKET = "feed";

export function StoryUploadDialog({
  open, onOpenChange, userId, onPosted,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  userId: string;
  onPosted: () => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [caption, setCaption] = useState("");
  const [busy, setBusy] = useState(false);

  function pickFile(f: File | null) {
    if (preview) URL.revokeObjectURL(preview);
    setFile(f);
    setPreview(f ? URL.createObjectURL(f) : null);
  }

  async function submit() {
    if (!file) return;
    setBusy(true);
    try {
      const ext = file.name.split(".").pop() || "jpg";
      const path = `stories/${userId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
      const up = await supabase.storage.from(BUCKET).upload(path, file, {
        cacheControl: "3600", upsert: false, contentType: file.type,
      });
      if (up.error) throw up.error;
      const ins = await supabase.from("feed_stories").insert({
        author_id: userId,
        image_path: path,
        caption: caption.trim() || null,
      });
      if (ins.error) throw ins.error;
      toast.success("Story publicado! Expira em 24h.");
      setFile(null); setCaption(""); setPreview(null);
      onOpenChange(false);
      onPosted();
    } catch (e) {
      toast.error("Falha ao publicar story: " + (e as Error).message);
    } finally { setBusy(false); }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Novo story</DialogTitle>
          <DialogDescription>Visível para a equipe por 24 horas.</DialogDescription>
        </DialogHeader>

        <div className="flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 text-xs">
          <ShieldAlert className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
          <p className="text-muted-foreground">
            Conteúdo deve ser relacionado ao trabalho. Administradores podem remover stories que fujam do protocolo.
          </p>
        </div>

        {preview ? (
          <div className="rounded-lg overflow-hidden border border-border bg-black">
            <img src={preview} alt="" className="w-full max-h-80 object-contain" />
          </div>
        ) : (
          <button
            onClick={() => fileRef.current?.click()}
            className="w-full h-44 rounded-lg border border-dashed border-border bg-muted/30 grid place-items-center text-muted-foreground hover:bg-muted/50"
          >
            <div className="flex flex-col items-center gap-2 text-xs">
              <ImagePlus className="h-5 w-5" />
              Selecionar foto
            </div>
          </button>
        )}
        <Input
          ref={fileRef} type="file" accept="image/*" className="hidden"
          onChange={(e) => pickFile(e.target.files?.[0] ?? null)}
        />

        <Textarea
          value={caption}
          onChange={(e) => setCaption(e.target.value)}
          placeholder="Legenda (opcional)…"
          rows={2}
          maxLength={200}
        />

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={busy}>Cancelar</Button>
          <Button variant="gold" onClick={submit} disabled={!file || busy}>
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Publicar story"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
