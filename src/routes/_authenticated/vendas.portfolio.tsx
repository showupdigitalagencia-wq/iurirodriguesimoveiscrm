import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { FotosThumbs, useFotosUrls } from "@/components/admin/FotosManager";
import { ChaveActions, ChaveStatusBadge, useAtrasoHoras } from "@/components/admin/ChaveActions";
import { Bed, Bath, Car, Maximize2, MapPin, Building2, X, ExternalLink, Share2 } from "lucide-react";
import { buildImovelShareMessage, openWhatsAppShare } from "@/lib/imovel-share";
import type { Database } from "@/integrations/supabase/types";

type Imovel = Database["public"]["Views"]["imoveis_portfolio"]["Row"];

export const Route = createFileRoute("/_authenticated/vendas/portfolio")({
  validateSearch: (search: Record<string, unknown>) => ({
    finalidade: (search.finalidade as string) ?? undefined,
  }),
  component: PortfolioPage,
});

const TIPO_LABEL: Record<string, string> = {
  apartamento: "Apartamento",
  casa: "Casa",
  comercial: "Comercial",
  terreno: "Terreno",
  cobertura: "Cobertura",
  studio: "Studio",
  sala: "Sala Comercial",
};

const FINALIDADE_LABEL: Record<string, string> = {
  locacao: "Locação",
  venda: "Venda",
  ambos: "Locação e Venda",
};

const STATUS_LABEL: Record<string, string> = {
  disponivel: "Disponível",
  disponivel_locacao: "Disponível p/ Locação",
  disponivel_venda: "Disponível p/ Venda",
};

function formatBRL(v: number | null | undefined) {
  if (v == null) return "—";
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 }).format(Number(v));
}

function PortfolioPage() {
  const search = Route.useSearch();
  const [bairro, setBairro] = useState("");
  const [tipo, setTipo] = useState<string>("todos");
  const [finalidade, setFinalidade] = useState<string>(
    search.finalidade === "venda" || search.finalidade === "locacao" ? search.finalidade : "todos",
  );
  const [valorMin, setValorMin] = useState("");
  const [valorMax, setValorMax] = useState("");
  const [quartos, setQuartos] = useState<string>("todos");
  const [selected, setSelected] = useState<Imovel | null>(null);

  const { data: imoveis = [], isLoading } = useQuery({
    queryKey: ["imoveis_portfolio"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("imoveis_portfolio")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Imovel[];
    },
  });

  const filtrados = useMemo(() => {
    return imoveis.filter((i) => {
      if (bairro.trim()) {
        const q = bairro.toLowerCase();
        const hay = `${i.bairro ?? ""} ${i.cidade ?? ""} ${i.rua ?? ""}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      if (tipo !== "todos" && i.tipo !== tipo) return false;
      if (finalidade !== "todos") {
        const fin = i.finalidade ?? "locacao";
        if (finalidade === "locacao" && !(fin === "locacao" || fin === "ambos")) return false;
        if (finalidade === "venda" && !(fin === "venda" || fin === "ambos")) return false;
      }
      const valor = finalidade === "venda" ? i.valor_venda : i.valor_aluguel ?? i.valor_venda;
      if (valorMin && Number(valor ?? 0) < Number(valorMin)) return false;
      if (valorMax && Number(valor ?? 0) > Number(valorMax)) return false;
      if (quartos !== "todos") {
        const q = Number(quartos);
        if (q === 4) {
          if ((i.quartos ?? 0) < 4) return false;
        } else if ((i.quartos ?? 0) !== q) return false;
      }
      return true;
    });
  }, [imoveis, bairro, tipo, finalidade, valorMin, valorMax, quartos]);

  const tipos = useMemo(() => {
    const s = new Set<string>();
    imoveis.forEach((i) => i.tipo && s.add(i.tipo));
    return Array.from(s);
  }, [imoveis]);

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg md:text-xl font-semibold">Portfólio de Imóveis</h2>
        <p className="text-xs md:text-sm text-muted-foreground">
          Imóveis disponíveis para oferecer aos seus leads. {filtrados.length} de {imoveis.length} imóveis.
        </p>
      </div>

      <Card>
        <CardContent className="p-3 md:p-4 grid grid-cols-2 md:grid-cols-6 gap-3">
          <div className="col-span-2 md:col-span-2">
            <Label className="text-xs">Região / Bairro</Label>
            <Input placeholder="Ex: Barra, Recreio..." value={bairro} onChange={(e) => setBairro(e.target.value)} />
          </div>
          <div>
            <Label className="text-xs">Tipo</Label>
            <Select value={tipo} onValueChange={setTipo}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos</SelectItem>
                {tipos.map((t) => <SelectItem key={t} value={t}>{TIPO_LABEL[t] ?? t}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">Finalidade</Label>
            <Select value={finalidade} onValueChange={setFinalidade}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos</SelectItem>
                <SelectItem value="locacao">Locação</SelectItem>
                <SelectItem value="venda">Venda</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">Quartos</Label>
            <Select value={quartos} onValueChange={setQuartos}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos</SelectItem>
                <SelectItem value="1">1</SelectItem>
                <SelectItem value="2">2</SelectItem>
                <SelectItem value="3">3</SelectItem>
                <SelectItem value="4">4+</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">Valor mín. (R$)</Label>
            <Input type="number" inputMode="numeric" placeholder="0" value={valorMin} onChange={(e) => setValorMin(e.target.value)} />
          </div>
          <div className="col-span-2 md:col-span-1">
            <Label className="text-xs">Valor máx. (R$)</Label>
            <Input type="number" inputMode="numeric" placeholder="∞" value={valorMax} onChange={(e) => setValorMax(e.target.value)} />
          </div>
          {(bairro || tipo !== "todos" || finalidade !== "todos" || valorMin || valorMax || quartos !== "todos") && (
            <div className="col-span-2 md:col-span-6">
              <Button variant="ghost" size="sm" onClick={() => {
                setBairro(""); setTipo("todos"); setFinalidade("todos"); setValorMin(""); setValorMax(""); setQuartos("todos");
              }}>Limpar filtros</Button>
            </div>
          )}
        </CardContent>
      </Card>

      {isLoading ? (
        <div className="text-sm text-muted-foreground p-6 text-center">Carregando imóveis...</div>
      ) : filtrados.length === 0 ? (
        <div className="text-sm text-muted-foreground p-6 text-center border rounded-lg">
          Nenhum imóvel encontrado com esses filtros.
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 md:gap-4">
          {filtrados.map((i) => <ImovelCard key={i.id} imovel={i} onClick={() => setSelected(i)} />)}
        </div>
      )}

      <ImovelDialog imovel={selected} onClose={() => setSelected(null)} />
    </div>
  );
}

function ImovelCard({ imovel, onClick }: { imovel: Imovel; onClick: () => void }) {
  const urls = useFotosUrls((imovel.fotos ?? []).slice(0, 1));
  const atrasoHoras = useAtrasoHoras();
  const fin = imovel.finalidade ?? "locacao";
  const mostraAluguel = fin === "locacao" || fin === "ambos";
  const mostraVenda = fin === "venda" || fin === "ambos";
  const chaveLite = {
    id: imovel.id as string,
    chave_com_id: (imovel.chave_com_id as string | null) ?? null,
    chave_retirada_em: (imovel.chave_retirada_em as string | null) ?? null,
    chave_foto_atual: (imovel.chave_foto_atual as string | null) ?? null,
  };

  return (
    <Card className="overflow-hidden cursor-pointer hover:shadow-md transition group" onClick={onClick}>
      <div className="aspect-[4/3] bg-muted relative overflow-hidden">
        {urls[0] ? (
          <img src={urls[0]} alt={imovel.codigo ?? "imóvel"} className="w-full h-full object-cover group-hover:scale-105 transition" loading="lazy" />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-muted-foreground">
            <Building2 className="h-12 w-12" />
          </div>
        )}
        <div className="absolute top-2 left-2 flex gap-1 flex-wrap">
          <Badge variant="secondary" className="text-[10px]">{STATUS_LABEL[imovel.status ?? ""] ?? imovel.status}</Badge>
          {imovel.gestao_patrimonio && (
            <Badge className="text-[10px] bg-gold/90 text-black hover:bg-gold">Gestão de Patrimônio</Badge>
          )}
        </div>
        {imovel.codigo && (
          <div className="absolute top-2 right-2 bg-black/60 text-white text-[10px] px-2 py-0.5 rounded">
            {imovel.codigo}
          </div>
        )}
      </div>
      <CardContent className="p-3 space-y-2">
        <div>
          <div className="text-xs text-muted-foreground flex items-center gap-1">
            <MapPin className="h-3 w-3 shrink-0" />
            <span className="truncate">{[imovel.bairro, imovel.cidade].filter(Boolean).join(" — ") || "—"}</span>
          </div>
          <div className="text-sm font-medium truncate">{TIPO_LABEL[imovel.tipo ?? ""] ?? imovel.tipo} · {FINALIDADE_LABEL[fin] ?? fin}</div>
        </div>
        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          {imovel.quartos != null && <span className="flex items-center gap-1"><Bed className="h-3 w-3" />{imovel.quartos}</span>}
          {imovel.banheiros != null && <span className="flex items-center gap-1"><Bath className="h-3 w-3" />{imovel.banheiros}</span>}
          {imovel.vagas != null && <span className="flex items-center gap-1"><Car className="h-3 w-3" />{imovel.vagas}</span>}
          {imovel.area_m2 != null && <span className="flex items-center gap-1"><Maximize2 className="h-3 w-3" />{imovel.area_m2}m²</span>}
        </div>
        <div className="space-y-0.5 pt-1 border-t">
          {mostraAluguel && (
            <div className="text-sm font-semibold text-emerald-700 dark:text-emerald-400">
              {formatBRL(imovel.valor_aluguel)} <span className="text-[10px] font-normal text-muted-foreground">/ mês</span>
            </div>
          )}
          {mostraVenda && (
            <div className="text-sm font-semibold text-teal-700 dark:text-teal-400">
              {formatBRL(imovel.valor_venda)} <span className="text-[10px] font-normal text-muted-foreground">venda</span>
            </div>
          )}
        </div>
        <div className="pt-2 border-t" onClick={(e) => e.stopPropagation()}>
          <ChaveStatusBadge imovel={chaveLite} atrasoHoras={atrasoHoras} />
        </div>
      </CardContent>
    </Card>
  );
}

function ImovelDialog({ imovel, onClose }: { imovel: Imovel | null; onClose: () => void }) {
  const urls = useFotosUrls(imovel?.fotos ?? []);
  const { data: captadorNome } = useQuery({
    queryKey: ["captador-nome", imovel?.captador_id],
    queryFn: async () => {
      if (!imovel?.captador_id) return null;
      const { data } = await supabase.from("profiles").select("nome").eq("id", imovel.captador_id).maybeSingle();
      return data?.nome ?? null;
    },
    enabled: !!imovel?.captador_id,
  });
  if (!imovel) return null;
  const fin = imovel.finalidade ?? "locacao";

  return (
    <Dialog open={!!imovel} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {imovel.codigo && <Badge variant="outline">{imovel.codigo}</Badge>}
            {TIPO_LABEL[imovel.tipo ?? ""] ?? imovel.tipo} · {FINALIDADE_LABEL[fin] ?? fin}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          {urls.length > 0 && (
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
              {urls.map((u, idx) => (
                <img key={idx} src={u} alt={`foto ${idx + 1}`} className="aspect-[4/3] w-full object-cover rounded border" loading="lazy" />
              ))}
            </div>
          )}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
            <div><div className="text-xs text-muted-foreground">Quartos</div><div>{imovel.quartos ?? "—"}</div></div>
            <div><div className="text-xs text-muted-foreground">Banheiros</div><div>{imovel.banheiros ?? "—"}</div></div>
            <div><div className="text-xs text-muted-foreground">Vagas</div><div>{imovel.vagas ?? "—"}</div></div>
            <div><div className="text-xs text-muted-foreground">Área</div><div>{imovel.area_m2 ? `${imovel.area_m2} m²` : "—"}</div></div>
          </div>
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <div className="text-xs text-muted-foreground">Aluguel</div>
              <div className="font-semibold">{formatBRL(imovel.valor_aluguel)}</div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground">Venda</div>
              <div className="font-semibold">{formatBRL(imovel.valor_venda)}</div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground">Condomínio</div>
              <div>{formatBRL(imovel.condominio)}</div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground">IPTU</div>
              <div>{formatBRL(imovel.iptu)}</div>
            </div>
          </div>
          <div className="text-sm">
            <div className="text-xs text-muted-foreground mb-1">Endereço</div>
            <div>
              {[imovel.rua, imovel.numero].filter(Boolean).join(", ")}
              {imovel.complemento ? ` — ${imovel.complemento}` : ""}
              {imovel.bairro ? `, ${imovel.bairro}` : ""}
              {imovel.cidade ? ` — ${imovel.cidade}` : ""}
              {imovel.cep ? ` · CEP ${imovel.cep}` : ""}
            </div>
          </div>
          <div className="flex flex-wrap gap-3 text-sm">
            <div>
              <div className="text-xs text-muted-foreground">Captador</div>
              <div>{captadorNome ?? "—"}</div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground">Gestão de Patrimônio</div>
              <div>{imovel.gestao_patrimonio ? "Sim" : "Não"}</div>
            </div>
          </div>
          <div className="border-t pt-3">
            <div className="text-xs text-muted-foreground mb-2">Chave do imóvel</div>
            <ChaveActions
              imovel={{
                id: imovel.id as string,
                chave_com_id: (imovel.chave_com_id as string | null) ?? null,
                chave_retirada_em: (imovel.chave_retirada_em as string | null) ?? null,
                chave_foto_atual: (imovel.chave_foto_atual as string | null) ?? null,
              }}
            />
          </div>
          {imovel.observacoes && (
            <div className="text-sm">
              <div className="text-xs text-muted-foreground mb-1">Observações</div>
              <div className="whitespace-pre-wrap">{imovel.observacoes}</div>
            </div>
          )}
          <div className="flex flex-wrap gap-2">
            {imovel.vitrine_url && (
              <Button
                asChild
                size="sm"
                variant="outline"
                className="h-7 px-2 gap-1 text-xs border-gold/40 text-gold hover:bg-gold/10 hover:text-gold"
              >
                <a href={imovel.vitrine_url} target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="h-3 w-3" />
                  Vitrine
                </a>
              </Button>
            )}
            <Button
              size="sm"
              variant="outline"
              className="h-7 px-2 gap-1 text-xs border-emerald-500/40 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-500/10"
              onClick={() => {
                const msg = buildImovelShareMessage(imovel as never, urls);
                openWhatsAppShare(msg);
              }}
            >
              <Share2 className="h-3 w-3" />
              Compartilhar
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
