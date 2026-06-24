import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { CheckCircle2 } from "lucide-react";
import { formatBRL, type VendasTipo } from "@/lib/vendas-helpers";
import { listImoveisParaFechamento, fecharLeadVendas, type ImovelFechamentoOption } from "@/lib/fechamento.functions";

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  leadId: string;
  leadNome: string;
  tipo: VendasTipo; // 'compra' | 'locacao'
  onFechado?: (comissao: number) => void;
}

export function FecharLeadDialog({ open, onOpenChange, leadId, leadNome, tipo, onFechado }: Props) {
  const listFn = useServerFn(listImoveisParaFechamento);
  const fecharFn = useServerFn(fecharLeadVendas);

  const [busca, setBusca] = useState("");
  const [imovelId, setImovelId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["fechamento_imoveis_all"],
    enabled: open,
    queryFn: () => listFn({ data: {} }),
  });

  const itens = data?.items ?? [];
  const filtrados = useMemo(() => {
    const q = busca.trim().toLowerCase();
    if (!q) return itens.slice(0, 100);
    return itens
      .filter((i) =>
        (i.codigo ?? "").toLowerCase().includes(q) ||
        (i.bairro ?? "").toLowerCase().includes(q) ||
        (i.tipo ?? "").toLowerCase().includes(q),
      )
      .slice(0, 100);
  }, [itens, busca]);

  const imovelSel: ImovelFechamentoOption | null =
    itens.find((i) => i.id === imovelId) ?? null;

  const comissaoPreview = useMemo(() => {
    if (!imovelSel) return null;
    if (tipo === "compra") {
      const v = Number(imovelSel.valor_venda || 0);
      return v > 0 ? Math.round(v * 0.06 * 100) / 100 : null;
    } else {
      const v = Number(imovelSel.valor_aluguel || 0);
      return v > 0 ? Math.round(v * 100) / 100 : null;
    }
  }, [imovelSel, tipo]);

  async function confirmar() {
    if (!imovelId) {
      toast.error("Selecione um imóvel");
      return;
    }
    setSaving(true);
    try {
      const res = await fecharFn({ data: { lead_id: leadId, imovel_id: imovelId } });
      toast.success(`Lead fechado — comissão ${formatBRL(res.comissao)}`);
      onFechado?.(res.comissao);
      onOpenChange(false);
      setImovelId(null);
      setBusca("");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao fechar lead");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!saving) onOpenChange(o); }}>
      <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Fechar lead — {leadNome}</DialogTitle>
          <DialogDescription>
            Selecione o imóvel {tipo === "compra" ? "vendido" : "locado"} do portfólio para calcular a comissão automaticamente.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-2">
          <div>
            <Label>Buscar imóvel (código, bairro, tipo)</Label>
            <Input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Ex: AP203, Barra, casa" />
          </div>

          <div className="border rounded max-h-72 overflow-y-auto divide-y">
            {isLoading && <div className="p-3 text-sm text-muted-foreground">Carregando imóveis…</div>}
            {!isLoading && filtrados.length === 0 && (
              <div className="p-3 text-sm text-muted-foreground">Nenhum imóvel encontrado.</div>
            )}
            {filtrados.map((i) => {
              const valor = tipo === "compra" ? i.valor_venda : i.valor_aluguel;
              const sel = i.id === imovelId;
              const finLabel =
                i.finalidade === "venda" ? "Venda"
                : i.finalidade === "locacao" ? "Locação"
                : i.finalidade === "venda_locacao" ? "Venda+Locação"
                : i.finalidade;
              return (
                <button
                  key={i.id}
                  type="button"
                  onClick={() => setImovelId(i.id)}
                  className={`w-full text-left p-3 hover:bg-muted/50 transition ${sel ? "bg-gold/10 border-l-2 border-gold" : ""}`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <div className="font-medium text-sm truncate flex items-center gap-2">
                        <span>{i.codigo ?? "(sem código)"} — {i.tipo} {i.bairro ? `· ${i.bairro}` : ""}</span>
                        <span className="text-[10px] uppercase tracking-wide px-1.5 py-0.5 rounded bg-muted text-muted-foreground shrink-0">{finLabel}</span>
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {tipo === "compra" ? "Venda" : "Aluguel"}: {valor ? formatBRL(Number(valor)) : "—"}
                      </div>
                    </div>
                    {sel && <CheckCircle2 className="h-4 w-4 text-gold shrink-0" />}
                  </div>
                </button>
              );
            })}
          </div>

          {imovelSel && (
            <div className="border rounded-md p-3 bg-muted/30 space-y-1 text-sm">
              <div className="flex justify-between"><span className="text-muted-foreground">Imóvel</span><span className="font-medium">{imovelSel.codigo ?? imovelSel.id.slice(0, 8)}</span></div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">{tipo === "compra" ? "Valor de venda" : "Valor de aluguel"}</span>
                <span className="font-medium">{formatBRL(Number((tipo === "compra" ? imovelSel.valor_venda : imovelSel.valor_aluguel) || 0))}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Regra</span>
                <span className="font-medium">{tipo === "compra" ? "6% sobre venda" : "1 mês de aluguel"}</span>
              </div>
              <div className="flex justify-between text-base pt-1 border-t">
                <span className="font-semibold">Comissão</span>
                <span className="font-bold text-gold">{comissaoPreview != null ? formatBRL(comissaoPreview) : "—"}</span>
              </div>
              {comissaoPreview == null && (
                <div className="text-xs text-destructive pt-1">
                  Esse imóvel não tem {tipo === "compra" ? "valor de venda" : "valor de aluguel"} cadastrado.
                </div>
              )}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>Cancelar</Button>
          <Button variant="gold" onClick={confirmar} disabled={saving || !imovelId || comissaoPreview == null}>
            {saving ? "Fechando…" : "Confirmar fechamento"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
