import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { REGIOES, ETAPAS, etapaColor, type LeadEtapa } from "@/lib/lead-helpers";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Plus } from "lucide-react";

type Resp = { id: string; nome: string; canal: string };

interface Props {
  mode: "lead" | "corretor";
  isAdmin: boolean;
  responsaveis: Resp[];
  onCreated: () => void;
  triggerLabel?: string;
}

const REGIAO_TO_CANAL: Record<string, string> = {
  barra_da_tijuca: "robson",
  recreio: "fabiola",
  belford_roxo: "renata",
  nilopolis: "denise",
  mesquita: "denise",
  jacarepagua: "robson",
  zona_sul: "robson",
  zona_norte: "renata",
  zona_oeste: "fabiola",
  centro: "robson",
  outras: "robson",
};

export function CreateLeadDialog({ mode, isAdmin, responsaveis, onCreated, triggerLabel }: Props) {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    nome: "", email: "", telefone: "",
    regiao: "barra_da_tijuca",
    responsavel_id: "",
    observacoes: "",
    ja_corretor: "",
    creci_ativo: "",
    numero_creci: "",
    disponibilidade_regiao: "",
    disponibilidade_video: "",
    possui_veiculo: "",
  });

  function update<K extends keyof typeof form>(k: K, v: typeof form[K]) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  async function submit() {
    if (!form.nome.trim() || !form.telefone.trim()) {
      toast.error("Nome e telefone são obrigatórios");
      return;
    }
    setSaving(true);
    try {
      // resolve responsavel/canal
      let responsavel_id: string | null = form.responsavel_id || null;
      let canal: string;
      if (isAdmin && responsavel_id) {
        canal = responsaveis.find((r) => r.id === responsavel_id)?.canal ?? REGIAO_TO_CANAL[form.regiao] ?? "robson";
      } else if (!isAdmin) {
        // executive: lookup own responsavel via profile
        const { data: u } = await supabase.auth.getUser();
        const uid = u.user?.id;
        if (uid) {
          const { data: p } = await supabase.from("profiles").select("responsavel_id").eq("id", uid).maybeSingle();
          responsavel_id = (p?.responsavel_id as string | null) ?? null;
        }
        canal = responsavel_id ? (responsaveis.find((r) => r.id === responsavel_id)?.canal ?? "robson") : "robson";
      } else {
        canal = REGIAO_TO_CANAL[form.regiao] ?? "robson";
        const r = responsaveis.find((x) => x.canal === canal);
        responsavel_id = r?.id ?? null;
      }

      const dados_corretor = mode === "corretor" ? {
        ja_corretor: form.ja_corretor || null,
        creci_ativo: form.creci_ativo || null,
        numero_creci: form.numero_creci || null,
        [`disponibilidade_${form.regiao === "recreio" ? "recreio" : form.regiao === "belford_roxo" ? "belford" : (form.regiao === "mesquita" || form.regiao === "nilopolis") ? "mesquita" : "barra"}`]: form.disponibilidade_regiao || null,
        disponibilidade_video: form.disponibilidade_video || null,
        possui_veiculo: form.possui_veiculo || null,
      } : null;

      const { error } = await supabase.from("leads").insert({
        nome: form.nome.trim(),
        telefone: form.telefone.replace(/\D/g, ""),
        email: form.email.trim() || null,
        regiao: form.regiao as never,
        canal: canal as never,
        responsavel_id,
        is_corretor: mode === "corretor",
        observacoes: form.observacoes.trim() || null,
        origem: mode === "corretor" ? "cadastro_manual_corretor" : "cadastro_manual",
        dados_corretor: dados_corretor as never,
      });
      if (error) throw error;
      toast.success(mode === "corretor" ? "Corretor cadastrado" : "Lead cadastrado");
      setOpen(false);
      setForm({
        nome: "", email: "", telefone: "", regiao: "barra_da_tijuca", responsavel_id: "",
        observacoes: "", ja_corretor: "", creci_ativo: "", numero_creci: "",
        disponibilidade_regiao: "", disponibilidade_video: "", possui_veiculo: "",
      });
      onCreated();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao cadastrar");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="gold" className="h-11 md:h-10">
          <Plus className="h-4 w-4" /> {triggerLabel ?? (mode === "corretor" ? "Cadastrar Corretor" : "Cadastrar Lead")}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{mode === "corretor" ? "Cadastrar novo corretor" : "Cadastrar novo lead"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 py-2">
          <div><Label>Nome completo *</Label><Input value={form.nome} onChange={(e) => update("nome", e.target.value)} /></div>
          <div className="grid grid-cols-2 gap-2">
            <div><Label>Email</Label><Input type="email" value={form.email} onChange={(e) => update("email", e.target.value)} /></div>
            <div><Label>Telefone *</Label><Input value={form.telefone} onChange={(e) => update("telefone", e.target.value)} /></div>
          </div>
          <div>
            <Label>Região</Label>
            <Select value={form.regiao} onValueChange={(v) => update("regiao", v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{REGIOES.map((r) => <SelectItem key={r.id} value={r.id}>{r.nome}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          {isAdmin && (
            <div>
              <Label>Responsável</Label>
              <Select value={form.responsavel_id} onValueChange={(v) => update("responsavel_id", v)}>
                <SelectTrigger><SelectValue placeholder="Automático pela região" /></SelectTrigger>
                <SelectContent>{responsaveis.map((r) => <SelectItem key={r.id} value={r.id}>{r.nome}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          )}

          {mode === "corretor" ? (
            <>
              <div>
                <Label>Já atua como corretor?</Label>
                <Select value={form.ja_corretor} onValueChange={(v) => update("ja_corretor", v)}>
                  <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Sim, credenciado">Sim, credenciado</SelectItem>
                    <SelectItem value="Ainda não">Ainda não</SelectItem>
                    <SelectItem value="Em processo">Em processo</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label>CRECI ativo?</Label>
                  <Select value={form.creci_ativo} onValueChange={(v) => update("creci_ativo", v)}>
                    <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Sim">Sim</SelectItem>
                      <SelectItem value="Não">Não</SelectItem>
                      <SelectItem value="Em andamento">Em andamento</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div><Label>Número do CRECI</Label><Input value={form.numero_creci} onChange={(e) => update("numero_creci", e.target.value)} /></div>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <Label className="text-xs">Disp. região</Label>
                  <Select value={form.disponibilidade_regiao} onValueChange={(v) => update("disponibilidade_regiao", v)}>
                    <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                    <SelectContent><SelectItem value="Sim">Sim</SelectItem><SelectItem value="Não">Não</SelectItem></SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs">Disp. video</Label>
                  <Select value={form.disponibilidade_video} onValueChange={(v) => update("disponibilidade_video", v)}>
                    <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                    <SelectContent><SelectItem value="Sim">Sim</SelectItem><SelectItem value="Não">Não</SelectItem></SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs">Veículo</Label>
                  <Select value={form.possui_veiculo} onValueChange={(v) => update("possui_veiculo", v)}>
                    <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                    <SelectContent><SelectItem value="Sim">Sim</SelectItem><SelectItem value="Não">Não</SelectItem></SelectContent>
                  </Select>
                </div>
              </div>
            </>
          ) : (
            <div><Label>Observações</Label><Textarea rows={4} value={form.observacoes} onChange={(e) => update("observacoes", e.target.value)} /></div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
          <Button variant="gold" onClick={submit} disabled={saving}>{saving ? "Salvando..." : "Cadastrar"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
