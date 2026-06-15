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
  tipo: "individual" | "institucional" | "alinhamento" | "mentoria",
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
  const [leadTab, setLeadTab] = useState<"equipe" | "leads">("leads");
  const [teamList, setTeamList] = useState<LeadOpt[]>([]);
  const [myLeads, setMyLeads] = useState<LeadOpt[]>([]);
  const [selectedLeadIds, setSelectedLeadIds] = useState<Set<string>>(new Set());
  const [waListOpen, setWaListOpen] = useState(false);
  const [waList, setWaList] = useState<LeadOpt[]>([]);
  const [addUserOpen, setAddUserOpen] = useState(false);
  const [allUsers, setAllUsers] = useState<{ id: string; nome: string; role: string }[]>([]);
  const [selectedUserIds, setSelectedUserIds] = useState<Set<string>>(new Set());
  const callGet = useServerFn(getReuniao);
  const callStatus = useServerFn(updateReuniaoStatus);
  const callDelete = useServerFn(deleteReuniao);
  const callAddLead = useServerFn(addLeadToReuniao);
  const callAddUser = useServerFn(addUserToReuniao);
  const callAddLeadsBatch = useServerFn(addLeadsBatchToReuniao);
  const callAddUsersBatch = useServerFn(addUsersBatchToReuniao);

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
    let myCanal: string | null = null;
    if (!isAdmin) {
      const { data: profile } = await supabase.from("profiles").select("responsavel_id").eq("id", r.my_user_id).maybeSingle();
      const respId = profile?.responsavel_id;
      if (respId) {
        const { data: resp } = await supabase.from("responsaveis").select("canal").eq("id", respId).maybeSingle();
        myCanal = (resp?.canal as string | null) ?? null;
      }
    }
    // Leads do pipeline (não fechado)
    let q = supabase.from("leads").select("id, nome, telefone, canal, etapa, is_corretor").order("nome").limit(500);
    if (!isAdmin && myCanal) q = q.eq("canal", myCanal as never);
    const { data: rows } = await q;
    const all = ((rows ?? []) as (LeadOpt & { etapa: string; is_corretor: boolean; canal: string })[]);
    setMyLeads(all.filter((l) => l.etapa !== "fechado").map(({ id, nome, telefone }) => ({ id, nome, telefone })));
    setTeamList(
      all
        .filter((l) => l.etapa === "fechado" && l.is_corretor)
        .map(({ id, nome, telefone }) => ({ id, nome, telefone })),
    );
  }

  async function openAdd() {
    setAddOpen(true);
    setSelectedLeadIds(new Set());
    setLeadTab("leads");
    await loadMyLeads();
  }

  function toggleLead(id: string) {
    setSelectedLeadIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  function selectAllInTab(list: LeadOpt[], select: boolean) {
    setSelectedLeadIds((prev) => {
      const next = new Set(prev);
      for (const l of list) { if (select) next.add(l.id); else next.delete(l.id); }
      return next;
    });
  }

  async function submitAddLeads() {
    if (!reuniaoId || selectedLeadIds.size === 0) return;
    try {
      const ids = Array.from(selectedLeadIds);
      const res = await callAddLeadsBatch({ data: { reuniao_id: reuniaoId, lead_ids: ids } });
      toast.success(`${res.added.length} adicionado(s)`);
      setAddOpen(false);
      onChanged?.();
      const fresh = await callGet({ data: { id: reuniaoId } });
      setR(fresh);
      setWaList(res.added.map((l) => ({ id: l.id, nome: l.nome, telefone: l.telefone })));
      setWaListOpen(true);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha");
    }
  }

  async function openAddUser() {
    setAddUserOpen(true);
    setSelectedUserIds(new Set());
    const { data: roles } = await supabase.from("user_roles").select("user_id, role");
    const ids = (roles ?? []).map((r) => r.user_id);
    const { data: profs } = await supabase.from("profiles").select("id, nome").in("id", ids);
    const rolesById = new Map((roles ?? []).map((r) => [r.user_id, r.role]));
    setAllUsers(((profs ?? []) as { id: string; nome: string }[])
      .map((p) => ({ ...p, role: rolesById.get(p.id) ?? "" }))
      .sort((a, b) => a.nome.localeCompare(b.nome)));
  }

  function toggleUser(id: string) {
    setSelectedUserIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  async function submitAddUsers() {
    if (!reuniaoId || selectedUserIds.size === 0) return;
    try {
      const res = await callAddUsersBatch({ data: { reuniao_id: reuniaoId, user_ids: Array.from(selectedUserIds) } });
      toast.success(`${res.addedCount} participante(s) notificado(s)`);
      setAddUserOpen(false);
      onChanged?.();
      const fresh = await callGet({ data: { id: reuniaoId } });
      setR(fresh);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha");
    }
  }

  // Mantido: usado internamente caso queira-se adicionar individual (legacy)
  void callAddLead; void callAddUser;

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

            {/* Add lead modal: equipe + leads, multi-select */}
            <Dialog open={addOpen} onOpenChange={setAddOpen}>
              <DialogContent className="max-w-md">
                <DialogHeader>
                  <DialogTitle>Adicionar à reunião</DialogTitle>
                  <DialogDescription>
                    {isAdmin ? "Equipe (corretores fechados) ou leads do pipeline." : "Sua equipe ou seus leads."}
                  </DialogDescription>
                </DialogHeader>
                <Tabs value={leadTab} onValueChange={(v) => setLeadTab(v as "equipe" | "leads")}>
                  <TabsList className="grid grid-cols-2 w-full">
                    <TabsTrigger value="equipe">Equipe ({teamList.length})</TabsTrigger>
                    <TabsTrigger value="leads">Leads ({myLeads.length})</TabsTrigger>
                  </TabsList>
                  {(["equipe", "leads"] as const).map((tab) => {
                    const list = tab === "equipe" ? teamList : myLeads;
                    const allSelected = list.length > 0 && list.every((l) => selectedLeadIds.has(l.id));
                    return (
                      <TabsContent key={tab} value={tab} className="space-y-2">
                        <div className="flex items-center justify-between px-1">
                          <label className="flex items-center gap-2 text-xs cursor-pointer">
                            <Checkbox checked={allSelected} onCheckedChange={(c) => selectAllInTab(list, !!c)} />
                            Selecionar todos
                          </label>
                          <span className="text-xs text-muted-foreground">{selectedLeadIds.size} selecionado(s)</span>
                        </div>
                        <div className="max-h-72 overflow-y-auto border border-border rounded-md divide-y divide-border">
                          {list.length === 0 && <p className="p-3 text-xs text-muted-foreground">Nenhum disponível.</p>}
                          {list.map((l) => (
                            <label key={l.id} className="flex items-center gap-2 p-2 cursor-pointer hover:bg-muted text-sm min-h-11">
                              <Checkbox checked={selectedLeadIds.has(l.id)} onCheckedChange={() => toggleLead(l.id)} />
                              <span className="flex-1 truncate">{l.nome} <span className="text-muted-foreground text-xs">— {l.telefone}</span></span>
                            </label>
                          ))}
                        </div>
                      </TabsContent>
                    );
                  })}
                </Tabs>
                <div className="flex justify-end gap-2 pt-2">
                  <Button variant="outline" onClick={() => setAddOpen(false)}>Cancelar</Button>
                  <Button variant="gold" onClick={submitAddLeads} disabled={selectedLeadIds.size === 0}>
                    Confirmar e Adicionar ({selectedLeadIds.size})
                  </Button>
                </div>
              </DialogContent>
            </Dialog>

            {/* WhatsApp list modal pós-adicao em massa */}
            <Dialog open={waListOpen} onOpenChange={setWaListOpen}>
              <DialogContent className="max-w-md">
                <DialogHeader>
                  <DialogTitle>Enviar WhatsApp</DialogTitle>
                  <DialogDescription>Envie confirmação para cada participante adicionado.</DialogDescription>
                </DialogHeader>
                <div className="max-h-80 overflow-y-auto border border-border rounded-md divide-y divide-border">
                  {waList.length === 0 && <p className="p-3 text-xs text-muted-foreground">Nenhum.</p>}
                  {waList.map((l) => {
                    const corretores = r.participantes_corretores.map((c) => c.nome).join(", ");
                    const msg = buildWhatsAppMessage(r.tipo, l.nome, new Date(r.data_inicio), r.local, corretores);
                    const tel = onlyDigits(l.telefone);
                    const phone = tel.startsWith("55") || tel.length < 11 ? tel : `55${tel}`;
                    const href = `https://wa.me/${phone}?text=${encodeURIComponent(msg)}`;
                    return (
                      <div key={l.id} className="flex items-center justify-between gap-2 p-2">
                        <span className="text-sm truncate">{l.nome} <span className="text-muted-foreground text-xs">— {l.telefone}</span></span>
                        {tel ? (
                          <Button asChild size="sm" variant="gold" className="shrink-0 min-h-11">
                            <a href={href} target="_blank" rel="noopener noreferrer">
                              <MessageCircle className="h-4 w-4 mr-1" /> Enviar
                            </a>
                          </Button>
                        ) : (
                          <span className="text-xs text-muted-foreground">sem telefone</span>
                        )}
                      </div>
                    );
                  })}
                </div>
                <div className="flex justify-end pt-2">
                  <Button variant="outline" onClick={() => setWaListOpen(false)}>Fechar</Button>
                </div>
              </DialogContent>
            </Dialog>

            {/* Add internal user modal (admin only) - multi-select */}
            <Dialog open={addUserOpen} onOpenChange={setAddUserOpen}>
              <DialogContent className="max-w-md">
                <DialogHeader>
                  <DialogTitle>Adicionar participantes</DialogTitle>
                  <DialogDescription>Admins, executivos ou corretores.</DialogDescription>
                </DialogHeader>
                <div className="space-y-2">
                  <div className="flex items-center justify-between px-1">
                    <label className="flex items-center gap-2 text-xs cursor-pointer">
                      <Checkbox
                        checked={allUsers.length > 0 && allUsers.every((u) => selectedUserIds.has(u.id))}
                        onCheckedChange={(c) => setSelectedUserIds(c ? new Set(allUsers.map((u) => u.id)) : new Set())}
                      />
                      Selecionar todos
                    </label>
                    <span className="text-xs text-muted-foreground">{selectedUserIds.size} selecionado(s)</span>
                  </div>
                  <div className="max-h-72 overflow-y-auto border border-border rounded-md divide-y divide-border">
                    {allUsers.length === 0 && <p className="p-3 text-xs text-muted-foreground">Carregando...</p>}
                    {allUsers.map((u) => (
                      <label key={u.id} className="flex items-center gap-2 p-2 cursor-pointer hover:bg-muted text-sm min-h-11">
                        <Checkbox checked={selectedUserIds.has(u.id)} onCheckedChange={() => toggleUser(u.id)} />
                        <span className="flex-1 truncate">{u.nome}</span>
                        <Badge variant="outline" className="text-[10px]">{u.role}</Badge>
                      </label>
                    ))}
                  </div>
                  <div className="flex justify-end gap-2 pt-2">
                    <Button variant="outline" onClick={() => setAddUserOpen(false)}>Cancelar</Button>
                    <Button variant="gold" onClick={submitAddUsers} disabled={selectedUserIds.size === 0}>
                      Confirmar e Adicionar ({selectedUserIds.size})
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
