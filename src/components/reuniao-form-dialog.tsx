import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Checkbox } from "@/components/ui/checkbox";
import { useServerFn } from "@tanstack/react-start";
import { createReuniao } from "@/lib/reunioes.functions";
import { startGoogleOAuth, getGoogleStatus } from "@/lib/google.functions";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { MessageCircle, Video, CheckCircle2, Copy, Users } from "lucide-react";

type Tipo = "individual" | "institucional" | "alinhamento";
type LeadOpt = { id: string; nome: string; telefone: string };
type RespOpt = { id: string; nome: string; canal: string };

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

async function copyText(text: string) {
  try {
    await navigator.clipboard.writeText(text);
    toast.success("Mensagem copiada");
  } catch {
    toast.error("Falha ao copiar");
  }
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
  const [leads, setLeads] = useState<LeadOpt[]>([]);
  const [resps, setResps] = useState<RespOpt[]>([]);
  const [isAdmin, setIsAdmin] = useState(false);
  const [saving, setSaving] = useState(false);
  const [googleConnected, setGoogleConnected] = useState<boolean | null>(null);
  const [googleEmail, setGoogleEmail] = useState<string | null>(null);
  const [connectingGoogle, setConnectingGoogle] = useState(false);
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
    resp_ids: new Set<string>(),
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
    supabase.from("leads").select("id, nome, telefone").order("created_at", { ascending: false }).limit(500)
      .then(({ data }) => setLeads((data as LeadOpt[]) ?? []));
    supabase.from("responsaveis").select("id, nome, canal").order("nome")
      .then(({ data }) => setResps((data as RespOpt[]) ?? []));
    supabase.auth.getUser().then(async ({ data }) => {
      const uid = data.user?.id;
      if (!uid) return setIsAdmin(false);
      const { data: r } = await supabase.from("user_roles").select("role").eq("user_id", uid).eq("role", "admin").maybeSingle();
      setIsAdmin(!!r);
    });
    refreshGoogleStatus();
  }, [open]);

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
        lead_ids: new Set<string>(), resp_ids: new Set<string>(),
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
          responsavel_ids: Array.from(form.resp_ids),
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
      const corretorNome = resps.find((r) => form.resp_ids.has(r.id))?.nome ?? "";

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
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>⚠️ Reunião de Alinhamento agendada</DialogTitle>
            <DialogDescription>Envie a mensagem para o grupo da equipe</DialogDescription>
          </DialogHeader>
          <div className="bg-muted rounded-md p-3 text-sm whitespace-pre-wrap break-words">{msg}</div>
          <div className="flex flex-col gap-2">
            <Button variant="gold" onClick={() => copyText(msg)}>
              <Copy className="h-4 w-4 mr-1" /> Copiar mensagem
            </Button>
            <Button asChild variant="default">
              <a href={GROUP_WA_URL} target="_blank" rel="noopener noreferrer">
                <Users className="h-4 w-4 mr-1" /> Enviar para Grupo WhatsApp
              </a>
            </Button>
            <Button variant="outline" onClick={() => onOpenChange(false)}>Fechar</Button>
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
            <DialogTitle>✅ Reunião agendada! Envie a confirmação</DialogTitle>
            <DialogDescription>
              Copie a mensagem e envie pelo WhatsApp para cada lead.
            </DialogDescription>
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
            <div className="space-y-3">
              {confirmacao.leads.map((l) => {
                const tel = onlyDigits(l.telefone);
                const phone = tel.startsWith("55") || tel.length < 11 ? tel : `55${tel}`;
                const waUrl = `https://wa.me/${phone}`;
                const msg = buildLeadMessage({
                  tipo: confirmacao.tipo,
                  leadNome: l.nome,
                  data: confirmacao.data,
                  hora: confirmacao.hora,
                  local: confirmacao.local,
                  corretor: confirmacao.corretor,
                });
                return (
                  <div key={l.id} className="border border-border rounded-md p-3 space-y-2">
                    <div className="text-sm font-medium">{l.nome} <span className="text-muted-foreground text-xs">— {l.telefone}</span></div>
                    <div className="bg-muted rounded-md p-2 text-xs whitespace-pre-wrap break-words max-h-40 overflow-y-auto">{msg}</div>
                    <div className="flex flex-wrap gap-2">
                      <Button size="sm" variant="outline" onClick={() => copyText(msg)}>
                        <Copy className="h-4 w-4 mr-1" /> Copiar
                      </Button>
                      {tel && (
                        <Button asChild size="sm" variant="gold">
                          <a href={waUrl} target="_blank" rel="noopener noreferrer">
                            <MessageCircle className="h-4 w-4 mr-1" /> Abrir WhatsApp
                          </a>
                        </Button>
                      )}
                    </div>
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
                <RadioGroupItem value="individual" /> <span>Individual</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <RadioGroupItem value="institucional" /> <span>Institucional</span>
              </label>
              {isAdmin && (
                <label className="flex items-center gap-2 cursor-pointer">
                  <RadioGroupItem value="alinhamento" /> <span className="text-red-600 font-medium">Alinhamento</span>
                </label>
              )}
            </RadioGroup>
          </div>

          {form.tipo !== "alinhamento" && (
            <div>
              <Label>Leads participantes</Label>
              <div className="mt-2 max-h-40 overflow-y-auto border border-border rounded-md p-2 space-y-1">
                {leads.length === 0 && <p className="text-xs text-muted-foreground">Nenhum lead disponível</p>}
                {leads.map((l) => (
                  <label key={l.id} className="flex items-center gap-2 text-sm cursor-pointer py-1 px-1 hover:bg-muted rounded">
                    <Checkbox checked={form.lead_ids.has(l.id)} onCheckedChange={() => setForm({ ...form, lead_ids: toggle(form.lead_ids, l.id) })} />
                    <span className="truncate">{l.nome} <span className="text-muted-foreground text-xs">— {l.telefone}</span></span>
                  </label>
                ))}
              </div>
            </div>
          )}

          <div>
            <Label>Corretores participantes</Label>
            <div className="mt-2 border border-border rounded-md p-2 space-y-1">
              {resps.map((r) => (
                <label key={r.id} className="flex items-center gap-2 text-sm cursor-pointer py-1 px-1 hover:bg-muted rounded">
                  <Checkbox checked={form.resp_ids.has(r.id)} onCheckedChange={() => setForm({ ...form, resp_ids: toggle(form.resp_ids, r.id) })} />
                  <span>{r.nome}</span>
                </label>
              ))}
            </div>
          </div>

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
  );
}
