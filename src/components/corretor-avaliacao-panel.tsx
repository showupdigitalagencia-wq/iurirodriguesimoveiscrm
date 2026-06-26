import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger, DialogDescription } from "@/components/ui/dialog";
import { Card, CardContent } from "@/components/ui/card";
import { Star, ClipboardCheck, CalendarClock } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";

type Avaliacao = {
  id: string;
  reuniao_alinhamento_presente: boolean;
  mentoria_presente: boolean;
  engajamento: number;
  observacao: string | null;
  avaliado_por: string;
  created_at: string;
};

type Props = {
  leadId: string;
  corretorProfileId?: string | null;
  responsavelId?: string | null;
};

export function CorretorAvaliacaoPanel({ leadId, corretorProfileId, responsavelId }: Props) {
  const [list, setList] = useState<Avaliacao[]>([]);
  const [open, setOpen] = useState(false);
  const [canEvaluate, setCanEvaluate] = useState(false);
  const [loading, setLoading] = useState(true);

  // form state
  const [alinhamento, setAlinhamento] = useState<boolean | null>(null);
  const [mentoria, setMentoria] = useState<boolean | null>(null);
  const [engajamento, setEngajamento] = useState<number>(0);
  const [observacao, setObservacao] = useState("");
  const [saving, setSaving] = useState(false);

  async function load() {
    setLoading(true);
    const { data } = await supabase
      .from("corretor_avaliacoes")
      .select("id, reuniao_alinhamento_presente, mentoria_presente, engajamento, observacao, avaliado_por, created_at")
      .eq("lead_id", leadId)
      .order("created_at", { ascending: false });
    setList((data as Avaliacao[]) ?? []);
    setLoading(false);
  }

  useEffect(() => {
    load();
    // Permissão: admin OU executivo cujo id = responsavelId do lead
    (async () => {
      const { data: u } = await supabase.auth.getUser();
      const uid = u.user?.id;
      if (!uid) return;
      const { data: roleRow } = await supabase.from("user_roles").select("role").eq("user_id", uid).eq("role", "admin").maybeSingle();
      if (roleRow?.role === "admin") { setCanEvaluate(true); return; }
      if (responsavelId) {
        const { data: resp } = await supabase.from("responsaveis").select("id").eq("user_id", uid).eq("ativo", true).maybeSingle();
        if (resp?.id && resp.id === responsavelId) setCanEvaluate(true);
      }
    })();
  }, [leadId, responsavelId]);

  function resetForm() {
    setAlinhamento(null); setMentoria(null); setEngajamento(0); setObservacao("");
  }

  async function submit() {
    if (alinhamento === null || mentoria === null || engajamento < 1) {
      toast.error("Preencha todos os critérios obrigatórios");
      return;
    }
    const { data: u } = await supabase.auth.getUser();
    const uid = u.user?.id;
    if (!uid) { toast.error("Sessão expirada"); return; }
    setSaving(true);
    const { error } = await supabase.from("corretor_avaliacoes").insert({
      lead_id: leadId,
      corretor_profile_id: corretorProfileId ?? null,
      avaliado_por: uid,
      reuniao_alinhamento_presente: alinhamento,
      mentoria_presente: mentoria,
      engajamento,
      observacao: observacao.trim() || null,
    });
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Avaliação registrada");
    setOpen(false);
    resetForm();
    load();
  }

  const ultima = list[0];

  return (
    <Card>
      <CardContent className="p-4 space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-sm font-semibold">
              <ClipboardCheck className="h-4 w-4 text-gold" /> Avaliação contínua
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">
              {ultima ? (
                <span className="inline-flex items-center gap-1">
                  <CalendarClock className="h-3 w-3" />
                  Última: {format(new Date(ultima.created_at), "dd/MM/yy HH:mm", { locale: ptBR })}
                </span>
              ) : "Sem avaliações ainda."}
            </p>
          </div>
          {canEvaluate && (
            <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) resetForm(); }}>
              <DialogTrigger asChild>
                <Button size="sm" variant="gold">Avaliar</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Nova avaliação</DialogTitle>
                  <DialogDescription>O score histórico acumula — cada registro fica salvo.</DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                  <YesNoField label="Participou da última reunião de Alinhamento?" value={alinhamento} onChange={setAlinhamento} />
                  <YesNoField label="Participou da última Mentoria?" value={mentoria} onChange={setMentoria} />
                  <div>
                    <Label className="text-sm">Engajamento geral</Label>
                    <div className="flex gap-1 mt-1">
                      {[1,2,3,4,5].map((n) => (
                        <button
                          key={n}
                          type="button"
                          onClick={() => setEngajamento(n)}
                          className="p-1 rounded hover:bg-muted"
                          aria-label={`${n} estrela${n>1?"s":""}`}
                        >
                          <Star className={cn("h-6 w-6", n <= engajamento ? "fill-amber-400 text-amber-400" : "text-muted-foreground")} />
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <Label className="text-sm" htmlFor="obs">Observação (opcional)</Label>
                    <Textarea id="obs" value={observacao} onChange={(e) => setObservacao(e.target.value)} rows={3} maxLength={500} />
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
                  <Button variant="gold" onClick={submit} disabled={saving}>{saving ? "Salvando…" : "Registrar"}</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          )}
        </div>

        {ultima && (
          <div className="grid grid-cols-3 gap-2 text-xs">
            <Pill label="Alinhamento" ok={ultima.reuniao_alinhamento_presente} />
            <Pill label="Mentoria" ok={ultima.mentoria_presente} />
            <div className="rounded-md bg-muted/50 px-2 py-1.5 text-center">
              <div className="text-[10px] text-muted-foreground">Engajamento</div>
              <div className="font-semibold flex items-center justify-center gap-0.5">
                {ultima.engajamento}<Star className="h-3 w-3 fill-amber-400 text-amber-400" />
              </div>
            </div>
          </div>
        )}

        {list.length > 1 && (
          <details className="text-xs">
            <summary className="cursor-pointer text-muted-foreground hover:text-foreground">
              Ver histórico ({list.length} avaliações)
            </summary>
            <div className="mt-2 space-y-2 max-h-60 overflow-y-auto">
              {list.slice(1).map((a) => (
                <div key={a.id} className="rounded-md border border-border/60 p-2">
                  <div className="text-muted-foreground text-[10px]">
                    {format(new Date(a.created_at), "dd/MM/yy HH:mm", { locale: ptBR })}
                  </div>
                  <div className="flex items-center gap-3 mt-1">
                    <span>Alinh.: {a.reuniao_alinhamento_presente ? "✅" : "❌"}</span>
                    <span>Ment.: {a.mentoria_presente ? "✅" : "❌"}</span>
                    <span className="flex items-center gap-0.5">{a.engajamento}<Star className="h-3 w-3 fill-amber-400 text-amber-400" /></span>
                  </div>
                  {a.observacao && <div className="mt-1 text-muted-foreground">{a.observacao}</div>}
                </div>
              ))}
            </div>
          </details>
        )}

        {!loading && list.length === 0 && !canEvaluate && (
          <p className="text-xs text-muted-foreground">Aguardando primeira avaliação do executivo responsável.</p>
        )}
      </CardContent>
    </Card>
  );
}

function YesNoField({ label, value, onChange }: { label: string; value: boolean | null; onChange: (v: boolean) => void }) {
  return (
    <div>
      <Label className="text-sm">{label}</Label>
      <div className="flex gap-2 mt-1">
        <Button type="button" size="sm" variant={value === true ? "default" : "outline"} onClick={() => onChange(true)}>Sim</Button>
        <Button type="button" size="sm" variant={value === false ? "default" : "outline"} onClick={() => onChange(false)}>Não</Button>
      </div>
    </div>
  );
}

function Pill({ label, ok }: { label: string; ok: boolean }) {
  return (
    <div className={cn(
      "rounded-md px-2 py-1.5 text-center",
      ok ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300" : "bg-red-500/10 text-red-700 dark:text-red-300",
    )}>
      <div className="text-[10px] opacity-80">{label}</div>
      <div className="font-semibold">{ok ? "Sim" : "Não"}</div>
    </div>
  );
}
