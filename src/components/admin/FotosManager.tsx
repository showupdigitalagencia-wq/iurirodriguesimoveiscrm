import { useEffect, useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Upload, X, ArrowLeft, ArrowRight, Loader2 } from "lucide-react";

const BUCKET = "imoveis-fotos";

function isUrl(s: string) {
  return /^https?:\/\//i.test(s);
}

async function resolveUrl(pathOrUrl: string): Promise<string> {
  if (isUrl(pathOrUrl)) return pathOrUrl;
  const { data } = await supabase.storage.from(BUCKET).createSignedUrl(pathOrUrl, 60 * 60);
  return data?.signedUrl ?? "";
}

export function useFotosUrls(fotos: string[]) {
  const [urls, setUrls] = useState<string[]>([]);
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const resolved = await Promise.all(fotos.map(resolveUrl));
      if (!cancelled) setUrls(resolved);
    })();
    return () => { cancelled = true; };
  }, [fotos.join("|")]);
  return urls;
}

export function FotosThumbs({ fotos, max = 4 }: { fotos: string[]; max?: number }) {
  const urls = useFotosUrls(fotos.slice(0, max));
  if (!fotos.length) return null;
  return (
    <div className="flex gap-1 flex-wrap">
      {urls.map((u, i) => (
        <img key={i} src={u} alt={`foto ${i + 1}`} className="w-14 h-14 object-cover rounded border" />
      ))}
      {fotos.length > max && (
        <div className="w-14 h-14 rounded border flex items-center justify-center text-xs text-muted-foreground bg-muted">
          +{fotos.length - max}
        </div>
      )}
    </div>
  );
}

export function FotosManager({
  fotos,
  onChange,
  imovelId,
}: {
  fotos: string[];
  onChange: (next: string[]) => void;
  imovelId?: string;
}) {
  const [uploading, setUploading] = useState(false);
  const urls = useFotosUrls(fotos);
  const fileRef = useRef<HTMLInputElement>(null);

  async function handleUpload(files: FileList | null) {
    if (!files || !files.length) return;
    setUploading(true);
    const folder = imovelId ?? "novo";
    const added: string[] = [];
    for (const file of Array.from(files)) {
      const ext = file.name.split(".").pop() ?? "jpg";
      const path = `${folder}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
      const { error } = await supabase.storage.from(BUCKET).upload(path, file, { upsert: false });
      if (error) { toast.error(`Falha ao enviar ${file.name}: ${error.message}`); continue; }
      added.push(path);
    }
    setUploading(false);
    if (added.length) {
      onChange([...fotos, ...added]);
      toast.success(`${added.length} foto(s) enviada(s)`);
    }
    if (fileRef.current) fileRef.current.value = "";
  }

  async function remove(idx: number) {
    const target = fotos[idx];
    const next = fotos.filter((_, i) => i !== idx);
    onChange(next);
    if (!isUrl(target)) {
      await supabase.storage.from(BUCKET).remove([target]);
    }
  }

  function move(idx: number, dir: -1 | 1) {
    const j = idx + dir;
    if (j < 0 || j >= fotos.length) return;
    const next = [...fotos];
    [next[idx], next[j]] = [next[j], next[idx]];
    onChange(next);
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={(e) => handleUpload(e.target.files)}
        />
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => fileRef.current?.click()}
          disabled={uploading}
        >
          {uploading ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Upload className="h-4 w-4 mr-1" />}
          {uploading ? "Enviando..." : "Adicionar fotos"}
        </Button>
        <span className="text-xs text-muted-foreground">{fotos.length} foto(s)</span>
      </div>
      {fotos.length > 0 && (
        <div className="grid grid-cols-3 md:grid-cols-4 gap-2">
          {fotos.map((_, idx) => (
            <div key={idx} className="relative group border rounded overflow-hidden bg-muted">
              {urls[idx] ? (
                <img src={urls[idx]} alt={`foto ${idx + 1}`} className="w-full h-24 object-cover" />
              ) : (
                <div className="w-full h-24 flex items-center justify-center text-xs text-muted-foreground">…</div>
              )}
              <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition flex items-center justify-center gap-1">
                <Button type="button" size="icon" variant="secondary" className="h-7 w-7" onClick={() => move(idx, -1)} disabled={idx === 0}>
                  <ArrowLeft className="h-3 w-3" />
                </Button>
                <Button type="button" size="icon" variant="secondary" className="h-7 w-7" onClick={() => move(idx, 1)} disabled={idx === fotos.length - 1}>
                  <ArrowRight className="h-3 w-3" />
                </Button>
                <Button type="button" size="icon" variant="destructive" className="h-7 w-7" onClick={() => remove(idx)}>
                  <X className="h-3 w-3" />
                </Button>
              </div>
              <div className="absolute top-1 left-1 bg-black/60 text-white text-[10px] px-1 rounded">{idx + 1}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
