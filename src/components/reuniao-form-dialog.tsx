import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Checkbox } from "@/components/ui/checkbox";
import { useServerFn } from "@tanstack/react-start";
import { createReuniao, listEquipeReuniao, listLeadsReuniao, type EquipeMembro } from "@/lib/reunioes.functions";
import { ETAPAS } from "@/lib/lead-helpers";

const ETAPA_LABEL: Record<string, string> = Object.fromEntries(ETAPAS.map((e) => [e.id, e.nome]));
import { startGoogleOAuth, getGoogleStatus } from "@/lib/google.functions";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { MessageCircle, Video, CheckCircle2, Users, Shield, Briefcase, UserPlus, X } from "lucide-react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";

type Tipo = "individual" | "institucional" | "alinhamento" | "mentoria";
type LeadOpt = { id: string; nome: string; telefone: string; etapa?: string | null };

const GROUP_WA_URL = "https://chat.whatsapp.com/GCRzxSX7Ou51J8qgNjLiyu";

function onlyDigits(s: string): string {
  return (s ?? "").replace(/\D+/g, "");
}

function formatBR(date: string): string {
  const [y, m, d] = date.split("-");
  return `${d}/${m}/${y}`;
}

function buildLeadMessage(opts: {
  tipo: Tipo;
  leadNome: string;
  data: string;
  hora: string;
  local: string;
  corretor: string;
}): string {
  const { tipo, leadNome, data, hora, local, corretor } = opts;
  const dataBR = formatBR(data);
  const link = local || "a definir";
  if (tipo === "institucional") {
    return `Olá ${leadNome}! 😊\n\nVocê está convidado para uma REUNIÃO INSTITUCIONAL! 🏢✨\nCom nosso Diretor Geral IURI RODRIGUES!\n\n📅 Data: ${dataBR}\n🕐 Hora: ${hora}\n📍 Link Google Meet: ${link}\n\nConfirme sua presença!\n\nIuri Rodrigues Imóveis 🏢`;
  }
  return `Olá ${leadNome}! 😊\n\nSua reunião foi agendada!\n\n📅 Data: ${dataBR}\n🕐 Hora: ${hora}\n📍 Link Google Meet: ${link}\n👤 Corretor: ${corretor}\n\nIuri Rodrigues Imóveis 🏢`;
}

function buildGroupMessage(opts: { data: string; hora: string; local: string }): string {
  const dataBR = formatBR(opts.data);
  return `⚠️ REUNIÃO DE ALINHAMENTO\n\nAtenção equipe! 👥\n\n📅 Data: ${dataBR}\n🕐 Hora: ${opts.hora}\n📍 Link Google Meet: ${opts.local || "a definir"}\n\nPresença de TODOS obrigatória!\n\n— Iuri Rodrigues\nDiretor Geral | Iuri Rodrigues Imóveis 🏢`;
}

// Próximos horários fixos: Seg 19h, Ter 15h, Qui 17h, Sáb 15h
function nextInstitucionalSlots(): { iso: string; dateStr: string; timeStr: string; label: string }[] {
  const targets: { dow: number; hour: number; label: string }[] = [
    { dow: 1, hour: 19, label: "Seg 19:00" },
    { dow: 2, hour: 15, label: "Ter 15:00" },
    { dow: 4, hour: 17, label: "Qui 17:00" },
    { dow: 6, hour: 15, label: "Sáb 15:00" },
  ];
  const now = new Date();
  return targets.map((t) => {
    const d = new Date(now);
    const diff = (t.dow - d.getDay() + 7) % 7;
    d.setDate(d.getDate() + (diff === 0 && d.getHours() >= t.hour ? 7 : diff));
    d.setHours(t.hour, 0, 0, 0);
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    const hh = String(t.hour).padStart(2, "0");
    return {
      iso: d.toISOString(),
      dateStr: `${yyyy}-${mm}-${dd}`,
      timeStr: `${hh}:00`,
      label: t.label,
    };
  });
}




interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  defaultLeadId?: string | null;
  onCreated?: (id: string) => void;
}

export function ReuniaoFormDialog({ open, onOpenChange, defaultLeadId, onCreated }: Props) {
  const call = useServerFn(createReuniao);
  const startOAuth = useServerFn(startGoogleOAuth);
  const checkStatus = useServerFn(getGoogleStatus);
  const fetchEquipe = useServerFn(listEquipeReuniao);
  const fetchPipelineLeads = useServerFn(listLeadsReuniao);
  const [leads, setLeads] = useState<LeadOpt[]>([]);
  const [equipe, setEquipe] = useState<EquipeMembro[]>([]);
  const [isAdmin, setIsAdmin] = useState(false);
  const [saving, setSaving] = useState(false);
  const [googleConnected, setGoogleConnected] = useState<boolean | null>(null);
  const [googleEmail, setGoogleEmail] = useState<string | null>(null);
  const [connectingGoogle, setConnectingGoogle] = useState(false);
  const [participantsOpen, setParticipantsOpen] = useState(false);
  const [participantsTab, setParticipantsTab] = useState<"equipe" | "leads">("equipe");
  const [confirmacao, setConfirmacao] = useState<null | {
    leads: LeadOpt[];
    tipo: Tipo;
    data: string;
    hora: string;
    local: string;
    corretor: string;
    invitedEmails: string[];
    leadsSemEmail: string[];
  }>(null);
  const [form, setForm] = useState({
    titulo: "",
    data: "",
    hora: "",
    duracao: 60,
    tipo: "individual" as Tipo,
    descricao: "",
    lead_ids: new Set<string>(),
    user_ids: new Set<string>(),
  });

  async function refreshGoogleStatus() {
    try {
      const s = await checkStatus();
      setGoogleConnected(s.connected);
      setGoogleEmail(s.email);
    } catch {
      setGoogleConnected(false);
    }
  }

  useEffect(() => {
    if (!open) return;
    if (defaultLeadId) {
      supabase.from("leads").select("id, nome, telefone").eq("id", defaultLeadId).maybeSingle()
        .then(({ data }) => setLeads(data ? [data as LeadOpt] : []));
    } else {
      fetchPipelineLeads().then((r) => setLeads(r.leads)).catch(() => setLeads([]));
    }
    fetchEquipe().then((r) => setEquipe(r.equipe)).catch(() => setEquipe([]));
    supabase.auth.getUser().then(async ({ data }) => {
      const uid = data.user?.id;
      if (!uid) return setIsAdmin(false);
      const { data: r } = await supabase.from("user_roles").select("role").eq("user_id", uid).eq("role", "admin").maybeSingle();
      setIsAdmin(!!r);
    });
    refreshGoogleStatus();
  }, [open, defaultLeadId]);

  useEffect(() => {
    if (!open) return;
    function onMsg(e: MessageEvent) {
      const d = e.data;
      if (!d || d.type !== "google-oauth") return;
      if (d.status === "connected") {
        toast.success("Google conectado!");
        refreshGoogleStatus();
      } else {
        toast.error(`Falha ao conectar: ${d.reason ?? "erro"}`);
      }
      setConnectingGoogle(false);
    }
    window.addEventListener("message", onMsg);
    return () => window.removeEventListener("message", onMsg);
  }, [open]);

  useEffect(() => {
    if (open && defaultLeadId) {
      setForm((f) => ({ ...f, lead_ids: new Set([defaultLeadId]) }));
    }
    if (!open) {
      setForm({
        titulo: "", data: "", hora: "", duracao: 60,
        tipo: "individual", descricao: "",
        lead_ids: new Set<string>(), user_ids: new Set<string>(),
      });
      setConfirmacao(null);
    }
  }, [open, defaultLeadId]);

  function toggle(set: Set<string>, id: string): Set<string> {
    const n = new Set(set);
    if (n.has(id)) n.delete(id); else n.add(id);
    return n;
  }

  async function handleConnectGoogle() {
    setConnectingGoogle(true);
    try {
      const { url } = await startOAuth();
      const w = window.open(url, "google-oauth", "width=520,height=640,menubar=no,toolbar=no");
      if (!w) {
        toast.error("Permita pop-ups para conectar o Google");
        setConnectingGoogle(false);
        return;
      }
      const timer = setInterval(() => {
        if (w.closed) {
          clearInterval(timer);
          setConnectingGoogle(false);
          refreshGoogleStatus();
        }
      }, 800);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao iniciar conexão");
      setConnectingGoogle(false);
    }
  }

  async function submit() {
    if (!form.titulo.trim() || !form.data || !form.hora) {
      toast.error("Preencha título, data e hora");
      return;
    }
    if (!googleConnected) {
      toast.error("Conecte sua conta Google para gerar o link do Meet");
      return;
    }
    setSaving(true);
    try {
      const iso = new Date(`${form.data}T${form.hora}:00`).toISOString();
      const res = await call({
        data: {
          titulo: form.titulo.trim(),
          descricao: form.descricao || null,
          data_inicio: iso,
          duracao_min: Number(form.duracao) || 60,
          local: null,
          tipo: form.tipo,
          lead_ids: Array.from(form.lead_ids),
          responsavel_ids: [],
          user_ids: Array.from(form.user_ids),
          usar_meet: true,
        },
      });
      toast.success("Reunião agendada");
      onCreated?.(res.id);

      const finalLocal = res.local ?? "";
      if (!res.local) {
        toast.warning("Google Meet não foi gerado. Verifique a conexão Google.");
      }

      const selectedLeads = leads.filter((l) => form.lead_ids.has(l.id));
      const corretorNome = equipe.filter((e) => form.user_ids.has(e.id)).map((e) => e.nome).join(", ");

      setConfirmacao({
        leads: selectedLeads,
        tipo: form.tipo,
        data: form.data,
        hora: form.hora,
        local: finalLocal,
        corretor: corretorNome,
        invitedEmails: res.invitedEmails ?? [],
        leadsSemEmail: res.leadsSemEmail ?? [],
      });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao agendar");
    } finally {
      setSaving(false);
    }
  }

  // Confirmation modal — alinhamento
  if (confirmacao && confirmacao.tipo === "alinhamento") {
    const msg = buildGroupMessage({ data: confirmacao.data, hora: confirmacao.hora, local: confirmacao.local });
    const handleSendGroup = async () => {
      try {
        await navigator.clipboard.writeText(msg);
        toast.success("✅ Mensagem copiada!", { description: "Cole no grupo (Ctrl+V ou segurar+colar) e envie" });
      } catch {
        toast.error("Não foi possível copiar — copie manualmente");
      }
      // Open in a new tab; works on both mobile (deep link) and desktop (WhatsApp Web)
      window.open(GROUP_WA_URL, "_blank", "noopener,noreferrer");
    };
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>⚠️ Reunião de Alinhamento agendada!</DialogTitle>
            <DialogDescription>Notifique a equipe:</DialogDescription>
          </DialogHeader>
          <div className="bg-muted rounded-md p-3 text-sm whitespace-pre-wrap break-words">{msg}</div>
          <div className="flex flex-col gap-2">
            <Button variant="gold" onClick={handleSendGroup}>
              <Users className="h-4 w-4 mr-1" /> 📋 Copiar e Abrir Grupo WhatsApp
            </Button>
            <Button variant="ghost" onClick={() => onOpenChange(false)}>Fechar</Button>
          </div>

        </DialogContent>
      </Dialog>
    );
  }

  // Confirmation modal — individual/institucional
  if (confirmacao) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>✅ Reunião agendada com sucesso!</DialogTitle>
            <DialogDescription>Envie a confirmação:</DialogDescription>
          </DialogHeader>
          {confirmacao.local && (
            <div className="text-xs bg-muted rounded-md p-2 break-all">
              <strong>Link Meet:</strong> {confirmacao.local}
            </div>
          )}
          {confirmacao.invitedEmails.length > 0 && (
            <div className="text-xs rounded-md p-2 bg-green-500/10 border border-green-500/30 space-y-1">
              <div className="font-medium text-green-700 dark:text-green-400">
                ✅ Convite do Google Calendar enviado para:
              </div>
              <ul className="list-disc list-inside break-all">
                {confirmacao.invitedEmails.map((em) => (
                  <li key={em}>{em}</li>
                ))}
              </ul>
            </div>
          )}
          {confirmacao.leadsSemEmail.length > 0 && (
            <div className="text-xs rounded-md p-2 bg-yellow-500/10 border border-yellow-500/30">
              <div className="font-medium text-yellow-700 dark:text-yellow-400">
                ⚠️ Lead sem email — convite não enviado:
              </div>
              <ul className="list-disc list-inside">
                {confirmacao.leadsSemEmail.map((n) => (
                  <li key={n}>{n}</li>
                ))}
              </ul>
            </div>
          )}
          {confirmacao.leads.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum lead selecionado.</p>
          ) : (
            <div className="space-y-2">
              {confirmacao.leads.map((l) => {
                const tel = onlyDigits(l.telefone);
                const phone = tel.startsWith("55") || tel.length < 11 ? tel : `55${tel}`;
                const msg = buildLeadMessage({
                  tipo: confirmacao.tipo,
                  leadNome: l.nome,
                  data: confirmacao.data,
                  hora: confirmacao.hora,
                  local: confirmacao.local,
                  corretor: confirmacao.corretor,
                });
                const waUrl = `https://wa.me/${phone}?text=${encodeURIComponent(msg)}`;
                return (
                  <div key={l.id} className="flex items-center justify-between gap-2 border border-border rounded-md p-2">
                    <span className="text-sm font-medium truncate">{l.nome}</span>
                    {tel ? (
                      <Button asChild size="sm" variant="gold">
                        <a href={waUrl} target="_blank" rel="noopener noreferrer">
                          <MessageCircle className="h-4 w-4 mr-1" /> Enviar no WhatsApp
                        </a>
                      </Button>
                    ) : (
                      <span className="text-xs text-muted-foreground">sem telefone</span>
                    )}
                  </div>
                );
              })}
            </div>
          )}
          <div className="flex justify-end pt-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>Fechar</Button>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <>
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Agendar Reunião</DialogTitle>
          <DialogDescription>Preencha os detalhes da reunião</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label>Título</Label>
            <Input value={form.titulo} onChange={(e) => setForm({ ...form, titulo: e.target.value })} placeholder="Ex: Apresentação do imóvel" />
          </div>

          {form.tipo === "institucional" && (
            <div className="border border-gold/40 bg-gold/5 rounded-md p-2 space-y-1.5">
              <p className="text-xs font-medium text-gold-foreground/80">Horários fixos sugeridos:</p>
              <div className="flex flex-wrap gap-1.5">
                {nextInstitucionalSlots().map((s) => (
                  <Button
                    key={s.iso}
                    type="button"
                    size="sm"
                    variant={form.data === s.dateStr && form.hora === s.timeStr ? "gold" : "outline"}
                    onClick={() => setForm({ ...form, data: s.dateStr, hora: s.timeStr, titulo: form.titulo || `Reunião Institucional — ${s.timeStr}` })}
                  >
                    {s.label}
                  </Button>
                ))}
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Data</Label>
              <Input type="date" value={form.data} onChange={(e) => setForm({ ...form, data: e.target.value })} />
            </div>
            <div>
              <Label>Hora</Label>
              <Input type="time" value={form.hora} onChange={(e) => setForm({ ...form, hora: e.target.value })} />
            </div>
          </div>

          <div>
            <Label>Duração (minutos)</Label>
            <Input type="number" min={5} max={1440} value={form.duracao} onChange={(e) => setForm({ ...form, duracao: Number(e.target.value) })} />
          </div>

          <div className="border border-border rounded-md p-3 bg-muted/40">
            <div className="flex items-center gap-2 mb-2">
              <Video className="h-4 w-4 text-primary" />
              <span className="font-medium text-sm">Local: Google Meet</span>
            </div>
            {googleConnected === null ? (
              <p className="text-xs text-muted-foreground">Verificando conexão Google...</p>
            ) : googleConnected ? (
              <div className="flex items-start gap-2 text-xs text-muted-foreground">
                <CheckCircle2 className="h-4 w-4 text-green-500 mt-0.5" />
                <span>
                  Google conectado{googleEmail ? ` (${googleEmail})` : ""}. O link do Meet será gerado automaticamente ao agendar.
                </span>
              </div>
            ) : (
              <div className="space-y-2">
                <p className="text-xs text-muted-foreground">
                  Você precisa conectar sua conta Google para gerar o link do Meet.
                </p>
                <Button type="button" variant="gold" size="sm" onClick={handleConnectGoogle} disabled={connectingGoogle}>
                  {connectingGoogle ? "Conectando..." : "Conectar Google Meet"}
                </Button>
              </div>
            )}
          </div>

          <div>
            <Label>Tipo</Label>
            <RadioGroup value={form.tipo} onValueChange={(v) => setForm({ ...form, tipo: v as Tipo })} className="flex flex-wrap gap-4 mt-2">
              <label className="flex items-center gap-2 cursor-pointer">
                <RadioGroupItem value="individual" /> <span className="text-blue-500 font-medium">Individual</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <RadioGroupItem value="institucional" /> <span className="text-gold font-medium">Institucional</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <RadioGroupItem value="mentoria" /> <span className="text-blue-900 dark:text-blue-300 font-medium">Mentoria</span>
              </label>
              {isAdmin && (
                <label className="flex items-center gap-2 cursor-pointer">
                  <RadioGroupItem value="alinhamento" /> <span className="text-purple-600 font-medium">Alinhamento</span>
                </label>
              )}
            </RadioGroup>
          </div>

          {form.tipo !== "alinhamento" && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <Label>Participantes</Label>
                <Button type="button" size="sm" variant="outline" onClick={() => setParticipantsOpen(true)}>
                  <UserPlus className="h-4 w-4 mr-1" /> Adicionar Participantes
                </Button>
              </div>
              {form.user_ids.size === 0 && form.lead_ids.size === 0 ? (
                <p className="text-xs text-muted-foreground">Nenhum participante selecionado</p>
              ) : (
                <p className="text-sm text-muted-foreground">
                  <span className="font-medium text-foreground">{form.user_ids.size}</span> da equipe + <span className="font-medium text-foreground">{form.lead_ids.size}</span> leads adicionados
                </p>
              )}
            </div>
          )}

          <div>
            <Label>Descrição / Observações</Label>
            <Textarea rows={3} value={form.descricao} onChange={(e) => setForm({ ...form, descricao: e.target.value })} />
          </div>

          <div className="flex gap-2 justify-end pt-2">
            <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>Cancelar</Button>
            <Button variant="gold" onClick={submit} disabled={saving || !googleConnected}>
              {saving ? "Salvando..." : "Agendar"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>

    <Dialog open={participantsOpen} onOpenChange={setParticipantsOpen}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Adicionar Participantes</DialogTitle>
          <DialogDescription>Selecione corretores da equipe e/ou leads do pipeline</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <section className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-sm font-semibold">Equipe ({equipe.length} pessoas)</Label>
              <label className="flex items-center gap-2 text-xs cursor-pointer">
                <Checkbox
                  checked={equipe.length > 0 && equipe.every((e) => form.user_ids.has(e.id))}
                  onCheckedChange={(c) =>
                    setForm({ ...form, user_ids: c ? new Set(equipe.map((e) => e.id)) : new Set<string>() })
                  }
                />
                <span>Selecionar toda a equipe</span>
              </label>
            </div>
            <div className="max-h-56 overflow-y-auto border border-border rounded-md p-2 space-y-1">
              {equipe.length === 0 && <p className="text-xs text-muted-foreground">Nenhum membro disponível</p>}
              {equipe.map((m) => (
                <label key={m.id} className="flex items-center gap-2 text-sm cursor-pointer py-1 px-1 hover:bg-muted rounded">
                  <Checkbox checked={form.user_ids.has(m.id)} onCheckedChange={() => setForm({ ...form, user_ids: toggle(form.user_ids, m.id) })} />
                  {m.tipo === "admin" ? <Shield className="h-3.5 w-3.5 text-red-500 shrink-0" /> : m.tipo === "executivo" ? <Briefcase className="h-3.5 w-3.5 text-gold shrink-0" /> : <Users className="h-3.5 w-3.5 text-muted-foreground shrink-0" />}
                  <span className="truncate">
                    {m.nome}
                    {m.tipo === "admin" && <span className="text-xs text-red-500 ml-1">(Admin)</span>}
                    {m.tipo === "executivo" && <span className="text-xs text-gold ml-1">(Executivo)</span>}
                    {m.tipo === "corretor" && m.executivo && (
                      <span className="text-xs text-muted-foreground ml-1">— Exec: {m.executivo}</span>
                    )}
                  </span>
                </label>
              ))}
            </div>
          </section>

          <section className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-sm font-semibold">Leads ({leads.length} leads)</Label>
              <label className="flex items-center gap-2 text-xs cursor-pointer">
                <Checkbox
                  checked={leads.length > 0 && leads.every((l) => form.lead_ids.has(l.id))}
                  onCheckedChange={(c) =>
                    setForm({ ...form, lead_ids: c ? new Set(leads.map((l) => l.id)) : new Set<string>() })
                  }
                />
                <span>Selecionar todos os leads</span>
              </label>
            </div>
            <div className="max-h-56 overflow-y-auto border border-border rounded-md p-2 space-y-1">
              {leads.length === 0 && <p className="text-xs text-muted-foreground">Nenhum lead disponível</p>}
              {leads.map((l) => (
                <label key={l.id} className="flex items-center gap-2 text-sm cursor-pointer py-1 px-1 hover:bg-muted rounded">
                  <Checkbox checked={form.lead_ids.has(l.id)} onCheckedChange={() => setForm({ ...form, lead_ids: toggle(form.lead_ids, l.id) })} />
                  <span className="truncate">
                    {l.nome}
                    <span className="text-muted-foreground text-xs ml-1">— {l.telefone}</span>
                    {l.etapa && <span className="text-xs text-muted-foreground ml-1">• {l.etapa}</span>}
                  </span>
                </label>
              ))}
            </div>
          </section>
        </div>
        <div className="flex justify-end pt-2">
          <Button variant="gold" onClick={() => setParticipantsOpen(false)}>Confirmar</Button>
        </div>
      </DialogContent>
    </Dialog>
    </>
  );
}
