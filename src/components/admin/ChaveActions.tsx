import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Key, KeyRound, Camera, Loader2, History } from "lucide-react";
import { toast } from "sonner";

type ChaveLog = {
  id: string;
  imovel_id: string;
  corretor_id: string;
  tipo: "retirada" | "devolucao";
  foto_url: string;
  observacao: string | null;
  criado_em: string;
};

export type ImovelChaveLite = {
  id: string;
  chave_com_id: string | null;
  chave_retirada_em: string | null;
  chave_foto_atual: string | null;
};

function horasEntre(iso: string | null): number | null {
  if (!iso) return null;
  return (Date.now() - new Date(iso).getTime()) / 3600000;
}

export function ChaveStatusBadge({ imovel, atrasoHoras }: { imovel: ImovelChaveLite; atrasoHoras: number; }) {
  const { data: nome } = useQuery({
    queryKey: ["profile-nome", imovel.chave_com_id],
    queryFn: async () => {
      if (!imovel.chave_com_id) return null;
      const { data } = await supabase.from("profiles").select("nome").eq("id", imovel.chave_com_id).maybeSingle();
      return data?.nome ?? null;
    },
    enabled: !!imovel.chave_com_id,
  });

  if (!imovel.chave_com_id) {
    return (
      <Badge className="bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 gap-1">
        <Key className="h-3 w-3" /> Chave disponível
      </Badge>
    );
  }
  const horas = horasEntre(imovel.chave_retirada_em) ?? 0;
  const atrasada = horas > atrasoHoras;
  return (
    <Badge className={atrasada ? "bg-rose-500/10 text-rose-700 dark:text-rose-400 gap-1" : "bg-blue-500/10 text-blue-700 dark:text-blue-400 gap-1"}>
      <KeyRound className="h-3 w-3" />
      {atrasada ? "Chave atrasada" : "Chave"} · {nome ?? "—"} · {Math.floor(horas)}h
    </Badge>
  );
}

function SignedImage({ path, className }: { path: string | null; className?: string }) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    if (!path) { setUrl(null); return; }
    supabase.storage.from("chaves-fotos").createSignedUrl(path, 60 * 30).then(({ data }) => {
      if (alive) setUrl(data?.signedUrl ?? null);
    });
    return () => { alive = false; };
  }, [path]);
  if (!url) return <div className={`bg-muted rounded ${className ?? ""}`} />;
  return <img src={url} alt="Foto da chave" className={`object-cover rounded ${className ?? ""}`} />;
}

export function useAtrasoHoras() {
  const { data } = useQuery({
    queryKey: ["config", "chaves_atraso_horas"],
    queryFn: async () => {
      const { data } = await supabase.from("configuracoes").select("valor").eq("chave", "chaves_atraso_horas").maybeSingle();
      const v = data?.valor as unknown;
      const n = typeof v === "number" ? v : typeof v === "string" ? Number(v) : 24;
      return Number.isFinite(n) ? n : 24;
    },
    staleTime: 5 * 60 * 1000,
  });
  return data ?? 24;
}

export function ChaveActions({ imovel, onChanged }: { imovel: ImovelChaveLite; onChanged?: () => void }) {
  const qc = useQueryClient();
  const atrasoHoras = useAtrasoHoras();
  const [open, setOpen] = useState<null | "retirar" | "devolver">(null);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [uid, setUid] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUid(data.user?.id ?? null));
  }, []);
  useEffect(() => {
    if (!uid) return;
    supabase.from("user_roles").select("role").eq("user_id", uid).then(({ data }) => {
      setIsAdmin((data ?? []).some((r) => r.role === "admin"));
    });
  }, [uid]);

  const comAlguem = !!imovel.chave_com_id;
  const podeDevolver = comAlguem && (isAdmin || imovel.chave_com_id === uid);

  function refresh() {
    qc.invalidateQueries({ queryKey: ["imoveis"] });
    qc.invalidateQueries({ queryKey: ["chaves-rastreio"] });
    qc.invalidateQueries({ queryKey: ["chaves-log", imovel.id] });
    onChanged?.();
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <ChaveStatusBadge imovel={imovel} atrasoHoras={atrasoHoras} />
      {!comAlguem && (
        <Button size="sm" variant="outline" className="h-7 px-2 gap-1 text-xs border-gold/40 text-gold hover:bg-gold/10 hover:text-gold"
          onClick={(e) => { e.stopPropagation(); setOpen("retirar"); }}>
          <Key className="h-3 w-3" /> Retirar chave
        </Button>
      )}
      {podeDevolver && (
        <Button size="sm" variant="outline" className="h-7 px-2 gap-1 text-xs"
          onClick={(e) => { e.stopPropagation(); setOpen("devolver"); }}>
          <KeyRound className="h-3 w-3" /> Devolver chave
        </Button>
      )}
      <Button size="sm" variant="ghost" className="h-7 px-2 gap-1 text-xs"
        onClick={(e) => { e.stopPropagation(); setHistoryOpen(true); }}>
        <History className="h-3 w-3" /> Histórico
      </Button>

      {open && (
        <ChaveActionDialog
          imovelId={imovel.id}
          tipo={open}
          onClose={() => setOpen(null)}
          onDone={() => { setOpen(null); refresh(); }}
        />
      )}
      <ChaveHistoryDialog imovelId={imovel.id} open={historyOpen} onOpenChange={setHistoryOpen} />
    </div>
  );
}

function ChaveActionDialog({ imovelId, tipo, onClose, onDone }: {
  imovelId: string; tipo: "retirada" | "devolucao" | "retirar" | "devolver"; onClose: () => void; onDone: () => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [observacao, setObservacao] = useState("");
  const [busy, setBusy] = useState(false);
  const isRetirar = tipo === "retirar" || tipo === "retirada";
  const preview = useMemo(() => (file ? URL.createObjectURL(file) : null), [file]);
  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview); }, [preview]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (!file) { toast.error("Foto obrigatória"); return; }
    setBusy(true);
    try {
      const ext = (file.name.split(".").pop() || "jpg").toLowerCase();
      const path = `${imovelId}/${Date.now()}-${isRetirar ? "ret" : "dev"}.${ext}`;
      const up = await supabase.storage.from("chaves-fotos").upload(path, file, { upsert: false, contentType: file.type || "image/jpeg" });
      if (up.error) throw up.error;

      const obs = observacao || undefined;
      const rpc = isRetirar
        ? supabase.rpc("retirar_chave", { _imovel_id: imovelId, _foto_url: path, _observacao: obs })
        : supabase.rpc("devolver_chave", { _imovel_id: imovelId, _foto_url: path, _observacao: obs });
      const { error } = await rpc;
      if (error) throw error;

      toast.success(isRetirar ? "Chave retirada" : "Chave devolvida");
      onDone();
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      toast.error(msg);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent onClick={(e) => e.stopPropagation()} className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {isRetirar ? <><Key className="h-4 w-4" /> Retirar Chave</> : <><KeyRound className="h-4 w-4" /> Devolver Chave</>}
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-3">
          <div>
            <Label className="text-sm">Foto obrigatória (com a chave na mão)</Label>
            <input
              ref={inputRef}
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            />
            {preview ? (
              <button type="button" onClick={() => inputRef.current?.click()} className="block w-full">
                <img src={preview} alt="Pré-visualização" className="w-full max-h-72 object-cover rounded border" />
                <span className="block text-xs text-muted-foreground mt-1">Tocar para trocar a foto</span>
              </button>
            ) : (
              <Button type="button" variant="outline" className="w-full h-24 border-dashed gap-2" onClick={() => inputRef.current?.click()}>
                <Camera className="h-5 w-5" /> Tirar / escolher foto
              </Button>
            )}
          </div>
          <div>
            <Label className="text-sm">Observação (opcional)</Label>
            <Textarea value={observacao} onChange={(e) => setObservacao(e.target.value)} rows={2} placeholder="Ex.: visita ao Sr. João às 15h" />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose} disabled={busy}>Cancelar</Button>
            <Button type="submit" disabled={busy || !file}>
              {busy ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : null}
              {isRetirar ? "Confirmar retirada" : "Confirmar devolução"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function ChaveHistoryDialog({ imovelId, open, onOpenChange }: {
  imovelId: string; open: boolean; onOpenChange: (v: boolean) => void;
}) {
  const { data: logs = [] } = useQuery({
    queryKey: ["chaves-log", imovelId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("chaves_log")
        .select("*")
        .eq("imovel_id", imovelId)
        .order("criado_em", { ascending: false });
      if (error) throw error;
      return (data ?? []) as ChaveLog[];
    },
    enabled: open,
  });

  const userIds = Array.from(new Set(logs.map((l) => l.corretor_id)));
  const { data: nomes = {} } = useQuery({
    queryKey: ["profile-nomes", userIds.join(",")],
    queryFn: async () => {
      if (!userIds.length) return {};
      const { data } = await supabase.from("profiles").select("id, nome").in("id", userIds);
      const map: Record<string, string> = {};
      (data ?? []).forEach((p) => { map[p.id] = p.nome ?? "—"; });
      return map;
    },
    enabled: open && userIds.length > 0,
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent onClick={(e) => e.stopPropagation()} className="sm:max-w-lg sm:max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Histórico da chave</DialogTitle>
        </DialogHeader>
        {logs.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhuma movimentação registrada.</p>
        ) : (
          <ul className="space-y-3">
            {logs.map((l) => (
              <li key={l.id} className="flex gap-3 border rounded p-2">
                <SignedImage path={l.foto_url} className="w-20 h-20 shrink-0" />
                <div className="text-sm space-y-0.5">
                  <div className="flex items-center gap-2">
                    {l.tipo === "retirada"
                      ? <Badge className="bg-blue-500/10 text-blue-700 dark:text-blue-400">Retirada</Badge>
                      : <Badge className="bg-emerald-500/10 text-emerald-700 dark:text-emerald-400">Devolução</Badge>}
                    <span className="text-xs text-muted-foreground">
                      {new Date(l.criado_em).toLocaleString("pt-BR")}
                    </span>
                  </div>
                  <div className="text-xs"><strong>Por:</strong> {nomes[l.corretor_id] ?? "—"}</div>
                  {l.observacao && <div className="text-xs text-muted-foreground">{l.observacao}</div>}
                </div>
              </li>
            ))}
          </ul>
        )}
      </DialogContent>
    </Dialog>
  );
}
