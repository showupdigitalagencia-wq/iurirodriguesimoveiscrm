import { createFileRoute, redirect } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import {
  ChevronLeft, ChevronRight, Download, Maximize2, Radio, Building2, Bot,
  CalendarDays, Key, BarChart3, Trophy, Newspaper, Smartphone, DollarSign,
  Target, AlertTriangle, CheckCircle2, Sparkles,
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
  render: () => JSX.Element;
  // pdf representation
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

const SLIDES: SlideDef[] = [
  {
    id: 1,
    title: "Capa",
    pdf: { title: "Ecossistema Nexus", subtitle: "Tecnologia, organização e crescimento para o seu dia a dia como corretor", bullets: ["Iuri Rodrigues Imóveis"] },
    render: () => (
      <SlideShell>
        <div className="space-y-6">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-xs tracking-[0.3em] uppercase" style={{ background: "rgba(201,161,74,0.15)", color: GOLD_SOFT, border: `1px solid ${GOLD}55` }}>
            <Sparkles className="h-3.5 w-3.5" /> Apresentação institucional
          </div>
          <h1 className="text-6xl md:text-8xl font-bold tracking-tight" style={{ fontFamily: "'Cormorant Garamond', serif" }}>
            Ecossistema <span style={{ color: GOLD }}>Nexus</span>
          </h1>
          <p className="text-xl md:text-2xl max-w-3xl opacity-90">Tecnologia, organização e crescimento para o seu dia a dia como corretor.</p>
          <div className="text-sm tracking-widest uppercase opacity-70 pt-4">Iuri Rodrigues Imóveis</div>
        </div>
      </SlideShell>
    ),
  },
  {
    id: 2,
    title: "A dor",
    pdf: {
      eyebrow: "O problema",
      title: "Quantas vezes você já perdeu um lead por demorar pra responder?",
      cards: [
        { title: "Lead esquecido", body: "Mensagem some no WhatsApp e o cliente vai pro concorrente." },
        { title: "Chave sem controle", body: "Ninguém sabe onde está. A visita atrasa. O cliente desiste." },
        { title: "Sem visão clara", body: "Você não sabe quanto vendeu, quem está produzindo, o que melhorar." },
      ],
    },
    render: () => (
      <SlideShell eyebrow="O problema">
        <div className="space-y-8">
          <h2 className="text-4xl md:text-5xl font-semibold max-w-4xl leading-tight" style={{ fontFamily: "'Cormorant Garamond', serif" }}>
            Quantas vezes você já <span style={{ color: GOLD }}>perdeu um lead</span> por demorar pra responder?
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {[
              { i: AlertTriangle, t: "Lead esquecido", d: "Mensagem some no WhatsApp e o cliente vai pro concorrente." },
              { i: Key, t: "Chave sem controle", d: "Ninguém sabe onde está. A visita atrasa. O cliente desiste." },
              { i: BarChart3, t: "Sem visão clara", d: "Você não sabe quanto vendeu, quem está produzindo, o que melhorar." },
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
      title: "Um único ecossistema. Tudo conectado.",
      cards: [
        { title: "Plantão", body: "Distribuição justa de leads" },
        { title: "Portfólio", body: "Imóveis no bolso" },
        { title: "Laura IA", body: "Sua assistente 24/7" },
        { title: "Agenda", body: "Visitas e reuniões" },
        { title: "Chaves", body: "Controle total" },
        { title: "Relatórios", body: "Clareza no resultado" },
        { title: "Conquistas", body: "Metas e badges" },
        { title: "Início (Feed)", body: "Time conectado" },
      ],
    },
    render: () => (
      <SlideShell eyebrow="A solução">
        <div className="space-y-8">
          <h2 className="text-4xl md:text-5xl font-semibold" style={{ fontFamily: "'Cormorant Garamond', serif" }}>
            Um único ecossistema. <span style={{ color: GOLD }}>Tudo conectado.</span>
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
      title: "Nenhum lead fica sem dono",
      bullets: [
        "Lead chega → sistema identifica o plantonista do dia",
        "Notificação imediata. Você tem 10 minutos pra responder",
        "Se não responder, escalona automaticamente pro próximo",
        "Distribuição justa, rastreável e transparente",
      ],
    },
    render: () => (
      <SlideShell eyebrow="Plantão">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-10 items-center">
          <div className="space-y-4">
            <h2 className="text-5xl font-semibold" style={{ fontFamily: "'Cormorant Garamond', serif" }}>
              Nenhum lead fica <span style={{ color: GOLD }}>sem dono</span>.
            </h2>
            <p className="opacity-85 text-lg">Distribuição automática, com verificação de agenda e escalonamento por SLA.</p>
            <div className="text-sm opacity-75">Benefícios: justiça na distribuição, resposta rápida, mais conversão.</div>
          </div>
          <GlassCard>
            <ol className="space-y-4">
              {[
                "Lead chega via WhatsApp ou site",
                "Sistema identifica o plantonista do dia",
                "Notificação imediata: 10 minutos pra responder",
                "Sem resposta? Escalona automaticamente",
              ].map((s, i) => (
                <li key={i} className="flex gap-3 items-start">
                  <span className="h-7 w-7 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0" style={{ background: GOLD, color: NAVY }}>{i + 1}</span>
                  <span className="opacity-90">{s}</span>
                </li>
              ))}
            </ol>
          </GlassCard>
        </div>
      </SlideShell>
    ),
  },
  {
    id: 5,
    title: "Portfólio",
    pdf: {
      eyebrow: "Portfólio",
      title: "Todo o portfólio no seu bolso",
      bullets: ["Busca por região e finalidade", "Fotos reais, atualizadas", "Compartilhar em 1 toque (WhatsApp)", "Vitrine pronta pra mandar pro cliente"],
    },
    render: () => (
      <SlideShell eyebrow="Portfólio">
        <div className="space-y-6 max-w-4xl">
          <h2 className="text-5xl font-semibold" style={{ fontFamily: "'Cormorant Garamond', serif" }}>
            Todo o portfólio <span style={{ color: GOLD }}>no seu bolso</span>.
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4">
            {["Busca por região e finalidade", "Fotos reais, sempre atualizadas", "Compartilhar em 1 toque pelo WhatsApp", "Vitrine pronta pra mandar pro cliente"].map((b, i) => (
              <GlassCard key={i} className="flex items-center gap-3 py-4">
                <CheckCircle2 className="h-5 w-5 flex-shrink-0" style={{ color: GOLD }} />
                <span>{b}</span>
              </GlassCard>
            ))}
          </div>
        </div>
      </SlideShell>
    ),
  },
  {
    id: 6,
    title: "Laura IA",
    pdf: {
      eyebrow: "Inteligência Artificial",
      title: "Laura — sua assistente que entende imóvel",
      bullets: [
        "\"Temos apartamento na Barra até R$ 2.500?\"",
        "\"Me coloca de plantão na quinta.\"",
        "\"Agenda visita amanhã 15h pro João.\"",
        "Busca imóveis, agenda, registra visitas, atualiza leads.",
      ],
    },
    render: () => (
      <SlideShell eyebrow="Inteligência Artificial">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-10 items-center">
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <Bot className="h-10 w-10" style={{ color: GOLD }} />
              <h2 className="text-5xl font-semibold" style={{ fontFamily: "'Cormorant Garamond', serif" }}>Laura</h2>
            </div>
            <p className="text-xl opacity-90">Sua assistente que entende imóvel. Fala por texto, áudio e foto.</p>
            <ul className="space-y-2 text-sm opacity-80 pt-2">
              <li>• Busca no portfólio em segundos</li>
              <li>• Agenda visitas e plantão</li>
              <li>• Registra ações no sistema</li>
            </ul>
          </div>
          <div className="space-y-3">
            {[
              "Temos apartamento na Barra até R$ 2.500?",
              "Me coloca de plantão na quinta.",
              "Agenda visita amanhã 15h pro João.",
            ].map((m, i) => (
              <GlassCard key={i} className="py-4">
                <div className="text-xs uppercase tracking-wider opacity-60 mb-1">Você</div>
                <div className="text-base">"{m}"</div>
              </GlassCard>
            ))}
          </div>
        </div>
      </SlideShell>
    ),
  },
  {
    id: 7,
    title: "Central Hoje",
    pdf: {
      eyebrow: "Central Hoje",
      title: "Tudo que importa, em um só lugar",
      bullets: ["Leads urgentes sem primeiro contato", "Visitas de hoje", "Follow-ups vencendo", "Chaves atrasadas"],
    },
    render: () => (
      <SlideShell eyebrow="Central Hoje">
        <div className="space-y-8 max-w-5xl">
          <h2 className="text-5xl font-semibold" style={{ fontFamily: "'Cormorant Garamond', serif" }}>
            Tudo que importa, <span style={{ color: GOLD }}>em um só lugar</span>.
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
        </div>
      </SlideShell>
    ),
  },
  {
    id: 8,
    title: "Comissão",
    pdf: {
      eyebrow: "Comissão",
      title: "Comissão calculada automaticamente",
      bullets: ["Venda: 6% do valor do imóvel", "Locação: 1 aluguel cheio", "Cálculo automático ao fechar o lead", "Histórico transparente"],
    },
    render: () => (
      <SlideShell eyebrow="Comissão">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-center">
          <h2 className="text-5xl font-semibold" style={{ fontFamily: "'Cormorant Garamond', serif" }}>
            Comissão <span style={{ color: GOLD }}>calculada automaticamente</span>.
          </h2>
          <div className="space-y-4">
            <GlassCard className="flex items-center gap-4">
              <DollarSign className="h-10 w-10" style={{ color: GOLD }} />
              <div>
                <div className="text-3xl font-bold">6%</div>
                <div className="text-sm opacity-80">do valor do imóvel em venda</div>
              </div>
            </GlassCard>
            <GlassCard className="flex items-center gap-4">
              <DollarSign className="h-10 w-10" style={{ color: GOLD }} />
              <div>
                <div className="text-3xl font-bold">1 aluguel</div>
                <div className="text-sm opacity-80">cheio em contrato de locação</div>
              </div>
            </GlassCard>
          </div>
        </div>
      </SlideShell>
    ),
  },
  {
    id: 9,
    title: "Metas e Conquistas",
    pdf: {
      eyebrow: "Metas e Conquistas",
      title: "Veja seu progresso. Comemore suas vitórias.",
      bullets: ["Meta mensal sempre à vista", "Conquistas/badges automáticas", "Postagens no feed quando bate meta", "Notificação ao conquistar"],
    },
    render: () => (
      <SlideShell eyebrow="Metas e Conquistas">
        <div className="space-y-8 max-w-5xl">
          <h2 className="text-5xl font-semibold" style={{ fontFamily: "'Cormorant Garamond', serif" }}>
            Veja seu progresso. <span style={{ color: GOLD }}>Comemore suas vitórias.</span>
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <GlassCard>
              <div className="flex items-center gap-3 mb-3"><Target className="h-6 w-6" style={{ color: GOLD }} /><div className="font-semibold">Meta do mês</div></div>
              <div className="text-sm opacity-80 mb-2">R$ 18.000 / R$ 25.000</div>
              <div className="h-3 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.1)" }}>
                <div className="h-full rounded-full" style={{ width: "72%", background: `linear-gradient(90deg, ${GOLD}, ${GOLD_SOFT})` }} />
              </div>
              <div className="text-xs opacity-60 mt-2">72% atingido</div>
            </GlassCard>
            <GlassCard>
              <div className="flex items-center gap-3 mb-3"><Trophy className="h-6 w-6" style={{ color: GOLD }} /><div className="font-semibold">Conquistas recentes</div></div>
              <ul className="space-y-2 text-sm">
                <li>🏆 Primeira venda do mês</li>
                <li>⚡ Resposta relâmpago (5 min)</li>
                <li>🔥 3 visitas em um dia</li>
              </ul>
            </GlassCard>
          </div>
        </div>
      </SlideShell>
    ),
  },
  {
    id: 10,
    title: "Feed",
    pdf: {
      eyebrow: "Início",
      title: "O feed da nossa equipe",
      bullets: ["Fotos, vídeos, áudio e texto", "Stories de 24h", "Curtidas e comentários", "Conquistas viram post automaticamente"],
    },
    render: () => (
      <SlideShell eyebrow="Início">
        <div className="space-y-6 max-w-4xl">
          <h2 className="text-5xl font-semibold" style={{ fontFamily: "'Cormorant Garamond', serif" }}>
            O <span style={{ color: GOLD }}>feed da nossa equipe</span>.
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {[
              { t: "Mídia rica", d: "Foto, vídeo, áudio e texto" },
              { t: "Stories 24h", d: "Compartilhe o momento" },
              { t: "Curtidas e comentários", d: "Interação real do time" },
              { t: "Conquistas no feed", d: "Bateu meta? Vai pro feed" },
            ].map((c, i) => (
              <GlassCard key={i}>
                <div className="font-semibold" style={{ color: GOLD }}>{c.t}</div>
                <div className="text-sm opacity-80 mt-1">{c.d}</div>
              </GlassCard>
            ))}
          </div>
        </div>
      </SlideShell>
    ),
  },
  {
    id: 11,
    title: "Mobile",
    pdf: {
      eyebrow: "Mobile",
      title: "Tudo isso no seu celular",
      bullets: ["Funciona em Android e iPhone", "Notificações push em tempo real", "PWA: instala como app, sem loja", "Offline-friendly nas telas principais"],
    },
    render: () => (
      <SlideShell eyebrow="Mobile">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-10 items-center">
          <h2 className="text-5xl font-semibold" style={{ fontFamily: "'Cormorant Garamond', serif" }}>
            Tudo isso <span style={{ color: GOLD }}>no seu celular</span>.
          </h2>
          <div className="space-y-3">
            {[
              { i: Smartphone, t: "Android e iPhone", d: "Mesma experiência em qualquer aparelho" },
              { i: Sparkles, t: "Notificações push", d: "Você não perde nada importante" },
              { i: Download, t: "PWA — instala como app", d: "Sem passar por loja, atualiza sozinho" },
            ].map((c, i) => (
              <GlassCard key={i} className="flex items-center gap-4 py-4">
                <c.i className="h-7 w-7 flex-shrink-0" style={{ color: GOLD }} />
                <div>
                  <div className="font-semibold">{c.t}</div>
                  <div className="text-sm opacity-80">{c.d}</div>
                </div>
              </GlassCard>
            ))}
          </div>
        </div>
      </SlideShell>
    ),
  },
  {
    id: 12,
    title: "Resumo",
    pdf: {
      eyebrow: "Resumo",
      title: "Por que o Nexus muda o jogo",
      cards: [
        { title: "Mais leads com justiça", body: "Distribuição transparente, sem briga interna." },
        { title: "Menos tempo perdido", body: "Tudo no mesmo lugar. Menos clique, mais ação." },
        { title: "Mais clareza no resultado", body: "Você vê o que vendeu, o que falta, o que melhorar." },
        { title: "Mais conexão com o time", body: "Feed, conquistas e metas compartilhadas." },
      ],
    },
    render: () => (
      <SlideShell eyebrow="Resumo">
        <div className="space-y-8 max-w-6xl">
          <h2 className="text-5xl font-semibold" style={{ fontFamily: "'Cormorant Garamond', serif" }}>
            Por que o <span style={{ color: GOLD }}>Nexus muda o jogo</span>.
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {[
              { t: "Mais leads com justiça", d: "Distribuição transparente, sem briga interna." },
              { t: "Menos tempo perdido", d: "Tudo no mesmo lugar. Menos clique, mais ação." },
              { t: "Mais clareza no resultado", d: "Você vê o que vendeu, o que falta, o que melhorar." },
              { t: "Mais conexão com o time", d: "Feed, conquistas e metas compartilhadas." },
            ].map((c, i) => (
              <GlassCard key={i}>
                <div className="text-lg font-semibold" style={{ color: GOLD }}>{c.t}</div>
                <div className="text-sm opacity-85 mt-1">{c.d}</div>
              </GlassCard>
            ))}
          </div>
        </div>
      </SlideShell>
    ),
  },
  {
    id: 13,
    title: "Fechamento",
    pdf: {
      title: "Você é um dos próximos?",
      subtitle: "O Ecossistema Nexus está pronto. Agora é usar, todos os dias.",
    },
    render: () => (
      <SlideShell>
        <div className="space-y-8 text-center">
          <h2 className="text-7xl md:text-8xl font-semibold" style={{ fontFamily: "'Cormorant Garamond', serif" }}>
            Você é um dos <span style={{ color: GOLD }}>próximos</span>?
          </h2>
          <p className="text-2xl opacity-90 max-w-3xl mx-auto">
            O Ecossistema Nexus está pronto. <span style={{ color: GOLD_SOFT }}>Agora é usar, todos os dias.</span>
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
    // BG
    pdf.setFillColor(...navy);
    pdf.rect(0, 0, W, H, "F");
    // accent bar
    pdf.setFillColor(...gold);
    pdf.rect(0, 0, 6, H, "F");
    // top header
    pdf.setTextColor(232, 201, 119);
    pdf.setFontSize(10);
    if (slide.pdf.eyebrow) pdf.text(slide.pdf.eyebrow.toUpperCase(), 60, 50);
    pdf.setTextColor(255, 255, 255);
    pdf.text("ECOSSISTEMA NEXUS", W - 60, 50, { align: "right" });

    // title
    pdf.setTextColor(255, 255, 255);
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(slide.id === 1 || slide.id === 13 ? 64 : 40);
    const titleLines = pdf.splitTextToSize(slide.pdf.title, W - 120);
    pdf.text(titleLines, 60, slide.id === 1 || slide.id === 13 ? H / 2 - 40 : 140);

    let y = slide.id === 1 || slide.id === 13 ? H / 2 + 40 : 140 + titleLines.length * 50 + 30;

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

    // footer
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
