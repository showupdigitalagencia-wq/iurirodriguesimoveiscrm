import { createFileRoute, redirect } from "@tanstack/react-router";
import React, { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import {
  ChevronLeft, ChevronRight, Download, Maximize2, Radio, Building2, Bot,
  CalendarDays, Key, BarChart3, Trophy, Newspaper, Smartphone,
  Target, CheckCircle2, Sparkles, Heart, Users,
  Bed, Bath, Car, MapPin, Image as ImageIcon, MessageCircle, Share2,
  Zap, Flame, TrendingUp, Clock, Bell, ArrowRight, X, Check,
  Camera, Search, Video, FileText, Award, BookOpen,
  AlertTriangle, EyeOff, UserX, ShieldCheck, Lightbulb, Send, Layers,
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
    body?: string;
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

// Parágrafo explicativo: 2 a 4 frases por slide, com peso visual
function BodyCopy({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <p
      className={`text-[19px] md:text-[21px] leading-[1.55] opacity-90 max-w-[640px] font-light ${className}`}
      style={{ fontFamily: "'Inter', system-ui, sans-serif", color: "#E8ECF5" }}
    >
      {children}
    </p>
  );
}

// Diagrama simples de fluxo (ícones + setas), identidade Navy + Dourado
function FlowDiagram({
  steps,
}: {
  steps: { icon: React.ComponentType<{ className?: string }>; label: string; sub?: string }[];
}) {
  return (
    <div className="flex items-center justify-center gap-2 md:gap-3 flex-wrap">
      {steps.map((s, i) => (
        <React.Fragment key={i}>
          <div className="flex flex-col items-center text-center w-[150px]">
            <div
              className="h-16 w-16 rounded-2xl flex items-center justify-center shadow-xl mb-2"
              style={{
                background: `linear-gradient(135deg, ${GOLD}, ${GOLD_SOFT})`,
                color: NAVY,
                boxShadow: `0 0 28px ${GOLD}44`,
              }}
            >
              <s.icon className="h-7 w-7" />
            </div>
            <div className="text-[13px] font-semibold leading-tight">{s.label}</div>
            {s.sub && <div className="text-[11px] opacity-65 mt-0.5">{s.sub}</div>}
          </div>
          {i < steps.length - 1 && (
            <ArrowRight className="h-5 w-5 flex-shrink-0 opacity-70" style={{ color: GOLD }} />
          )}
        </React.Fragment>
      ))}
    </div>
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
    pdf: { title: "Ecossistema Nexus", subtitle: "A tecnologia que trabalha por você." },
    render: () => (
      <SlideShell>
        <div className="space-y-10 text-center">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-[11px] tracking-[0.4em] uppercase mx-auto" style={{ background: "rgba(212,175,55,0.12)", color: GOLD_SOFT, border: `1px solid ${GOLD}55` }}>
            <Sparkles className="h-3.5 w-3.5" /> Iuri Rodrigues Imóveis
          </div>
          <h1 className="text-7xl md:text-9xl font-semibold leading-[0.95]" style={{ fontFamily: "'Cormorant Garamond', serif" }}>
            Ecossistema<br /><span style={{ color: GOLD }}>Nexus</span>
          </h1>
          <p className="text-2xl md:text-3xl opacity-85 max-w-3xl mx-auto font-light" style={{ fontFamily: "'Cormorant Garamond', serif" }}>
            A tecnologia que trabalha <span style={{ color: GOLD_SOFT }}>por você</span>.
          </p>
        </div>
      </SlideShell>
    ),
  },

  // 2 — Abertura
  {
    id: 2,
    title: "Antes de falar de tecnologia",
    pdf: {
      eyebrow: "Abertura",
      title: "Antes de falar de tecnologia, vamos falar de você.",
      subtitle: "Do corretor que acorda cedo, atende em qualquer horário, e segura tudo nas próprias mãos.",
    },
    render: () => (
      <SlideShell eyebrow="Abertura">
        <div className="space-y-8 max-w-5xl">
          <Headline>
            Antes de falar de tecnologia,<br /><span style={{ color: GOLD }}>vamos falar de você</span>.
          </Headline>
          <p className="text-2xl opacity-85 font-light leading-relaxed" style={{ fontFamily: "'Cormorant Garamond', serif" }}>
            Do corretor que acorda cedo. Atende a qualquer hora.<br />
            Segura tudo nas próprias mãos.
          </p>
        </div>
      </SlideShell>
    ),
  },

  // 3 — Dor 1
  {
    id: 3,
    title: "A oportunidade que esfriou",
    pdf: {
      eyebrow: "A realidade · 1 de 4",
      title: "O lead chegou. Você demorou 20 minutos. Ele já estava com outro.",
      subtitle: "Toda oportunidade tem um relógio rodando. E ninguém te avisa.",
    },
    render: () => (
      <SlideShell eyebrow="A realidade · 1 de 4">
        <div className="grid md:grid-cols-2 gap-12 items-center">
          <div className="space-y-6">
            <div className="inline-flex items-center gap-2 text-[11px] tracking-[0.3em] uppercase" style={{ color: "#fca5a5" }}>
              <AlertTriangle className="h-4 w-4" /> Oportunidade perdida
            </div>
            <Headline>
              O lead chegou.<br />
              Você demorou <span style={{ color: GOLD }}>20 minutos</span>.<br />
              Ele já estava <span style={{ color: GOLD }}>com outro</span>.
            </Headline>
            <p className="text-lg opacity-75 max-w-md">Toda oportunidade tem um relógio rodando. E ninguém te avisa.</p>
          </div>
          <div className="flex justify-center">
            <div className="relative">
              <div className="absolute inset-0 rounded-full blur-3xl opacity-30" style={{ background: "#ef4444" }} />
              <div className="relative w-64 h-64 rounded-full border-4 flex flex-col items-center justify-center" style={{ borderColor: "#ef4444" }}>
                <Clock className="h-16 w-16 mb-2" style={{ color: "#ef4444" }} />
                <div className="text-5xl font-bold" style={{ color: "#ef4444" }}>20:00</div>
                <div className="text-xs uppercase tracking-widest opacity-70 mt-1">tarde demais</div>
              </div>
            </div>
          </div>
        </div>
      </SlideShell>
    ),
  },

  // 4 — Dor 2
  {
    id: 4,
    title: "O caos da rotina",
    pdf: {
      eyebrow: "A realidade · 2 de 4",
      title: "Chave em uma gaveta. Follow-up num caderno. Imóvel num grupo de WhatsApp.",
      subtitle: "Tudo espalhado. Tudo na sua cabeça. Tudo prestes a escapar.",
    },
    render: () => (
      <SlideShell eyebrow="A realidade · 2 de 4">
        <div className="space-y-10">
          <Headline>
            <span style={{ color: GOLD }}>Tudo espalhado.</span><br />
            Tudo na sua cabeça.
          </Headline>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { i: Key, t: "Chave numa gaveta" },
              { i: FileText, t: "Follow-up num caderno" },
              { i: MessageCircle, t: "Imóvel num grupo" },
              { i: CalendarDays, t: "Visita num post-it" },
            ].map((b, i) => (
              <GlassCard key={i} className="text-center py-8">
                <b.i className="h-9 w-9 mx-auto mb-3 opacity-60" />
                <div className="text-sm opacity-80">{b.t}</div>
              </GlassCard>
            ))}
          </div>
          <p className="text-xl opacity-75 text-center font-light" style={{ fontFamily: "'Cormorant Garamond', serif" }}>
            E quando algo escapa, <span style={{ color: GOLD_SOFT }}>quem paga é você</span>.
          </p>
        </div>
      </SlideShell>
    ),
  },

  // 5 — Dor 3
  {
    id: 5,
    title: "O esforço que ninguém vê",
    pdf: {
      eyebrow: "A realidade · 3 de 4",
      title: "Você trabalhou o mês inteiro. E ninguém viu.",
      subtitle: "Sem registro. Sem ranking. Sem reconhecimento.",
    },
    render: () => (
      <SlideShell eyebrow="A realidade · 3 de 4">
        <div className="grid md:grid-cols-5 gap-10 items-center">
          <div className="md:col-span-3 space-y-6">
            <div className="inline-flex items-center gap-2 text-[11px] tracking-[0.3em] uppercase opacity-70">
              <EyeOff className="h-4 w-4" /> Esforço invisível
            </div>
            <Headline>
              Você trabalhou o mês inteiro.<br />
              E <span style={{ color: GOLD }}>ninguém viu</span>.
            </Headline>
            <p className="text-lg opacity-75 max-w-lg">Sem registro do que foi feito. Sem ranking. Sem reconhecimento.</p>
          </div>
          <div className="md:col-span-2 flex justify-center">
            <div className="relative w-56 h-56">
              <div className="absolute inset-0 rounded-full border-2 border-dashed opacity-30" style={{ borderColor: GOLD }} />
              <div className="absolute inset-6 rounded-full border opacity-20" style={{ borderColor: GOLD }} />
              <div className="absolute inset-0 flex items-center justify-center">
                <EyeOff className="h-20 w-20 opacity-40" />
              </div>
            </div>
          </div>
        </div>
      </SlideShell>
    ),
  },

  // 6 — Dor 4
  {
    id: 6,
    title: "Sozinho contra o mercado",
    pdf: {
      eyebrow: "A realidade · 4 de 4",
      title: "Você está sozinho contra o mercado.",
      subtitle: "Sem time por perto. Sem ferramenta que ajude. Só você.",
    },
    render: () => (
      <SlideShell eyebrow="A realidade · 4 de 4">
        <div className="space-y-10 text-center max-w-4xl mx-auto">
          <UserX className="h-16 w-16 mx-auto opacity-50" />
          <Headline>
            Você está <span style={{ color: GOLD }}>sozinho</span><br />
            contra o mercado.
          </Headline>
          <p className="text-xl opacity-80 font-light" style={{ fontFamily: "'Cormorant Garamond', serif" }}>
            Sem time por perto. Sem ferramenta que ajude.<br />
            Só você — e a próxima ligação.
          </p>
        </div>
      </SlideShell>
    ),
  },

  // 7 — A virada
  {
    id: 7,
    title: "E se existisse outro jeito?",
    pdf: {
      title: "E se existisse um jeito completamente diferente de ser corretor?",
      subtitle: "Não uma melhoria. Uma virada. Algo que esse mercado nunca viu.",
    },
    render: () => (
      <SlideShell>
        <div className="space-y-12 text-center max-w-5xl mx-auto">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-[11px] tracking-[0.4em] uppercase mx-auto" style={{ background: `${GOLD}15`, color: GOLD_SOFT, border: `1px solid ${GOLD}55` }}>
            <Lightbulb className="h-3.5 w-3.5" /> A virada
          </div>
          <h2 className="text-6xl md:text-8xl font-semibold leading-[1]" style={{ fontFamily: "'Cormorant Garamond', serif" }}>
            E se existisse<br />
            um jeito <span style={{ color: GOLD }}>completamente<br />diferente</span> de ser corretor?
          </h2>
          <p className="text-2xl opacity-80 font-light" style={{ fontFamily: "'Cormorant Garamond', serif" }}>
            Não uma melhoria.<br /><span style={{ color: GOLD_SOFT }}>Uma virada.</span>
          </p>
        </div>
      </SlideShell>
    ),
  },

  // 8 — Visão geral do Ecossistema
  {
    id: 8,
    title: "Ecossistema Nexus",
    pdf: {
      eyebrow: "Visão geral",
      title: "Um ecossistema. Uma única experiência.",
      cards: [
        { title: "Agenda", body: "Você no controle do seu tempo." },
        { title: "Portfólio", body: "Todo o catálogo no bolso." },
        { title: "Laura IA", body: "Sua assistente pessoal." },
        { title: "Hoje", body: "O que importa, sem esforço." },
        { title: "Desempenho", body: "Seu funil, em tempo real." },
        { title: "Time", body: "Feed, stories, conquistas." },
      ],
    },
    render: () => (
      <SlideShell eyebrow="Visão geral">
        <div className="space-y-8">
          <Headline>
            Um ecossistema.<br /><span style={{ color: GOLD }}>Uma única experiência</span>.
          </Headline>
          <div className="grid grid-cols-3 gap-4">
            {[
              { i: CalendarDays, t: "Agenda", d: "Você no controle do seu tempo" },
              { i: Building2, t: "Portfólio", d: "Todo o catálogo no bolso" },
              { i: Bot, t: "Laura IA", d: "Sua assistente pessoal" },
              { i: Sparkles, t: "Hoje", d: "O que importa, sem esforço" },
              { i: BarChart3, t: "Desempenho", d: "Seu funil, em tempo real" },
              { i: Newspaper, t: "Time", d: "Feed, stories, conquistas" },
            ].map((m, i) => (
              <GlassCard key={i}>
                <m.i className="h-7 w-7 mb-3" style={{ color: GOLD }} />
                <div className="text-lg font-semibold mb-1">{m.t}</div>
                <div className="text-xs opacity-70">{m.d}</div>
              </GlassCard>
            ))}
          </div>
        </div>
      </SlideShell>
    ),
  },

  // 9 — Autonomia na distribuição de leads
  {
    id: 9,
    title: "Sua agenda, suas regras",
    pdf: {
      eyebrow: "Autonomia",
      title: "Você define quando está disponível. O sistema respeita.",
      subtitle: "Lead novo só chega nos momentos que você escolheu. Sem invasão. Sem desperdício.",
    },
    render: () => (
      <SlideShell eyebrow="Autonomia">
        <div className="grid md:grid-cols-2 gap-12 items-center">
          <div className="space-y-6">
            <Headline>
              Sua agenda,<br /><span style={{ color: GOLD }}>suas regras</span>.
            </Headline>
            <p className="text-lg opacity-85 max-w-md">
              Você marca quando está disponível.<br />
              O sistema só te envia leads nesses momentos.
            </p>
            <div className="space-y-2 pt-2">
              {["Sem invasão fora do horário", "Sem desperdício de oportunidade", "Você no comando do seu tempo"].map((b, i) => (
                <div key={i} className="flex items-center gap-3">
                  <CheckCircle2 className="h-5 w-5 flex-shrink-0" style={{ color: GOLD }} />
                  <span className="text-sm opacity-90">{b}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="flex justify-center"><MockAgendaCard /></div>
        </div>
      </SlideShell>
    ),
  },

  // 10 — PROVA REAL: Leads recebidos
  {
    id: 10,
    title: "Prova real · Leads",
    pdf: {
      eyebrow: "Prova real",
      title: "Seus leads, organizados para você.",
    },
    render: () => (
      <SlideShell eyebrow="Prova real">
        <div className="grid md:grid-cols-5 gap-8 items-center">
          <div className="md:col-span-2 space-y-4">
            <div className="text-[11px] tracking-[0.35em] uppercase" style={{ color: GOLD_SOFT }}>Tela real</div>
            <h3 className="text-4xl md:text-5xl font-semibold leading-tight" style={{ fontFamily: "'Cormorant Garamond', serif" }}>
              Seus leads,<br /><span style={{ color: GOLD }}>organizados</span> para você.
            </h3>
          </div>
          <div className="md:col-span-3 flex justify-center scale-110"><MockPlantaoCard /></div>
        </div>
      </SlideShell>
    ),
  },

  // 11 — Portfólio
  {
    id: 11,
    title: "Portfólio no bolso",
    pdf: {
      eyebrow: "Portfólio",
      title: "Todo o catálogo, sempre atualizado, no seu bolso.",
      subtitle: "Você nunca mais perde uma venda por não ter o imóvel certo na hora certa.",
    },
    render: () => (
      <SlideShell eyebrow="Portfólio">
        <div className="space-y-8 max-w-5xl">
          <Headline>
            Todo o catálogo<br /><span style={{ color: GOLD }}>no seu bolso</span>.
          </Headline>
          <p className="text-xl opacity-85 max-w-2xl font-light" style={{ fontFamily: "'Cormorant Garamond', serif" }}>
            Sempre atualizado. Sempre com você.<br />
            Você nunca mais perde uma venda por não ter o imóvel certo na hora certa.
          </p>
          <div className="flex gap-3 pt-2">
            {[Search, MapPin, Layers, ImageIcon].map((I, i) => (
              <div key={i} className="h-12 w-12 rounded-xl flex items-center justify-center" style={{ background: `${GOLD}15`, border: `1px solid ${GOLD}44` }}>
                <I className="h-5 w-5" style={{ color: GOLD }} />
              </div>
            ))}
          </div>
        </div>
      </SlideShell>
    ),
  },

  // 12 — PROVA REAL: Imóvel
  {
    id: 12,
    title: "Prova real · Imóvel",
    pdf: { eyebrow: "Prova real", title: "Cada imóvel, pronto para impressionar." },
    render: () => (
      <SlideShell eyebrow="Prova real">
        <div className="grid md:grid-cols-2 gap-12 items-center">
          <div className="space-y-4">
            <div className="text-[11px] tracking-[0.35em] uppercase" style={{ color: GOLD_SOFT }}>Tela real</div>
            <h3 className="text-4xl md:text-5xl font-semibold leading-tight" style={{ fontFamily: "'Cormorant Garamond', serif" }}>
              Cada imóvel,<br />pronto para <span style={{ color: GOLD }}>impressionar</span>.
            </h3>
          </div>
          <div className="flex justify-center scale-110"><MockImovelCard /></div>
        </div>
      </SlideShell>
    ),
  },

  // 13 — Compartilhar em 1 toque
  {
    id: 13,
    title: "Compartilhar em 1 toque",
    pdf: {
      eyebrow: "Compartilhamento",
      title: "Impressione o cliente na hora. Em um toque.",
      subtitle: "Foto, descrição, valor — tudo pronto. Você só envia.",
    },
    render: () => (
      <SlideShell eyebrow="Compartilhamento">
        <div className="space-y-10 text-center max-w-4xl mx-auto">
          <div className="flex items-center justify-center gap-6">
            <div className="h-20 w-20 rounded-2xl flex items-center justify-center shadow-2xl" style={{ background: `linear-gradient(135deg, ${GOLD}, ${GOLD_SOFT})`, color: NAVY }}>
              <Share2 className="h-10 w-10" />
            </div>
            <ArrowRight className="h-8 w-8 opacity-60" />
            <div className="h-20 w-20 rounded-2xl flex items-center justify-center shadow-2xl" style={{ background: "#25D366", color: "#fff" }}>
              <MessageCircle className="h-10 w-10" />
            </div>
          </div>
          <Headline>
            Impressione o cliente<br /><span style={{ color: GOLD }}>na hora</span>.
          </Headline>
          <p className="text-xl opacity-80 font-light" style={{ fontFamily: "'Cormorant Garamond', serif" }}>
            Foto, descrição, valor — tudo pronto.<br />Você só envia.
          </p>
        </div>
      </SlideShell>
    ),
  },

  // 14 — Conheça a Laura (impacto)
  {
    id: 14,
    title: "Conheça a Laura",
    pdf: {
      title: "Conheça a Laura.",
      subtitle: "Sua assistente pessoal de Inteligência Artificial. Disponível 24 horas. Só para você.",
    },
    render: () => (
      <SlideShell>
        <div className="grid md:grid-cols-2 gap-12 items-center">
          <div className="space-y-8">
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-[11px] tracking-[0.4em] uppercase" style={{ background: `${GOLD}15`, color: GOLD_SOFT, border: `1px solid ${GOLD}55` }}>
              <Sparkles className="h-3.5 w-3.5" /> O diferencial
            </div>
            <h2 className="text-7xl md:text-8xl font-semibold leading-[0.95]" style={{ fontFamily: "'Cormorant Garamond', serif" }}>
              Conheça a<br /><span style={{ color: GOLD }}>Laura</span>.
            </h2>
            <p className="text-xl opacity-85 font-light max-w-md" style={{ fontFamily: "'Cormorant Garamond', serif" }}>
              Sua assistente pessoal de Inteligência Artificial.<br />
              <span style={{ color: GOLD_SOFT }}>Disponível 24 horas. Só para você.</span>
            </p>
          </div>
          <div className="flex justify-center">
            <div className="relative">
              <div className="absolute inset-0 rounded-full blur-3xl opacity-40" style={{ background: GOLD }} />
              <div className="relative h-72 w-72 rounded-full flex items-center justify-center" style={{ background: `radial-gradient(circle, ${GOLD}33, transparent 70%)`, border: `2px solid ${GOLD}55` }}>
                <Bot className="h-40 w-40" style={{ color: GOLD }} />
              </div>
            </div>
          </div>
        </div>
      </SlideShell>
    ),
  },

  // 15 — Laura entende você (consulta)
  {
    id: 15,
    title: "Laura entende você",
    pdf: {
      eyebrow: "Laura · Consulta",
      title: "Pergunte com suas palavras.",
      bullets: [
        "Temos apartamento na Barra até R$ 2.500?",
        "Qual minha meta esse mês?",
        "Quais leads ainda não atendi hoje?",
      ],
    },
    render: () => (
      <SlideShell eyebrow="Laura · Consulta">
        <div className="space-y-8">
          <Headline>
            Pergunte com<br /><span style={{ color: GOLD }}>suas palavras</span>.
          </Headline>
          <div className="space-y-3 max-w-3xl">
            {[
              "Temos apartamento na Barra até R$ 2.500?",
              "Qual minha meta esse mês?",
              "Quais leads ainda não atendi hoje?",
            ].map((q, i) => (
              <div key={i} className="flex items-start gap-3 rounded-2xl px-5 py-4" style={{ background: `${GOLD}15`, border: `1px solid ${GOLD}44` }}>
                <MessageCircle className="h-5 w-5 flex-shrink-0 mt-0.5" style={{ color: GOLD }} />
                <div className="text-lg" style={{ fontFamily: "'Cormorant Garamond', serif" }}>"{q}"</div>
              </div>
            ))}
          </div>
        </div>
      </SlideShell>
    ),
  },

  // 16 — Laura trabalha por você (ação)
  {
    id: 16,
    title: "Laura trabalha por você",
    pdf: {
      eyebrow: "Laura · Ação",
      title: "Diga o que aconteceu. Ela registra.",
      bullets: [
        "A visita com o João foi realizada.",
        "Estou retirando a chave do apto 304 (com foto).",
        "Atualize minha agenda: seg a sex, 10h às 18h.",
      ],
    },
    render: () => (
      <SlideShell eyebrow="Laura · Ação">
        <div className="space-y-8">
          <Headline>
            Diga o que aconteceu.<br /><span style={{ color: GOLD }}>Ela registra</span>.
          </Headline>
          <div className="grid md:grid-cols-3 gap-4">
            {[
              { i: CheckCircle2, q: "A visita com o João foi realizada." },
              { i: Camera, q: "Estou retirando a chave do apto 304." },
              { i: CalendarDays, q: "Atualize minha agenda: seg-sex, 10-18h." },
            ].map((c, i) => (
              <GlassCard key={i}>
                <c.i className="h-7 w-7 mb-3" style={{ color: GOLD }} />
                <div className="text-base leading-snug" style={{ fontFamily: "'Cormorant Garamond', serif" }}>"{c.q}"</div>
              </GlassCard>
            ))}
          </div>
          <p className="text-center text-lg opacity-80 font-light pt-2" style={{ fontFamily: "'Cormorant Garamond', serif" }}>
            Você fala. <span style={{ color: GOLD_SOFT }}>Ela faz</span>.
          </p>
        </div>
      </SlideShell>
    ),
  },

  // 17 — Laura tem o seu lado
  {
    id: 17,
    title: "Laura tem o seu lado",
    pdf: {
      eyebrow: "Laura · Confiança",
      title: "Ela só age depois que você confirma.",
      bullets: [
        "Confirma toda ação sensível antes de executar.",
        "Respeita o que é seu — não cruza limites.",
        "Disponível 24h, sem fila, sem espera.",
      ],
    },
    render: () => (
      <SlideShell eyebrow="Laura · Confiança">
        <div className="grid md:grid-cols-2 gap-12 items-center">
          <div className="space-y-6">
            <Headline>
              Ela só age depois<br />que <span style={{ color: GOLD }}>você confirma</span>.
            </Headline>
            <div className="space-y-3 pt-2">
              {[
                { i: ShieldCheck, t: "Confirma antes de executar" },
                { i: CheckCircle2, t: "Respeita o que é seu" },
                { i: Clock, t: "Disponível 24h, sem fila" },
              ].map((b, i) => (
                <div key={i} className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-lg flex items-center justify-center" style={{ background: `${GOLD}15`, border: `1px solid ${GOLD}44` }}>
                    <b.i className="h-5 w-5" style={{ color: GOLD }} />
                  </div>
                  <span className="text-base opacity-90">{b.t}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="flex justify-center"><MockPhoneFrame variant="chat" /></div>
        </div>
      </SlideShell>
    ),
  },

  // 18 — Central Hoje
  {
    id: 18,
    title: "Central Hoje",
    pdf: {
      eyebrow: "Central Hoje",
      title: "Tudo que importa, sem esforço de organizar.",
      subtitle: "O que precisa da sua atenção agora — em uma só tela.",
    },
    render: () => (
      <SlideShell eyebrow="Central Hoje">
        <div className="space-y-8 max-w-4xl">
          <Headline>
            Tudo que importa,<br /><span style={{ color: GOLD }}>em uma tela só</span>.
          </Headline>
          <p className="text-xl opacity-85 max-w-2xl font-light" style={{ fontFamily: "'Cormorant Garamond', serif" }}>
            O que precisa da sua atenção agora.<br />
            Sem você ter que procurar.
          </p>
        </div>
      </SlideShell>
    ),
  },

  // 19 — PROVA REAL: Hoje
  {
    id: 19,
    title: "Prova real · Hoje",
    pdf: { eyebrow: "Prova real", title: "O seu dia, pronto quando você abre o app." },
    render: () => (
      <SlideShell eyebrow="Prova real">
        <div className="space-y-4">
          <div className="text-[11px] tracking-[0.35em] uppercase text-center" style={{ color: GOLD_SOFT }}>Tela real</div>
          <h3 className="text-3xl md:text-4xl font-semibold text-center" style={{ fontFamily: "'Cormorant Garamond', serif" }}>
            O seu dia, <span style={{ color: GOLD }}>pronto</span> quando você abre o app.
          </h3>
          <div className="flex justify-center pt-4">
            <div className="w-full max-w-3xl"><MockHojeCard /></div>
          </div>
        </div>
      </SlideShell>
    ),
  },

  // 20 — Desempenho
  {
    id: 20,
    title: "Seu desempenho, visível",
    pdf: {
      eyebrow: "Desempenho",
      title: "Seu funil. Seu tempo de resposta. Sua evolução.",
      subtitle: "Tudo medido, em tempo real, só para você ver.",
    },
    render: () => (
      <SlideShell eyebrow="Desempenho">
        <div className="space-y-8 max-w-5xl">
          <Headline>
            Seu funil. Seu tempo.<br /><span style={{ color: GOLD }}>Sua evolução</span>.
          </Headline>
          <p className="text-xl opacity-85 max-w-2xl font-light" style={{ fontFamily: "'Cormorant Garamond', serif" }}>
            Tudo medido, em tempo real,<br />
            só para você acompanhar.
          </p>
          <div className="flex gap-3 pt-2">
            {[TrendingUp, BarChart3, Target, Clock].map((I, i) => (
              <div key={i} className="h-12 w-12 rounded-xl flex items-center justify-center" style={{ background: `${GOLD}15`, border: `1px solid ${GOLD}44` }}>
                <I className="h-5 w-5" style={{ color: GOLD }} />
              </div>
            ))}
          </div>
        </div>
      </SlideShell>
    ),
  },

  // 21 — PROVA REAL: Dashboard
  {
    id: 21,
    title: "Prova real · Relatório",
    pdf: { eyebrow: "Prova real", title: "Sua performance, em uma olhada." },
    render: () => (
      <SlideShell eyebrow="Prova real">
        <div className="space-y-4">
          <div className="text-[11px] tracking-[0.35em] uppercase text-center" style={{ color: GOLD_SOFT }}>Tela real</div>
          <h3 className="text-3xl md:text-4xl font-semibold text-center" style={{ fontFamily: "'Cormorant Garamond', serif" }}>
            Sua performance, <span style={{ color: GOLD }}>em uma olhada</span>.
          </h3>
          <div className="flex justify-center pt-4">
            <div className="w-full max-w-3xl"><MockDashboard /></div>
          </div>
        </div>
      </SlideShell>
    ),
  },

  // 22 — Esforço reconhecido
  {
    id: 22,
    title: "Esforço reconhecido",
    pdf: {
      eyebrow: "Metas e Conquistas",
      title: "Cada esforço seu, finalmente reconhecido.",
      cards: [
        { title: "Metas", body: "Progresso em tempo real." },
        { title: "Badges", body: "Resposta relâmpago, top do mês, mais visitas." },
        { title: "Ranking", body: "Saudável, transparente, para crescer junto." },
      ],
    },
    render: () => (
      <SlideShell eyebrow="Metas e Conquistas">
        <div className="space-y-8">
          <Headline>
            Cada esforço seu,<br /><span style={{ color: GOLD }}>reconhecido</span>.
          </Headline>
          <div className="grid grid-cols-3 gap-4">
            {[
              { i: Target, t: "Metas", d: "Progresso em tempo real" },
              { i: Award, t: "Badges", d: "Conquistas automáticas" },
              { i: Trophy, t: "Ranking", d: "Time crescendo junto" },
            ].map((c, i) => (
              <GlassCard key={i} className="text-center py-7">
                <c.i className="h-10 w-10 mx-auto mb-3" style={{ color: GOLD }} />
                <div className="text-xl font-semibold mb-1">{c.t}</div>
                <div className="text-xs opacity-70">{c.d}</div>
              </GlassCard>
            ))}
          </div>
        </div>
      </SlideShell>
    ),
  },

  // 23 — Time
  {
    id: 23,
    title: "Você faz parte de um time",
    pdf: {
      eyebrow: "Cultura",
      title: "Você não vende sozinho. Você é parte de um time.",
      subtitle: "Feed, stories, conquistas — cultura viva, todos os dias.",
    },
    render: () => (
      <SlideShell eyebrow="Cultura">
        <div className="space-y-8 max-w-5xl">
          <Headline>
            Você não vende sozinho.<br /><span style={{ color: GOLD }}>Você é time</span>.
          </Headline>
          <p className="text-xl opacity-85 max-w-2xl font-light" style={{ fontFamily: "'Cormorant Garamond', serif" }}>
            Feed, stories, conquistas compartilhadas.<br />
            Cultura viva — todos os dias.
          </p>
          <div className="flex gap-3 pt-2">
            {[Newspaper, Heart, MessageCircle, Trophy].map((I, i) => (
              <div key={i} className="h-12 w-12 rounded-xl flex items-center justify-center" style={{ background: `${GOLD}15`, border: `1px solid ${GOLD}44` }}>
                <I className="h-5 w-5" style={{ color: GOLD }} />
              </div>
            ))}
          </div>
        </div>
      </SlideShell>
    ),
  },

  // 24 — PROVA REAL: Feed
  {
    id: 24,
    title: "Prova real · Feed",
    pdf: { eyebrow: "Prova real", title: "Conquistas compartilhadas. Time conectado." },
    render: () => (
      <SlideShell eyebrow="Prova real">
        <div className="grid md:grid-cols-2 gap-12 items-center">
          <div className="space-y-4">
            <div className="text-[11px] tracking-[0.35em] uppercase" style={{ color: GOLD_SOFT }}>Tela real</div>
            <h3 className="text-4xl md:text-5xl font-semibold leading-tight" style={{ fontFamily: "'Cormorant Garamond', serif" }}>
              Conquista de um,<br /><span style={{ color: GOLD }}>orgulho de todos</span>.
            </h3>
          </div>
          <div className="flex justify-center scale-110"><MockFeedPost /></div>
        </div>
      </SlideShell>
    ),
  },

  // 25 — Liberdade total (mobile)
  {
    id: 25,
    title: "Liberdade total",
    pdf: {
      eyebrow: "Mobile",
      title: "No celular. Como app de verdade. Em qualquer lugar.",
      subtitle: "Sem instalar pela loja. Em segundos. Pronto para usar.",
    },
    render: () => (
      <SlideShell eyebrow="Mobile">
        <div className="grid md:grid-cols-2 gap-12 items-center">
          <div className="space-y-6">
            <Headline>
              No celular.<br /><span style={{ color: GOLD }}>Em qualquer lugar</span>.
            </Headline>
            <p className="text-lg opacity-85 max-w-md font-light" style={{ fontFamily: "'Cormorant Garamond', serif" }}>
              Funciona como app de verdade.<br />
              Sem loja, sem instalação complicada.<br />
              Em segundos — pronto para usar.
            </p>
            <div className="flex items-center gap-2 text-xs opacity-70">
              <Smartphone className="h-4 w-4" /> Android · iPhone · Tablet
            </div>
          </div>
          <div className="flex justify-center"><MockPhoneFrame variant="dashboard" /></div>
        </div>
      </SlideShell>
    ),
  },

  // 26 — Fechamento disruptivo
  {
    id: 26,
    title: "Você é um dos próximos?",
    pdf: {
      title: "Isso não é mais uma ferramenta. É uma forma diferente de ser corretor.",
      subtitle: "Você é um dos próximos?",
    },
    render: () => (
      <SlideShell>
        <div className="space-y-12 text-center max-w-5xl mx-auto">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-[11px] tracking-[0.4em] uppercase mx-auto" style={{ background: "rgba(212,175,55,0.12)", color: GOLD_SOFT, border: `1px solid ${GOLD}55` }}>
            <Sparkles className="h-3.5 w-3.5" /> Ecossistema Nexus
          </div>
          <h2 className="text-5xl md:text-7xl font-semibold leading-[1.05]" style={{ fontFamily: "'Cormorant Garamond', serif" }}>
            Isso não é mais uma ferramenta.<br />
            <span style={{ color: GOLD }}>É uma forma diferente<br />de ser corretor.</span>
          </h2>
          <p className="text-3xl md:text-4xl opacity-95 font-light" style={{ fontFamily: "'Cormorant Garamond', serif" }}>
            Você é um dos <span style={{ color: GOLD_SOFT }}>próximos</span>?
          </p>
          <div className="pt-4 text-xs tracking-[0.35em] uppercase opacity-60">Iuri Rodrigues Imóveis</div>
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
            <Button size="sm" variant="outline" asChild className="gap-2">
              <a href="/apresentacao2"><Sparkles className="h-4 w-4" /> Apresentação 2</a>
            </Button>
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

      <div
        className={fullscreen ? "flex-1 flex items-center justify-center overflow-hidden" : "flex-1 flex items-center justify-center p-0 md:p-6"}
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
      >
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
