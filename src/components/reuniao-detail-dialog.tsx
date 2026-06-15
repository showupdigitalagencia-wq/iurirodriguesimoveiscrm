import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { useServerFn } from "@tanstack/react-start";
import { getReuniao, updateReuniaoStatus, deleteReuniao, type ReuniaoDetail, type ReuniaoStatus } from "@/lib/reunioes.functions";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";
import { Calendar, MapPin, Users, Trash2, MessageCircle } from "lucide-react";

function onlyDigits(s: string) {
  return (s || "").replace(/\D/g, "");
}

function buildWhatsAppMessage(
  tipo: "individual" | "institucional" | "alinhamento",
  leadNome: string,
  dataHora: Date,
  local: string | null,
  corretores: string,
) {
  const data = format(dataHora, "dd/MM/yyyy", { locale: ptBR });
  const hora = format(dataHora, "HH:mm", { locale: ptBR });
  const localTxt = local?.trim() || "A definir";
  if (tipo === "institucional") {
    return `Olá ${leadNome}! 😊

Você está convidado(a) para uma
REUNIÃO INSTITUCIONAL! 🏢✨

Você terá a oportunidade de conhecer
pessoalmente nosso Diretor Geral
IURI RODRIGUES e toda a nossa equipe!

📅 Data: ${data}
🕐 Hora: ${hora}
📍 Local/Link: ${localTxt}

Esta é uma excelente oportunidade!
Confirme sua presença.

Iuri Rodrigues Imóveis`;
  }
  return `Olá ${leadNome}! 😊

Sua reunião foi agendada com sucesso!

📅 Data: ${data}
🕐 Hora: ${hora}
📍 Local/Link: ${localTxt}
👤 Corretor responsável: ${corretores || "A definir"}

Qualquer dúvida estamos à disposição!
Iuri Rodrigues Imóveis`;
}

interface Props {
  reuniaoId: string | null;
  onClose: () => void;
  onChanged?: () => void;
}

export function ReuniaoDetailDialog({ reuniaoId, onClose, onChanged }: Props) {
  const [r, setR] = useState<ReuniaoDetail | null>(null);
  const [resultado, setResultado] = useState("");
  const callGet = useServerFn(getReuniao);
  const callStatus = useServerFn(updateReuniaoStatus);
  const callDelete = useServerFn(deleteReuniao);

  useEffect(() => {
    if (!reuniaoId) { setR(null); return; }
    callGet({ data: { id: reuniaoId } }).then((d) => {
      setR(d);
      setResultado(d.resultado ?? "");
    }).catch((e) => toast.error(e instanceof Error ? e.message : "Erro"));
  }, [reuniaoId, callGet]);

  async function setStatus(status: ReuniaoStatus) {
    if (!reuniaoId) return;
    try {
      await callStatus({ data: { id: reuniaoId, status, resultado: status === "realizada" ? resultado || null : null } });
      toast.success("Status atualizado");
      onChanged?.();
      const fresh = await callGet({ data: { id: reuniaoId } });
      setR(fresh);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha");
    }
  }

  async function handleDelete() {
    if (!reuniaoId) return;
    if (!confirm("Tem certeza? A reunião será excluída e todos serão notificados.")) return;
    try {
      await callDelete({ data: { id: reuniaoId } });
      toast.success("Reunião excluída — notificação enviada");
      onChanged?.();
      onClose();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha");
    }
  }

  async function handleCancel() {
    if (!reuniaoId) return;
    if (!confirm("Tem certeza? Todos serão notificados do cancelamento.")) return;
    try {
      await callStatus({ data: { id: reuniaoId, status: "cancelada", resultado: null } });
      toast.success("Reunião cancelada — notificação enviada");
      onChanged?.();
      const fresh = await callGet({ data: { id: reuniaoId } });
      setR(fresh);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha");
    }
  }

  return (
    <Dialog open={!!reuniaoId} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        {r ? (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                {r.titulo}
              </DialogTitle>
              <DialogDescription className="flex gap-2 flex-wrap mt-1">
                <Badge
                  className={
                    r.tipo === "institucional"
                      ? "bg-gold text-gold-foreground"
                      : r.tipo === "alinhamento"
                      ? "bg-purple-600 text-white"
                      : "bg-blue-500 text-white"
                  }
                >
                  {r.tipo === "institucional" ? "Institucional" : r.tipo === "alinhamento" ? "Alinhamento" : "Individual"}
                </Badge>
                <Badge
                  variant="outline"
                  className={r.status === "cancelada" ? "bg-red-600 text-white border-red-700" : ""}
                >
                  {r.status}
                </Badge>
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-3 text-sm">
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                {format(new Date(r.data_inicio), "PPP 'às' HH:mm", { locale: ptBR })} · {r.duracao_min}min
              </div>
              {r.local && (
                <div className="flex items-start gap-2">
                  <MapPin className="h-4 w-4 text-muted-foreground mt-0.5" />
                  <span className="break-all">{r.local}</span>
                </div>
              )}
              {r.descricao && (
                <div>
                  <div className="text-xs uppercase text-muted-foreground mb-1">Descrição</div>
                  <p className="whitespace-pre-wrap">{r.descricao}</p>
                </div>
              )}

              <Separator />

              <div>
                <div className="flex items-center gap-2 text-xs uppercase text-muted-foreground mb-2">
                  <Users className="h-3.5 w-3.5" /> Leads
                </div>
                {r.participantes_leads.length === 0 ? <p className="text-muted-foreground text-xs">Nenhum</p> : (
                  <ul className="space-y-2">
                    {r.participantes_leads.map((l) => {
                      const corretores = r.participantes_corretores.map((c) => c.nome).join(", ");
                      const msg = buildWhatsAppMessage(r.tipo, l.nome, new Date(r.data_inicio), r.local, corretores);
                      const tel = onlyDigits(l.telefone);
                      const href = `https://wa.me/${tel.startsWith("55") || tel.length < 11 ? tel : "55" + tel}?text=${encodeURIComponent(msg)}`;
                      return (
                        <li key={l.id} className="flex items-center justify-between gap-2">
                          <span className="text-sm truncate">{l.nome} <span className="text-muted-foreground text-xs">— {l.telefone}</span></span>
                          {tel && (
                            <Button asChild size="sm" variant="outline" className="shrink-0">
                              <a href={href} target="_blank" rel="noopener noreferrer">
                                <MessageCircle className="h-4 w-4 mr-1" /> Enviar confirmação
                              </a>
                            </Button>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>

              <div>
                <div className="flex items-center gap-2 text-xs uppercase text-muted-foreground mb-2">
                  <Users className="h-3.5 w-3.5" /> Corretores
                </div>
                {r.participantes_corretores.length === 0 ? <p className="text-muted-foreground text-xs">Nenhum</p> : (
                  <ul className="space-y-1">
                    {r.participantes_corretores.map((c) => (
                      <li key={c.id} className="text-sm">{c.nome}</li>
                    ))}
                  </ul>
                )}
              </div>

              <Separator />

              <div>
                <Label>Resultado / observações pós-reunião</Label>
                <Textarea rows={3} value={resultado} onChange={(e) => setResultado(e.target.value)} placeholder="O que aconteceu?" />
              </div>

              <div className="flex gap-2 flex-wrap pt-2">
                <Button variant="gold" size="sm" onClick={() => setStatus("realizada")}>Marcar realizada</Button>
                <Button variant="outline" size="sm" onClick={() => setStatus("agendada")}>Reabrir</Button>
                <Button variant="outline" size="sm" onClick={handleCancel} className="text-destructive">Cancelar reunião</Button>
                <Button variant="ghost" size="sm" onClick={handleDelete} className="text-destructive ml-auto">
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </>
        ) : (
          <p className="text-sm text-muted-foreground">Carregando...</p>
        )}
      </DialogContent>
    </Dialog>
  );
}
