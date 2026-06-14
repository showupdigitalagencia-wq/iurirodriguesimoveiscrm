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
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { MessageCircle } from "lucide-react";

type LeadOpt = { id: string; nome: string; telefone: string };
type RespOpt = { id: string; nome: string; canal: string };

function onlyDigits(s: string): string {
  return (s ?? "").replace(/\D+/g, "");
}

function buildWaUrl(opts: {
  tipo: "individual" | "institucional";
  leadNome: string;
  telefone: string;
  data: string;
  hora: string;
  local: string;
  corretor: string;
}): string {
  const { tipo, leadNome, telefone, data, hora, local, corretor } = opts;
  const [y, m, d] = data.split("-");
  const dataBR = `${d}/${m}/${y}`;
  const msg = tipo === "institucional"
    ? `Olá ${leadNome}! 😊 Você está convidado para uma REUNIÃO INSTITUCIONAL! 🏢✨ Com nosso Diretor Geral IURI RODRIGUES! 📅 Data: ${dataBR} 🕐 Hora: ${hora} 📍 Local/Link: ${local || "a definir"} Confirme sua presença! Iuri Rodrigues Imóveis`
    : `Olá ${leadNome}! 😊 Sua reunião foi agendada! 📅 Data: ${dataBR} 🕐 Hora: ${hora} 📍 Local/Link: ${local || "a definir"} 👤 Corretor: ${corretor} Iuri Rodrigues Imóveis`;
  const phone = onlyDigits(telefone);
  return `https://wa.me/${phone}?text=${encodeURIComponent(msg)}`;
}

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  defaultLeadId?: string | null;
  onCreated?: (id: string) => void;
}

export function ReuniaoFormDialog({ open, onOpenChange, defaultLeadId, onCreated }: Props) {
  const call = useServerFn(createReuniao);
  const [leads, setLeads] = useState<LeadOpt[]>([]);
  const [resps, setResps] = useState<RespOpt[]>([]);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    titulo: "",
    data: "",
    hora: "",
    duracao: 60,
    local: "",
    tipo: "individual" as "individual" | "institucional",
    descricao: "",
    lead_ids: new Set<string>(),
    resp_ids: new Set<string>(),
  });

  useEffect(() => {
    if (!open) return;
    supabase.from("leads").select("id, nome, telefone").order("created_at", { ascending: false }).limit(500)
      .then(({ data }) => setLeads((data as LeadOpt[]) ?? []));
    supabase.from("responsaveis").select("id, nome, canal").order("nome")
      .then(({ data }) => setResps((data as RespOpt[]) ?? []));
  }, [open]);

  useEffect(() => {
    if (open && defaultLeadId) {
      setForm((f) => ({ ...f, lead_ids: new Set([defaultLeadId]) }));
    }
    if (!open) {
      setForm({
        titulo: "", data: "", hora: "", duracao: 60, local: "",
        tipo: "individual", descricao: "",
        lead_ids: new Set<string>(), resp_ids: new Set<string>(),
      });
    }
  }, [open, defaultLeadId]);

  function toggle(set: Set<string>, id: string): Set<string> {
    const n = new Set(set);
    if (n.has(id)) n.delete(id); else n.add(id);
    return n;
  }

  async function submit() {
    if (!form.titulo.trim() || !form.data || !form.hora) {
      toast.error("Preencha título, data e hora");
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
          local: form.local || null,
          tipo: form.tipo,
          lead_ids: Array.from(form.lead_ids),
          responsavel_ids: Array.from(form.resp_ids),
        },
      });
      toast.success("Reunião agendada");
      onCreated?.(res.id);
      onOpenChange(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao agendar");
    } finally {
      setSaving(false);
    }
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

          <div>
            <Label>Local ou link</Label>
            <Input value={form.local} onChange={(e) => setForm({ ...form, local: e.target.value })} placeholder="Endereço, sala ou URL da videochamada" />
          </div>

          <div>
            <Label>Tipo</Label>
            <RadioGroup value={form.tipo} onValueChange={(v) => setForm({ ...form, tipo: v as typeof form.tipo })} className="flex gap-4 mt-2">
              <label className="flex items-center gap-2 cursor-pointer">
                <RadioGroupItem value="individual" /> <span>Individual</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <RadioGroupItem value="institucional" /> <span>Institucional</span>
              </label>
            </RadioGroup>
          </div>

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
            <Button variant="gold" onClick={submit} disabled={saving}>{saving ? "Salvando..." : "Agendar"}</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
