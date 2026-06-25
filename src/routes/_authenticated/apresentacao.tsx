import { createFileRoute, redirect } from "@tanstack/react-router";
import React, { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import {
  ChevronLeft, ChevronRight, Download, Maximize2, Radio, Building2, Bot,
  CalendarDays, Key, BarChart3, Trophy, Newspaper, Smartphone,
  Target, AlertTriangle, CheckCircle2, Sparkles, Heart, Rocket, Users,
  Bed, Bath, Car, MapPin, Image as ImageIcon, MessageCircle, Share2,
  Zap, Flame, TrendingUp, Clock, Bell,
} from "lucide-react";
import jsPDF from "jspdf";

export const Route = createFileRoute("/_authenticated/apresentacao")({
  beforeLoad: async () => {
    const { data: ud } = await supabase.auth.getUser();
    const uid = ud.user?.id;
    if (!uid) throw redirect({ to: "/auth" });
    const { data: roles } = await supabase.from("user_roles").select("role").eq("user_id", uid);
    const isAdmin = roles?.some((r) => r.role === "admin") ?? false;
    if (!isAdmin) throw redirect({ to: "/dashboard" });
  },
  component: ApresentacaoPage,
});

// ---------------- Slide content ----------------
type SlideDef = {
  id: number;
  title: string;
  render: () => React.ReactElement;
  pdf: {
    eyebrow?: string;
    title: string;
    subtitle?: string;
    bullets?: string[];
    cards?: { title: string; body: string }[];
  };
};

const NAVY = "#0B1B33";
const NAVY_DEEP = "#06101F";
const GOLD = "#C9A14A";
const GOLD_SOFT = "#E8C977";

function SlideShell({ children, eyebrow }: { children: React.ReactNode; eyebrow?: string }) {
  return (
    <div
      className="relative w-full h-full overflow-hidden text-white"
      style={{
        background: `radial-gradient(1200px 600px at 20% 0%, ${GOLD}22, transparent 60%), radial-gradient(900px 500px at 100% 100%, ${GOLD}18, transparent 60%), linear-gradient(135deg, ${NAVY} 0%, ${NAVY_DEEP} 100%)`,
      }}
    >
      <div className="absolute inset-0 opacity-[0.05]" style={{ backgroundImage: "linear-gradient(white 1px, transparent 1px), linear-gradient(90deg, white 1px, transparent 1px)", backgroundSize: "48px 48px" }} />
      {eyebrow && (
        <div className="absolute top-8 left-10 text-xs tracking-[0.3em] uppercase" style={{ color: GOLD_SOFT }}>
          {eyebrow}
        </div>
      )}
      <div className="absolute top-8 right-10 text-xs tracking-widest uppercase opacity-80">Ecossistema Nexus</div>
      <div className="relative z-10 w-full h-full flex flex-col justify-center px-10 md:px-20">{children}</div>
      <div className="absolute bottom-6 left-10 right-10 flex items-center justify-between text-xs opacity-70">
        <span>Iuri Rodrigues Imóveis</span>
        <span className="h-[2px] flex-1 mx-6" style={{ background: `linear-gradient(90deg, transparent, ${GOLD}, transparent)` }} />
        <span>2026</span>
      </div>
    </div>
  );
}

function GlassCard({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div
      className={`rounded-2xl border backdrop-blur-xl p-6 ${className}`}
      style={{ background: "rgba(255,255,255,0.06)", borderColor: "rgba(201,161,74,0.35)" }}
    >
      {children}
    </div>
  );
}

// ---------------- Mockups (visual fac-similes do sistema) ----------------

function MockPlantaoCard() {
  return (
    <div className="rounded-2xl border shadow-2xl p-5 w-full max-w-sm" style={{ background: "#0F2240", borderColor: `${GOLD}55` }}>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2 text-xs tracking-widest uppercase" style={{ color: GOLD_SOFT }}>
          <Radio className="h-3.5 w-3.5" /> Plantonista de hoje
        </div>
        <span className="text-[10px] px-2 py-0.5 rounded-full" style={{ background: `${GOLD}22`, color: GOLD_SOFT }}>Ao vivo</span>
      </div>
      <div className="flex items-center gap-3">
        <div className="h-14 w-14 rounded-full flex items-center justify-center text-xl font-bold" style={{ background: `linear-gradient(135deg, ${GOLD}, ${GOLD_SOFT})`, color: NAVY }}>
          PR
        </div>
        <div>
          <div className="text-lg font-semibold text-white">Pedro Ramos</div>
          <div className="text-xs opacity-70">Barra · Recreio</div>
        </div>
      </div>
      <div className="mt-4 grid grid-cols-3 gap-2 text-center">
        <div className="rounded-lg py-2" style={{ background: "rgba(255,255,255,0.05)" }}>
          <div className="text-lg font-bold" style={{ color: GOLD }}>8</div>
          <div className="text-[10px] opacity-60">Recebidos</div>
        </div>
        <div className="rounded-lg py-2" style={{ background: "rgba(255,255,255,0.05)" }}>
          <div className="text-lg font-bold" style={{ color: GOLD }}>6</div>
          <div className="text-[10px] opacity-60">Atendidos</div>
        </div>
        <div className="rounded-lg py-2" style={{ background: "rgba(255,255,255,0.05)" }}>
          <div className="text-lg font-bold" style={{ color: GOLD }}>4m</div>
          <div className="text-[10px] opacity-60">T. resposta</div>
        </div>
      </div>
    </div>
  );
}

function MockImovelCard() {
  return (
    <div className="rounded-2xl overflow-hidden border shadow-2xl w-full max-w-sm bg-white text-slate-900">
      <div className="relative h-44" style={{ background: `linear-gradient(135deg, #d4d4d8 0%, #71717a 100%)` }}>
        <div className="absolute inset-0 flex items-center justify-center opacity-30">
          <Building2 className="h-20 w-20 text-white" />
        </div>
        <div className="absolute top-3 left-3 text-[10px] px-2 py-1 rounded-full font-medium" style={{ background: GOLD, color: NAVY }}>
          VENDA
        </div>
        <div className="absolute bottom-3 right-3 text-[10px] px-2 py-1 rounded-full bg-black/70 text-white flex items-center gap-1">
          <ImageIcon className="h-3 w-3" /> 12
        </div>
      </div>
      <div className="p-4 space-y-2">
        <div className="text-xs uppercase tracking-wider text-slate-500">Cód. IM-2840 · Barra da Tijuca</div>
        <div className="text-xl font-bold" style={{ color: NAVY }}>R$ 1.180.000</div>
        <div className="flex items-center gap-1 text-xs text-slate-600">
          <MapPin className="h-3.5 w-3.5" /> Av. das Américas, 4500
        </div>
        <div className="flex items-center gap-4 text-xs text-slate-700 pt-2 border-t">
          <span className="flex items-center gap-1"><Bed className="h-3.5 w-3.5" /> 3 qtos</span>
          <span className="flex items-center gap-1"><Bath className="h-3.5 w-3.5" /> 2 banh</span>
          <span className="flex items-center gap-1"><Car className="h-3.5 w-3.5" /> 2 vagas</span>
          <span className="ml-auto font-semibold">98 m²</span>
        </div>
      </div>
    </div>
  );
}

function MockFunil() {
  const etapas = [
    { l: "Novos leads", v: 124, w: "100%" },
    { l: "Contato realizado", v: 89, w: "72%" },
    { l: "Visita agendada", v: 41, w: "33%" },
    { l: "Proposta enviada", v: 18, w: "15%" },
    { l: "Fechado", v: 7, w: "6%" },
  ];
  return (
    <div className="rounded-2xl border shadow-2xl p-5 w-full max-w-md" style={{ background: "#0F2240", borderColor: `${GOLD}55` }}>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2 text-xs tracking-widest uppercase" style={{ color: GOLD_SOFT }}>
          <BarChart3 className="h-3.5 w-3.5" /> Funil de Conversão · Você
        </div>
        <span className="text-[10px] opacity-60">Últimos 30 dias</span>
      </div>
      <div className="space-y-2.5">
        {etapas.map((e, i) => (
          <div key={i}>
            <div className="flex justify-between text-xs mb-1">
              <span className="opacity-80 text-white">{e.l}</span>
              <span className="font-semibold" style={{ color: GOLD_SOFT }}>{e.v}</span>
            </div>
            <div className="h-2 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.08)" }}>
              <div className="h-full rounded-full" style={{ width: e.w, background: `linear-gradient(90deg, ${GOLD}, ${GOLD_SOFT})` }} />
            </div>
          </div>
        ))}
      </div>
      <div className="mt-4 pt-3 border-t border-white/10 flex items-center justify-between text-xs">
        <span className="opacity-70">Taxa global</span>
        <span className="font-bold flex items-center gap-1" style={{ color: GOLD }}>
          <TrendingUp className="h-3.5 w-3.5" /> 5,6%
        </span>
      </div>
    </div>
  );
}

function MockFeedPost() {
  return (
    <div className="rounded-2xl overflow-hidden border shadow-2xl w-full max-w-sm bg-white text-slate-900">
      <div className="flex items-center gap-3 p-3 border-b">
        <div className="h-10 w-10 rounded-full flex items-center justify-center text-sm font-bold" style={{ background: `linear-gradient(135deg, ${GOLD}, ${GOLD_SOFT})`, color: NAVY }}>
          MS
        </div>
        <div className="flex-1">
          <div className="text-sm font-semibold">Mariana Silva</div>
          <div className="text-[11px] text-slate-500">há 12 min · Recreio</div>
        </div>
      </div>
      <div className="h-52 flex items-center justify-center" style={{ background: `linear-gradient(135deg, ${NAVY}, ${NAVY_DEEP})` }}>
        <div className="text-center text-white px-6">
          <Trophy className="h-10 w-10 mx-auto mb-2" style={{ color: GOLD }} />
          <div className="font-semibold">Fechei minha 3ª venda do mês! 🎉</div>
        </div>
      </div>
      <div className="p-3">
        <div className="flex items-center gap-4 text-slate-700 text-sm">
          <span className="flex items-center gap-1.5"><Heart className="h-4 w-4" style={{ color: "#e11d48" }} /> 24</span>
          <span className="flex items-center gap-1.5"><MessageCircle className="h-4 w-4" /> 7</span>
          <span className="flex items-center gap-1.5 ml-auto"><Share2 className="h-4 w-4" /></span>
        </div>
        <div className="text-xs text-slate-600 mt-2">
          <span className="font-semibold">Carlos:</span> Parabéns, Mari! Bora pra mais 🚀
        </div>
      </div>
    </div>
  );
}

function MockPhoneFrame() {
  return (
    <div className="relative mx-auto" style={{ width: 240, height: 480 }}>
      <div className="absolute inset-0 rounded-[36px] border-[10px] shadow-2xl" style={{ borderColor: "#1a1a1a", background: "#000" }}>
        <div className="absolute top-1 left-1/2 -translate-x-1/2 w-20 h-5 rounded-b-xl z-10" style={{ background: "#1a1a1a" }} />
        <div className="absolute inset-0 m-0 rounded-[26px] overflow-hidden" style={{ background: `linear-gradient(180deg, ${NAVY}, ${NAVY_DEEP})` }}>
          {/* Mini Dashboard */}
          <div className="px-3 pt-8 pb-2 text-white">
            <div className="flex items-center justify-between mb-3">
              <div>
                <div className="text-[10px] opacity-60 uppercase tracking-wider">Bom dia</div>
                <div className="text-sm font-semibold">Pedro Ramos</div>
              </div>
              <Bell className="h-4 w-4" style={{ color: GOLD }} />
            </div>
            <div className="rounded-xl p-3 mb-2" style={{ background: "rgba(255,255,255,0.08)" }}>
              <div className="flex items-center gap-2 text-[10px] uppercase tracking-wider mb-1.5" style={{ color: GOLD_SOFT }}>
                <Radio className="h-3 w-3" /> Plantão · Hoje
              </div>
              <div className="text-xs">3 leads novos · 1 aguardando</div>
            </div>
            <div className="rounded-xl p-3 mb-2" style={{ background: "rgba(255,255,255,0.08)" }}>
              <div className="flex items-center gap-2 text-[10px] uppercase tracking-wider mb-1.5" style={{ color: GOLD_SOFT }}>
                <Target className="h-3 w-3" /> Meta do mês
              </div>
              <div className="h-1.5 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.1)" }}>
                <div className="h-full rounded-full" style={{ width: "72%", background: `linear-gradient(90deg, ${GOLD}, ${GOLD_SOFT})` }} />
              </div>
              <div className="text-[10px] opacity-60 mt-1">72% · R$ 18k de R$ 25k</div>
            </div>
            <div className="rounded-xl p-3" style={{ background: "rgba(255,255,255,0.08)" }}>
              <div className="flex items-center gap-2 text-[10px] uppercase tracking-wider mb-1.5" style={{ color: GOLD_SOFT }}>
                <CalendarDays className="h-3 w-3" /> Hoje
              </div>
              <div className="text-xs space-y-0.5">
                <div>· Visita 14h — Av. Lúcio Costa</div>
                <div>· Follow-up João Silva</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ---------------- Slides ----------------
const SLIDES: SlideDef[] = [
  {
    id: 1,
    title: "Capa",
    pdf: { title: "Ecossistema Nexus", subtitle: "A tecnologia que trabalha por você", bullets: ["Iuri Rodrigues Imóveis"] },
    render: () => (
      <SlideShell>
        <div className="space-y-6">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-xs tracking-[0.3em] uppercase" style={{ background: "rgba(201,161,74,0.15)", color: GOLD_SOFT, border: `1px solid ${GOLD}55` }}>
            <Sparkles className="h-3.5 w-3.5" /> Apresentação institucional
          </div>
          <h1 className="text-6xl md:text-8xl font-bold tracking-tight" style={{ fontFamily: "'Cormorant Garamond', serif" }}>
            Ecossistema <span style={{ color: GOLD }}>Nexus</span>
          </h1>
          <p className="text-xl md:text-2xl max-w-3xl opacity-90">A tecnologia que <span style={{ color: GOLD_SOFT }}>trabalha por você</span>.</p>
          <div className="text-sm tracking-widest uppercase opacity-70 pt-4">Iuri Rodrigues Imóveis</div>
        </div>
      </SlideShell>
    ),
  },
  {
    id: 2,
    title: "A virada de chave",
    pdf: {
      eyebrow: "A virada de chave",
      title: "Nunca mais perca uma oportunidade.",
      cards: [
        { title: "Lead esquecido", body: "Mensagem perdida no WhatsApp." },
        { title: "Chave sem controle", body: "Visita atrasa, cliente desiste." },
        { title: "Caos do dia a dia", body: "Tarefa demais, foco de menos." },
      ],
    },
    render: () => (
      <SlideShell eyebrow="A virada de chave">
        <div className="space-y-8">
          <h2 className="text-4xl md:text-5xl font-semibold max-w-4xl leading-tight" style={{ fontFamily: "'Cormorant Garamond', serif" }}>
            Nunca mais <span style={{ color: GOLD }}>perca uma oportunidade</span>.
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {[
              { i: AlertTriangle, t: "Lead esquecido", d: "Mensagem perdida no WhatsApp." },
              { i: Key, t: "Chave sem controle", d: "Visita atrasa, cliente desiste." },
              { i: Clock, t: "Caos da rotina", d: "Tarefa demais, foco de menos." },
            ].map((c, i) => (
              <GlassCard key={i}>
                <c.i className="h-7 w-7 mb-3" style={{ color: GOLD }} />
                <div className="text-lg font-semibold mb-1">{c.t}</div>
                <div className="text-sm opacity-80">{c.d}</div>
              </GlassCard>
            ))}
          </div>
        </div>
      </SlideShell>
    ),
  },
  {
    id: 3,
    title: "A solução",
    pdf: {
      eyebrow: "A solução",
      title: "Um ecossistema pensado pra você crescer.",
      cards: [
        { title: "Plantão", body: "Oportunidade pra todos" },
        { title: "Portfólio", body: "Imóveis no bolso" },
        { title: "Laura IA", body: "Assistente 24/7" },
        { title: "Agenda", body: "Visitas e reuniões" },
        { title: "Chaves", body: "Controle total" },
        { title: "Relatórios", body: "Seu desempenho" },
        { title: "Conquistas", body: "Metas e badges" },
        { title: "Início (Feed)", body: "Time conectado" },
      ],
    },
    render: () => (
      <SlideShell eyebrow="A solução">
        <div className="space-y-8">
          <h2 className="text-4xl md:text-5xl font-semibold" style={{ fontFamily: "'Cormorant Garamond', serif" }}>
            Um ecossistema pra <span style={{ color: GOLD }}>você crescer</span>.
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { i: Radio, t: "Plantão" }, { i: Building2, t: "Portfólio" }, { i: Bot, t: "Laura IA" }, { i: CalendarDays, t: "Agenda" },
              { i: Key, t: "Chaves" }, { i: BarChart3, t: "Relatórios" }, { i: Trophy, t: "Conquistas" }, { i: Newspaper, t: "Início" },
            ].map((m, i) => (
              <GlassCard key={i} className="flex flex-col items-center text-center py-5">
                <m.i className="h-8 w-8 mb-2" style={{ color: GOLD }} />
                <div className="text-base font-medium">{m.t}</div>
              </GlassCard>
            ))}
          </div>
        </div>
      </SlideShell>
    ),
  },
  {
    id: 4,
    title: "Plantão",
    pdf: {
      eyebrow: "Plantão",
      title: "Você nunca mais perde uma oportunidade.",
      bullets: [
        "Lead chega → sistema identifica o plantonista do dia",
        "Notificação imediata · 10 min pra responder",
        "Sem resposta? Escalona automaticamente",
      ],
    },
    render: () => (
      <SlideShell eyebrow="Plantão">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-10 items-center">
          <div className="space-y-5">
            <h2 className="text-5xl font-semibold leading-tight" style={{ fontFamily: "'Cormorant Garamond', serif" }}>
              Cada lead encontra <span style={{ color: GOLD }}>seu corretor</span>.
            </h2>
            <ul className="space-y-2.5 text-base opacity-90">
              <li className="flex items-start gap-2"><CheckCircle2 className="h-5 w-5 mt-0.5 flex-shrink-0" style={{ color: GOLD }} />Plantonista do dia identificado na hora</li>
              <li className="flex items-start gap-2"><CheckCircle2 className="h-5 w-5 mt-0.5 flex-shrink-0" style={{ color: GOLD }} />10 minutos pra responder</li>
              <li className="flex items-start gap-2"><CheckCircle2 className="h-5 w-5 mt-0.5 flex-shrink-0" style={{ color: GOLD }} />Escalona sozinho se demorar</li>
            </ul>
          </div>
          <div className="flex justify-center">
            <MockPlantaoCard />
          </div>
        </div>
      </SlideShell>
    ),
  },
  {
    id: 5,
    title: "Portfólio",
    pdf: {
      eyebrow: "Portfólio",
      title: "Impressione o cliente em segundos.",
      bullets: [
        "Busca por região e preço",
        "Fotos profissionais e atualizadas",
        "Compartilhar em 1 toque",
      ],
    },
    render: () => (
      <SlideShell eyebrow="Portfólio">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-10 items-center">
          <div className="space-y-5">
            <h2 className="text-5xl font-semibold leading-tight" style={{ fontFamily: "'Cormorant Garamond', serif" }}>
              Imóveis <span style={{ color: GOLD }}>no seu bolso</span>.
            </h2>
            <ul className="space-y-2.5 text-base opacity-90">
              <li className="flex items-start gap-2"><CheckCircle2 className="h-5 w-5 mt-0.5 flex-shrink-0" style={{ color: GOLD }} />Busca por região e preço</li>
              <li className="flex items-start gap-2"><CheckCircle2 className="h-5 w-5 mt-0.5 flex-shrink-0" style={{ color: GOLD }} />Fotos profissionais</li>
              <li className="flex items-start gap-2"><CheckCircle2 className="h-5 w-5 mt-0.5 flex-shrink-0" style={{ color: GOLD }} />Compartilhar em 1 toque</li>
            </ul>
          </div>
          <div className="flex justify-center">
            <MockImovelCard />
          </div>
        </div>
      </SlideShell>
    ),
  },
  {
    id: 6,
    title: "Laura entende você",
    pdf: {
      eyebrow: "Laura IA · Consultas",
      title: "Laura entende você",
      bullets: [
        "\"Temos apartamento na Barra até R$ 2.500?\"",
        "\"Qual minha meta esse mês?\"",
        "\"Quais imóveis disponíveis em Nova Iguaçu?\"",
      ],
    },
    render: () => (
      <SlideShell eyebrow="Laura IA · Consultas">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-10 items-center">
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <Bot className="h-10 w-10" style={{ color: GOLD }} />
              <h2 className="text-5xl font-semibold" style={{ fontFamily: "'Cormorant Garamond', serif" }}>Laura entende você</h2>
            </div>
            <p className="text-xl opacity-90">Pergunta natural. Resposta na hora.</p>
          </div>
          <div className="space-y-3">
            {[
              { q: "Temos apartamento na Barra até R$ 2.500?", a: "Achei 7 opções. Vou te mandar as fotos." },
              { q: "Qual minha meta esse mês?", a: "Você está em 72% — R$ 18.000 de R$ 25.000." },
              { q: "Quais imóveis disponíveis em Nova Iguaçu?", a: "12 imóveis ativos. Quer filtrar por preço?" },
            ].map((m, i) => (
              <div key={i} className="space-y-1.5">
                <div className="rounded-2xl rounded-br-sm px-4 py-2.5 ml-auto max-w-[85%] text-sm" style={{ background: `${GOLD}22`, border: `1px solid ${GOLD}55` }}>
                  <span className="opacity-95">"{m.q}"</span>
                </div>
                <div className="rounded-2xl rounded-bl-sm px-4 py-2.5 max-w-[85%] text-sm" style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.12)" }}>
                  <span className="text-xs uppercase tracking-wider opacity-60 mr-2" style={{ color: GOLD_SOFT }}>Laura</span>
                  {m.a}
                </div>
              </div>
            ))}
          </div>
        </div>
      </SlideShell>
    ),
  },
  {
    id: 7,
    title: "Laura trabalha por você",
    pdf: {
      eyebrow: "Laura IA · Ações",
      title: "Laura trabalha por você",
      bullets: [
        "\"Estou disponível seg a sex, 10h–18h. Atualize minha agenda\" → ajusta sua disponibilidade.",
        "\"A visita com o João foi realizada\" → confirma direto no sistema.",
        "\"Estou retirando a chave do 304\" + foto → registra a retirada.",
        "\"Atribui esse lead pra quem está livre\" (executivos) → distribui pelo melhor critério.",
      ],
    },
    render: () => (
      <SlideShell eyebrow="Laura IA · Ações">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-10 items-center">
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <Bot className="h-10 w-10" style={{ color: GOLD }} />
              <h2 className="text-5xl font-semibold" style={{ fontFamily: "'Cormorant Garamond', serif" }}>Laura trabalha por você</h2>
            </div>
            <p className="text-xl opacity-90">Você fala. Ela faz <span style={{ color: GOLD_SOFT }}>direto no sistema</span>.</p>
          </div>
          <div className="space-y-3">
            {[
              { q: "Estou disponível essa semana de seg a sex, das 10h às 18h. Atualize minha agenda de disponibilidade.", a: "Pronto: sua disponibilidade foi atualizada na agenda." },
              { q: "A visita com o João foi realizada.", a: "Visita confirmada. Quer registrar follow-up?" },
              { q: "Estou retirando a chave do 304. [foto]", a: "Retirada registrada com a foto da chave." },
              { q: "Atribui esse lead pra quem está livre hoje.", a: "Atribuí para o Pedro — agenda livre agora." },
            ].map((m, i) => (
              <div key={i} className="space-y-1.5">
                <div className="rounded-2xl rounded-br-sm px-4 py-2.5 ml-auto max-w-[85%] text-sm" style={{ background: `${GOLD}22`, border: `1px solid ${GOLD}55` }}>
                  <span className="opacity-95">"{m.q}"</span>
                </div>
                <div className="rounded-2xl rounded-bl-sm px-4 py-2.5 max-w-[85%] text-sm" style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.12)" }}>
                  <span className="text-xs uppercase tracking-wider opacity-60 mr-2" style={{ color: GOLD_SOFT }}>Laura</span>
                  {m.a}
                </div>
              </div>
            ))}
          </div>
        </div>
      </SlideShell>
    ),
  },
  {
    id: 8,
    title: "Laura tem seu lado",
    pdf: {
      eyebrow: "Laura IA · Confiança",
      title: "Laura tem seu lado, com segurança",
      bullets: [
        "Confirma antes de qualquer ação.",
        "Respeita seu perfil e suas informações.",
        "Disponível 24h, sem fila.",
      ],
    },
    render: () => (
      <SlideShell eyebrow="Laura IA · Confiança">
        <div className="space-y-8 max-w-5xl">
          <div className="flex items-center gap-3">
            <Bot className="h-10 w-10" style={{ color: GOLD }} />
            <h2 className="text-5xl font-semibold" style={{ fontFamily: "'Cormorant Garamond', serif" }}>
              Laura tem <span style={{ color: GOLD }}>seu lado</span>, com segurança.
            </h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[
              { i: CheckCircle2, t: "Confirma antes de agir", d: "Nada acontece sem você aprovar." },
              { i: Sparkles, t: "Respeita o seu perfil", d: "Suas informações continuam só suas." },
              { i: Heart, t: "Disponível 24h", d: "Sem fila, sem esperar." },
            ].map((c, i) => (
              <GlassCard key={i}>
                <c.i className="h-7 w-7 mb-3" style={{ color: GOLD }} />
                <div className="text-lg font-semibold mb-1">{c.t}</div>
                <div className="text-sm opacity-80">{c.d}</div>
              </GlassCard>
            ))}
          </div>
        </div>
      </SlideShell>
    ),
  },
  {
    id: 9,
    title: "Central Hoje",
    pdf: {
      eyebrow: "Central Hoje",
      title: "Sem caos, sem esquecimento.",
      bullets: [
        "Leads urgentes · Visitas · Follow-ups · Chaves",
        "Tudo em uma tela só, sempre atualizada",
      ],
    },
    render: () => (
      <SlideShell eyebrow="Central Hoje">
        <div className="space-y-8 max-w-5xl">
          <h2 className="text-5xl font-semibold" style={{ fontFamily: "'Cormorant Garamond', serif" }}>
            Sem caos, <span style={{ color: GOLD }}>sem esquecimento</span>.
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { t: "Leads urgentes", d: "Sem primeiro contato" },
              { t: "Visitas", d: "Agendadas pra hoje" },
              { t: "Follow-ups", d: "Vencendo agora" },
              { t: "Chaves", d: "Retirada em atraso" },
            ].map((c, i) => (
              <GlassCard key={i}>
                <div className="text-lg font-semibold" style={{ color: GOLD }}>{c.t}</div>
                <div className="text-sm opacity-80 mt-1">{c.d}</div>
              </GlassCard>
            ))}
          </div>
          <p className="text-lg opacity-85 pt-2">Sua mente livre pra <span style={{ color: GOLD_SOFT }}>vender</span>.</p>
        </div>
      </SlideShell>
    ),
  },
  {
    id: 10,
    title: "Relatórios",
    pdf: {
      eyebrow: "Relatórios",
      title: "Você enxerga o seu próprio desempenho.",
      bullets: [
        "Funil de conversão pessoal",
        "Tempo médio de resposta",
        "Vendas, visitas e taxa de fechamento",
      ],
    },
    render: () => (
      <SlideShell eyebrow="Relatórios">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-10 items-center">
          <div className="space-y-5">
            <h2 className="text-5xl font-semibold leading-tight" style={{ fontFamily: "'Cormorant Garamond', serif" }}>
              O que <span style={{ color: GOLD }}>você vê</span> sobre o seu desempenho.
            </h2>
            <ul className="space-y-2.5 text-base opacity-90">
              <li className="flex items-start gap-2"><CheckCircle2 className="h-5 w-5 mt-0.5 flex-shrink-0" style={{ color: GOLD }} />Funil de conversão pessoal</li>
              <li className="flex items-start gap-2"><CheckCircle2 className="h-5 w-5 mt-0.5 flex-shrink-0" style={{ color: GOLD }} />Tempo médio de resposta</li>
              <li className="flex items-start gap-2"><CheckCircle2 className="h-5 w-5 mt-0.5 flex-shrink-0" style={{ color: GOLD }} />Vendas, visitas e taxa de fechamento</li>
            </ul>
            <p className="text-sm opacity-70 pt-2">Sem mistério. Você sabe exatamente onde melhorar.</p>
          </div>
          <div className="flex justify-center">
            <MockFunil />
          </div>
        </div>
      </SlideShell>
    ),
  },
  {
    id: 11,
    title: "Metas e Conquistas",
    pdf: {
      eyebrow: "Metas e Conquistas",
      title: "Seu crescimento, reconhecido.",
      bullets: [
        "Progresso visual da meta, em tempo real",
        "Conquistas e badges automáticas",
      ],
    },
    render: () => (
      <SlideShell eyebrow="Metas e Conquistas">
        <div className="space-y-8 max-w-5xl">
          <h2 className="text-5xl font-semibold" style={{ fontFamily: "'Cormorant Garamond', serif" }}>
            Seu crescimento, <span style={{ color: GOLD }}>reconhecido</span>.
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <GlassCard>
              <div className="flex items-center gap-3 mb-3"><Target className="h-6 w-6" style={{ color: GOLD }} /><div className="font-semibold">Meta do mês</div></div>
              <div className="h-3 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.1)" }}>
                <div className="h-full rounded-full" style={{ width: "72%", background: `linear-gradient(90deg, ${GOLD}, ${GOLD_SOFT})` }} />
              </div>
              <div className="text-xs opacity-60 mt-2">72% atingido</div>
            </GlassCard>
            <GlassCard>
              <div className="flex items-center gap-3 mb-3"><Trophy className="h-6 w-6" style={{ color: GOLD }} /><div className="font-semibold">Conquistas recentes</div></div>
              <ul className="space-y-2 text-sm">
                <li className="flex items-center gap-2"><Trophy className="h-4 w-4" style={{ color: GOLD_SOFT }} /> Primeira venda do mês</li>
                <li className="flex items-center gap-2"><Zap className="h-4 w-4" style={{ color: GOLD_SOFT }} /> Resposta relâmpago (5 min)</li>
                <li className="flex items-center gap-2"><Flame className="h-4 w-4" style={{ color: GOLD_SOFT }} /> 3 visitas em um dia</li>
              </ul>
            </GlassCard>
          </div>
        </div>
      </SlideShell>
    ),
  },
  {
    id: 12,
    title: "Feed e Stories",
    pdf: {
      eyebrow: "Início",
      title: "Você faz parte de um time de verdade.",
      bullets: [
        "Fotos, vídeos, áudios e textos",
        "Stories de 24h",
        "Curtidas e comentários",
      ],
    },
    render: () => (
      <SlideShell eyebrow="Início">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-10 items-center">
          <div className="space-y-5">
            <h2 className="text-5xl font-semibold leading-tight" style={{ fontFamily: "'Cormorant Garamond', serif" }}>
              Um <span style={{ color: GOLD }}>time de verdade</span>.
            </h2>
            <ul className="space-y-2.5 text-base opacity-90">
              <li className="flex items-start gap-2"><CheckCircle2 className="h-5 w-5 mt-0.5 flex-shrink-0" style={{ color: GOLD }} />Foto, vídeo, áudio e texto</li>
              <li className="flex items-start gap-2"><CheckCircle2 className="h-5 w-5 mt-0.5 flex-shrink-0" style={{ color: GOLD }} />Stories de 24h</li>
              <li className="flex items-start gap-2"><CheckCircle2 className="h-5 w-5 mt-0.5 flex-shrink-0" style={{ color: GOLD }} />Curtidas e comentários</li>
            </ul>
          </div>
          <div className="flex justify-center">
            <MockFeedPost />
          </div>
        </div>
      </SlideShell>
    ),
  },
  {
    id: 13,
    title: "Mobile",
    pdf: {
      eyebrow: "Mobile",
      title: "Sua carreira no seu bolso.",
      bullets: [
        "Android e iPhone",
        "Notificação em tempo real",
        "Instala como app, sem loja",
      ],
    },
    render: () => (
      <SlideShell eyebrow="Mobile">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-10 items-center">
          <div className="space-y-5">
            <h2 className="text-5xl font-semibold leading-tight" style={{ fontFamily: "'Cormorant Garamond', serif" }}>
              Sua carreira <span style={{ color: GOLD }}>no seu bolso</span>.
            </h2>
            <ul className="space-y-2.5 text-base opacity-90">
              <li className="flex items-start gap-2"><Smartphone className="h-5 w-5 mt-0.5 flex-shrink-0" style={{ color: GOLD }} />Android e iPhone</li>
              <li className="flex items-start gap-2"><Bell className="h-5 w-5 mt-0.5 flex-shrink-0" style={{ color: GOLD }} />Notificação em tempo real</li>
              <li className="flex items-start gap-2"><Download className="h-5 w-5 mt-0.5 flex-shrink-0" style={{ color: GOLD }} />Instala como app, sem loja</li>
            </ul>
          </div>
          <div className="flex justify-center">
            <MockPhoneFrame />
          </div>
        </div>
      </SlideShell>
    ),
  },
  {
    id: 14,
    title: "Crescimento",
    pdf: {
      eyebrow: "Crescimento",
      title: "Tecnologia que cresce com você.",
      bullets: [
        "Laura cuida do repetitivo",
        "Organização automática",
        "Foco no que importa",
      ],
    },
    render: () => (
      <SlideShell eyebrow="Crescimento">
        <div className="space-y-8 max-w-5xl">
          <h2 className="text-5xl font-semibold" style={{ fontFamily: "'Cormorant Garamond', serif" }}>
            Tecnologia que <span style={{ color: GOLD }}>cresce com você</span>.
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[
              { i: Bot, t: "Laura cuida do repetitivo", d: "Busca, agenda, registra — sem você levantar um dedo." },
              { i: Sparkles, t: "Organização automática", d: "Tudo no lugar, sem precisar lembrar." },
              { i: Rocket, t: "Foco no que importa", d: "Atender bem. Vender mais." },
            ].map((c, i) => (
              <GlassCard key={i}>
                <c.i className="h-7 w-7 mb-3" style={{ color: GOLD }} />
                <div className="font-semibold mb-1">{c.t}</div>
                <div className="text-sm opacity-80">{c.d}</div>
              </GlassCard>
            ))}
          </div>
        </div>
      </SlideShell>
    ),
  },
  {
    id: 15,
    title: "Resumo emocional",
    pdf: {
      eyebrow: "Por que o Nexus",
      title: "Por que o Nexus muda a sua história",
      cards: [
        { title: "Nunca mais perde oportunidade", body: "Cada lead encontra o seu corretor." },
        { title: "Nunca mais se perde na rotina", body: "Tudo no lugar, na hora certa." },
        { title: "Seu esforço é reconhecido", body: "Metas e visibilidade real." },
        { title: "Você faz parte de algo maior", body: "Um time conectado." },
      ],
    },
    render: () => (
      <SlideShell eyebrow="Por que o Nexus">
        <div className="space-y-8 max-w-6xl">
          <h2 className="text-5xl font-semibold" style={{ fontFamily: "'Cormorant Garamond', serif" }}>
            Por que o Nexus <span style={{ color: GOLD }}>muda a sua história</span>.
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {[
              { i: CheckCircle2, t: "Nunca mais perde oportunidade", d: "Cada lead encontra o seu corretor." },
              { i: Sparkles, t: "Nunca mais se perde na rotina", d: "Tudo no lugar, na hora certa." },
              { i: Trophy, t: "Seu esforço é reconhecido", d: "Metas e visibilidade real." },
              { i: Users, t: "Você faz parte de algo maior", d: "Um time conectado." },
            ].map((c, i) => (
              <GlassCard key={i} className="flex gap-4 items-start">
                <c.i className="h-7 w-7 flex-shrink-0 mt-1" style={{ color: GOLD }} />
                <div>
                  <div className="text-lg font-semibold" style={{ color: GOLD }}>{c.t}</div>
                  <div className="text-sm opacity-85 mt-1">{c.d}</div>
                </div>
              </GlassCard>
            ))}
          </div>
        </div>
      </SlideShell>
    ),
  },
  {
    id: 16,
    title: "Fechamento",
    pdf: {
      title: "Você é um dos próximos?",
      subtitle: "O Ecossistema Nexus já está aqui. Agora é crescer, todos os dias.",
    },
    render: () => (
      <SlideShell>
        <div className="space-y-8 text-center">
          <Heart className="h-12 w-12 mx-auto" style={{ color: GOLD }} />
          <h2 className="text-7xl md:text-8xl font-semibold" style={{ fontFamily: "'Cormorant Garamond', serif" }}>
            Você é um dos <span style={{ color: GOLD }}>próximos</span>?
          </h2>
          <p className="text-2xl opacity-90 max-w-3xl mx-auto">
            O Ecossistema Nexus já está aqui. <span style={{ color: GOLD_SOFT }}>Agora é crescer, todos os dias.</span>
          </p>
          <div className="pt-8 text-sm tracking-[0.3em] uppercase opacity-70">Iuri Rodrigues Imóveis</div>
        </div>
      </SlideShell>
    ),
  },
];


// ---------------- PDF generation ----------------
function generatePDF() {
  const pdf = new jsPDF({ orientation: "landscape", unit: "pt", format: [1280, 720] });
  const W = 1280, H = 720;
  const navy: [number, number, number] = [11, 27, 51];
  const gold: [number, number, number] = [201, 161, 74];

  SLIDES.forEach((slide, idx) => {
    if (idx > 0) pdf.addPage([W, H], "landscape");
    pdf.setFillColor(...navy);
    pdf.rect(0, 0, W, H, "F");
    pdf.setFillColor(...gold);
    pdf.rect(0, 0, 6, H, "F");
    pdf.setTextColor(232, 201, 119);
    pdf.setFontSize(10);
    if (slide.pdf.eyebrow) pdf.text(slide.pdf.eyebrow.toUpperCase(), 60, 50);
    pdf.setTextColor(255, 255, 255);
    pdf.text("ECOSSISTEMA NEXUS", W - 60, 50, { align: "right" });

    pdf.setTextColor(255, 255, 255);
    pdf.setFont("helvetica", "bold");
    const isCover = slide.id === 1 || slide.id === SLIDES.length;
    pdf.setFontSize(isCover ? 64 : 40);
    const titleLines = pdf.splitTextToSize(slide.pdf.title, W - 120);
    pdf.text(titleLines, 60, isCover ? H / 2 - 40 : 140);

    let y = isCover ? H / 2 + 40 : 140 + titleLines.length * 50 + 30;

    if (slide.pdf.subtitle) {
      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(20);
      pdf.setTextColor(220, 220, 220);
      const subLines = pdf.splitTextToSize(slide.pdf.subtitle, W - 120);
      pdf.text(subLines, 60, y);
      y += subLines.length * 26 + 20;
    }

    if (slide.pdf.bullets) {
      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(18);
      pdf.setTextColor(235, 235, 235);
      slide.pdf.bullets.forEach((b) => {
        pdf.setFillColor(...gold);
        pdf.circle(70, y - 5, 4, "F");
        const lines = pdf.splitTextToSize(b, W - 160);
        pdf.text(lines, 90, y);
        y += lines.length * 24 + 10;
      });
    }

    if (slide.pdf.cards) {
      const cols = slide.pdf.cards.length <= 3 ? slide.pdf.cards.length : Math.ceil(slide.pdf.cards.length / 2);
      const rows = Math.ceil(slide.pdf.cards.length / cols);
      const gap = 20;
      const cardW = (W - 120 - gap * (cols - 1)) / cols;
      const cardH = Math.min(180, (H - y - 80 - gap * (rows - 1)) / rows);
      slide.pdf.cards.forEach((c, i) => {
        const col = i % cols, row = Math.floor(i / cols);
        const x = 60 + col * (cardW + gap);
        const cy = y + row * (cardH + gap);
        pdf.setFillColor(20, 38, 64);
        pdf.roundedRect(x, cy, cardW, cardH, 12, 12, "F");
        pdf.setDrawColor(...gold);
        pdf.setLineWidth(0.5);
        pdf.roundedRect(x, cy, cardW, cardH, 12, 12, "S");
        pdf.setTextColor(...gold);
        pdf.setFont("helvetica", "bold");
        pdf.setFontSize(16);
        pdf.text(c.title, x + 20, cy + 32);
        pdf.setTextColor(230, 230, 230);
        pdf.setFont("helvetica", "normal");
        pdf.setFontSize(12);
        const bodyLines = pdf.splitTextToSize(c.body, cardW - 40);
        pdf.text(bodyLines, x + 20, cy + 58);
      });
    }

    pdf.setDrawColor(...gold);
    pdf.setLineWidth(0.3);
    pdf.line(60, H - 50, W - 60, H - 50);
    pdf.setTextColor(180, 180, 180);
    pdf.setFontSize(9);
    pdf.text("Iuri Rodrigues Imóveis", 60, H - 30);
    pdf.text(`${slide.id} / ${SLIDES.length}`, W - 60, H - 30, { align: "right" });
  });

  pdf.save("ecossistema-nexus-apresentacao.pdf");
}

// ---------------- Page ----------------
function ApresentacaoPage() {
  const [idx, setIdx] = useState(0);
  const [fullscreen, setFullscreen] = useState(false);

  const next = useCallback(() => setIdx((i) => Math.min(SLIDES.length - 1, i + 1)), []);
  const prev = useCallback(() => setIdx((i) => Math.max(0, i - 1)), []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight" || e.key === " " || e.key === "PageDown") { e.preventDefault(); next(); }
      else if (e.key === "ArrowLeft" || e.key === "PageUp") { e.preventDefault(); prev(); }
      else if (e.key === "Home") setIdx(0);
      else if (e.key === "End") setIdx(SLIDES.length - 1);
      else if (e.key === "Escape" && document.fullscreenElement) document.exitFullscreen();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [next, prev]);

  useEffect(() => {
    const onFsChange = () => setFullscreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", onFsChange);
    return () => document.removeEventListener("fullscreenchange", onFsChange);
  }, []);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) document.documentElement.requestFullscreen();
    else document.exitFullscreen();
  };

  const slide = SLIDES[idx];

  return (
    <div className="min-h-screen flex flex-col bg-black">
      {!fullscreen && (
        <div className="flex items-center justify-between gap-3 px-4 py-3 border-b" style={{ background: NAVY_DEEP, borderColor: "rgba(201,161,74,0.25)" }}>
          <div className="text-white text-sm">
            <span className="opacity-60">Apresentação · </span>
            <span className="font-semibold">{slide.title}</span>
            <span className="opacity-60 ml-2">· Slide {idx + 1} de {SLIDES.length}</span>
          </div>
          <div className="flex items-center gap-2">
            <Button size="sm" variant="outline" onClick={generatePDF} className="gap-2">
              <Download className="h-4 w-4" /> Baixar PDF
            </Button>
            <Button size="sm" variant="outline" onClick={toggleFullscreen} className="gap-2">
              <Maximize2 className="h-4 w-4" /> Tela cheia
            </Button>
          </div>
        </div>
      )}

      <div className="flex-1 flex items-center justify-center p-0 md:p-6">
        <div className="relative w-full max-w-[1400px]" style={{ aspectRatio: "16/9" }}>
          <div className="absolute inset-0 rounded-xl overflow-hidden shadow-2xl">
            {slide.render()}
          </div>
        </div>
      </div>

      {!fullscreen && (
        <div className="flex items-center justify-center gap-4 px-4 py-4" style={{ background: NAVY_DEEP }}>
          <Button size="icon" variant="outline" onClick={prev} disabled={idx === 0}>
            <ChevronLeft className="h-5 w-5" />
          </Button>
          <div className="flex gap-1.5 items-center">
            {SLIDES.map((_, i) => (
              <button
                key={i}
                onClick={() => setIdx(i)}
                className="h-2 rounded-full transition-all"
                style={{
                  width: i === idx ? 28 : 8,
                  background: i === idx ? GOLD : "rgba(255,255,255,0.25)",
                }}
                aria-label={`Ir para slide ${i + 1}`}
              />
            ))}
          </div>
          <Button size="icon" variant="outline" onClick={next} disabled={idx === SLIDES.length - 1}>
            <ChevronRight className="h-5 w-5" />
          </Button>
        </div>
      )}

      {fullscreen && (
        <>
          <button onClick={prev} className="fixed left-4 top-1/2 -translate-y-1/2 p-3 rounded-full bg-white/10 hover:bg-white/20 text-white" aria-label="Anterior">
            <ChevronLeft className="h-6 w-6" />
          </button>
          <button onClick={next} className="fixed right-4 top-1/2 -translate-y-1/2 p-3 rounded-full bg-white/10 hover:bg-white/20 text-white" aria-label="Próximo">
            <ChevronRight className="h-6 w-6" />
          </button>
          <div className="fixed bottom-4 left-1/2 -translate-x-1/2 px-4 py-2 rounded-full bg-black/60 text-white text-xs">
            {idx + 1} / {SLIDES.length}
          </div>
        </>
      )}
    </div>
  );
}
