import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

function startOfToday(): string {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
}
function endOfToday(): string {
  const d = new Date();
  d.setHours(23, 59, 59, 999);
  return d.toISOString();
}
function todayDateStr(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function useUserId() {
  const [uid, setUid] = useState<string | null>(null);
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUid(data.user?.id ?? null));
  }, []);
  return uid;
}

export type PlantaoHoje = { id: string; data: string } | null;
export type LeadSemContato = {
  id: string;
  nome: string;
  telefone: string | null;
  atribuido_em: string | null;
  plantao_dia: string | null;
};
export type VisitaHoje = {
  id: string;
  data_inicio: string;
  endereco: string | null;
  status: string;
  imovel_id: string | null;
  lead_id: string;
  comparecimento: string | null;
};
export type FollowupHoje = {
  id: string;
  nome: string;
  telefone: string | null;
  etapa: string;
  fonte: "vendas" | "captacao";
};
export type ChaveAtrasada = {
  id: string;
  codigo: string | null;
  rua: string;
  numero: string | null;
  bairro: string | null;
  chave_retirada_em: string | null;
};

export function useHojeData() {
  const uid = useUserId();
  const qc = useQueryClient();

  const plantao = useQuery({
    queryKey: ["hoje-plantao", uid],
    enabled: !!uid,
    queryFn: async (): Promise<PlantaoHoje> => {
      const { data } = await supabase
        .from("plantao_escala")
        .select("id, data")
        .eq("corretor_id", uid!)
        .eq("data", todayDateStr())
        .maybeSingle();
      return (data as PlantaoHoje) ?? null;
    },
  });

  const leadsSemContato = useQuery({
    queryKey: ["hoje-leads-sem-contato", uid],
    enabled: !!uid,
    queryFn: async (): Promise<LeadSemContato[]> => {
      const { data } = await supabase
        .from("vendas_leads")
        .select("id, nome, telefone, atribuido_em, plantao_dia, first_response_at, atribuicao_status")
        .eq("corretor_id", uid!)
        .eq("atribuicao_status", "aceito")
        .is("first_response_at", null)
        .not("plantao_dia", "is", null)
        .order("atribuido_em", { ascending: true })
        .limit(50);
      return (data ?? []) as LeadSemContato[];
    },
  });

  const visitas = useQuery({
    queryKey: ["hoje-visitas", uid],
    enabled: !!uid,
    queryFn: async (): Promise<VisitaHoje[]> => {
      const { data } = await supabase
        .from("vendas_visitas")
        .select("id, data_inicio, endereco, status, imovel_id, lead_id, comparecimento")
        .eq("corretor_id", uid!)
        .gte("data_inicio", startOfToday())
        .lte("data_inicio", endOfToday())
        .neq("status", "cancelada")
        .order("data_inicio", { ascending: true });
      return (data ?? []) as VisitaHoje[];
    },
  });

  const followup = useQuery({
    queryKey: ["hoje-followup", uid],
    enabled: !!uid,
    queryFn: async (): Promise<FollowupHoje[]> => {
      const start = startOfToday();
      const end = endOfToday();
      const [v, c] = await Promise.all([
        supabase
          .from("vendas_leads")
          .select("id, nome, telefone, etapa, followup_alerta_em")
          .eq("corretor_id", uid!)
          .gte("followup_alerta_em", start)
          .lte("followup_alerta_em", end)
          .limit(100),
        supabase
          .from("leads")
          .select("id, nome, telefone, etapa, followup_alerta_em")
          .eq("responsavel_id", uid!)
          .gte("followup_alerta_em", start)
          .lte("followup_alerta_em", end)
          .limit(100),
      ]);
      const out: FollowupHoje[] = [];
      (v.data ?? []).forEach((r) =>
        out.push({ id: r.id, nome: r.nome, telefone: r.telefone, etapa: r.etapa as string, fonte: "vendas" }),
      );
      (c.data ?? []).forEach((r) =>
        out.push({ id: r.id, nome: r.nome, telefone: r.telefone, etapa: r.etapa as string, fonte: "captacao" }),
      );
      return out;
    },
  });

  const chaves = useQuery({
    queryKey: ["hoje-chaves", uid],
    enabled: !!uid,
    queryFn: async (): Promise<ChaveAtrasada[]> => {
      const { data: cfg } = await supabase
        .from("configuracoes")
        .select("valor")
        .eq("chave", "chaves_atraso_horas")
        .maybeSingle();
      const horasLimite = typeof cfg?.valor === "number" ? cfg!.valor : 24;
      const limite = new Date(Date.now() - horasLimite * 3600_000).toISOString();
      const { data } = await supabase
        .from("imoveis")
        .select("id, codigo, rua, numero, bairro, chave_retirada_em, chave_com_id")
        .eq("chave_com_id", uid!)
        .not("chave_retirada_em", "is", null)
        .lt("chave_retirada_em", limite)
        .limit(50);
      return (data ?? []) as ChaveAtrasada[];
    },
  });

  // Realtime — invalidação leve por tabela
  useEffect(() => {
    if (!uid) return;
    const ch = supabase
      .channel(`hoje-${uid}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "vendas_leads" }, () => {
        qc.invalidateQueries({ queryKey: ["hoje-leads-sem-contato", uid] });
        qc.invalidateQueries({ queryKey: ["hoje-followup", uid] });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "leads" }, () => {
        qc.invalidateQueries({ queryKey: ["hoje-followup", uid] });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "vendas_visitas" }, () => {
        qc.invalidateQueries({ queryKey: ["hoje-visitas", uid] });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "imoveis" }, () => {
        qc.invalidateQueries({ queryKey: ["hoje-chaves", uid] });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "plantao_escala" }, () => {
        qc.invalidateQueries({ queryKey: ["hoje-plantao", uid] });
      })
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [uid, qc]);

  const total =
    (leadsSemContato.data?.length ?? 0) +
    (visitas.data?.length ?? 0) +
    (followup.data?.length ?? 0) +
    (chaves.data?.length ?? 0);

  return {
    uid,
    plantao: plantao.data ?? null,
    leadsSemContato: leadsSemContato.data ?? [],
    visitas: visitas.data ?? [],
    followup: followup.data ?? [],
    chaves: chaves.data ?? [],
    total,
    loading:
      plantao.isLoading ||
      leadsSemContato.isLoading ||
      visitas.isLoading ||
      followup.isLoading ||
      chaves.isLoading,
  };
}

export function useHojeBadge() {
  const { total } = useHojeData();
  return total;
}
