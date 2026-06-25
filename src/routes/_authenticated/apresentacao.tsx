import { createFileRoute, redirect } from "@tanstack/react-router";
import React, { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import {
  ChevronLeft, ChevronRight, Download, Maximize2, Radio, Building2, Bot,
  CalendarDays, Key, BarChart3, Trophy, Newspaper, Smartphone,
  Target, CheckCircle2, Sparkles, Heart, Users,
  Bed, Bath, Car, MapPin, Image as ImageIcon, MessageCircle, Share2,
  Zap, Flame, TrendingUp, Clock, Bell, ArrowRight, X, Check,
  Camera, Search, Video, FileText, Award, BookOpen,
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

// ---------------- Tokens ----------------
const NAVY = "#0A0E1A";
const NAVY_2 = "#0F1730";
const NAVY_DEEP = "#06101F";
const GOLD = "#D4AF37";
const GOLD_SOFT = "#E8C977";

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

// ---------------- Shell + Glass ----------------
function SlideShell({ children, eyebrow, dense = false }: { children: React.ReactNode; eyebrow?: string; dense?: boolean }) {
  return (
    <div
      className="relative w-full h-full overflow-hidden text-white"
      style={{
        background: `radial-gradient(1400px 700px at 15% -10%, ${GOLD}22, transparent 60%), radial-gradient(1000px 600px at 110% 110%, ${GOLD}18, transparent 60%), linear-gradient(135deg, ${NAVY} 0%, ${NAVY_DEEP} 100%)`,
      }}
    >
      <div className="absolute inset-0 opacity-[0.04]" style={{ backgroundImage: "linear-gradient(white 1px, transparent 1px), linear-gradient(90deg, white 1px, transparent 1px)", backgroundSize: "56px 56px" }} />
      {eyebrow && (
        <div className="absolute top-7 left-10 text-[11px] tracking-[0.4em] uppercase font-medium" style={{ color: GOLD_SOFT }}>
          {eyebrow}
        </div>
      )}
      <div className="absolute top-7 right-10 text-[11px] tracking-[0.3em] uppercase opacity-70">Ecossistema Nexus</div>
      <div className={`relative z-10 w-full h-full flex flex-col justify-center ${dense ? "px-8 md:px-14" : "px-10 md:px-20"}`}>{children}</div>
      <div className="absolute bottom-5 left-10 right-10 flex items-center justify-between text-[11px] opacity-60">
        <span>Iuri Rodrigues Imóveis</span>
        <span className="h-[1px] flex-1 mx-6" style={{ background: `linear-gradient(90deg, transparent, ${GOLD}, transparent)` }} />
        <span>2026</span>
      </div>
    </div>
  );
}

function GlassCard({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div
      className={`rounded-2xl border backdrop-blur-xl p-5 ${className}`}
      style={{ background: "rgba(255,255,255,0.05)", borderColor: "rgba(212,175,55,0.3)" }}
    >
      {children}
    </div>
  );
}

function Headline({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="text-5xl md:text-6xl font-semibold leading-[1.05]" style={{ fontFamily: "'Cormorant Garamond', serif" }}>
      {children}
    </h2>
  );
}

// ---------------- Mockups (mockups visuais reais da identidade Nexus) ----------------

function MockPlantaoCard() {
  return (
    <div className="rounded-2xl border shadow-2xl p-6 w-full max-w-md" style={{ background: NAVY_2, borderColor: `${GOLD}55` }}>
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-2 text-[11px] tracking-[0.25em] uppercase" style={{ color: GOLD_SOFT }}>
          <Radio className="h-3.5 w-3.5" /> Plantonista de hoje
        </div>
        <span className="text-[10px] px-2.5 py-1 rounded-full flex items-center gap-1.5" style={{ background: `${GOLD}22`, color: GOLD_SOFT }}>
          <span className="h-1.5 w-1.5 rounded-full animate-pulse" style={{ background: "#22c55e" }} /> Ao vivo
        </span>
      </div>
      <div className="flex items-center gap-4">
        <div className="h-16 w-16 rounded-full flex items-center justify-center text-2xl font-bold" style={{ background: `linear-gradient(135deg, ${GOLD}, ${GOLD_SOFT})`, color: NAVY }}>
          PR
        </div>
        <div>
          <div className="text-xl font-semibold text-white">Pedro Ramos</div>
          <div className="text-sm opacity-70">Barra · Recreio</div>
        </div>
      </div>
      <div className="mt-5 grid grid-cols-3 gap-2 text-center">
        {[
          { v: "12", l: "Recebidos" },
          { v: "10", l: "Atendidos" },
          { v: "3m", l: "T. resposta" },
        ].map((s, i) => (
          <div key={i} className="rounded-lg py-3" style={{ background: "rgba(255,255,255,0.05)" }}>
            <div className="text-2xl font-bold" style={{ color: GOLD }}>{s.v}</div>
            <div className="text-[10px] opacity-60 uppercase tracking-wider">{s.l}</div>
          </div>
        ))}
      </div>
      <div className="mt-4 rounded-lg p-3 text-xs flex items-center gap-2" style={{ background: "rgba(34,197,94,0.1)", border: "1px solid rgba(34,197,94,0.3)" }}>
        <CheckCircle2 className="h-4 w-4" style={{ color: "#22c55e" }} />
        <span>Lead novo distribuído há 38s — Pedro respondeu em 2min.</span>
      </div>
    </div>
  );
}

function MockImovelCard() {
  return (
    <div className="rounded-2xl overflow-hidden border shadow-2xl w-full max-w-sm bg-white text-slate-900">
      <div className="relative h-48" style={{ background: `linear-gradient(135deg, #1e293b 0%, #475569 100%)` }}>
        <div className="absolute inset-0 flex items-center justify-center opacity-30">
          <Building2 className="h-24 w-24 text-white" />
        </div>
        <div className="absolute top-3 left-3 text-[10px] px-2.5 py-1 rounded-full font-bold" style={{ background: GOLD, color: NAVY }}>
          VENDA
        </div>
        <div className="absolute bottom-3 right-3 text-[10px] px-2 py-1 rounded-full bg-black/70 text-white flex items-center gap-1">
          <ImageIcon className="h-3 w-3" /> 12
        </div>
        <button className="absolute bottom-3 left-3 h-8 w-8 rounded-full flex items-center justify-center" style={{ background: GOLD, color: NAVY }}>
          <Share2 className="h-4 w-4" />
        </button>
      </div>
      <div className="p-4 space-y-2">
        <div className="text-[10px] uppercase tracking-wider text-slate-500 font-medium">IM-2840 · Barra da Tijuca</div>
        <div className="text-2xl font-bold" style={{ color: NAVY }}>R$ 1.180.000</div>
        <div className="flex items-center gap-1 text-xs text-slate-600">
          <MapPin className="h-3.5 w-3.5" /> Av. das Américas, 4500
        </div>
        <div className="flex items-center gap-3 text-xs text-slate-700 pt-2 border-t">
          <span className="flex items-center gap-1"><Bed className="h-3.5 w-3.5" /> 3</span>
          <span className="flex items-center gap-1"><Bath className="h-3.5 w-3.5" /> 2</span>
          <span className="flex items-center gap-1"><Car className="h-3.5 w-3.5" /> 2</span>
          <span className="ml-auto font-semibold">98 m²</span>
        </div>
      </div>
    </div>
  );
}

function MockAgendaCard() {
  const items = [
    { h: "09:00", t: "Visita · Av. Lúcio Costa, 320", tag: "Visita", color: GOLD, icon: MapPin },
    { h: "11:30", t: "Reunião · João Silva", tag: "Reunião", color: "#60a5fa", icon: Users },
    { h: "14:00", t: "Google Meet · Proposta", tag: "Meet", color: "#22c55e", icon: Video },
    { h: "16:30", t: "Follow-up · Mariana", tag: "Follow", color: "#f59e0b", icon: Bell },
  ];
  return (
    <div className="rounded-2xl border shadow-2xl p-5 w-full max-w-md" style={{ background: NAVY_2, borderColor: `${GOLD}55` }}>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2 text-[11px] tracking-[0.25em] uppercase" style={{ color: GOLD_SOFT }}>
          <CalendarDays className="h-3.5 w-3.5" /> Agenda · Hoje
        </div>
        <span className="text-[10px] opacity-60">Qui, 28 nov</span>
      </div>
      <div className="space-y-2">
        {items.map((it, i) => (
          <div key={i} className="flex items-center gap-3 rounded-xl p-3" style={{ background: "rgba(255,255,255,0.04)" }}>
            <div className="text-xs font-mono font-semibold w-12" style={{ color: GOLD_SOFT }}>{it.h}</div>
            <div className="h-8 w-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: `${it.color}22`, color: it.color }}>
              <it.icon className="h-4 w-4" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm text-white truncate">{it.t}</div>
              <div className="text-[10px] uppercase tracking-wider opacity-50">{it.tag}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function MockChaveCard() {
  return (
    <div className="rounded-2xl border shadow-2xl p-5 w-full max-w-md" style={{ background: NAVY_2, borderColor: `${GOLD}55` }}>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2 text-[11px] tracking-[0.25em] uppercase" style={{ color: GOLD_SOFT }}>
          <Key className="h-3.5 w-3.5" /> Chave · IM-2840
        </div>
        <span className="text-[10px] px-2 py-0.5 rounded-full" style={{ background: "rgba(34,197,94,0.15)", color: "#86efac" }}>Retirada</span>
      </div>
      <div className="grid grid-cols-2 gap-3 mb-4">
        <div className="rounded-xl overflow-hidden aspect-square flex items-center justify-center relative" style={{ background: `linear-gradient(135deg, ${NAVY_DEEP}, ${NAVY})` }}>
          <Camera className="h-10 w-10 opacity-30" />
          <div className="absolute bottom-2 left-2 text-[9px] uppercase tracking-wider opacity-70">Retirada · 09:14</div>
        </div>
        <div className="rounded-xl overflow-hidden aspect-square flex items-center justify-center border-dashed border-2 border-white/15">
          <div className="text-center opacity-50">
            <Camera className="h-8 w-8 mx-auto mb-1" />
            <div className="text-[10px]">Aguarda devolução</div>
          </div>
        </div>
      </div>
      <div className="space-y-1.5 text-xs">
        <div className="flex justify-between"><span className="opacity-60">Corretor</span><span className="text-white">Pedro Ramos</span></div>
        <div className="flex justify-between"><span className="opacity-60">Cliente</span><span className="text-white">Marina S.</span></div>
        <div className="flex justify-between"><span className="opacity-60">Previsão devolução</span><span style={{ color: GOLD_SOFT }}>Hoje · 12h</span></div>
      </div>
    </div>
  );
}

function MockHojeCard() {
  const blocks = [
    { i: Radio, t: "Plantão", v: "1 ativo", c: "#22c55e" },
    { i: Zap, t: "Leads urgentes", v: "3 sem contato", c: "#ef4444" },
    { i: MapPin, t: "Visitas hoje", v: "4 agendadas", c: GOLD },
    { i: Clock, t: "Follow-ups", v: "2 vencendo", c: "#f59e0b" },
    { i: Key, t: "Chaves", v: "1 em atraso", c: "#ef4444" },
    { i: Users, t: "Captação", v: "5 candidatos", c: "#60a5fa" },
  ];
  return (
    <div className="rounded-2xl border shadow-2xl p-5 w-full" style={{ background: NAVY_2, borderColor: `${GOLD}55` }}>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2 text-[11px] tracking-[0.25em] uppercase" style={{ color: GOLD_SOFT }}>
          <Sparkles className="h-3.5 w-3.5" /> Central Hoje
        </div>
        <span className="text-[10px] opacity-60">Atualizado agora</span>
      </div>
      <div className="grid grid-cols-3 gap-3">
        {blocks.map((b, i) => (
          <div key={i} className="rounded-xl p-3" style={{ background: "rgba(255,255,255,0.04)" }}>
            <div className="flex items-center gap-2 mb-2">
              <b.i className="h-4 w-4" style={{ color: b.c }} />
              <div className="text-[10px] uppercase tracking-wider opacity-70">{b.t}</div>
            </div>
            <div className="text-sm font-semibold text-white">{b.v}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function MockDashboard() {
  return (
    <div className="rounded-2xl border shadow-2xl p-5 w-full" style={{ background: NAVY_2, borderColor: `${GOLD}55` }}>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2 text-[11px] tracking-[0.25em] uppercase" style={{ color: GOLD_SOFT }}>
          <BarChart3 className="h-3.5 w-3.5" /> Performance · Novembro
        </div>
        <span className="text-[10px] opacity-60">Últimos 30 dias</span>
      </div>
      {/* KPI strip */}
      <div className="grid grid-cols-4 gap-2 mb-4">
        {[
          { v: "124", l: "Leads", c: GOLD },
          { v: "41", l: "Visitas", c: "#60a5fa" },
          { v: "7", l: "Vendas", c: "#22c55e" },
          { v: "4m", l: "T. resposta", c: GOLD_SOFT },
        ].map((k, i) => (
          <div key={i} className="rounded-lg p-2.5" style={{ background: "rgba(255,255,255,0.04)" }}>
            <div className="text-xl font-bold" style={{ color: k.c }}>{k.v}</div>
            <div className="text-[9px] uppercase tracking-wider opacity-60">{k.l}</div>
          </div>
        ))}
      </div>
      {/* Funil */}
      <div className="space-y-1.5 mb-4">
        {[
          { l: "Novos leads", w: "100%", v: 124 },
          { l: "Contato", w: "72%", v: 89 },
          { l: "Visita", w: "33%", v: 41 },
          { l: "Proposta", w: "15%", v: 18 },
          { l: "Fechado", w: "6%", v: 7 },
        ].map((e, i) => (
          <div key={i}>
            <div className="flex justify-between text-[10px] mb-0.5">
              <span className="opacity-80 text-white">{e.l}</span>
              <span style={{ color: GOLD_SOFT }}>{e.v}</span>
            </div>
            <div className="h-1.5 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.06)" }}>
              <div className="h-full rounded-full" style={{ width: e.w, background: `linear-gradient(90deg, ${GOLD}, ${GOLD_SOFT})` }} />
            </div>
          </div>
        ))}
      </div>
      {/* Bar chart */}
      <div className="pt-3 border-t border-white/10">
        <div className="text-[10px] uppercase tracking-wider opacity-60 mb-2">Vendas por semana</div>
        <div className="flex items-end gap-2 h-16">
          {[40, 65, 50, 80, 55, 90, 75].map((h, i) => (
            <div key={i} className="flex-1 rounded-t" style={{ height: `${h}%`, background: `linear-gradient(180deg, ${GOLD}, ${GOLD}55)` }} />
          ))}
        </div>
      </div>
    </div>
  );
}

function MockFeedPost() {
  return (
    <div className="rounded-2xl overflow-hidden border shadow-2xl w-full max-w-sm bg-white text-slate-900">
      {/* Stories strip */}
      <div className="flex gap-2 p-3 border-b overflow-hidden">
        {["MS", "PR", "JC", "AL"].map((n, i) => (
          <div key={i} className="flex-shrink-0">
            <div className="h-12 w-12 rounded-full p-0.5" style={{ background: `linear-gradient(135deg, ${GOLD}, ${GOLD_SOFT})` }}>
              <div className="h-full w-full rounded-full flex items-center justify-center text-xs font-bold bg-white" style={{ color: NAVY }}>
                {n}
              </div>
            </div>
          </div>
        ))}
      </div>
      <div className="flex items-center gap-3 p-3">
        <div className="h-10 w-10 rounded-full flex items-center justify-center text-sm font-bold" style={{ background: `linear-gradient(135deg, ${GOLD}, ${GOLD_SOFT})`, color: NAVY }}>
          MS
        </div>
        <div className="flex-1">
          <div className="text-sm font-semibold">Mariana Silva</div>
          <div className="text-[11px] text-slate-500">há 12 min · Recreio</div>
        </div>
      </div>
      <div className="h-44 flex items-center justify-center" style={{ background: `linear-gradient(135deg, ${NAVY}, ${NAVY_DEEP})` }}>
        <div className="text-center text-white px-6">
          <Trophy className="h-12 w-12 mx-auto mb-2" style={{ color: GOLD }} />
          <div className="font-semibold">Fechei minha 3ª venda do mês!</div>
        </div>
      </div>
      <div className="p-3">
        <div className="flex items-center gap-4 text-slate-700 text-sm">
          <span className="flex items-center gap-1.5"><Heart className="h-5 w-5" style={{ color: "#e11d48", fill: "#e11d48" }} /> 24</span>
          <span className="flex items-center gap-1.5"><MessageCircle className="h-5 w-5" /> 7</span>
          <span className="flex items-center gap-1.5 ml-auto"><Share2 className="h-5 w-5" /></span>
        </div>
        <div className="text-xs text-slate-600 mt-2">
          <span className="font-semibold">Carlos:</span> Parabéns, Mari!
        </div>
      </div>
    </div>
  );
}

function MockPhoneFrame({ variant = "dashboard" }: { variant?: "dashboard" | "chat" }) {
  return (
    <div className="relative mx-auto" style={{ width: 240, height: 480 }}>
      <div className="absolute inset-0 rounded-[36px] border-[10px] shadow-2xl" style={{ borderColor: "#1a1a1a", background: "#000" }}>
        <div className="absolute top-1 left-1/2 -translate-x-1/2 w-20 h-5 rounded-b-xl z-10" style={{ background: "#1a1a1a" }} />
        <div className="absolute inset-0 m-0 rounded-[26px] overflow-hidden" style={{ background: `linear-gradient(180deg, ${NAVY}, ${NAVY_DEEP})` }}>
          {variant === "dashboard" ? (
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
                <div className="text-[10px] opacity-60 mt-1">72% atingido</div>
              </div>
              <div className="rounded-xl p-3" style={{ background: "rgba(255,255,255,0.08)" }}>
                <div className="flex items-center gap-2 text-[10px] uppercase tracking-wider mb-1.5" style={{ color: GOLD_SOFT }}>
                  <CalendarDays className="h-3 w-3" /> Hoje
                </div>
                <div className="text-[11px] space-y-0.5">
                  <div>· 14h Visita — Av. Lúcio</div>
                  <div>· Follow-up João Silva</div>
                </div>
              </div>
            </div>
          ) : (
            <div className="px-3 pt-8 pb-2 text-white text-[11px]">
              <div className="flex items-center gap-2 mb-3 pb-2 border-b border-white/10">
                <Bot className="h-5 w-5" style={{ color: GOLD }} />
                <div className="text-sm font-semibold">Laura</div>
              </div>
              <div className="space-y-2">
                <div className="ml-auto max-w-[80%] rounded-xl rounded-br-sm px-2.5 py-1.5" style={{ background: `${GOLD}33` }}>
                  Atualize minha disponibilidade
                </div>
                <div className="max-w-[80%] rounded-xl rounded-bl-sm px-2.5 py-1.5" style={{ background: "rgba(255,255,255,0.08)" }}>
                  Pronto. Seg-Sex, 10–18h.
                </div>
                <div className="ml-auto max-w-[80%] rounded-xl rounded-br-sm px-2.5 py-1.5" style={{ background: `${GOLD}33` }}>
                  Visita do João foi realizada
                </div>
                <div className="max-w-[80%] rounded-xl rounded-bl-sm px-2.5 py-1.5" style={{ background: "rgba(255,255,255,0.08)" }}>
                  Registrei. Quer marcar follow-up?
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ---------------- Slides ----------------
const SLIDES: SlideDef[] = [
  // 1 — Capa
  {
    id: 1,
    title: "Capa",
    pdf: { title: "Ecossistema Nexus", subtitle: "A tecnologia que trabalha para você", bullets: ["Iuri Rodrigues Imóveis"] },
    render: () => (
      <SlideShell>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-10 items-center">
          <div className="space-y-7">
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-[11px] tracking-[0.35em] uppercase" style={{ background: "rgba(212,175,55,0.12)", color: GOLD_SOFT, border: `1px solid ${GOLD}55` }}>
              <Sparkles className="h-3.5 w-3.5" /> Apresentação institucional
            </div>
            <h1 className="text-7xl md:text-8xl font-bold tracking-tight leading-[0.95]" style={{ fontFamily: "'Cormorant Garamond', serif" }}>
              Ecossistema<br /><span style={{ color: GOLD }}>Nexus</span>
            </h1>
            <p className="text-2xl md:text-3xl opacity-90 font-light" style={{ fontFamily: "'Cormorant Garamond', serif" }}>
              A tecnologia que <span style={{ color: GOLD_SOFT }}>trabalha para você</span>.
            </p>
            <div className="text-xs tracking-[0.35em] uppercase opacity-60 pt-4">Iuri Rodrigues Imóveis</div>
          </div>
          <div className="hidden md:flex items-center justify-center gap-6">
            <div className="opacity-90"><MockPhoneFrame /></div>
            <div className="space-y-4 self-end">
              <div className="scale-90 origin-top-right"><MockHojeCard /></div>
            </div>
          </div>
        </div>
      </SlideShell>
    ),
  },

  // 2 — Antes x Depois
  {
    id: 2,
    title: "Antes x Depois",
    pdf: {
      eyebrow: "Antes x Depois",
      title: "A virada de chave.",
      cards: [
        { title: "ANTES", body: "Leads perdidos · WhatsApp caótico · Agenda confusa · Sem acompanhamento" },
        { title: "DEPOIS", body: "Tudo centralizado · IA auxiliando · Plantão automatizado · Relatórios em tempo real" },
      ],
    },
    render: () => (
      <SlideShell eyebrow="A virada de chave">
        <div className="space-y-8">
          <Headline>Antes <span style={{ color: GOLD }}>x</span> Depois.</Headline>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="rounded-2xl border p-7 space-y-3" style={{ background: "rgba(239,68,68,0.06)", borderColor: "rgba(239,68,68,0.3)" }}>
              <div className="flex items-center gap-2 text-[11px] tracking-[0.3em] uppercase font-semibold" style={{ color: "#fca5a5" }}>Antes</div>
              <ul className="space-y-3 text-base">
                {["Leads perdidos no WhatsApp", "Agenda confusa e dispersa", "Falta de acompanhamento", "Sem visão de performance"].map((t, i) => (
                  <li key={i} className="flex items-center gap-3"><X className="h-5 w-5 flex-shrink-0" style={{ color: "#ef4444" }} /><span className="opacity-90">{t}</span></li>
                ))}
              </ul>
            </div>
            <div className="rounded-2xl border p-7 space-y-3" style={{ background: "rgba(212,175,55,0.08)", borderColor: `${GOLD}55` }}>
              <div className="flex items-center gap-2 text-[11px] tracking-[0.3em] uppercase font-semibold" style={{ color: GOLD_SOFT }}>Depois · Nexus</div>
              <ul className="space-y-3 text-base">
                {["Tudo centralizado em um só lugar", "IA Laura auxiliando 24h", "Plantão automatizado", "Relatórios em tempo real"].map((t, i) => (
                  <li key={i} className="flex items-center gap-3"><Check className="h-5 w-5 flex-shrink-0" style={{ color: GOLD }} /><span>{t}</span></li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </SlideShell>
    ),
  },

  // 3 — Fluxograma
  {
    id: 3,
    title: "Como funciona",
    pdf: {
      eyebrow: "Como funciona",
      title: "Do lead ao fechamento, sem fricção.",
      bullets: ["Lead → Plantão → Corretor → Agenda → Visita → Proposta → Fechamento"],
    },
    render: () => (
      <SlideShell eyebrow="Como o Nexus funciona">
        <div className="space-y-10">
          <Headline>Do lead ao <span style={{ color: GOLD }}>fechamento</span>.</Headline>
          <div className="flex flex-wrap items-center justify-center gap-3 md:gap-2">
            {[
              { i: Users, t: "Lead" },
              { i: Radio, t: "Plantão" },
              { i: Bot, t: "Corretor" },
              { i: CalendarDays, t: "Agenda" },
              { i: MapPin, t: "Visita" },
              { i: FileText, t: "Proposta" },
              { i: Trophy, t: "Fechamento" },
            ].map((s, i, arr) => (
              <React.Fragment key={i}>
                <div className="flex flex-col items-center gap-2 px-3">
                  <div className="h-16 w-16 rounded-2xl flex items-center justify-center border" style={{ background: "rgba(212,175,55,0.1)", borderColor: `${GOLD}66` }}>
                    <s.i className="h-7 w-7" style={{ color: GOLD }} />
                  </div>
                  <div className="text-sm font-medium">{s.t}</div>
                </div>
                {i < arr.length - 1 && <ArrowRight className="h-5 w-5 opacity-50" style={{ color: GOLD }} />}
              </React.Fragment>
            ))}
          </div>
          <p className="text-center text-lg opacity-80">Cada etapa, conectada. <span style={{ color: GOLD_SOFT }}>Nada se perde no caminho</span>.</p>
        </div>
      </SlideShell>
    ),
  },

  // 4 — Plantão
  {
    id: 4,
    title: "Plantão",
    pdf: {
      eyebrow: "Sistema de Plantão",
      title: "Mais velocidade = mais conversão.",
      bullets: ["Distribuição automática", "10 minutos para atendimento", "Escalonamento automático", "Nenhuma oportunidade perdida"],
    },
    render: () => (
      <SlideShell eyebrow="Sistema de Plantão">
        <div className="grid grid-cols-1 md:grid-cols-5 gap-10 items-center">
          <div className="md:col-span-2 space-y-5">
            <Headline>Mais velocidade,<br /><span style={{ color: GOLD }}>mais conversão</span>.</Headline>
            <ul className="space-y-2.5 text-base opacity-90">
              {["Distribuição automática", "10 min para atendimento", "Escalonamento se demorar", "Nenhuma oportunidade perdida"].map((t, i) => (
                <li key={i} className="flex items-start gap-2"><CheckCircle2 className="h-5 w-5 mt-0.5 flex-shrink-0" style={{ color: GOLD }} />{t}</li>
              ))}
            </ul>
          </div>
          <div className="md:col-span-3 flex justify-center">
            <MockPlantaoCard />
          </div>
        </div>
      </SlideShell>
    ),
  },

  // 5 — Portfólio
  {
    id: 5,
    title: "Portfólio",
    pdf: {
      eyebrow: "Portfólio Inteligente",
      title: "Imóveis no seu bolso.",
      bullets: ["Fotos profissionais", "Busca por região e preço", "Compartilhamento em um toque"],
    },
    render: () => (
      <SlideShell eyebrow="Portfólio Inteligente">
        <div className="grid grid-cols-1 md:grid-cols-5 gap-10 items-center">
          <div className="md:col-span-2 space-y-5">
            <Headline>Imóveis <span style={{ color: GOLD }}>no seu bolso</span>.</Headline>
            <ul className="space-y-2.5 text-base opacity-90">
              {[
                { i: ImageIcon, t: "Fotos profissionais" },
                { i: Search, t: "Busca por região e preço" },
                { i: Share2, t: "Compartilhar em 1 toque" },
              ].map((t, i) => (
                <li key={i} className="flex items-start gap-2"><t.i className="h-5 w-5 mt-0.5 flex-shrink-0" style={{ color: GOLD }} />{t.t}</li>
              ))}
            </ul>
          </div>
          <div className="md:col-span-3 flex justify-center">
            <MockImovelCard />
          </div>
        </div>
      </SlideShell>
    ),
  },

  // 6 — Agenda
  {
    id: 6,
    title: "Agenda Nexus",
    pdf: {
      eyebrow: "Agenda Nexus",
      title: "Seu dia organizado em um único lugar.",
      bullets: ["Visitas e reuniões", "Integração Google Meet", "Organização diária automática"],
    },
    render: () => (
      <SlideShell eyebrow="Agenda Nexus">
        <div className="grid grid-cols-1 md:grid-cols-5 gap-10 items-center">
          <div className="md:col-span-2 space-y-5">
            <Headline>Seu dia <span style={{ color: GOLD }}>organizado</span>.</Headline>
            <p className="text-lg opacity-80">Visitas, reuniões e Google Meet — tudo num único lugar.</p>
            <ul className="space-y-2.5 text-base opacity-90">
              {["Visitas e reuniões", "Google Meet integrado", "Organização automática"].map((t, i) => (
                <li key={i} className="flex items-start gap-2"><CheckCircle2 className="h-5 w-5 mt-0.5 flex-shrink-0" style={{ color: GOLD }} />{t}</li>
              ))}
            </ul>
          </div>
          <div className="md:col-span-3 flex justify-center">
            <MockAgendaCard />
          </div>
        </div>
      </SlideShell>
    ),
  },

  // 7 — Laura IA (chat real)
  {
    id: 7,
    title: "Laura IA",
    pdf: {
      eyebrow: "Laura IA",
      title: "Sua assistente de produtividade.",
      bullets: [
        "\"Estou disponível seg a sex, 10h–18h. Atualize minha disponibilidade.\" → Laura ajusta a agenda.",
        "\"A visita com o João foi realizada.\" → Laura registra no sistema.",
        "\"Quais são meus leads mais urgentes hoje?\" → Laura mostra prioridades.",
        "\"Quais imóveis disponíveis na Barra até R$ 700 mil?\" → Laura busca no portfólio.",
      ],
    },
    render: () => (
      <SlideShell eyebrow="Laura IA · Sua assistente">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-10 items-center">
          <div className="space-y-5">
            <div className="flex items-center gap-3">
              <div className="h-14 w-14 rounded-2xl flex items-center justify-center" style={{ background: `linear-gradient(135deg, ${GOLD}, ${GOLD_SOFT})`, color: NAVY }}>
                <Bot className="h-7 w-7" />
              </div>
              <Headline>Laura <span style={{ color: GOLD }}>IA</span></Headline>
            </div>
            <p className="text-lg opacity-85">Você fala. Ela <span style={{ color: GOLD_SOFT }}>faz direto no sistema</span>.</p>
            <p className="text-sm opacity-70 italic border-l-2 pl-3" style={{ borderColor: GOLD }}>
              "A Laura não substitui você. Ela elimina tarefas operacionais para que você tenha mais tempo para vender."
            </p>
          </div>
          <div className="space-y-2.5">
            {[
              { q: "Estou disponível esta semana, seg a sex, das 10h às 18h. Atualize minha disponibilidade.", a: "Disponibilidade atualizada na sua agenda." },
              { q: "A visita com o João foi realizada.", a: "Visita registrada. Quer agendar follow-up?" },
              { q: "Quais meus leads mais urgentes hoje?", a: "3 follow-ups vencendo e 2 visitas confirmadas." },
              { q: "Quais imóveis na Barra até R$ 700 mil?", a: "Encontrei 5 opções. Vou te mandar agora." },
            ].map((m, i) => (
              <div key={i} className="space-y-1">
                <div className="rounded-2xl rounded-br-sm px-3.5 py-2 ml-auto max-w-[88%] text-[13px]" style={{ background: `${GOLD}22`, border: `1px solid ${GOLD}55` }}>
                  {m.q}
                </div>
                <div className="rounded-2xl rounded-bl-sm px-3.5 py-2 max-w-[88%] text-[13px] flex gap-2" style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.12)" }}>
                  <Bot className="h-3.5 w-3.5 flex-shrink-0 mt-0.5" style={{ color: GOLD_SOFT }} />
                  <span>{m.a}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </SlideShell>
    ),
  },

  // 8 — Laura na prática
  {
    id: 8,
    title: "Laura na prática",
    pdf: {
      eyebrow: "Laura IA · Na prática",
      title: "Menos tempo preenchendo. Mais tempo vendendo.",
      cards: [
        { title: "Agenda", body: "Organiza sua disponibilidade." },
        { title: "Sistema", body: "Atualiza sem você navegar." },
        { title: "Informação", body: "Encontra o que você precisa." },
        { title: "Prioridades", body: "Mostra o que importa hoje." },
        { title: "24/7", body: "Disponível a qualquer hora." },
      ],
    },
    render: () => (
      <SlideShell eyebrow="Laura na prática">
        <div className="space-y-8">
          <Headline>Menos preenchimento.<br /><span style={{ color: GOLD }}>Mais fechamento</span>.</Headline>
          {/* Flow */}
          <div className="flex items-center justify-center gap-4 md:gap-6 py-2">
            {[
              { i: Users, t: "Corretor" },
              { i: Bot, t: "Laura" },
              { i: Sparkles, t: "Nexus" },
              { i: Trophy, t: "Resultado" },
            ].map((s, i, arr) => (
              <React.Fragment key={i}>
                <div className="flex flex-col items-center gap-2">
                  <div className="h-14 w-14 rounded-full flex items-center justify-center border-2" style={{ background: NAVY_2, borderColor: GOLD }}>
                    <s.i className="h-6 w-6" style={{ color: GOLD }} />
                  </div>
                  <div className="text-xs uppercase tracking-wider">{s.t}</div>
                </div>
                {i < arr.length - 1 && <ArrowRight className="h-5 w-5" style={{ color: GOLD }} />}
              </React.Fragment>
            ))}
          </div>
          {/* Benefits */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            {[
              { i: CalendarDays, t: "Organiza sua agenda" },
              { i: Sparkles, t: "Atualiza sem navegar" },
              { i: Search, t: "Encontra rápido" },
              { i: Target, t: "Prioriza o seu dia" },
              { i: Clock, t: "Disponível 24h" },
            ].map((b, i) => (
              <GlassCard key={i} className="flex flex-col items-center text-center py-4">
                <b.i className="h-6 w-6 mb-2" style={{ color: GOLD }} />
                <div className="text-xs leading-tight">{b.t}</div>
              </GlassCard>
            ))}
          </div>
        </div>
      </SlideShell>
    ),
  },

  // 9 — Gestão de Chaves
  {
    id: 9,
    title: "Gestão de Chaves",
    pdf: {
      eyebrow: "Gestão de Chaves",
      title: "Controle total, sem perdas.",
      bullets: ["Retirada por foto", "Devolução por foto", "Controle em tempo real"],
    },
    render: () => (
      <SlideShell eyebrow="Gestão de Chaves">
        <div className="grid grid-cols-1 md:grid-cols-5 gap-10 items-center">
          <div className="md:col-span-2 space-y-5">
            <Headline>Chave certa,<br />na <span style={{ color: GOLD }}>hora certa</span>.</Headline>
            <ul className="space-y-2.5 text-base opacity-90">
              {[
                { i: Camera, t: "Retirada por foto" },
                { i: Camera, t: "Devolução por foto" },
                { i: Clock, t: "Controle em tempo real" },
                { i: CheckCircle2, t: "Menos perdas, mais segurança" },
              ].map((t, i) => (
                <li key={i} className="flex items-start gap-2"><t.i className="h-5 w-5 mt-0.5 flex-shrink-0" style={{ color: GOLD }} />{t.t}</li>
              ))}
            </ul>
          </div>
          <div className="md:col-span-3 flex justify-center">
            <MockChaveCard />
          </div>
        </div>
      </SlideShell>
    ),
  },

  // 10 — Central de Comando
  {
    id: 10,
    title: "Central de Comando",
    pdf: {
      eyebrow: "Central Hoje",
      title: "Você sempre sabe o que fazer a seguir.",
      bullets: ["Follow-ups · Visitas · Pendências · Prioridades"],
    },
    render: () => (
      <SlideShell eyebrow="Central de Comando">
        <div className="space-y-7">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-center">
            <div className="space-y-4">
              <Headline>Você sempre sabe<br /><span style={{ color: GOLD }}>o que fazer a seguir</span>.</Headline>
              <p className="text-lg opacity-85">Follow-ups, visitas, pendências e prioridades — numa única tela, sempre atualizada.</p>
            </div>
            <div className="flex justify-center">
              <MockHojeCard />
            </div>
          </div>
        </div>
      </SlideShell>
    ),
  },

  // 11 — Relatórios e Performance
  {
    id: 11,
    title: "Relatórios",
    pdf: {
      eyebrow: "Relatórios e Performance",
      title: "O que não é medido, não pode ser melhorado.",
      bullets: ["Conversão · Leads · Visitas · Tempo de resposta · Fechamentos"],
    },
    render: () => (
      <SlideShell eyebrow="Relatórios e Performance">
        <div className="grid grid-cols-1 md:grid-cols-5 gap-8 items-center">
          <div className="md:col-span-2 space-y-5">
            <Headline>O que não é medido,<br /><span style={{ color: GOLD }}>não pode ser melhorado</span>.</Headline>
            <ul className="space-y-2 text-sm opacity-90">
              {["Conversão por etapa", "Leads e visitas", "Tempo de resposta", "Fechamentos do mês"].map((t, i) => (
                <li key={i} className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 flex-shrink-0" style={{ color: GOLD }} />{t}</li>
              ))}
            </ul>
          </div>
          <div className="md:col-span-3 flex justify-center">
            <MockDashboard />
          </div>
        </div>
      </SlideShell>
    ),
  },

  // 12 — Metas e Conquistas
  {
    id: 12,
    title: "Metas e Conquistas",
    pdf: {
      eyebrow: "Metas e Conquistas",
      title: "Seu crescimento, reconhecido.",
      bullets: ["Barras de progresso", "Badges automáticas", "Ranking da equipe"],
    },
    render: () => (
      <SlideShell eyebrow="Metas e Conquistas">
        <div className="space-y-7">
          <Headline>Seu esforço, <span style={{ color: GOLD }}>reconhecido</span>.</Headline>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {/* Meta */}
            <GlassCard>
              <div className="flex items-center gap-2 mb-4"><Target className="h-5 w-5" style={{ color: GOLD }} /><span className="text-sm uppercase tracking-wider opacity-70">Meta do mês</span></div>
              <div className="text-4xl font-bold mb-2" style={{ color: GOLD }}>72%</div>
              <div className="h-2.5 rounded-full overflow-hidden mb-2" style={{ background: "rgba(255,255,255,0.08)" }}>
                <div className="h-full rounded-full" style={{ width: "72%", background: `linear-gradient(90deg, ${GOLD}, ${GOLD_SOFT})` }} />
              </div>
              <div className="text-xs opacity-60">R$ 18.000 de R$ 25.000</div>
            </GlassCard>
            {/* Badges */}
            <GlassCard>
              <div className="flex items-center gap-2 mb-4"><Award className="h-5 w-5" style={{ color: GOLD }} /><span className="text-sm uppercase tracking-wider opacity-70">Conquistas</span></div>
              <div className="space-y-2.5">
                {[
                  { i: Trophy, t: "1ª venda do mês" },
                  { i: Zap, t: "Resposta relâmpago" },
                  { i: Flame, t: "3 visitas em 1 dia" },
                ].map((b, i) => (
                  <div key={i} className="flex items-center gap-3 rounded-lg p-2" style={{ background: "rgba(255,255,255,0.04)" }}>
                    <div className="h-9 w-9 rounded-full flex items-center justify-center" style={{ background: `linear-gradient(135deg, ${GOLD}, ${GOLD_SOFT})`, color: NAVY }}>
                      <b.i className="h-4 w-4" />
                    </div>
                    <span className="text-sm">{b.t}</span>
                  </div>
                ))}
              </div>
            </GlassCard>
            {/* Ranking */}
            <GlassCard>
              <div className="flex items-center gap-2 mb-4"><TrendingUp className="h-5 w-5" style={{ color: GOLD }} /><span className="text-sm uppercase tracking-wider opacity-70">Ranking</span></div>
              <div className="space-y-2">
                {[
                  { p: 1, n: "Mariana S.", v: "R$ 32k" },
                  { p: 2, n: "Pedro R.", v: "R$ 27k" },
                  { p: 3, n: "Carlos L.", v: "R$ 19k" },
                ].map((r, i) => (
                  <div key={i} className="flex items-center gap-3 text-sm">
                    <div className="h-7 w-7 rounded-full flex items-center justify-center text-xs font-bold" style={{ background: r.p === 1 ? GOLD : "rgba(255,255,255,0.1)", color: r.p === 1 ? NAVY : "white" }}>{r.p}</div>
                    <span className="flex-1">{r.n}</span>
                    <span style={{ color: GOLD_SOFT }} className="font-semibold">{r.v}</span>
                  </div>
                ))}
              </div>
            </GlassCard>
          </div>
        </div>
      </SlideShell>
    ),
  },

  // 13 — Feed Interno
  {
    id: 13,
    title: "Feed Interno",
    pdf: {
      eyebrow: "Feed Interno",
      title: "Um time conectado vende mais.",
      bullets: ["Stories de 24h", "Curtidas e comentários", "Reconhecimento da equipe"],
    },
    render: () => (
      <SlideShell eyebrow="Feed Interno">
        <div className="grid grid-cols-1 md:grid-cols-5 gap-10 items-center">
          <div className="md:col-span-2 space-y-5">
            <Headline>Um time conectado,<br /><span style={{ color: GOLD }}>vende mais</span>.</Headline>
            <ul className="space-y-2.5 text-base opacity-90">
              {["Stories de 24h", "Curtidas e comentários", "Reconhecimento da equipe", "Cultura forte, todo dia"].map((t, i) => (
                <li key={i} className="flex items-start gap-2"><CheckCircle2 className="h-5 w-5 mt-0.5 flex-shrink-0" style={{ color: GOLD }} />{t}</li>
              ))}
            </ul>
          </div>
          <div className="md:col-span-3 flex justify-center">
            <MockFeedPost />
          </div>
        </div>
      </SlideShell>
    ),
  },

  // 14 — Mobile
  {
    id: 14,
    title: "Mobile",
    pdf: {
      eyebrow: "Mobile Experience",
      title: "Sua carreira no seu bolso.",
      bullets: ["Android e iPhone", "Notificações em tempo real", "Instala como app, sem loja"],
    },
    render: () => (
      <SlideShell eyebrow="Mobile Experience">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-10 items-center">
          <div className="space-y-5">
            <Headline>Sua carreira <span style={{ color: GOLD }}>no seu bolso</span>.</Headline>
            <ul className="space-y-2.5 text-base opacity-90">
              {[
                { i: Smartphone, t: "Android e iPhone" },
                { i: Bell, t: "Notificações em tempo real" },
                { i: Download, t: "Instala como app, sem loja" },
              ].map((t, i) => (
                <li key={i} className="flex items-start gap-2"><t.i className="h-5 w-5 mt-0.5 flex-shrink-0" style={{ color: GOLD }} />{t.t}</li>
              ))}
            </ul>
          </div>
          <div className="flex justify-center gap-6">
            <MockPhoneFrame variant="dashboard" />
            <div className="hidden md:block"><MockPhoneFrame variant="chat" /></div>
          </div>
        </div>
      </SlideShell>
    ),
  },

  // 15 — Quanto tempo devolve
  {
    id: 15,
    title: "Tempo que o Nexus devolve",
    pdf: {
      eyebrow: "O que o Nexus devolve para você",
      title: "Quanto tempo o Nexus devolve para você?",
      cards: [
        { title: "−70%", body: "Retrabalho" },
        { title: "−80%", body: "Esquecimentos" },
        { title: "+3h", body: "Por dia" },
        { title: "+40%", body: "Oportunidades atendidas" },
      ],
    },
    render: () => (
      <SlideShell eyebrow="O que o Nexus devolve para você">
        <div className="space-y-8">
          <Headline>Quanto tempo o Nexus<br /><span style={{ color: GOLD }}>devolve para você</span>?</Headline>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-5">
            {[
              { n: "−70%", t: "Retrabalho" },
              { n: "−80%", t: "Esquecimentos" },
              { n: "+3h", t: "Por dia" },
              { n: "+40%", t: "Oportunidades" },
            ].map((s, i) => (
              <GlassCard key={i} className="text-center py-7">
                <div className="text-5xl md:text-6xl font-bold mb-1" style={{ color: GOLD, fontFamily: "'Cormorant Garamond', serif" }}>{s.n}</div>
                <div className="text-sm uppercase tracking-wider opacity-80">{s.t}</div>
              </GlassCard>
            ))}
          </div>
          <p className="text-center text-lg opacity-85">Mais tempo. Mais foco. <span style={{ color: GOLD_SOFT }}>Mais vendas</span>.</p>
        </div>
      </SlideShell>
    ),
  },

  // 16 — Fechamento
  {
    id: 16,
    title: "O futuro já chegou",
    pdf: {
      title: "O futuro da imobiliária já chegou.",
      subtitle: "O Ecossistema Nexus não substitui o corretor. Ele potencializa o corretor.",
    },
    render: () => (
      <SlideShell>
        <div className="space-y-10 text-center">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-[11px] tracking-[0.35em] uppercase mx-auto" style={{ background: "rgba(212,175,55,0.12)", color: GOLD_SOFT, border: `1px solid ${GOLD}55` }}>
            <Sparkles className="h-3.5 w-3.5" /> O futuro já chegou
          </div>
          <h2 className="text-6xl md:text-8xl font-semibold leading-[1]" style={{ fontFamily: "'Cormorant Garamond', serif" }}>
            O futuro da imobiliária<br /><span style={{ color: GOLD }}>já chegou</span>.
          </h2>
          <p className="text-2xl md:text-3xl opacity-90 max-w-4xl mx-auto font-light" style={{ fontFamily: "'Cormorant Garamond', serif" }}>
            O Ecossistema Nexus não substitui o corretor.<br /><span style={{ color: GOLD_SOFT }}>Ele potencializa o corretor.</span>
          </p>
          <div className="pt-6 text-xs tracking-[0.35em] uppercase opacity-60">Iuri Rodrigues Imóveis</div>
        </div>
      </SlideShell>
    ),
  },
];

// ---------------- PDF: Apresentação ----------------
function generatePDF() {
  const pdf = new jsPDF({ orientation: "landscape", unit: "pt", format: [1280, 720] });
  const W = 1280, H = 720;
  const navy: [number, number, number] = [10, 14, 26];
  const gold: [number, number, number] = [212, 175, 55];

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
        pdf.setFillColor(20, 30, 56);
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

// ---------------- PDF: Guia Completo ----------------
function generateGuide() {
  const pdf = new jsPDF({ orientation: "portrait", unit: "pt", format: "a4" });
  const W = pdf.internal.pageSize.getWidth();
  const H = pdf.internal.pageSize.getHeight();
  const M = 50;
  const navy: [number, number, number] = [10, 14, 26];
  const gold: [number, number, number] = [212, 175, 55];
  let y = 0;

  const newPage = (withHeader = true) => {
    pdf.addPage();
    y = M;
    if (withHeader) drawHeader();
  };

  const drawHeader = () => {
    pdf.setFillColor(...navy);
    pdf.rect(0, 0, W, 30, "F");
    pdf.setFillColor(...gold);
    pdf.rect(0, 28, W, 2, "F");
    pdf.setTextColor(232, 201, 119);
    pdf.setFontSize(8);
    pdf.text("ECOSSISTEMA NEXUS · GUIA COMPLETO", M, 18);
    pdf.setTextColor(200, 200, 200);
    pdf.text("Iuri Rodrigues Imóveis", W - M, 18, { align: "right" });
    y = 60;
  };

  const ensureSpace = (h: number) => {
    if (y + h > H - 50) newPage();
  };

  const h1 = (text: string) => {
    ensureSpace(48);
    pdf.setTextColor(...gold);
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(22);
    pdf.text(text, M, y);
    y += 8;
    pdf.setDrawColor(...gold);
    pdf.setLineWidth(1);
    pdf.line(M, y, M + 60, y);
    y += 18;
  };

  const h2 = (text: string) => {
    ensureSpace(30);
    pdf.setTextColor(40, 50, 80);
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(14);
    pdf.text(text, M, y);
    y += 18;
  };

  const p = (text: string) => {
    pdf.setTextColor(60, 60, 60);
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(11);
    const lines = pdf.splitTextToSize(text, W - M * 2);
    lines.forEach((line: string) => {
      ensureSpace(16);
      pdf.text(line, M, y);
      y += 15;
    });
    y += 4;
  };

  const bullets = (items: string[]) => {
    pdf.setTextColor(60, 60, 60);
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(11);
    items.forEach((it) => {
      const lines = pdf.splitTextToSize(it, W - M * 2 - 18);
      ensureSpace(lines.length * 15 + 4);
      pdf.setFillColor(...gold);
      pdf.circle(M + 4, y - 4, 2.2, "F");
      pdf.text(lines, M + 16, y);
      y += lines.length * 15 + 2;
    });
    y += 4;
  };

  // Cover
  pdf.setFillColor(...navy);
  pdf.rect(0, 0, W, H, "F");
  pdf.setFillColor(...gold);
  pdf.rect(0, 0, 6, H, "F");
  pdf.setTextColor(232, 201, 119);
  pdf.setFontSize(10);
  pdf.text("ECOSSISTEMA NEXUS", M, 80);
  pdf.setTextColor(255, 255, 255);
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(42);
  pdf.text("Guia Completo", M, H / 2 - 30);
  pdf.setTextColor(...gold);
  pdf.text("do Ecossistema", M, H / 2 + 10);
  pdf.text("Nexus", M, H / 2 + 50);
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(14);
  pdf.setTextColor(220, 220, 220);
  pdf.text("A tecnologia que trabalha para você.", M, H / 2 + 90);
  pdf.setFontSize(9);
  pdf.setTextColor(180, 180, 180);
  pdf.text("Iuri Rodrigues Imóveis · 2026", M, H - 60);

  // Sumário
  newPage();
  h1("Sumário");
  bullets([
    "1. Visão geral do Nexus",
    "2. Como funciona cada módulo",
    "    Plantão · Agenda · Portfólio · Laura IA · Gestão de Chaves · Relatórios · Metas · Feed Interno",
    "3. Benefícios para o corretor",
    "4. Benefícios para a imobiliária",
    "5. Perguntas frequentes",
  ]);

  // 1
  newPage();
  h1("1. Visão Geral");
  p("O Ecossistema Nexus é a plataforma proprietária da Iuri Rodrigues Imóveis que centraliza captação, atendimento, agenda, portfólio, gestão de chaves, relatórios e cultura de equipe — tudo conectado e operado também pela assistente de IA Laura.");
  p("O Nexus foi desenhado para que o corretor passe menos tempo preenchendo sistemas e mais tempo fechando negócios. Cada módulo conversa com o próximo: o lead que chega no Plantão vira visita na Agenda, retira chave na Gestão de Chaves, gera fechamento nos Relatórios e celebração no Feed.");

  // 2
  h1("2. Como funciona cada módulo");

  h2("Plantão");
  p("Distribuição automática de leads para o corretor de plantão do dia, com SLA de 10 minutos e escalonamento automático se o atendimento atrasar. Considera disponibilidade na agenda e equilíbrio entre corretores.");
  bullets(["Plantonista identificado em tempo real", "10 min para o primeiro contato", "Escalonamento automático", "Histórico de cada distribuição"]);

  h2("Agenda Nexus");
  p("Visão única do dia: visitas, reuniões e Google Meet num só lugar. Integração com Google Calendar (FreeBusy) evita conflitos de horário.");
  bullets(["Visitas e reuniões", "Google Meet integrado", "Verificação automática de conflitos", "Reagendamento e cancelamento em um clique"]);

  h2("Portfólio Inteligente");
  p("Catálogo completo dos imóveis com fotos profissionais, busca por região e preço, e compartilhamento direto em um toque (WhatsApp).");
  bullets(["Fotos profissionais", "Busca por região e preço", "Compartilhamento em 1 toque", "Sempre atualizado"]);

  newPage();
  h2("Laura IA");
  p("Assistente de produtividade e operação. A Laura atua no sistema com base em comandos em linguagem natural, sempre confirmando ações sensíveis antes de executar.");
  bullets([
    "Atualiza sua disponibilidade na agenda",
    "Registra visitas concluídas",
    "Identifica leads urgentes e prioridades do dia",
    "Pesquisa o portfólio por região, preço e tipo",
    "Disponível 24h, com confirmação antes de agir",
  ]);
  p("Importante: a Laura não gerencia escalas de plantão. Ela atua como camada de produtividade — você fala, ela faz a parte operacional para você.");

  h2("Gestão de Chaves");
  p("Controle de retirada e devolução por foto, com histórico em tempo real. Reduz perdas e dá rastreabilidade total.");
  bullets(["Foto na retirada e na devolução", "Status em tempo real", "Alertas de atraso"]);

  h2("Relatórios e Performance");
  p("Painel pessoal de desempenho: funil de conversão, tempo médio de resposta, vendas, visitas e taxa de fechamento.");
  bullets(["Funil de conversão por etapa", "Tempo de resposta", "Vendas e visitas do mês", "Histórico para evolução"]);

  newPage();
  h2("Metas e Conquistas");
  p("Metas individuais com barra de progresso em tempo real, conquistas (badges) automáticas e ranking saudável para reconhecer quem cresce.");
  bullets(["Barra de progresso da meta", "Badges automáticas (ex: resposta relâmpago)", "Ranking da equipe"]);

  h2("Feed Interno");
  p("Rede social interna com stories de 24h, curtidas e comentários — para reconhecer conquistas, compartilhar bastidores e manter o time conectado.");
  bullets(["Posts de foto, vídeo, áudio e texto", "Stories de 24h", "Curtidas e comentários"]);

  // 3
  newPage();
  h1("3. Benefícios para o Corretor");
  bullets([
    "Nunca mais perder uma oportunidade — leads chegam atribuídos e com prazo",
    "Mais tempo vendendo, menos preenchendo sistemas",
    "Agenda organizada num único lugar",
    "Portfólio sempre atualizado, no bolso",
    "Reconhecimento real do esforço (metas e conquistas)",
    "Apoio da Laura 24h, sem fila",
  ]);

  // 4
  h1("4. Benefícios para a Imobiliária");
  bullets([
    "Distribuição justa e mensurável de oportunidades",
    "Visibilidade de funil, conversão e tempo de resposta",
    "Padronização de processos (visita, chave, fechamento)",
    "Cultura de equipe fortalecida pelo Feed",
    "Menos retrabalho, mais previsibilidade de receita",
    "Base de conhecimento que cresce com a operação",
  ]);

  // 5
  newPage();
  h1("5. Perguntas Frequentes");

  h2("A Laura pode mexer no meu plantão?");
  p("Não. A Laura é uma camada de produtividade. Ela atualiza disponibilidade, registra visitas, pesquisa portfólio e organiza prioridades — não altera escalas de plantão.");

  h2("Preciso instalar algum aplicativo?");
  p("Não. O Nexus funciona como PWA: você instala direto pelo navegador, no Android ou iPhone, sem passar por loja de aplicativos.");

  h2("Como funciona o SLA do plantão?");
  p("Quando um lead chega, o sistema identifica o plantonista do dia e dá 10 minutos para o primeiro contato. Se não houver resposta, escala automaticamente para o próximo da fila.");

  h2("Meus dados ficam seguros?");
  p("Sim. Cada perfil enxerga apenas o que é seu (RLS no banco), e a Laura confirma antes de qualquer ação sensível.");

  h2("Posso pedir para a Laura por áudio ou foto?");
  p("Sim. A Laura aceita texto, áudio e imagem — por exemplo, foto da chave retirada para registrar automaticamente.");

  // Footer numbering pass
  const total = pdf.getNumberOfPages();
  for (let i = 1; i <= total; i++) {
    pdf.setPage(i);
    pdf.setTextColor(160, 160, 160);
    pdf.setFontSize(8);
    pdf.text(`${i} / ${total}`, W - M, H - 25, { align: "right" });
  }

  pdf.save("guia-completo-ecossistema-nexus.pdf");
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

  const touchX = useRef<number | null>(null);
  const onTouchStart = (e: React.TouchEvent) => { touchX.current = e.touches[0].clientX; };
  const onTouchEnd = (e: React.TouchEvent) => {
    if (touchX.current == null) return;
    const dx = e.changedTouches[0].clientX - touchX.current;
    if (Math.abs(dx) > 50) (dx < 0 ? next : prev)();
    touchX.current = null;
  };

  return (
    <div className={fullscreen ? "fixed inset-0 z-[9999] bg-black flex flex-col" : "min-h-screen flex flex-col bg-black"}>
      {!fullscreen && (
        <div className="flex items-center justify-between gap-3 px-4 py-3 border-b" style={{ background: NAVY_DEEP, borderColor: "rgba(212,175,55,0.25)" }}>
          <div className="text-white text-sm">
            <span className="opacity-60">Apresentação · </span>
            <span className="font-semibold">{slide.title}</span>
            <span className="opacity-60 ml-2">· Slide {idx + 1} de {SLIDES.length}</span>
          </div>
          <div className="flex items-center gap-2">
            <Button size="sm" variant="outline" onClick={generateGuide} className="gap-2">
              <BookOpen className="h-4 w-4" /> Guia Completo (PDF)
            </Button>
            <Button size="sm" variant="outline" onClick={generatePDF} className="gap-2">
              <Download className="h-4 w-4" /> Baixar PDF
            </Button>
            <Button size="sm" variant="outline" onClick={toggleFullscreen} className="gap-2">
              <Maximize2 className="h-4 w-4" /> Tela cheia
            </Button>
          </div>
        </div>
      )}

      <div className={fullscreen ? "flex-1 flex items-center justify-center overflow-hidden" : "flex-1 flex items-center justify-center p-0 md:p-6"}>
        <div
          className={fullscreen ? "relative bg-black overflow-hidden" : "relative w-full max-w-[1400px] rounded-xl overflow-hidden shadow-2xl"}
          style={
            fullscreen
              ? { width: "min(100vw, 177.78vh)", height: "min(56.25vw, 100vh)" }
              : { aspectRatio: "16/9" }
          }
        >
          <div className="absolute inset-0">
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
          <button onClick={prev} className="fixed left-4 top-1/2 -translate-y-1/2 p-3 rounded-full bg-white/10 hover:bg-white/20 text-white z-[10000]" aria-label="Anterior">
            <ChevronLeft className="h-6 w-6" />
          </button>
          <button onClick={next} className="fixed right-4 top-1/2 -translate-y-1/2 p-3 rounded-full bg-white/10 hover:bg-white/20 text-white z-[10000]" aria-label="Próximo">
            <ChevronRight className="h-6 w-6" />
          </button>
          <div className="fixed bottom-4 left-1/2 -translate-x-1/2 px-4 py-2 rounded-full bg-black/60 text-white text-xs z-[10000]">
            {idx + 1} / {SLIDES.length}
          </div>
        </>
      )}
    </div>
  );
}
