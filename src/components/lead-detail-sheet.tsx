import { useEffect, useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { ETAPAS, CANAIS, etapaNome, canalNome, regiaoNome, urgencyForLead, formatMinutes, type LeadRow } from "@/lib/lead-helpers";
import { updateLead, updateLeadEtapa, addNote, markFirstResponse } from "@/lib/leads.functions";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Phone, MessageCircle, MapPin, Mail, Clock, MessageSquarePlus, CheckCircle2 } from "lucide-react";

type HistoricoRow = {
  id: string;
  acao: string;
  detalhe: unknown;
  created_at: string;
};

interface Props {
  leadId: string | null;
  onClose: () => void;
  onUpdated?: () => void;
}

export function LeadDetailSheet({ leadId, onClose, onUpdated }: Props) {
  const [lead, setLead] = useState<LeadRow | null>(null);
  const [historico, setHistorico] = useState<HistoricoRow[]>([]);
  const [nota, setNota] = useState("");
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({ nome: "", email: "", telefone: "", observacoes: "", canal: "denise" as LeadRow["canal"] });

  const callUpdate = useServerFn(updateLead);
  const callEtapa = useServerFn(updateLeadEtapa);
  const callNote = useServerFn(addNote);
  const callFirst = useServerFn(markFirstResponse);

  useEffect(() => {
    if (!leadId) { setLead(null); return; }
    let active = true;
    async function load() {
      const [{ data: l }, { data: h }] = await Promise.all([
        supabase.from("leads").select("*").eq("id", leadId!).maybeSingle(),
        supabase.from("lead_historico").select("id, acao, detalhe, created_at").eq("lead_id", leadId!).order("created_at", { ascending: false }),
      ]);
      if (!active) return;
      setLead((l as LeadRow) ?? null);
      setHistorico((h as HistoricoRow[]) ?? []);
      if (l) {
        const ll = l as LeadRow;
        setForm({
          nome: ll.nome, email: ll.email ?? "", telefone: ll.telefone,
          observacoes: ll.observacoes ?? "", canal: ll.canal,
        });
      }
    }
    load();
    return () => { active = false; };
  }, [leadId]);

  async function reload() {
    if (!leadId) return;
    const [{ data: l }, { data: h }] = await Promise.all([
      supabase.from("leads").select("*").eq("id", leadId).maybeSingle(),
      supabase.from("lead_historico").select("id, acao, detalhe, created_at").eq("lead_id", leadId).order("created_at", { ascending: false }),
    ]);
    setLead((l as LeadRow) ?? null);
    setHistorico((h as HistoricoRow[]) ?? []);
    onUpdated?.();
  }

  async function save() {
    if (!leadId) return;
    try {
      await callUpdate({ data: { id: leadId, patch: {
        nome: form.nome, email: form.email || null, telefone: form.telefone,
        observacoes: form.observacoes || null, canal: form.canal,
      } } });
      toast.success("Lead atualizado");
      setEditing(false);
      await reload();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao salvar");
    }
  }

  async function changeEtapa(etapa: LeadRow["etapa"]) {
    if (!leadId) return;
    try {
      await callEtapa({ data: { id: leadId, etapa } });
      toast.success(`Movido para ${etapaNome(etapa)}`);
      await reload();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha");
    }
  }

  async function postNote() {
    if (!leadId || !nota.trim()) return;
    try {
      await callNote({ data: { lead_id: leadId, nota: nota.trim() } });
      setNota("");
      toast.success("Nota adicionada");
      await reload();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha");
    }
  }

  async function markResponse() {
    if (!leadId) return;
    try {
      await callFirst({ data: { id: leadId } });
      toast.success("Primeira resposta registrada");
      await reload();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha");
    }
  }

  const urgency = lead ? urgencyForLead(lead) : null;
  const whatsappLink = lead ? `https://wa.me/${lead.telefone.replace(/\D/g, "")}` : "#";

  return (
    <Sheet open={!!leadId} onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="w-full sm:max-w-xl overflow-y-auto">
        {lead ? (
          <>
            <SheetHeader>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <SheetTitle className="text-2xl">{lead.nome}</SheetTitle>
                  <SheetDescription className="flex items-center gap-2 mt-1">
                    <Badge variant="outline">{etapaNome(lead.etapa)}</Badge>
                    {urgency && urgency.level !== "ok" && (
                      <Badge className={urgency.level === "critical" ? "bg-destructive" : "bg-gold text-gold-foreground"}>
                        <Clock className="h-3 w-3 mr-1" /> {formatMinutes(urgency.minutes)} sem resposta
                      </Badge>
                    )}
                    {lead.is_corretor && <Badge variant="secondary">Corretor</Badge>}
                  </SheetDescription>
                </div>
              </div>
            </SheetHeader>

            <div className="mt-4 flex flex-wrap gap-2">
              <Button asChild variant="gold" size="sm">
                <a href={whatsappLink} target="_blank" rel="noreferrer">
                  <MessageCircle className="h-4 w-4" /> WhatsApp
                </a>
              </Button>
              <Button asChild variant="outline" size="sm">
                <a href={`tel:${lead.telefone}`}><Phone className="h-4 w-4" /> Ligar</a>
              </Button>
              {!lead.first_response_at && (
                <Button onClick={markResponse} variant="outline" size="sm">
                  <CheckCircle2 className="h-4 w-4" /> Marcar resposta
                </Button>
              )}
            </div>

            <Separator className="my-5" />

            <Tabs defaultValue="info">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="info">Informações</TabsTrigger>
                <TabsTrigger value="notas">Notas</TabsTrigger>
                <TabsTrigger value="historico">Histórico</TabsTrigger>
              </TabsList>

              <TabsContent value="info" className="space-y-4 mt-4">
                <div className="flex justify-end">
                  {editing ? (
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" onClick={() => setEditing(false)}>Cancelar</Button>
                      <Button variant="gold" size="sm" onClick={save}>Salvar</Button>
                    </div>
                  ) : (
                    <Button variant="outline" size="sm" onClick={() => setEditing(true)}>Editar</Button>
                  )}
                </div>

                {editing ? (
                  <div className="space-y-3">
                    <Field label="Nome"><Input value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} /></Field>
                    <Field label="Telefone"><Input value={form.telefone} onChange={(e) => setForm({ ...form, telefone: e.target.value })} /></Field>
                    <Field label="Email"><Input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></Field>
                    <Field label="Responsável">
                      <Select value={form.canal} onValueChange={(v) => setForm({ ...form, canal: v as LeadRow["canal"] })}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {CANAIS.map((c) => <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </Field>
                    <Field label="Observações"><Textarea rows={4} value={form.observacoes} onChange={(e) => setForm({ ...form, observacoes: e.target.value })} /></Field>
                  </div>
                ) : (
                  <dl className="space-y-3 text-sm">
                    <InfoRow icon={<Phone className="h-4 w-4" />} label="Telefone" value={lead.telefone} />
                    {lead.email && <InfoRow icon={<Mail className="h-4 w-4" />} label="Email" value={lead.email} />}
                    <InfoRow icon={<MapPin className="h-4 w-4" />} label="Região" value={regiaoNome(lead.regiao)} />
                    <InfoRow icon={<MessageCircle className="h-4 w-4" />} label="Responsável" value={canalNome(lead.canal)} />
                    {lead.tipo_imovel && <InfoRow label="Tipo de imóvel" value={lead.tipo_imovel} />}
                    {lead.faixa_valor && <InfoRow label="Faixa de valor" value={lead.faixa_valor} />}
                    {lead.creci && <InfoRow label="CRECI" value={lead.creci} />}
                    {lead.observacoes && (
                      <div>
                        <div className="text-muted-foreground text-xs uppercase tracking-wide mb-1">Observações</div>
                        <p className="whitespace-pre-wrap">{lead.observacoes}</p>
                      </div>
                    )}
                    <InfoRow label="Criado em" value={format(new Date(lead.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR })} />
                  </dl>
                )}

                <Separator />

                <div>
                  <Label className="text-xs uppercase tracking-wide text-muted-foreground">Mover para etapa</Label>
                  <Select value={lead.etapa} onValueChange={(v) => changeEtapa(v as LeadRow["etapa"])}>
                    <SelectTrigger className="mt-2"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {ETAPAS.map((e) => <SelectItem key={e.id} value={e.id}>{e.nome}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </TabsContent>

              <TabsContent value="notas" className="space-y-3 mt-4">
                <Textarea placeholder="Adicionar nota interna..." value={nota} onChange={(e) => setNota(e.target.value)} rows={3} />
                <Button onClick={postNote} variant="gold" size="sm" disabled={!nota.trim()}>
                  <MessageSquarePlus className="h-4 w-4" /> Adicionar nota
                </Button>
                <Separator />
                <div className="space-y-2">
                  {historico.filter((h) => h.acao === "nota").map((h) => {
                    const det = h.detalhe as { nota?: string } | null;
                    return (
                      <div key={h.id} className="bg-muted/40 rounded-md p-3 text-sm">
                        <div className="text-[11px] text-muted-foreground mb-1">
                          {format(new Date(h.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                        </div>
                        <p className="whitespace-pre-wrap">{det?.nota}</p>
                      </div>
                    );
                  })}
                  {historico.filter((h) => h.acao === "nota").length === 0 && (
                    <p className="text-sm text-muted-foreground text-center py-4">Sem notas ainda.</p>
                  )}
                </div>
              </TabsContent>

              <TabsContent value="historico" className="mt-4 space-y-2">
                {historico.map((h) => (
                  <div key={h.id} className="flex gap-3 text-sm border-l-2 border-gold/40 pl-3 py-1">
                    <div className="flex-1">
                      <div className="font-medium capitalize">{h.acao.replace(/_/g, " ")}</div>
                      <div className="text-[11px] text-muted-foreground">
                        {format(new Date(h.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                      </div>
                    </div>
                  </div>
                ))}
                {historico.length === 0 && (
                  <p className="text-sm text-muted-foreground text-center py-4">Sem histórico.</p>
                )}
              </TabsContent>
            </Tabs>
          </>
        ) : (
          <div className="py-12 text-center text-muted-foreground">Carregando…</div>
        )}
      </SheetContent>
    </Sheet>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs uppercase tracking-wide text-muted-foreground">{label}</Label>
      {children}
    </div>
  );
}

function InfoRow({ icon, label, value }: { icon?: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-start gap-2">
      {icon && <span className="text-muted-foreground mt-0.5">{icon}</span>}
      <div className="flex-1">
        <div className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</div>
        <div>{value}</div>
      </div>
    </div>
  );
}
