import { createFileRoute, redirect } from "@tanstack/react-router";
import React, { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import {
  ChevronLeft, ChevronRight, Maximize2, MessageCircle, Calendar, FileSpreadsheet,
  StickyNote, Globe, Bell, AlertTriangle, Sparkles, Radio, Users, Building2,
  Bot, Key, BarChart3, Trophy, Newspaper, Clock, ArrowRight, Search,
  CheckCircle2, MapPin, Send, Zap, Camera, Image as ImageIcon,
} from "lucide-react";

export const Route = createFileRoute("/_authenticated/apresentacao2")({
  beforeLoad: async () => {
    const { data: ud } = await supabase.auth.getUser();
    const uid = ud.user?.id;
    if (!uid) throw redirect({ to: "/auth" });
    const { data: roles } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", uid);
    const isAdmin = roles?.some((r) => r.role === "admin") ?? false;
    if (!isAdmin) throw redirect({ to: "/dashboard" });
  },
  component: Apresentacao2Page,
});

// ---------------- Tokens ----------------
const NAVY = "#0A0E1A";
const NAVY_2 = "#0F1730";
const NAVY_DEEP = "#06101F";
const GOLD = "#D4AF37";
const GOLD_SOFT = "#E8C977";

// ---------------- Shell ----------------
function Stage({
  children,
  variant = "default",
  eyebrow,
}: {
  children: React.ReactNode;
  variant?: "default" | "black" | "spot" | "deep";
  eyebrow?: string;
}) {
  const bg =
    variant === "black"
      ? `radial-gradient(900px 500px at 50% 60%, ${GOLD}14, transparent 70%), #000`
      : variant === "spot"
      ? `radial-gradient(700px 700px at 50% 50%, ${GOLD}33, transparent 65%), linear-gradient(180deg, ${NAVY_DEEP}, #000)`
      : variant === "deep"
      ? `linear-gradient(180deg, #000 0%, ${NAVY_DEEP} 100%)`
      : `radial-gradient(1400px 700px at 12% -10%, ${GOLD}22, transparent 60%), radial-gradient(1000px 600px at 110% 110%, ${GOLD}18, transparent 60%), linear-gradient(135deg, ${NAVY} 0%, ${NAVY_DEEP} 100%)`;
  return (
    <div className="relative w-full h-full overflow-hidden text-white" style={{ background: bg }}>
      <div
        className="absolute inset-0 opacity-[0.035] pointer-events-none"
        style={{
          backgroundImage:
            "linear-gradient(white 1px, transparent 1px), linear-gradient(90deg, white 1px, transparent 1px)",
          backgroundSize: "64px 64px",
        }}
      />
      {eyebrow && (
        <div
          className="absolute top-8 left-12 text-[11px] tracking-[0.45em] uppercase font-medium z-10"
          style={{ color: GOLD_SOFT }}
        >
          {eyebrow}
        </div>
      )}
      <div className="absolute top-8 right-12 text-[10px] tracking-[0.4em] uppercase opacity-50 z-10">
        Nexus
      </div>
      <div className="relative z-10 w-full h-full">{children}</div>
      <div className="absolute bottom-6 left-12 right-12 flex items-center text-[10px] opacity-40">
        <span className="tracking-[0.3em] uppercase">Iuri Rodrigues Imóveis</span>
        <span
          className="h-px flex-1 mx-6"
          style={{ background: `linear-gradient(90deg, transparent, ${GOLD}66, transparent)` }}
        />
        <span>O Futuro do Corretor</span>
      </div>
    </div>
  );
}

function Headline({
  children,
  size = "lg",
  align = "center",
}: {
  children: React.ReactNode;
  size?: "xl" | "lg" | "md";
  align?: "center" | "left";
}) {
  const cls =
    size === "xl"
      ? "text-6xl md:text-8xl"
      : size === "lg"
      ? "text-5xl md:text-7xl"
      : "text-4xl md:text-5xl";
  return (
    <h2
      className={`${cls} font-semibold leading-[1.02] ${align === "center" ? "text-center" : "text-left"}`}
      style={{ fontFamily: "'Cormorant Garamond', serif", letterSpacing: "-0.01em" }}
    >
      {children}
    </h2>
  );
}

function Sub({ children }: { children: React.ReactNode }) {
  return (
    <p
      className="text-xl md:text-2xl opacity-70 text-center mt-6 font-light"
      style={{ letterSpacing: "0.02em" }}
    >
      {children}
    </p>
  );
}

function Glow({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`relative ${className}`}>
      <div
        className="absolute inset-0 blur-3xl opacity-60"
        style={{ background: `radial-gradient(circle, ${GOLD}55, transparent 70%)` }}
      />
      <div className="relative">{children}</div>
    </div>
  );
}

// ---------------- Chat Mock ----------------
function LauraChat({ user, action }: { user: string; action: React.ReactNode }) {
  return (
    <div
      className="w-full max-w-2xl rounded-3xl border shadow-2xl overflow-hidden backdrop-blur-xl"
      style={{ background: "rgba(15,23,48,0.85)", borderColor: `${GOLD}55` }}
    >
      <div
        className="flex items-center gap-3 px-5 py-3 border-b"
        style={{ borderColor: `${GOLD}33`, background: "rgba(0,0,0,0.3)" }}
      >
        <div
          className="h-9 w-9 rounded-full flex items-center justify-center"
          style={{ background: `linear-gradient(135deg, ${GOLD}, ${GOLD_SOFT})` }}
        >
          <Bot className="h-5 w-5" style={{ color: NAVY }} />
        </div>
        <div>
          <div className="text-sm font-semibold">Laura</div>
          <div className="text-[10px] opacity-60 tracking-widest uppercase">Assistente Nexus</div>
        </div>
      </div>
      <div className="p-6 space-y-5">
        <div className="flex justify-end">
          <div
            className="max-w-[80%] rounded-2xl rounded-br-sm px-4 py-3 text-sm"
            style={{ background: `${GOLD}22`, border: `1px solid ${GOLD}44` }}
          >
            {user}
          </div>
        </div>
        <div className="flex justify-start">
          <div
            className="max-w-[90%] rounded-2xl rounded-bl-sm px-4 py-4 text-sm"
            style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)" }}
          >
            {action}
          </div>
        </div>
      </div>
    </div>
  );
}

// ---------------- SLIDES ----------------
type Slide = { id: number; title: string; render: () => React.ReactElement };

const SLIDES: Slide[] = [
  // S1
  {
    id: 1,
    title: "O corretor moderno",
    render: () => (
      <Stage variant="black" eyebrow="Ato 1 · A Dor">
        <div className="h-full flex flex-col items-center justify-center px-10">
          <div
            className="text-[10px] tracking-[0.5em] uppercase mb-10 opacity-60"
            style={{ color: GOLD_SOFT }}
          >
            2026
          </div>
          <Headline size="xl">
            O corretor moderno
            <br />
            <span style={{ color: GOLD }}>trabalha mais do que nunca.</span>
          </Headline>
        </div>
      </Stage>
    ),
  },
  // S2 — caos
  {
    id: 2,
    title: "Falta de sistema",
    render: () => (
      <Stage>
        <div className="h-full grid grid-cols-2 gap-12 items-center px-16">
          <div className="relative h-[70%]">
            {[
              { Icon: MessageCircle, label: "WhatsApp", x: "5%", y: "10%", rot: "-8deg" },
              { Icon: Calendar, label: "Agenda", x: "55%", y: "5%", rot: "6deg" },
              { Icon: FileSpreadsheet, label: "Planilha", x: "30%", y: "30%", rot: "-3deg" },
              { Icon: StickyNote, label: "Anotações", x: "10%", y: "55%", rot: "9deg" },
              { Icon: Globe, label: "Sites", x: "55%", y: "50%", rot: "-7deg" },
              { Icon: Bell, label: "Mensagens", x: "35%", y: "72%", rot: "4deg" },
            ].map(({ Icon, label, x, y, rot }, i) => (
              <div
                key={i}
                className="absolute rounded-2xl border backdrop-blur-md p-5 shadow-2xl"
                style={{
                  left: x,
                  top: y,
                  transform: `rotate(${rot})`,
                  background: "rgba(255,255,255,0.06)",
                  borderColor: "rgba(255,255,255,0.12)",
                  width: 160,
                }}
              >
                <Icon className="h-7 w-7 mb-2" style={{ color: GOLD_SOFT }} />
                <div className="text-sm opacity-80">{label}</div>
              </div>
            ))}
          </div>
          <div>
            <Headline align="left" size="lg">
              O problema não é
              <br />
              falta de esforço.
            </Headline>
            <p className="text-2xl mt-8 opacity-70 font-light">
              É falta de <span style={{ color: GOLD }}>sistema</span>.
            </p>
          </div>
        </div>
      </Stage>
    ),
  },
  // S3 — custo
  {
    id: 3,
    title: "Custo do caos",
    render: () => (
      <Stage variant="deep">
        <div className="h-full flex flex-col items-center justify-center px-16">
          <div className="grid grid-cols-3 gap-6 w-full max-w-5xl mb-12">
            {[
              { n: "1 em 4", l: "Leads perdidos por demora" },
              { n: "60%", l: "Follow-ups esquecidos" },
              { n: "30%", l: "Visitas sem confirmação" },
            ].map((s, i) => (
              <div
                key={i}
                className="rounded-2xl border p-8 text-center backdrop-blur-xl"
                style={{
                  background: "rgba(255,255,255,0.04)",
                  borderColor: "rgba(212,175,55,0.25)",
                }}
              >
                <div
                  className="text-5xl font-semibold mb-3"
                  style={{ color: GOLD, fontFamily: "'Cormorant Garamond', serif" }}
                >
                  {s.n}
                </div>
                <div className="text-sm opacity-70">{s.l}</div>
              </div>
            ))}
          </div>
          <Headline size="md">Pequenos esquecimentos geram grandes prejuízos.</Headline>
        </div>
      </Stage>
    ),
  },
  // S4 — Visão
  {
    id: 4,
    title: "Conectado",
    render: () => (
      <Stage variant="spot" eyebrow="Ato 2 · A Visão">
        <div className="h-full flex flex-col items-center justify-center">
          <Glow className="mb-12">
            <div
              className="h-28 w-28 rounded-3xl flex items-center justify-center text-4xl font-bold"
              style={{
                background: `linear-gradient(135deg, ${GOLD}, ${GOLD_SOFT})`,
                color: NAVY,
                fontFamily: "'Cormorant Garamond', serif",
              }}
            >
              N
            </div>
          </Glow>
          <Headline size="lg">E se tudo funcionasse conectado?</Headline>
        </div>
      </Stage>
    ),
  },
  // S5 — ecossistema map
  {
    id: 5,
    title: "Um ecossistema",
    render: () => {
      const orbit = [
        { Icon: MessageCircle, label: "WhatsApp" },
        { Icon: Radio, label: "Plantão" },
        { Icon: Calendar, label: "Agenda" },
        { Icon: Building2, label: "Portfólio" },
        { Icon: Bot, label: "Laura" },
        { Icon: BarChart3, label: "Relatórios" },
        { Icon: Newspaper, label: "Feed" },
        { Icon: Users, label: "Google Meet" },
      ];
      const R = 260;
      return (
        <Stage>
          <div className="h-full flex flex-col items-center justify-center">
            <div className="relative" style={{ width: R * 2 + 120, height: R * 2 + 120 }}>
              <div
                className="absolute inset-0 rounded-full border opacity-30"
                style={{ borderColor: GOLD, borderStyle: "dashed" }}
              />
              <Glow className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
                <div
                  className="h-32 w-32 rounded-3xl flex flex-col items-center justify-center"
                  style={{
                    background: `linear-gradient(135deg, ${GOLD}, ${GOLD_SOFT})`,
                    color: NAVY,
                  }}
                >
                  <div
                    className="text-3xl font-bold"
                    style={{ fontFamily: "'Cormorant Garamond', serif" }}
                  >
                    NEXUS
                  </div>
                </div>
              </Glow>
              {orbit.map(({ Icon, label }, i) => {
                const a = (i / orbit.length) * Math.PI * 2 - Math.PI / 2;
                const cx = R * Math.cos(a) + R + 60;
                const cy = R * Math.sin(a) + R + 60;
                return (
                  <div
                    key={i}
                    className="absolute rounded-2xl border backdrop-blur-md flex flex-col items-center justify-center"
                    style={{
                      left: cx - 50,
                      top: cy - 50,
                      width: 100,
                      height: 100,
                      background: "rgba(15,23,48,0.85)",
                      borderColor: `${GOLD}55`,
                    }}
                  >
                    <Icon className="h-6 w-6 mb-1.5" style={{ color: GOLD_SOFT }} />
                    <div className="text-[11px] opacity-80">{label}</div>
                  </div>
                );
              })}
            </div>
            <div className="mt-10">
              <Headline size="md">
                Um ecossistema. <span style={{ color: GOLD }}>Uma operação.</span>
              </Headline>
            </div>
          </div>
        </Stage>
      );
    },
  },
  // S6 — Jornada
  {
    id: 6,
    title: "Cliente real",
    render: () => (
      <Stage variant="black" eyebrow="Ato 3 · A Jornada">
        <div className="h-full flex flex-col items-center justify-center">
          <div
            className="h-24 w-24 rounded-full mb-8 flex items-center justify-center text-3xl font-semibold"
            style={{ background: `${GOLD}22`, color: GOLD_SOFT, border: `1px solid ${GOLD}55` }}
          >
            MC
          </div>
          <Headline size="lg">Vamos acompanhar um cliente real.</Headline>
          <Sub>Marina · procura 2 quartos na Barra · R$ 650 mil</Sub>
        </div>
      </Stage>
    ),
  },
  // S7 — mensagem
  {
    id: 7,
    title: "Mensagem chegando",
    render: () => (
      <Stage variant="deep">
        <div className="h-full flex items-center justify-center">
          <div
            className="w-[380px] rounded-[40px] border-8 shadow-2xl overflow-hidden"
            style={{ borderColor: "#1a1a1a", background: "#0a1f1c" }}
          >
            <div className="px-5 py-3 flex items-center gap-3" style={{ background: "#075E54" }}>
              <div className="h-10 w-10 rounded-full bg-white/20 flex items-center justify-center text-white font-semibold">
                M
              </div>
              <div>
                <div className="text-white text-sm font-semibold">Marina Costa</div>
                <div className="text-white/70 text-[10px]">online</div>
              </div>
            </div>
            <div className="p-4 space-y-3 min-h-[440px]" style={{ background: "#0b141a" }}>
              <div
                className="rounded-lg rounded-tl-none px-3 py-2 text-sm text-white max-w-[80%]"
                style={{ background: "#1f2c33" }}
              >
                Oi! Vi o anúncio do apartamento na Barra. Ainda está disponível?
                <div className="text-[9px] opacity-60 text-right mt-1">14:02</div>
              </div>
              <div className="flex items-center gap-2 text-white/40 text-xs animate-pulse">
                <span className="h-1.5 w-1.5 rounded-full bg-white/40" />
                digitando...
              </div>
            </div>
          </div>
          <div className="ml-16 max-w-md">
            <Headline align="left" size="md">
              Um cliente
              <br />
              entra em contato.
            </Headline>
          </div>
        </div>
      </Stage>
    ),
  },
  // S8 — distribuição
  {
    id: 8,
    title: "Nenhuma oportunidade esquecida",
    render: () => (
      <Stage>
        <div className="h-full flex flex-col items-center justify-center px-10">
          <div className="flex items-center gap-6 mb-14">
            {[
              { Icon: MessageCircle, label: "Lead" },
              { Icon: Radio, label: "Plantão" },
              { Icon: Users, label: "Corretor" },
            ].map(({ Icon, label }, i, arr) => (
              <React.Fragment key={i}>
                <div
                  className="rounded-2xl border backdrop-blur-md px-8 py-6 flex flex-col items-center"
                  style={{
                    background: "rgba(15,23,48,0.7)",
                    borderColor: `${GOLD}55`,
                    minWidth: 180,
                  }}
                >
                  <Icon className="h-9 w-9 mb-3" style={{ color: GOLD_SOFT }} />
                  <div className="text-lg font-medium">{label}</div>
                </div>
                {i < arr.length - 1 && (
                  <ArrowRight className="h-8 w-8 opacity-60" style={{ color: GOLD }} />
                )}
              </React.Fragment>
            ))}
          </div>
          <Headline size="md">Nenhuma oportunidade fica esquecida.</Headline>
        </div>
      </Stage>
    ),
  },
  // S9 — SLA 10 min
  {
    id: 9,
    title: "10 minutos",
    render: () => (
      <Stage variant="spot">
        <div className="h-full flex flex-col items-center justify-center">
          <Glow className="mb-10">
            <div
              className="h-64 w-64 rounded-full border-4 flex flex-col items-center justify-center"
              style={{ borderColor: GOLD, background: "rgba(0,0,0,0.4)" }}
            >
              <Clock className="h-10 w-10 mb-3" style={{ color: GOLD_SOFT }} />
              <div
                className="text-7xl font-bold"
                style={{ color: GOLD, fontFamily: "'Cormorant Garamond', serif" }}
              >
                10:00
              </div>
              <div className="text-xs tracking-[0.3em] uppercase opacity-70 mt-2">SLA</div>
            </div>
          </Glow>
          <Headline size="md">O Nexus protege suas oportunidades.</Headline>
          <Sub>Escalonamento automático se ninguém responder.</Sub>
        </div>
      </Stage>
    ),
  },
  // S10 — Portfolio
  {
    id: 10,
    title: "Estoque no bolso",
    render: () => (
      <Stage eyebrow="Ato 4 · No Controle">
        <div className="h-full grid grid-cols-2 gap-12 items-center px-16">
          <div>
            <Headline align="left" size="lg">
              Seu estoque inteiro
              <br />
              <span style={{ color: GOLD }}>no bolso.</span>
            </Headline>
          </div>
          <div className="grid grid-cols-2 gap-4">
            {[1, 2, 3, 4].map((i) => (
              <div
                key={i}
                className="rounded-2xl border overflow-hidden shadow-2xl"
                style={{ background: NAVY_2, borderColor: `${GOLD}33` }}
              >
                <div
                  className="h-32 flex items-center justify-center"
                  style={{
                    background: `linear-gradient(135deg, ${GOLD}33, ${NAVY_DEEP})`,
                  }}
                >
                  <ImageIcon className="h-10 w-10 opacity-30" />
                </div>
                <div className="p-4">
                  <div className="text-xs opacity-60 mb-1 flex items-center gap-1">
                    <MapPin className="h-3 w-3" /> Barra da Tijuca
                  </div>
                  <div
                    className="text-lg font-semibold"
                    style={{ color: GOLD, fontFamily: "'Cormorant Garamond', serif" }}
                  >
                    R$ {(580 + i * 35)}.000
                  </div>
                  <div className="text-[11px] opacity-70 mt-1">2 quartos · 78m²</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </Stage>
    ),
  },
  // S11 — Agenda
  {
    id: 11,
    title: "Semana organizada",
    render: () => (
      <Stage variant="deep">
        <div className="h-full grid grid-cols-2 gap-12 items-center px-16">
          <div
            className="rounded-2xl border shadow-2xl overflow-hidden backdrop-blur-xl"
            style={{ background: "rgba(15,23,48,0.85)", borderColor: `${GOLD}55` }}
          >
            <div className="px-5 py-3 border-b flex items-center justify-between" style={{ borderColor: `${GOLD}33` }}>
              <div className="text-sm font-semibold">Esta semana</div>
              <Calendar className="h-4 w-4" style={{ color: GOLD_SOFT }} />
            </div>
            <div className="p-4 space-y-2">
              {[
                { d: "SEG", t: "09:00", e: "Visita · Marina · Barra" },
                { d: "TER", t: "14:30", e: "Reunião · Equipe" },
                { d: "QUA", t: "10:00", e: "Visita · João · Recreio" },
                { d: "QUI", t: "16:00", e: "Google Meet · Cliente" },
                { d: "SEX", t: "11:00", e: "Visita · Ana · Jacarepaguá" },
              ].map((r, i) => (
                <div
                  key={i}
                  className="flex items-center gap-4 px-3 py-2.5 rounded-lg"
                  style={{ background: "rgba(255,255,255,0.04)" }}
                >
                  <div
                    className="text-[10px] tracking-widest font-semibold w-9 text-center"
                    style={{ color: GOLD_SOFT }}
                  >
                    {r.d}
                  </div>
                  <div className="text-sm font-mono opacity-80 w-14">{r.t}</div>
                  <div className="text-sm flex-1">{r.e}</div>
                </div>
              ))}
            </div>
          </div>
          <div>
            <Headline align="left" size="lg">
              Sua semana
              <br />
              organizada em
              <br />
              <span style={{ color: GOLD }}>segundos.</span>
            </Headline>
          </div>
        </div>
      </Stage>
    ),
  },
  // S12 — Laura disponibilidade
  {
    id: 12,
    title: "Fale naturalmente",
    render: () => (
      <Stage variant="deep" eyebrow="Ato 5 · O Momento UAU">
        <div className="h-full flex flex-col items-center justify-center px-16">
          <Headline size="md">Fale naturalmente.</Headline>
          <div className="mt-10">
            <LauraChat
              user="Laura, estou disponível esta semana de segunda a sexta das 10h às 18h. Atualize minha disponibilidade."
              action={
                <div>
                  <div className="flex items-center gap-2 mb-3" style={{ color: GOLD_SOFT }}>
                    <CheckCircle2 className="h-4 w-4" /> Agenda atualizada
                  </div>
                  <div className="grid grid-cols-5 gap-1.5 text-center text-[10px]">
                    {["SEG", "TER", "QUA", "QUI", "SEX"].map((d) => (
                      <div
                        key={d}
                        className="rounded px-1 py-2"
                        style={{ background: `${GOLD}22`, border: `1px solid ${GOLD}44` }}
                      >
                        <div className="font-semibold" style={{ color: GOLD_SOFT }}>
                          {d}
                        </div>
                        <div className="opacity-70 mt-1">10—18h</div>
                      </div>
                    ))}
                  </div>
                </div>
              }
            />
          </div>
        </div>
      </Stage>
    ),
  },
  // S13 — Prioridades
  {
    id: 13,
    title: "Receba direção",
    render: () => (
      <Stage variant="deep">
        <div className="h-full flex flex-col items-center justify-center px-16">
          <Headline size="md">Receba direção.</Headline>
          <div className="mt-10">
            <LauraChat
              user="Laura, quais são meus leads mais urgentes hoje?"
              action={
                <div className="space-y-2">
                  <div className="text-xs opacity-70 mb-2">3 prioridades para hoje:</div>
                  {[
                    { n: "Marina Costa", w: "Esperando há 8min", c: "#ef4444" },
                    { n: "João Silva", w: "Follow-up vencendo", c: GOLD },
                    { n: "Ana Lima", w: "Visita amanhã 9h", c: "#22c55e" },
                  ].map((l, i) => (
                    <div
                      key={i}
                      className="flex items-center gap-3 px-3 py-2 rounded-lg"
                      style={{ background: "rgba(255,255,255,0.04)" }}
                    >
                      <span className="h-2 w-2 rounded-full" style={{ background: l.c }} />
                      <div className="text-sm font-medium flex-1">{l.n}</div>
                      <div className="text-[11px] opacity-70">{l.w}</div>
                    </div>
                  ))}
                </div>
              }
            />
          </div>
        </div>
      </Stage>
    ),
  },
  // S14 — Consulta portfolio
  {
    id: 14,
    title: "Respostas em segundos",
    render: () => (
      <Stage variant="deep">
        <div className="h-full flex flex-col items-center justify-center px-16">
          <Headline size="md">Encontre respostas em segundos.</Headline>
          <div className="mt-10">
            <LauraChat
              user="Laura, quais imóveis tenho disponíveis na Barra até R$ 700 mil?"
              action={
                <div className="space-y-2">
                  <div className="text-xs opacity-70 mb-2 flex items-center gap-2">
                    <Search className="h-3 w-3" /> 4 imóveis encontrados
                  </div>
                  {[
                    { e: "Av. das Américas, 5500", p: "R$ 620.000" },
                    { e: "Rua Olegário, 120", p: "R$ 680.000" },
                    { e: "Av. Lúcio Costa, 3300", p: "R$ 695.000" },
                  ].map((i, k) => (
                    <div
                      key={k}
                      className="flex items-center gap-3 px-3 py-2 rounded-lg"
                      style={{ background: "rgba(255,255,255,0.04)" }}
                    >
                      <Building2 className="h-4 w-4 opacity-60" />
                      <div className="text-sm flex-1">{i.e}</div>
                      <div className="text-sm font-semibold" style={{ color: GOLD_SOFT }}>
                        {i.p}
                      </div>
                    </div>
                  ))}
                </div>
              }
            />
          </div>
        </div>
      </Stage>
    ),
  },
  // S15 — Visita realizada
  {
    id: 15,
    title: "Menos burocracia",
    render: () => (
      <Stage variant="deep">
        <div className="h-full flex flex-col items-center justify-center px-16">
          <Headline size="md">Menos burocracia. Mais vendas.</Headline>
          <div className="mt-10">
            <LauraChat
              user="Laura, a visita com João foi realizada."
              action={
                <div>
                  <div className="flex items-center gap-2 mb-3" style={{ color: GOLD_SOFT }}>
                    <CheckCircle2 className="h-4 w-4" /> Visita registrada
                  </div>
                  <div className="space-y-1.5 text-xs opacity-80">
                    <div>· Status: <span style={{ color: GOLD_SOFT }}>Compareceu</span></div>
                    <div>· Lead movido para "Pós-visita"</div>
                    <div>· Follow-up agendado em 2 dias</div>
                  </div>
                </div>
              }
            />
          </div>
        </div>
      </Stage>
    ),
  },
  // S16 — emocional
  {
    id: 16,
    title: "Ela devolve seu tempo",
    render: () => (
      <Stage variant="spot">
        <div className="h-full flex flex-col items-center justify-center">
          <Glow className="mb-12">
            <Sparkles className="h-20 w-20" style={{ color: GOLD }} />
          </Glow>
          <Headline size="lg">A Laura não vende por você.</Headline>
          <p
            className="text-3xl md:text-4xl mt-8 font-light text-center"
            style={{ color: GOLD, fontFamily: "'Cormorant Garamond', serif" }}
          >
            Ela devolve seu tempo.
          </p>
        </div>
      </Stage>
    ),
  },
  // S17 — Chaves
  {
    id: 17,
    title: "Gestão de Chaves",
    render: () => (
      <Stage eyebrow="Ato 6 · Tecnologia Invisível">
        <div className="h-full flex flex-col items-center justify-center px-16">
          <div className="flex items-center gap-4 mb-12">
            {[
              { Icon: Camera, l: "Foto" },
              { Icon: Key, l: "Retirada" },
              { Icon: CheckCircle2, l: "Controle" },
              { Icon: ArrowRight, l: "Devolução" },
            ].map(({ Icon, l }, i, arr) => (
              <React.Fragment key={i}>
                <div
                  className="rounded-2xl border backdrop-blur-md px-6 py-5 flex flex-col items-center"
                  style={{
                    background: "rgba(15,23,48,0.7)",
                    borderColor: `${GOLD}55`,
                    minWidth: 130,
                  }}
                >
                  <Icon className="h-7 w-7 mb-2" style={{ color: GOLD_SOFT }} />
                  <div className="text-xs opacity-80">{l}</div>
                </div>
                {i < arr.length - 1 && (
                  <div className="h-px w-8" style={{ background: `${GOLD}66` }} />
                )}
              </React.Fragment>
            ))}
          </div>
          <Headline size="md">Controle sem complicação.</Headline>
        </div>
      </Stage>
    ),
  },
  // S18 — Follow-up
  {
    id: 18,
    title: "Lembra do cliente",
    render: () => (
      <Stage variant="deep">
        <div className="h-full flex flex-col items-center justify-center px-16">
          <Glow className="mb-10">
            <div
              className="h-24 w-24 rounded-3xl flex items-center justify-center"
              style={{ background: `${GOLD}22`, border: `1px solid ${GOLD}55` }}
            >
              <Bell className="h-12 w-12" style={{ color: GOLD }} />
            </div>
          </Glow>
          <Headline size="md">
            O Nexus lembra do cliente
            <br />
            <span style={{ color: GOLD }}>quando você esquece.</span>
          </Headline>
        </div>
      </Stage>
    ),
  },
  // S19 — Templates
  {
    id: 19,
    title: "Menos trabalho repetitivo",
    render: () => (
      <Stage>
        <div className="h-full grid grid-cols-2 gap-12 items-center px-16">
          <div className="space-y-3">
            {[
              "Olá {nome}, sobre o imóvel na {regiao}...",
              "Confirmando nossa visita amanhã às {hora}.",
              "Tenho 3 opções dentro do seu orçamento.",
            ].map((t, i) => (
              <div
                key={i}
                className="rounded-xl border backdrop-blur-md p-4 flex items-center gap-3"
                style={{ background: "rgba(15,23,48,0.7)", borderColor: `${GOLD}44` }}
              >
                <Send className="h-4 w-4" style={{ color: GOLD_SOFT }} />
                <div className="text-sm opacity-90">{t}</div>
              </div>
            ))}
          </div>
          <div>
            <Headline align="left" size="lg">
              Menos trabalho
              <br />
              <span style={{ color: GOLD }}>repetitivo.</span>
            </Headline>
          </div>
        </div>
      </Stage>
    ),
  },
  // S20 — Dashboard
  {
    id: 20,
    title: "Medido melhora",
    render: () => (
      <Stage variant="deep" eyebrow="Ato 7 · Performance">
        <div className="h-full grid grid-cols-2 gap-12 items-center px-16">
          <div>
            <Headline align="left" size="lg">
              O que é medido
              <br />
              <span style={{ color: GOLD }}>melhora.</span>
            </Headline>
          </div>
          <div
            className="rounded-2xl border backdrop-blur-xl p-6 shadow-2xl"
            style={{ background: "rgba(15,23,48,0.85)", borderColor: `${GOLD}55` }}
          >
            <div className="grid grid-cols-3 gap-3 mb-5">
              {[
                { n: "47", l: "Leads" },
                { n: "12", l: "Visitas" },
                { n: "R$ 2,1M", l: "VGV" },
              ].map((s, i) => (
                <div
                  key={i}
                  className="rounded-xl px-3 py-3 text-center"
                  style={{ background: "rgba(255,255,255,0.04)" }}
                >
                  <div
                    className="text-2xl font-semibold"
                    style={{ color: GOLD, fontFamily: "'Cormorant Garamond', serif" }}
                  >
                    {s.n}
                  </div>
                  <div className="text-[10px] opacity-70 uppercase tracking-wider">{s.l}</div>
                </div>
              ))}
            </div>
            <div className="flex items-end gap-2 h-32">
              {[40, 55, 38, 70, 60, 82, 95].map((h, i) => (
                <div
                  key={i}
                  className="flex-1 rounded-t"
                  style={{
                    height: `${h}%`,
                    background: `linear-gradient(180deg, ${GOLD}, ${GOLD}44)`,
                  }}
                />
              ))}
            </div>
            <div className="text-[10px] opacity-60 mt-3 tracking-widest uppercase">
              Últimos 7 dias
            </div>
          </div>
        </div>
      </Stage>
    ),
  },
  // S21 — Metas
  {
    id: 21,
    title: "Crescimento visível",
    render: () => (
      <Stage>
        <div className="h-full flex flex-col items-center justify-center px-16">
          <div className="grid grid-cols-3 gap-6 w-full max-w-4xl mb-12">
            {[
              { Icon: Trophy, l: "Top Vendedor", c: GOLD },
              { Icon: Zap, l: "Resposta Relâmpago", c: "#22c55e" },
              { Icon: Sparkles, l: "100% Meta", c: GOLD_SOFT },
            ].map(({ Icon, l, c }, i) => (
              <div
                key={i}
                className="rounded-2xl border backdrop-blur-md p-6 flex flex-col items-center"
                style={{ background: "rgba(15,23,48,0.7)", borderColor: `${c}66` }}
              >
                <div
                  className="h-16 w-16 rounded-full flex items-center justify-center mb-3"
                  style={{ background: `${c}22`, border: `1px solid ${c}66` }}
                >
                  <Icon className="h-8 w-8" style={{ color: c }} />
                </div>
                <div className="text-sm font-medium text-center">{l}</div>
              </div>
            ))}
          </div>
          <Headline size="md">Seu crescimento fica visível.</Headline>
        </div>
      </Stage>
    ),
  },
  // S22 — Feed
  {
    id: 22,
    title: "Algo maior",
    render: () => (
      <Stage variant="deep">
        <div className="h-full grid grid-cols-2 gap-12 items-center px-16">
          <div
            className="rounded-2xl border backdrop-blur-xl p-5 shadow-2xl space-y-3"
            style={{ background: "rgba(15,23,48,0.85)", borderColor: `${GOLD}55` }}
          >
            <div className="flex gap-2 overflow-hidden">
              {["PR", "AC", "MS", "JL", "FN"].map((u, i) => (
                <div
                  key={i}
                  className="h-12 w-12 rounded-full flex items-center justify-center text-xs font-semibold flex-shrink-0"
                  style={{
                    background: `linear-gradient(135deg, ${GOLD}, ${GOLD_SOFT})`,
                    color: NAVY,
                    border: `2px solid ${NAVY_2}`,
                  }}
                >
                  {u}
                </div>
              ))}
            </div>
            <div
              className="rounded-xl p-4"
              style={{ background: "rgba(255,255,255,0.04)" }}
            >
              <div className="flex items-center gap-2 mb-2">
                <div
                  className="h-8 w-8 rounded-full flex items-center justify-center text-xs font-semibold"
                  style={{
                    background: `linear-gradient(135deg, ${GOLD}, ${GOLD_SOFT})`,
                    color: NAVY,
                  }}
                >
                  AC
                </div>
                <div className="text-sm font-medium">Ana Carvalho</div>
              </div>
              <div className="text-sm opacity-80">
                Fechei o apto da Barra! 🎉 Obrigada equipe!
              </div>
            </div>
          </div>
          <div>
            <Headline align="left" size="lg">
              Você faz parte
              <br />
              de <span style={{ color: GOLD }}>algo maior.</span>
            </Headline>
          </div>
        </div>
      </Stage>
    ),
  },
  // S23 — Tudo junto
  {
    id: 23,
    title: "Trabalhando junto",
    render: () => (
      <Stage variant="spot" eyebrow="Ato 8 · Encerramento">
        <div className="h-full flex flex-col items-center justify-center">
          <div className="grid grid-cols-4 gap-3 mb-12">
            {[
              MessageCircle, Radio, Calendar, Building2,
              Bot, Key, BarChart3, Newspaper,
            ].map((Icon, i) => (
              <div
                key={i}
                className="h-20 w-20 rounded-2xl border backdrop-blur-md flex items-center justify-center"
                style={{
                  background: "rgba(15,23,48,0.7)",
                  borderColor: `${GOLD}55`,
                  animation: `pulse 2s ease-in-out ${i * 0.1}s infinite`,
                }}
              >
                <Icon className="h-8 w-8" style={{ color: GOLD_SOFT }} />
              </div>
            ))}
          </div>
          <Headline size="md">Tudo trabalhando junto.</Headline>
        </div>
      </Stage>
    ),
  },
  // S24 — Não é sistema
  {
    id: 24,
    title: "Não é um sistema",
    render: () => (
      <Stage variant="black">
        <div className="h-full flex items-center justify-center px-10">
          <Headline size="xl">
            O Nexus
            <br />
            <span className="opacity-50">não é um sistema.</span>
          </Headline>
        </div>
      </Stage>
    ),
  },
  // S25 — Vantagem
  {
    id: 25,
    title: "Vantagem competitiva",
    render: () => (
      <Stage variant="black">
        <div className="h-full flex items-center justify-center px-10">
          <Headline size="xl">
            É uma
            <br />
            <span style={{ color: GOLD }}>vantagem competitiva.</span>
          </Headline>
        </div>
      </Stage>
    ),
  },
  // S26 — Encerramento
  {
    id: 26,
    title: "O futuro chegou",
    render: () => (
      <Stage variant="spot">
        <div className="h-full flex flex-col items-center justify-center">
          <Glow className="mb-12">
            <div
              className="h-36 w-36 rounded-[2rem] flex items-center justify-center"
              style={{
                background: `linear-gradient(135deg, ${GOLD}, ${GOLD_SOFT})`,
                color: NAVY,
              }}
            >
              <div
                className="text-6xl font-bold"
                style={{ fontFamily: "'Cormorant Garamond', serif" }}
              >
                N
              </div>
            </div>
          </Glow>
          <Headline size="lg">O futuro do corretor já chegou.</Headline>
          <p
            className="text-2xl md:text-3xl mt-6 font-light text-center"
            style={{ color: GOLD_SOFT, fontFamily: "'Cormorant Garamond', serif" }}
          >
            E você faz parte dele.
          </p>
        </div>
      </Stage>
    ),
  },
];

// ---------------- Page ----------------
function Apresentacao2Page() {
  const [idx, setIdx] = useState(0);
  const [fullscreen, setFullscreen] = useState(false);
  const [transitioning, setTransitioning] = useState(false);

  const go = useCallback((target: number) => {
    setTransitioning(true);
    setTimeout(() => {
      setIdx(target);
      setTransitioning(false);
    }, 200);
  }, []);

  const next = useCallback(
    () => go(Math.min(SLIDES.length - 1, idx + 1)),
    [idx, go],
  );
  const prev = useCallback(() => go(Math.max(0, idx - 1)), [idx, go]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight" || e.key === " " || e.key === "PageDown") {
        e.preventDefault();
        next();
      } else if (e.key === "ArrowLeft" || e.key === "PageUp") {
        e.preventDefault();
        prev();
      } else if (e.key === "Home") go(0);
      else if (e.key === "End") go(SLIDES.length - 1);
      else if (e.key === "Escape" && document.fullscreenElement)
        document.exitFullscreen();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [next, prev, go]);

  useEffect(() => {
    const onFs = () => setFullscreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", onFs);
    return () => document.removeEventListener("fullscreenchange", onFs);
  }, []);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) document.documentElement.requestFullscreen();
    else document.exitFullscreen();
  };

  const slide = SLIDES[idx];

  const touchX = useRef<number | null>(null);
  const onTouchStart = (e: React.TouchEvent) => {
    touchX.current = e.touches[0].clientX;
  };
  const onTouchEnd = (e: React.TouchEvent) => {
    if (touchX.current == null) return;
    const dx = e.changedTouches[0].clientX - touchX.current;
    if (Math.abs(dx) > 50) (dx < 0 ? next : prev)();
    touchX.current = null;
  };

  return (
    <div className={fullscreen ? "fixed inset-0 z-[9999] bg-black flex flex-col" : "min-h-screen flex flex-col bg-black"}>
      {!fullscreen && (
        <div
          className="flex items-center justify-between gap-3 px-4 py-3 border-b"
          style={{ background: NAVY_DEEP, borderColor: "rgba(212,175,55,0.25)" }}
        >
          <div className="text-white text-sm">
            <span className="opacity-60">Apresentação 2 · O Futuro do Corretor · </span>
            <span className="font-semibold">{slide.title}</span>
            <span className="opacity-60 ml-2">
              · Slide {idx + 1} de {SLIDES.length}
            </span>
          </div>
          <Button size="sm" variant="outline" onClick={toggleFullscreen} className="gap-2">
            <Maximize2 className="h-4 w-4" /> Modo Palestra
          </Button>
        </div>
      )}

      <div
        className={fullscreen ? "flex-1 flex items-center justify-center overflow-hidden" : "flex-1 flex items-center justify-center p-0 md:p-6"}
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
        onClick={(e) => {
          if (!fullscreen) return;
          const w = window.innerWidth;
          if (e.clientX > w / 2) next();
          else prev();
        }}
      >
        <div
          className={fullscreen ? "relative bg-black overflow-hidden" : "relative w-full max-w-[1400px] rounded-xl overflow-hidden shadow-2xl"}
          style={
            fullscreen
              ? { width: "min(100vw, 177.78vh)", height: "min(56.25vw, 100vh)" }
              : { aspectRatio: "16/9" }
          }
        >
          <div
            className="absolute inset-0 transition-all duration-300"
            style={{
              opacity: transitioning ? 0 : 1,
              transform: transitioning ? "scale(0.98)" : "scale(1)",
            }}
          >
            {slide.render()}
          </div>
        </div>
      </div>

      {!fullscreen && (
        <div
          className="flex items-center justify-center gap-4 px-4 py-4"
          style={{ background: NAVY_DEEP }}
        >
          <Button size="icon" variant="outline" onClick={prev} disabled={idx === 0}>
            <ChevronLeft className="h-5 w-5" />
          </Button>
          <div className="flex gap-1.5 items-center max-w-2xl flex-wrap justify-center">
            {SLIDES.map((_, i) => (
              <button
                key={i}
                onClick={() => go(i)}
                className="h-2 rounded-full transition-all"
                style={{
                  width: i === idx ? 28 : 8,
                  background: i === idx ? GOLD : "rgba(255,255,255,0.25)",
                }}
                aria-label={`Ir para slide ${i + 1}`}
              />
            ))}
          </div>
          <Button
            size="icon"
            variant="outline"
            onClick={next}
            disabled={idx === SLIDES.length - 1}
          >
            <ChevronRight className="h-5 w-5" />
          </Button>
        </div>
      )}

      {fullscreen && (
        <>
          <button
            onClick={(e) => {
              e.stopPropagation();
              prev();
            }}
            className="fixed left-4 top-1/2 -translate-y-1/2 p-3 rounded-full bg-white/10 hover:bg-white/20 text-white z-[10000]"
            aria-label="Anterior"
          >
            <ChevronLeft className="h-6 w-6" />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              next();
            }}
            className="fixed right-4 top-1/2 -translate-y-1/2 p-3 rounded-full bg-white/10 hover:bg-white/20 text-white z-[10000]"
            aria-label="Próximo"
          >
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
