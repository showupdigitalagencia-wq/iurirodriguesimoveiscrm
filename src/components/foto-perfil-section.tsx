import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Camera, Trash2, Loader2 } from "lucide-react";
import { signAvatar, clearAvatarCache } from "@/lib/avatar-url";

const BUCKET = "feed";
const MAX_BYTES = 5 * 1024 * 1024;

function initials(name: string) {
  return name.trim().split(/\s+/).slice(0, 2).map((p) => p[0]?.toUpperCase() ?? "").join("") || "?";
}

export function FotoPerfilSection() {
  const fileRef = useRef<HTMLInputElement | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [nome, setNome] = useState<string>("");
  const [path, setPath] = useState<string | null>(null);
  const [url, setUrl] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let active = true;
    supabase.auth.getUser().then(async ({ data }) => {
      const uid = data.user?.id ?? null;
      if (!active || !uid) return;
      setUserId(uid);
      const { data: p } = await supabase.from("profiles").select("nome, avatar_url").eq("id", uid).maybeSingle();
      const prof = p as { nome?: string; avatar_url?: string | null } | null;
      if (!active) return;
      setNome(prof?.nome ?? "");
      setPath(prof?.avatar_url ?? null);
      setUrl(await signAvatar(prof?.avatar_url ?? null));
    });
    return () => { active = false; };
  }, []);

  async function onPick(file: File) {
    if (!userId) return;
    if (!/^image\//.test(file.type)) return toast.error("Selecione uma imagem.");
    if (file.size > MAX_BYTES) return toast.error("Imagem muito grande (máx 5MB).");
    setBusy(true);
    try {
      // remove old
      if (path) {
        await supabase.storage.from(BUCKET).remove([path]).catch(() => null);
        clearAvatarCache(path);
      }
      const ext = (file.name.split(".").pop() || "jpg").toLowerCase().replace(/[^a-z0-9]/g, "") || "jpg";
      const newPath = `${userId}/avatar-${Date.now()}.${ext}`;
      const up = await supabase.storage.from(BUCKET).upload(newPath, file, { upsert: true, contentType: file.type || undefined });
      if (up.error) throw up.error;
      const { error: updErr } = await supabase.from("profiles").update({ avatar_url: newPath }).eq("id", userId);
      if (updErr) throw updErr;
      setPath(newPath);
      setUrl(await signAvatar(newPath));
      toast.success("Foto atualizada");
    } catch (e) {
      toast.error("Falha ao enviar: " + (e as Error).message);
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function onRemove() {
    if (!userId || !path) return;
    setBusy(true);
    try {
      await supabase.storage.from(BUCKET).remove([path]).catch(() => null);
      clearAvatarCache(path);
      const { error } = await supabase.from("profiles").update({ avatar_url: null }).eq("id", userId);
      if (error) throw error;
      setPath(null);
      setUrl(null);
      toast.success("Foto removida");
    } catch (e) {
      toast.error("Falha: " + (e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="bg-card border border-border rounded-xl p-6 max-w-md">
      <h2 className="font-semibold mb-1">Foto de perfil</h2>
      <p className="text-sm text-muted-foreground mb-4">
        Aparece no menu, no mural e nos comentários. JPG ou PNG, até 5MB.
      </p>
      <div className="flex items-center gap-4">
        <div className="relative h-20 w-20 rounded-full overflow-hidden border border-border bg-gradient-to-br from-gold/30 to-gold/10 grid place-items-center text-lg font-semibold text-gold shrink-0">
          {url ? (
            <img src={url} alt="" className="absolute inset-0 h-full w-full object-cover" />
          ) : (
            <span>{initials(nome || "?")}</span>
          )}
        </div>
        <div className="flex flex-col gap-2">
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) onPick(f); }}
          />
          <Button variant="gold" size="sm" disabled={busy} onClick={() => fileRef.current?.click()}>
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Camera className="h-4 w-4" />}
            {url ? "Trocar foto" : "Enviar foto"}
          </Button>
          {url && (
            <Button variant="ghost" size="sm" disabled={busy} onClick={onRemove} className="text-destructive hover:text-destructive">
              <Trash2 className="h-4 w-4" /> Remover
            </Button>
          )}
        </div>
      </div>
    </section>
  );
}
