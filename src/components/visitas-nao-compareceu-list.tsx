import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { MessageCircle, CalendarX2, CalendarCheck2 } from "lucide-react";

export type VisitaStatusFilter = "nao_compareceu" | "realizada";

export type NaoCompareceuItem = {
  visita_id: string;
  data_inicio: string;
  endereco: string | null;
  observacoes: string | null;
  confirmada_em: string | null;
  lead_id: string;
  lead_nome: string;
  lead_telefone: string;
  lead_tipo: string;
  lead_etapa: string;
  imovel_id: string | null;
  imovel_codigo: string | null;
  imovel_endereco: string | null;
  corretor_id: string;
  corretor_nome: string | null;
};

type Props = {
  from: string;
  to: string;
  scope?: "me" | "team" | "user" | "all" | "auto";
  targetId?: string | null;
  showPeriodInputs?: boolean;
  onLeadClick?: (leadId: string) => void;
  status?: VisitaStatusFilter;
};

function whatsappUrl(tel: string, msg: string) {
  const cleaned = (tel ?? "").replace(/\D/g, "");
  if (!cleaned) return null;
  const num = cleaned.length <= 11 ? `55${cleaned}` : cleaned;
  return `https://wa.me/${num}?text=${encodeURIComponent(msg)}`;
}

function fmtDateTime(iso: string) {
  const d = new Date(iso);
  return `${d.toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" })} ${d.toLocaleTimeString("pt-BR", { timeZone: "America/Sao_Paulo", hour: "2-digit", minute: "2-digit" })}`;
}

export function VisitasNaoCompareceuList({ from, to, scope = "auto", targetId, showPeriodInputs = false, onLeadClick, status = "nao_compareceu" }: Props) {
  const [items, setItems] = useState<NaoCompareceuItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const [localFrom, setLocalFrom] = useState(from.slice(0, 10));
  const [localTo, setLocalTo] = useState(to.slice(0, 10));

  const effFrom = useMemo(() => (showPeriodInputs ? new Date(`${localFrom}T00:00:00`).toISOString() : from), [showPeriodInputs, localFrom, from]);
  const effTo = useMemo(() => (showPeriodInputs ? new Date(`${localTo}T23:59:59`).toISOString() : to), [showPeriodInputs, localTo, to]);

  useEffect(() => {
    let alive = true;
    setLoading(true); setErr(null);
    (async () => {
      const { data, error } = await supabase.rpc("list_visitas_nao_compareceu", {
        _from: effFrom, _to: effTo, _scope: scope, _target_id: targetId || undefined, _status: status,
      });
      if (!alive) return;
      if (error) { setErr(error.message); setItems([]); }
      else {
        const payload = data as unknown as { items: NaoCompareceuItem[] } | null;
        setItems(payload?.items ?? []);
      }
      setLoading(false);
    })();
    return () => { alive = false; };
  }, [effFrom, effTo, scope, targetId, status]);

  const isRealizada = status === "realizada";
  const EmptyIcon = isRealizada ? CalendarCheck2 : CalendarX2;
  const emptyMsg = isRealizada
    ? 'Nenhuma visita marcada como "Compareceu" no período.'
    : 'Nenhuma visita marcada como "Não Compareceu" no período.';
  const buildMsg = (nome: string, dt: string) => isRealizada
    ? `Olá ${nome}! Foi ótimo te receber na visita de ${dt}. Posso te ajudar com os próximos passos?`
    : `Olá ${nome}! Notamos que não conseguimos nos encontrar na visita marcada para ${dt}. Posso te ajudar a reagendar?`;

  return (
    <div className="space-y-3">
      {showPeriodInputs && (
        <div className="flex gap-2 items-end flex-wrap">
          <div><Label className="text-xs">De</Label><Input type="date" value={localFrom} onChange={(e) => setLocalFrom(e.target.value)} className="mt-1 w-40" /></div>
          <div><Label className="text-xs">Até</Label><Input type="date" value={localTo} onChange={(e) => setLocalTo(e.target.value)} className="mt-1 w-40" /></div>
        </div>
      )}

      {err && <div className="bg-destructive/10 text-destructive border border-destructive/30 rounded-md p-3 text-sm">{err}</div>}
      {loading && <div className="text-sm text-muted-foreground animate-pulse">Carregando visitas...</div>}

      {!loading && items.length === 0 && (
        <div className="border rounded-lg p-8 text-center text-muted-foreground text-sm flex flex-col items-center gap-2">
          <EmptyIcon className="h-6 w-6 opacity-50" />
          {emptyMsg}
        </div>
      )}

      {!loading && items.length > 0 && (
        <div className="rounded-md border overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr className="text-left">
                <th className="p-3">Lead</th>
                <th className="p-3">Telefone</th>
                <th className="p-3">Data/hora da visita</th>
                <th className="p-3">Imóvel</th>
                <th className="p-3">Corretor</th>
                <th className="p-3 text-right">Ações</th>
              </tr>
            </thead>
            <tbody>
              {items.map((it) => {
                const msg = buildMsg(it.lead_nome, fmtDateTime(it.data_inicio));
                const wa = whatsappUrl(it.lead_telefone, msg);
                const imovelLabel = it.imovel_codigo
                  ? `${it.imovel_codigo}${it.imovel_endereco ? ` — ${it.imovel_endereco}` : ""}`
                  : it.endereco || it.imovel_endereco || "—";
                return (
                  <tr key={it.visita_id} className="border-t hover:bg-muted/30">
                    <td className="p-3 font-medium">
                      {onLeadClick ? (
                        <button className="underline-offset-2 hover:underline" onClick={() => onLeadClick(it.lead_id)}>{it.lead_nome}</button>
                      ) : it.lead_nome}
                    </td>
                    <td className="p-3">{it.lead_telefone || "—"}</td>
                    <td className="p-3">{fmtDateTime(it.data_inicio)}</td>
                    <td className="p-3 max-w-[280px] truncate" title={imovelLabel}>{imovelLabel}</td>
                    <td className="p-3">{it.corretor_nome || "—"}</td>
                    <td className="p-3 text-right">
                      {wa ? (
                        <Button asChild size="sm" variant="outline" className="gap-1">
                          <a href={wa} target="_blank" rel="noopener noreferrer">
                            <MessageCircle className="h-3.5 w-3.5" /> WhatsApp
                          </a>
                        </Button>
                      ) : (
                        <span className="text-xs text-muted-foreground">sem telefone</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
