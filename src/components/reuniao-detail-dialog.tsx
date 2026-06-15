import { useEffect, useMemo, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { useServerFn } from "@tanstack/react-start";
import { getReuniao, updateReuniaoStatus, deleteReuniao, addLeadToReuniao, addUserToReuniao, addLeadsBatchToReuniao, addUsersBatchToReuniao, type ReuniaoDetail, type ReuniaoStatus } from "@/lib/reunioes.functions";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";
import { Calendar, MapPin, Users, Trash2, MessageCircle, Plus, Lock } from "lucide-react";

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
  const diaSemana = format(dataHora, "EEEE", { locale: ptBR });
  const hora = format(dataHora, "HH:mm", { locale: ptBR });
  const localTxt = local?.trim() || "A definir";
  if (tipo === "institucional") {
    return `Olá ${leadNome}! 😊

Você está convidado para nossa
REUNIÃO INSTITUCIONAL!

📅 ${diaSemana}, ${data}
🕐 ${hora}
📍 Link Google Meet: ${localTxt}

Com nosso Diretor Geral IURI RODRIGUES!

Iuri Rodrigues Imóveis 🏢`;
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

type LeadOpt = { id: string; nome: string; telefone: string };

interface Props {
  reuniaoId: string | null;
  onClose: () => void;
  onChanged?: () => void;
}

export function ReuniaoDetailDialog({ reuniaoId, onClose, onChanged }: Props) {
  const [r, setR] = useState<ReuniaoDetail | null>(null);
  const [resultado, setResultado] = useState("");
  const [addOpen, setAddOpen] = useState(false);
  const [myLeads, setMyLeads] = useState<LeadOpt[]>([]);
  const [selectedLeadId, setSelectedLeadId] = useState<string>("");
  const [addUserOpen, setAddUserOpen] = useState(false);
  const [allUsers, setAllUsers] = useState<{ id: string; nome: string; role: string }[]>([]);
  const [selectedUserId, setSelectedUserId] = useState<string>("");
  const callGet = useServerFn(getReuniao);
  const callStatus = useServerFn(updateReuniaoStatus);
  const callDelete = useServerFn(deleteReuniao);
  const callAddLead = useServerFn(addLeadToReuniao);
  const callAddUser = useServerFn(addUserToReuniao);

  useEffect(() => {
    if (!reuniaoId) { setR(null); return; }
    callGet({ data: { id: reuniaoId } }).then((d) => {
      setR(d);
      setResultado(d.resultado ?? "");
    }).catch((e) => toast.error(e instanceof Error ? e.message : "Erro"));
  }, [reuniaoId, callGet]);

  const isAdmin = r?.my_role === "admin";
  const isExec = !!r?.is_executivo;
  const canEdit = isAdmin || (!r?.recorrente && (r?.criado_por === r?.my_user_id));
  const canAddLead = isAdmin || isExec;

  async function loadMyLeads() {
    if (!r) return;
    let q = supabase.from("leads").select("id, nome, telefone, canal").order("nome").limit(500);
    if (!isAdmin) {
      // Executivo: somente leads do seu canal
      const { data: profile } = await supabase.from("profiles").select("responsavel_id").eq("id", r.my_user_id).maybeSingle();
      const respId = profile?.responsavel_id;
      if (respId) {
        const { data: resp } = await supabase.from("responsaveis").select("canal").eq("id", respId).maybeSingle();
        const canal = resp?.canal;
        if (canal) q = q.eq("canal", canal);
      }
    }
    const { data } = await q;
    setMyLeads((data as LeadOpt[]) ?? []);
  }

  async function openAdd() {
    setAddOpen(true);
    setSelectedLeadId("");
    await loadMyLeads();
  }

  async function submitAddLead() {
    if (!reuniaoId || !selectedLeadId) return;
    try {
      const res = await callAddLead({ data: { reuniao_id: reuniaoId, lead_id: selectedLeadId } });
      toast.success("Lead adicionado");
      setAddOpen(false);
      onChanged?.();
      const fresh = await callGet({ data: { id: reuniaoId } });
      setR(fresh);
      // Abre WhatsApp automaticamente
      const lead = res.lead;
      const tel = onlyDigits(lead.telefone);
      if (tel && fresh) {
        const corretores = fresh.participantes_corretores.map((c) => c.nome).join(", ");
        const msg = buildWhatsAppMessage(fresh.tipo, lead.nome, new Date(fresh.data_inicio), fresh.local, corretores);
        const phone = tel.startsWith("55") || tel.length < 11 ? tel : `55${tel}`;
        window.open(`https://wa.me/${phone}?text=${encodeURIComponent(msg)}`, "_blank", "noopener");
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha");
    }
  }

  async function openAddUser() {
    setAddUserOpen(true);
    setSelectedUserId("");
    const { data: roles } = await supabase.from("user_roles").select("user_id, role");
    const ids = (roles ?? []).map((r) => r.user_id);
    const { data: profs } = await supabase.from("profiles").select("id, nome").in("id", ids);
    const rolesById = new Map((roles ?? []).map((r) => [r.user_id, r.role]));
    setAllUsers(((profs ?? []) as { id: string; nome: string }[])
      .map((p) => ({ ...p, role: rolesById.get(p.id) ?? "" }))
      .sort((a, b) => a.nome.localeCompare(b.nome)));
  }

  async function submitAddUser() {
    if (!reuniaoId || !selectedUserId) return;
    try {
      await callAddUser({ data: { reuniao_id: reuniaoId, user_id: selectedUserId } });
      toast.success("Participante adicionado e notificado");
      setAddUserOpen(false);
      onChanged?.();
      const fresh = await callGet({ data: { id: reuniaoId } });
      setR(fresh);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha");
    }
  }

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

  const leadsToShow = useMemo(() => r?.participantes_leads ?? [], [r]);

  return (
    <Dialog open={!!reuniaoId} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        {r ? (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                {r.titulo}
                {r.recorrente && <Lock className="h-4 w-4 text-gold" />}
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
                {r.recorrente && (
                  <Badge variant="outline" className="border-gold/60 text-gold">Recorrente — só Admin edita</Badge>
                )}
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
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-2">
                  <div className="flex items-center gap-2 text-xs uppercase text-muted-foreground">
                    <Users className="h-3.5 w-3.5" /> Leads {isAdmin ? "(todos)" : "(meus)"}
                  </div>
                  {canAddLead && (
                    <Button variant="gold" onClick={openAdd} className="w-full sm:w-auto min-h-11">
                      <Plus className="h-4 w-4 mr-1" /> Adicionar lead
                    </Button>
                  )}
                </div>
                {leadsToShow.length === 0 ? <p className="text-muted-foreground text-xs">Nenhum</p> : (
                  <ul className="space-y-2">
                    {leadsToShow.map((l) => {
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
                                <MessageCircle className="h-4 w-4 mr-1" /> Enviar
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
                  <Users className="h-3.5 w-3.5" /> Corretores / Executivos
                </div>
                {r.participantes_corretores.length === 0 ? <p className="text-muted-foreground text-xs">Nenhum</p> : (
                  <ul className="space-y-1">
                    {r.participantes_corretores.map((c) => (
                      <li key={c.id} className="text-sm">{c.nome}</li>
                    ))}
                  </ul>
                )}
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2 text-xs uppercase text-muted-foreground">
                    <Users className="h-3.5 w-3.5" /> Participantes internos
                  </div>
                  {isAdmin && (
                    <Button size="sm" variant="gold" onClick={openAddUser}>
                      <Plus className="h-3.5 w-3.5 mr-1" /> Adicionar participante
                    </Button>
                  )}
                </div>
                {(r.participantes_usuarios ?? []).length === 0 ? <p className="text-muted-foreground text-xs">Nenhum</p> : (
                  <ul className="space-y-1">
                    {(r.participantes_usuarios ?? []).map((u) => (
                      <li key={u.id} className="text-sm">{u.nome}</li>
                    ))}
                  </ul>
                )}
              </div>

              {canEdit && (
                <>
                  <Separator />
                  <div>
                    <Label>Resultado / observações pós-reunião</Label>
                    <Textarea rows={3} value={resultado} onChange={(e) => setResultado(e.target.value)} placeholder="O que aconteceu?" />
                  </div>
                  <div className="flex gap-2 flex-wrap pt-2">
                    <Button variant="gold" size="sm" onClick={() => setStatus("realizada")}>Marcar realizada</Button>
                    <Button variant="outline" size="sm" onClick={() => setStatus("agendada")}>Reabrir</Button>
                    <Button variant="outline" size="sm" onClick={handleCancel} className="text-destructive">Cancelar reunião</Button>
                    {isAdmin && (
                      <Button variant="ghost" size="sm" onClick={handleDelete} className="text-destructive ml-auto">
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </>
              )}
              {!canEdit && (
                <p className="text-xs text-muted-foreground italic">Esta reunião é gerenciada pelo Administrador.</p>
              )}
            </div>

            {/* Add lead modal */}
            <Dialog open={addOpen} onOpenChange={setAddOpen}>
              <DialogContent className="max-w-md">
                <DialogHeader>
                  <DialogTitle>Adicionar lead à reunião</DialogTitle>
                  <DialogDescription>
                    {isAdmin ? "Escolha qualquer lead." : "Escolha um dos seus leads."}
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-3">
                  <div className="max-h-72 overflow-y-auto border border-border rounded-md divide-y divide-border">
                    {myLeads.length === 0 && <p className="p-3 text-xs text-muted-foreground">Nenhum lead disponível.</p>}
                    {myLeads.map((l) => (
                      <label key={l.id} className="flex items-center gap-2 p-2 cursor-pointer hover:bg-muted text-sm">
                        <input
                          type="radio"
                          name="lead"
                          checked={selectedLeadId === l.id}
                          onChange={() => setSelectedLeadId(l.id)}
                        />
                        <span className="flex-1 truncate">{l.nome} <span className="text-muted-foreground text-xs">— {l.telefone}</span></span>
                      </label>
                    ))}
                  </div>
                  <div className="flex justify-end gap-2">
                    <Button variant="outline" onClick={() => setAddOpen(false)}>Cancelar</Button>
                    <Button variant="gold" onClick={submitAddLead} disabled={!selectedLeadId}>
                      Adicionar e enviar WhatsApp
                    </Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>

            {/* Add internal user modal (admin only) */}
            <Dialog open={addUserOpen} onOpenChange={setAddUserOpen}>
              <DialogContent className="max-w-md">
                <DialogHeader>
                  <DialogTitle>Adicionar participante</DialogTitle>
                  <DialogDescription>Admin, executivo ou corretor.</DialogDescription>
                </DialogHeader>
                <div className="space-y-3">
                  <div className="max-h-72 overflow-y-auto border border-border rounded-md divide-y divide-border">
                    {allUsers.length === 0 && <p className="p-3 text-xs text-muted-foreground">Carregando...</p>}
                    {allUsers.map((u) => (
                      <label key={u.id} className="flex items-center gap-2 p-2 cursor-pointer hover:bg-muted text-sm">
                        <input
                          type="radio"
                          name="user"
                          checked={selectedUserId === u.id}
                          onChange={() => setSelectedUserId(u.id)}
                        />
                        <span className="flex-1 truncate">{u.nome}</span>
                        <Badge variant="outline" className="text-[10px]">{u.role}</Badge>
                      </label>
                    ))}
                  </div>
                  <div className="flex justify-end gap-2">
                    <Button variant="outline" onClick={() => setAddUserOpen(false)}>Cancelar</Button>
                    <Button variant="gold" onClick={submitAddUser} disabled={!selectedUserId}>
                      Adicionar e notificar
                    </Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          </>
        ) : (
          <p className="text-sm text-muted-foreground">Carregando...</p>
        )}
      </DialogContent>
    </Dialog>
  );
}
