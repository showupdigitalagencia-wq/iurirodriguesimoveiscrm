import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { MessageCircle, ClipboardList } from "lucide-react";
import type { Database } from "@/integrations/supabase/types";

type Contrato = Database["public"]["Tables"]["contratos"]["Row"];
type Pagamento = {
  id: string; contrato_id: string; mes_referencia: string;
  valor_previsto: number; valor_pago: number | null;
  multa: number | null; juros: number | null;
  status: "pago" | "atrasado" | "pendente" | "inadimplente";
};
type Cobranca = {
  id: string; contrato_id: string; canal: string; mensagem: string | null; created_at: string;
};

export const Route = createFileRoute("/_authenticated/admin/inadimplentes")({
  component: InadimplentesPage,
});

function formatBRL(v: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v || 0);
}
function onlyDigits(s: string | null | undefined) {
  return (s || "").replace(/\D/g, "");
}

function InadimplentesPage() {
  const qc = useQueryClient();
  const [openCob, setOpenCob] = useState<Contrato | null>(null);

  const { data: contratos = [] } = useQuery({
    queryKey: ["contratos_inad"],
    queryFn: async () => {
      const { data, error } = await supabase.from("contratos").select("*");
      if (error) throw error;
      return data as Contrato[];
    },
  });
  const { data: pagamentos = [] } = useQuery({
    queryKey: ["pagamentos_inad"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("pagamentos").select("*").in("status", ["atrasado", "inadimplente"]);
      if (error) throw error;
      return (data ?? []) as Pagamento[];
    },
  });
  const { data: cobrancas = [] } = useQuery({
    queryKey: ["cobrancas_all"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("cobrancas").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Cobranca[];
    },
  });

  const inadimplentes = useMemo(() => {
    const map = new Map<string, { contrato: Contrato; aberto: number; meses: Pagamento[]; diasAtraso: number }>();
    const hoje = Date.now();
    for (const p of pagamentos) {
      const c = contratos.find((x) => x.id === p.contrato_id);
      if (!c) continue;
      const dia = Math.min(c.dia_vencimento || 10, 28);
      const [y, m] = p.mes_referencia.split("-").map(Number);
      const venc = new Date(y, m - 1, dia).getTime();
      const dias = Math.max(0, Math.floor((hoje - venc) / 86400000));
      const aberto = Number(p.valor_previsto || 0) - Number(p.valor_pago || 0) + Number(p.multa || 0) + Number(p.juros || 0);
      const cur = map.get(c.id) || { contrato: c, aberto: 0, meses: [], diasAtraso: 0 };
      cur.aberto += aberto;
      cur.meses.push(p);
      cur.diasAtraso = Math.max(cur.diasAtraso, dias);
      map.set(c.id, cur);
    }
    return Array.from(map.values()).sort((a, b) => b.diasAtraso - a.diasAtraso);
  }, [pagamentos, contratos]);

  function whatsappLink(c: Contrato, aberto: number, dias: number) {
    const fone = onlyDigits(c.locatario_telefone);
    if (!fone) { toast.error("Locatário sem telefone"); return null; }
    const num = fone.startsWith("55") ? fone : "55" + fone;
    const msg = encodeURIComponent(
      `Olá ${c.locatario_nome}, identificamos pendência de ${formatBRL(aberto)} ` +
      `referente ao aluguel (${dias} dia${dias === 1 ? "" : "s"} de atraso). ` +
      `Poderia regularizar? Qualquer dúvida, estamos à disposição.`
    );
    return `https://wa.me/${num}?text=${msg}`;
  }

  async function registrarCobranca(contrato: Contrato, canal: string, mensagem: string) {
    const { data: ud } = await supabase.auth.getUser();
    const { error } = await (supabase as any).from("cobrancas").insert({
      contrato_id: contrato.id, canal, mensagem: mensagem || null, realizada_por: ud.user?.id,
    });
    if (error) { toast.error(error.message); return; }
    toast.success("Cobrança registrada");
    qc.invalidateQueries({ queryKey: ["cobrancas_all"] });
  }

  return (
    <div className="space-y-4">
      <div className="text-sm text-muted-foreground">
        {inadimplentes.length} locatário{inadimplentes.length === 1 ? "" : "s"} com pendência
      </div>

      {inadimplentes.length === 0 ? (
        <Card><CardContent className="p-8 text-center text-muted-foreground">Nenhum inadimplente. 🎉</CardContent></Card>
      ) : (
        <div className="grid gap-3">
          {inadimplentes.map(({ contrato: c, aberto, meses, diasAtraso }) => {
            const link = whatsappLink(c, aberto, diasAtraso);
            const hist = cobrancas.filter((x) => x.contrato_id === c.id);
            return (
              <Card key={c.id}>
                <CardContent className="p-4 space-y-3">
                  <div className="flex justify-between items-start gap-2 flex-wrap">
                    <div className="min-w-0">
                      <div className="font-semibold">{c.locatario_nome}</div>
                      <div className="text-xs text-muted-foreground">{c.locatario_telefone || "Sem telefone"}</div>
                    </div>
                    <Badge className="bg-rose-500/10 text-rose-700 dark:text-rose-400">
                      {diasAtraso} dia{diasAtraso === 1 ? "" : "s"} de atraso
                    </Badge>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div><span className="text-muted-foreground">Em aberto:</span> <strong>{formatBRL(aberto)}</strong></div>
                    <div><span className="text-muted-foreground">Meses:</span> {meses.length}</div>
                  </div>
                  <div className="flex gap-2 flex-wrap">
                    <Button
                      size="sm"
                      onClick={() => {
                        if (!link) return;
                        window.open(link, "_blank");
                        registrarCobranca(c, "whatsapp", "Mensagem WhatsApp de cobrança");
                      }}
                      disabled={!link}
                    >
                      <MessageCircle className="h-4 w-4 mr-1" /> WhatsApp
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => setOpenCob(c)}>
                      <ClipboardList className="h-4 w-4 mr-1" /> Registrar cobrança
                    </Button>
                  </div>
                  {hist.length > 0 && (
                    <div className="text-xs border-t pt-2 space-y-1">
                      <div className="font-medium">Histórico ({hist.length})</div>
                      {hist.slice(0, 3).map((h) => (
                        <div key={h.id} className="text-muted-foreground">
                          {new Date(h.created_at).toLocaleString("pt-BR")} · {h.canal}{h.mensagem ? ` — ${h.mensagem}` : ""}
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <CobrancaDialog
        contrato={openCob}
        onClose={() => setOpenCob(null)}
        onSave={async (canal, msg) => {
          if (openCob) await registrarCobranca(openCob, canal, msg);
          setOpenCob(null);
        }}
      />
    </div>
  );
}

function CobrancaDialog({ contrato, onClose, onSave }: {
  contrato: Contrato | null; onClose: () => void; onSave: (canal: string, msg: string) => void;
}) {
  const [canal, setCanal] = useState("whatsapp");
  const [msg, setMsg] = useState("");
  return (
    <Dialog open={!!contrato} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>Registrar cobrança</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>Canal</Label>
            <Select value={canal} onValueChange={setCanal}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="whatsapp">WhatsApp</SelectItem>
                <SelectItem value="telefone">Telefone</SelectItem>
                <SelectItem value="email">E-mail</SelectItem>
                <SelectItem value="presencial">Presencial</SelectItem>
                <SelectItem value="outro">Outro</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Mensagem / observação</Label>
            <Textarea value={msg} onChange={(e) => setMsg(e.target.value)} rows={3} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={() => { onSave(canal, msg); setMsg(""); }}>Salvar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
