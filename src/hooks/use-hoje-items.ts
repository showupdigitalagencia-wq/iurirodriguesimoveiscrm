import { useEffect, useRef, useState } from "react";
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
export type CandidatoSemContato = {
  id: string;
  nome: string;
  telefone: string | null;
  regiao: string | null;
  created_at: string;
};
export type ReuniaoInstitucionalHoje = {
  id: string;
  titulo: string;
  data_inicio: string;
  local: string | null;
  candidatos_confirmados: number;
};

export function useHojeData() {
  const uid = useUserId();
  const qc = useQueryClient();

  const profile = useQuery({
    queryKey: ["hoje-profile", uid],
    enabled: !!uid,
    queryFn: async () => {
      const [{ data: p }, { data: exec }] = await Promise.all([
        supabase.from("profiles").select("responsavel_id").eq("id", uid!).maybeSingle(),
        supabase.rpc("current_user_is_executivo"),
      ]);
      return {
        responsavel_id:
          (p as { responsavel_id?: string | null } | null)?.responsavel_id ?? null,
        isExec: exec === true,
      };
    },
  });
  const isExec = profile.data?.isExec ?? false;
  const responsavelId = profile.data?.responsavel_id ?? null;

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

  // === Captação (Executivo) ===
  const candidatos = useQuery({
    queryKey: ["hoje-candidatos", responsavelId],
    enabled: !!uid && isExec && !!responsavelId,
    queryFn: async (): Promise<CandidatoSemContato[]> => {
      const { data: cfg } = await supabase
        .from("configuracoes")
        .select("valor")
        .eq("chave", "candidatos_sem_contato_dias")
        .maybeSingle();
      const dias = typeof cfg?.valor === "number" ? cfg!.valor : 3;
      const limite = new Date(Date.now() - dias * 86400_000).toISOString();
      const { data } = await supabase
        .from("candidatos")
        .select("id, nome, telefone, regiao, created_at, status, responsavel_id")
        .eq("responsavel_id", responsavelId!)
        .eq("status", "pendente_revisao")
        .lt("created_at", limite)
        .order("created_at", { ascending: true })
        .limit(50);
      return (data ?? []) as CandidatoSemContato[];
    },
  });

  const reunioes = useQuery({
    queryKey: ["hoje-reunioes-inst", uid, isExec],
    enabled: !!uid && isExec,
    queryFn: async (): Promise<ReuniaoInstitucionalHoje[]> => {
      const { data: rs } = await supabase
        .from("reunioes")
        .select("id, titulo, data_inicio, local, tipo, status, criado_por")
        .eq("tipo", "institucional")
        .neq("status", "cancelada")
        .eq("criado_por", uid!)
        .gte("data_inicio", startOfToday())
        .lte("data_inicio", endOfToday())
        .order("data_inicio", { ascending: true });
      const rows = (rs ?? []) as Array<{ id: string; titulo: string; data_inicio: string; local: string | null }>;
      if (rows.length === 0) return [];
      const ids = rows.map((r) => r.id);
      const { data: parts } = await supabase
        .from("reuniao_participantes")
        .select("reuniao_id, lead_id")
        .in("reuniao_id", ids)
        .not("lead_id", "is", null);
      const counts = new Map<string, number>();
      ((parts ?? []) as Array<{ reuniao_id: string }>).forEach((p) => {
        counts.set(p.reuniao_id, (counts.get(p.reuniao_id) ?? 0) + 1);
      });
      return rows.map((r) => ({
        id: r.id,
        titulo: r.titulo,
        data_inicio: r.data_inicio,
        local: r.local,
        candidatos_confirmados: counts.get(r.id) ?? 0,
      }));
    },
  });

  // Realtime — invalidação leve por tabela
  // Nome de canal único por montagem (evita colisão entre múltiplas
  // instâncias do hook — ex.: HojeIconButton no header + rota /hoje).
  const channelKeyRef = useRef<string>(
    `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`,
  );
  useEffect(() => {
    if (!uid) return;
    const ch = supabase
      .channel(`hoje-${uid}-${channelKeyRef.current}-${Math.random().toString(36).slice(2, 6)}`)
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
      .on("postgres_changes", { event: "*", schema: "public", table: "candidatos" }, () => {
        qc.invalidateQueries({ queryKey: ["hoje-candidatos", responsavelId] });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "reunioes" }, () => {
        qc.invalidateQueries({ queryKey: ["hoje-reunioes-inst", uid, isExec] });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "reuniao_participantes" }, () => {
        qc.invalidateQueries({ queryKey: ["hoje-reunioes-inst", uid, isExec] });
      })
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [uid, qc, responsavelId, isExec]);

  const total =
    (leadsSemContato.data?.length ?? 0) +
    (visitas.data?.length ?? 0) +
    (followup.data?.length ?? 0) +
    (chaves.data?.length ?? 0) +
    (candidatos.data?.length ?? 0) +
    (reunioes.data?.length ?? 0);

  return {
    uid,
    isExec,
    plantao: plantao.data ?? null,
    leadsSemContato: leadsSemContato.data ?? [],
    visitas: visitas.data ?? [],
    followup: followup.data ?? [],
    chaves: chaves.data ?? [],
    candidatos: candidatos.data ?? [],
    reunioes: reunioes.data ?? [],
    total,
    loading:
      plantao.isLoading ||
      leadsSemContato.isLoading ||
      visitas.isLoading ||
      followup.isLoading ||
      chaves.isLoading ||
      candidatos.isLoading ||
      reunioes.isLoading,
  };
}

export function useHojeBadge() {
  const { total } = useHojeData();
  return total;
}
