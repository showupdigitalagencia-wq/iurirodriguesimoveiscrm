import { createFileRoute, useSearch, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { getCaptacaoConfig } from "@/lib/captacao.functions";
import {
  CAPTACAO_REGIOES_MARQUEE,
  CAPTACAO_STATS,
} from "@/lib/captacao.constants";
import logoAsset from "@/assets/logo_iuri_rodrigues_v2.png.asset.json";
import { ShieldCheck, Cpu, Scale, GraduationCap } from "lucide-react";


const PILARES = [
  {
    icon: ShieldCheck,
    titulo: "Força de uma marca que já conquistou o mercado",
    texto:
      "Anos de atuação consolidada no Rio de Janeiro e Baixada Fluminense construíram uma reputação que abre portas. Clientes reconhecem o nome, indicam para outros e voltam a fechar negócio com a Iuri Rodrigues Imóveis. Trabalhar com uma marca respeitada muda completamente a forma como você é recebido em cada negociação.",
  },
  {
    icon: Cpu,
    titulo: "Tecnologia que nenhuma outra imobiliária da região tem",
    texto:
      "Desenvolvemos o Sistema Nexus, nosso próprio ecossistema digital com inteligência artificial integrada, a Laura. Gerencie seus leads, consulte o portfólio completo de imóveis, acompanhe sua agenda e organize toda sua rotina em um só lugar, direto do celular. Enquanto outros corretores ainda usam planilha e WhatsApp pessoal para tudo, você trabalha com tecnologia de ponta.",
  },
  {
    icon: Scale,
    titulo: "Oportunidades distribuídas com justiça",
    texto:
      "Aqui, leads não ficam perdidos em grupo de WhatsApp nem favorecem quem grita mais alto. Nosso sistema distribui oportunidades de forma automática e equilibrada, e acompanha seu desempenho com metas e conquistas reconhecidas por todo o time. Seu crescimento aqui depende do seu esforço, não de sorte.",
  },
  {
    icon: GraduationCap,
    titulo: "Mentoria e treinamento que formam referências",
    texto:
      "Investimos continuamente na formação de cada corretor através de mentorias presenciais, treinamentos práticos e acompanhamento próximo da liderança executiva. Não entregamos apenas ferramentas. Entregamos conhecimento, técnica e direcionamento estratégico construídos a partir de anos de experiência real no mercado imobiliário. É esse compromisso com o desenvolvimento contínuo que faz da Iuri Rodrigues Imóveis uma referência reconhecida.",
  },
];

const searchSchema = z.object({
  ref: z.enum(["barra", "recreio", "belford", "mesquita"]).optional(),
});

export const Route = createFileRoute("/seja-corretor")({
  ssr: false,
  validateSearch: searchSchema,
  head: () => ({
    meta: [
      { title: "Seja Corretor — Ecossistema Nexus | Iuri Rodrigues Imóveis" },
      {
        name: "description",
        content:
          "Os melhores corretores do Rio estão aqui. Conheça o Ecossistema Nexus e faça parte do time de corretores mais moderno do RJ.",
      },
      { property: "og:title", content: "Seja Corretor — Ecossistema Nexus" },
      {
        property: "og:description",
        content: "O time de corretores mais moderno do Rio de Janeiro.",
      },
    ],
  }),
  component: SejaCorretorPage,
});

const GOLD = "#D4AF37";
const SERIF = "'Cormorant Garamond', 'Playfair Display', Georgia, serif";
const LOGO_URL = logoAsset.url;

function youtubeId(url: string): string | null {
  if (!url) return null;
  const m = url.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|shorts\/))([\w-]{11})/);
  return m ? m[1] : null;
}

function SejaCorretorPage() {
  const { ref } = useSearch({ from: "/seja-corretor" });
  const getConfig = useServerFn(getCaptacaoConfig);
  const [vslId, setVslId] = useState<string | null>(null);
  const [groupUrl, setGroupUrl] = useState<string | null>(null);

  useEffect(() => {
    getConfig({})
      .then((r) => {
        setVslId(youtubeId(r.vslUrl));
        setGroupUrl(r.groupUrl);
      })
      .catch(() => null);
  }, [getConfig]);


  return (
    <div className="min-h-screen" style={{ background: "#0A0E1A", color: "white", fontFamily: "var(--font-sans)" }}>
      {/* HERO */}
      <section
        className="relative px-6 pt-10 pb-16 md:pt-16 md:pb-24 overflow-hidden"
        style={{
          background:
            "radial-gradient(1200px 600px at 50% -10%, rgba(212,175,55,0.10), transparent 60%), #0A0E1A",
        }}
      >
        <div className="max-w-5xl mx-auto text-center space-y-8 md:space-y-10">
          <img
            src={LOGO_URL}
            alt="Iuri Rodrigues Imóveis"
            className="w-full max-w-[140px] md:max-w-[180px] mx-auto object-contain"
            style={{ mixBlendMode: "screen" }}
          />

          <div className="space-y-5">
            <div
              className="text-[10px] md:text-xs uppercase tracking-[0.45em]"
              style={{ color: GOLD }}
            >
              Ecossistema Nexus
            </div>
            <h1
              className="text-5xl md:text-7xl lg:text-[5.5rem] leading-[1.05] tracking-tight"
              style={{ fontFamily: SERIF, fontWeight: 500, letterSpacing: "-0.01em" }}
            >
              Os melhores corretores do{" "}
              <em style={{ color: GOLD, fontStyle: "italic", fontWeight: 500 }}>Rio</em>
              <br className="hidden md:block" /> estão aqui
            </h1>
          </div>

          {/* VÍDEO no hero */}
          {vslId ? (
            <div className="relative mx-auto w-full max-w-3xl pt-2">
              {/* moldura dourada sutil */}
              <div
                aria-hidden
                className="absolute -inset-[1px] rounded-2xl pointer-events-none"
                style={{
                  background: `linear-gradient(135deg, ${GOLD}88, transparent 35%, transparent 65%, ${GOLD}55)`,
                  filter: "blur(0.5px)",
                }}
              />
              <div
                className="relative aspect-video w-full rounded-2xl overflow-hidden"
                style={{
                  border: `1px solid ${GOLD}44`,
                  boxShadow:
                    "0 30px 80px -30px rgba(0,0,0,0.8), 0 0 50px -20px rgba(212,175,55,0.25)",
                  background: "#000",
                }}
              >
                <iframe
                  className="w-full h-full"
                  src={`https://www.youtube.com/embed/${vslId}?rel=0&modestbranding=1&playsinline=1`}
                  title="Uma palavra do Iuri"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                />
              </div>
            </div>
          ) : (
            <div className="mx-auto w-full max-w-3xl aspect-video rounded-2xl bg-white/[0.02] border border-white/5" />
          )}

          <p className="text-white/70 max-w-2xl mx-auto text-base md:text-lg leading-relaxed">
            Não somos apenas uma imobiliária. Somos o time, a tecnologia e a liderança que faltavam
            para você vender mais. Com método, respaldo e presença real em cada negociação.
          </p>

        </div>
      </section>

      {/* CTA + FOTO DO TIME (grupo) */}
      <section className="px-6 py-16 md:py-20" style={{ background: "#0A0E1A" }}>
        <div className="max-w-5xl mx-auto space-y-10 text-center">
          <div className="flex flex-col items-center gap-5">
            <div className="text-[10px] md:text-xs uppercase tracking-[0.45em]" style={{ color: GOLD }}>
              Próximo passo
            </div>
            <h2
              className="text-3xl md:text-5xl leading-[1.1] max-w-2xl"
              style={{ fontFamily: SERIF, fontWeight: 500, letterSpacing: "-0.01em" }}
            >
              Faça parte do <em style={{ color: GOLD, fontStyle: "italic", fontWeight: 500 }}>nosso time</em>
            </h2>
            <a
              href="#candidatura"
              className="inline-flex items-center justify-center gap-2 px-8 py-4 rounded-md font-semibold text-sm md:text-base uppercase tracking-[0.2em] transition-transform hover:scale-[1.03]"
              style={{ background: GOLD, color: "#0A0E1A", boxShadow: `0 18px 50px -18px ${GOLD}99` }}
            >
              Quero fazer parte →
            </a>

          </div>

          <figure
            className="relative overflow-hidden rounded-2xl mx-auto"
            style={{ border: `1px solid ${GOLD}33`, boxShadow: "0 30px 80px -40px rgba(0,0,0,0.9)" }}
          >
            <div className="aspect-[16/9] w-full bg-black/40 flex items-center justify-center">
              {groupUrl ? (
                <img
                  src={groupUrl}
                  alt="Equipe Iuri Rodrigues Imóveis"
                  loading="lazy"
                  className="w-full h-full object-cover"
                  style={{ filter: "saturate(0.9) contrast(1.05)" }}
                />
              ) : (
                <div className="text-center text-white/40 text-xs uppercase tracking-[0.4em] px-6">
                  Foto da equipe em breve
                </div>
              )}
            </div>
            {groupUrl && (
              <div
                className="pointer-events-none absolute inset-0"
                style={{
                  background:
                    "linear-gradient(180deg, rgba(10,14,26,0) 55%, rgba(10,14,26,0.75) 100%)",
                }}
              />
            )}
          </figure>
        </div>
      </section>




      {/* MARQUEE de regiões */}
      <section
        className="overflow-hidden py-5 border-y"
        style={{ background: "#0F1626", borderColor: `${GOLD}22` }}
      >
        <div className="flex animate-[marquee_30s_linear_infinite] gap-12 whitespace-nowrap text-[10px] md:text-xs uppercase tracking-[0.45em] text-white/55">
          {[...CAPTACAO_REGIOES_MARQUEE, ...CAPTACAO_REGIOES_MARQUEE].map((r, i) => (
            <span key={i} className="flex items-center gap-3">
              <span style={{ color: GOLD }}>◆</span> {r}
            </span>
          ))}
        </div>
        <style>{`@keyframes marquee { from { transform: translateX(0); } to { transform: translateX(-50%); } }`}</style>
      </section>


      {/* MANIFESTO */}
      <section className="px-6 py-20" style={{ background: "#0F1626" }}>

        <div className="max-w-3xl mx-auto text-center space-y-6">
          <div className="text-[10px] md:text-xs uppercase tracking-[0.45em]" style={{ color: GOLD }}>
            Manifesto
          </div>
          <h2
            className="text-3xl md:text-5xl leading-[1.1]"
            style={{ fontFamily: SERIF, fontWeight: 500, letterSpacing: "-0.01em" }}
          >
            Não buscamos quantidade. <span style={{ color: GOLD }}>Selecionamos talentos.</span>
          </h2>
          <p className="text-white/70 text-base md:text-lg leading-relaxed">
            Na Iuri Rodrigues Imóveis, cada novo corretor passa a integrar um ecossistema construído sobre
            método, tecnologia, processos e desenvolvimento contínuo. Aqui, performance não depende apenas
            de esforço individual. Ela é potencializada por uma estrutura que reúne inteligência comercial,
            geração de oportunidades, treinamento permanente e suporte estratégico.
          </p>
          <p className="text-white/70 text-base md:text-lg leading-relaxed">
            Não procuramos profissionais em busca de uma oportunidade qualquer. Procuramos pessoas
            comprometidas com evolução, disciplina e excelência. Se o seu objetivo é apenas utilizar uma
            marca ou cumprir plantões ocasionais, provavelmente este não é o ambiente ideal.
          </p>
          <p className="text-white/70 text-base md:text-lg leading-relaxed">
            Se você deseja construir uma carreira consistente ao lado de uma equipe que compartilha
            conhecimento, investe em tecnologia e trabalha de forma integrada, será um prazer conhecer
            o seu perfil.
          </p>
          <p className="text-white/80 text-base md:text-lg leading-relaxed" style={{ fontFamily: SERIF, fontStyle: "italic" }}>
            Porque grandes resultados são consequência de grandes padrões.
          </p>
        </div>
      </section>

      {/* 3 PILARES */}
      <section className="px-6 py-20 md:py-24" style={{ background: "#0A0E1A" }}>
        <div className="max-w-6xl mx-auto space-y-14">
          <div className="text-center space-y-3">
            <div className="text-[10px] md:text-xs uppercase tracking-[0.45em]" style={{ color: GOLD }}>
              Quatro Pilares
            </div>
            <h2
              className="text-3xl md:text-5xl leading-[1.1] max-w-3xl mx-auto"
              style={{ fontFamily: SERIF, fontWeight: 500, letterSpacing: "-0.01em" }}
            >
              O que sustenta <em style={{ color: GOLD, fontStyle: "italic", fontWeight: 500 }}>cada corretor</em> do nosso time
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6 md:gap-8">
            {PILARES.map(({ icon: Icon, titulo, texto }, i) => (
              <article
                key={i}
                className="relative flex flex-col p-8 md:p-10 rounded-2xl h-full"
                style={{
                  background: "linear-gradient(180deg, #111A2E 0%, #0C1322 100%)",
                  border: `1px solid ${GOLD}33`,
                  boxShadow: "0 30px 80px -40px rgba(0,0,0,0.9)",
                }}
              >
                <div
                  className="flex items-center justify-center mb-7 rounded-xl"
                  style={{
                    width: 64,
                    height: 64,
                    background: `${GOLD}14`,
                    border: `1px solid ${GOLD}55`,
                  }}
                >
                  <Icon size={30} strokeWidth={1.5} style={{ color: GOLD }} />
                </div>
                <h3
                  className="text-base md:text-lg uppercase mb-5 leading-snug"
                  style={{
                    color: GOLD,
                    fontFamily: SERIF,
                    fontWeight: 500,
                    letterSpacing: "0.12em",
                  }}
                >
                  {titulo}
                </h3>
                <div
                  className="h-px w-12 mb-5"
                  style={{ background: `${GOLD}66` }}
                />
                <p className="text-white/75 text-[15px] md:text-base leading-relaxed">
                  {texto}
                </p>
              </article>
            ))}
          </div>
        </div>
      </section>








      {/* STATS */}
      <section className="px-6 py-14" style={{ background: "#0A0E1A" }}>
        <div className="max-w-5xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-8 text-center">
          {CAPTACAO_STATS.map((s) => (
            <div key={s.l} className="space-y-2">
              <div
                className="text-5xl md:text-6xl"
                style={{ fontFamily: SERIF, color: GOLD, fontWeight: 500, letterSpacing: "-0.02em" }}
              >
                {s.n}
              </div>
              <div className="text-[10px] md:text-xs uppercase tracking-[0.45em] text-white/55">{s.l}</div>
            </div>
          ))}
        </div>
      </section>




      {/* FORMULÁRIO DE CANDIDATURA */}
      <section id="candidatura" className="px-6 py-20 md:py-24" style={{ background: "#0A0E1A" }}>
        <div className="max-w-2xl mx-auto">
          <div className="text-center mb-10">
            <div className="text-[10px] md:text-xs uppercase tracking-[0.45em] mb-3" style={{ color: GOLD }}>
              Candidatura
            </div>
            <h2 className="text-3xl md:text-5xl leading-[1.1]" style={{ fontFamily: SERIF, fontWeight: 500, letterSpacing: "-0.01em" }}>
              Preencha e <em style={{ color: GOLD, fontStyle: "italic", fontWeight: 500 }}>fale com a liderança</em>
            </h2>
            <p className="text-white/60 text-sm md:text-base mt-4">
              Leva menos de 1 minuto. Após enviar, o executivo da sua região entra em contato.
            </p>
          </div>
          <CandidaturaForm refRegion={(ref as RegiaoOpt | undefined) ?? null} />
        </div>
      </section>

      {/* CTA FINAL */}
      <section className="px-6 py-24" style={{ background: "#0F1626" }}>
        <div className="max-w-3xl mx-auto text-center space-y-6">
          <h2 className="text-3xl md:text-5xl leading-[1.1]" style={{ fontFamily: SERIF, fontWeight: 500, letterSpacing: "-0.01em" }}>
            Pronto para fazer parte do <em style={{ color: GOLD, fontStyle: "italic", fontWeight: 500 }}>maior ecossistema</em> do Rio?
          </h2>
          <p className="text-white/70 text-base md:text-lg">
            Preencha o formulário acima e a liderança entra em contato.
          </p>
          <a
            href="#candidatura"
            className="inline-flex items-center justify-center gap-2 px-8 py-4 rounded-md font-semibold text-sm md:text-base uppercase tracking-[0.2em] transition-transform hover:scale-[1.03]"
            style={{ background: GOLD, color: "#0A0E1A", boxShadow: `0 18px 50px -18px ${GOLD}99` }}
          >
            Quero fazer parte →
          </a>
        </div>
      </section>


      <footer className="px-6 py-8 text-center text-xs text-white/50 space-y-1" style={{ background: "#0A0E1A", borderTop: `1px solid ${GOLD}33` }}>
        <div>© Iuri Rodrigues Imóveis · Ecossistema Nexus</div>
        <div className="text-[11px] text-white/40">
          Iuri Rodrigues Imóveis — <span style={{ color: GOLD }}>CRECI 11379J</span> — CNPJ 33.587.804/0001-98
        </div>
      </footer>
    </div>
  );
}

type RegiaoOpt = "barra" | "recreio" | "belford" | "mesquita";
const REGIAO_LABEL: Record<RegiaoOpt, string> = {
  barra: "Barra da Tijuca / Jacarepaguá / Zona Sul",
  recreio: "Recreio / Zona Oeste",
  belford: "Belford Roxo / Zona Norte",
  mesquita: "Mesquita / Nilópolis",
};

function CandidaturaForm({ refRegion }: { refRegion: RegiaoOpt | null }) {
  const navigate = useNavigate();
  const [form, setForm] = useState({
    nome: "",
    telefone: "",
    email: "",
    regiao: (refRegion ?? "") as RegiaoOpt | "",
    ja_corretor: "",
    creci_ativo: "",
    numero_creci: "",
    disponibilidade_video: "",
    possui_veiculo: "",
  });
  const [status, setStatus] = useState<"idle" | "saving" | "ok" | "err">("idle");
  const [errMsg, setErrMsg] = useState<string>("");

  function upd<K extends keyof typeof form>(k: K, v: (typeof form)[K]) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.nome.trim() || !form.telefone.trim() || !form.regiao) {
      setErrMsg("Preencha nome, telefone e região.");
      setStatus("err");
      return;
    }
    setStatus("saving");
    setErrMsg("");
    try {
      const payload: Record<string, string> = {
        nome: form.nome.trim(),
        telefone: form.telefone.trim(),
        email: form.email.trim(),
        ja_corretor: form.ja_corretor,
        creci_ativo: form.creci_ativo,
        numero_creci: form.numero_creci.trim(),
        disponibilidade_video: form.disponibilidade_video,
        possui_veiculo: form.possui_veiculo,
        origem: "seja_corretor_landing",
      };
      // Mapeia região escolhida para o campo de disponibilidade que o webhook entende
      if (form.regiao === "barra") payload.disponibilidade_barra = "Sim";
      if (form.regiao === "recreio") payload.disponibilidade_recreio = "Sim";
      if (form.regiao === "belford") payload.disponibilidade_belford = "Sim";
      if (form.regiao === "mesquita") payload.disponibilidade_mesquita = "Sim";

      const r = await fetch("/api/public/webhook", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!r.ok) {
        const t = await r.text().catch(() => "");
        throw new Error(t || `Erro ${r.status}`);
      }
      setStatus("ok");
      navigate({ to: "/obrigado", search: { ref: form.regiao as RegiaoOpt } });
    } catch (e) {
      setErrMsg(e instanceof Error ? e.message : "Falha ao enviar");
      setStatus("err");
    }
  }



  const inputCls =
    "w-full h-11 px-3 rounded-md bg-white/[0.04] border border-white/15 text-white placeholder:text-white/30 focus:outline-none focus:border-white/40 transition";
  const labelCls = "block text-[11px] uppercase tracking-[0.18em] text-white/60 mb-1.5";

  return (
    <form
      onSubmit={submit}
      className="rounded-2xl p-6 md:p-8 space-y-4"
      style={{ background: "#0F1626", border: `1px solid ${GOLD}33` }}
    >
      <div>
        <label className={labelCls}>Nome completo *</label>
        <input className={inputCls} value={form.nome} onChange={(e) => upd("nome", e.target.value)} required />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className={labelCls}>WhatsApp *</label>
          <input
            className={inputCls}
            inputMode="tel"
            placeholder="(21) 9 9999-9999"
            value={form.telefone}
            onChange={(e) => upd("telefone", e.target.value)}
            required
          />
        </div>
        <div>
          <label className={labelCls}>Email</label>
          <input
            className={inputCls}
            type="email"
            value={form.email}
            onChange={(e) => upd("email", e.target.value)}
          />
        </div>
      </div>

      {refRegion ? (
        <div>
          <label className={labelCls}>Região de atuação</label>
          <div
            className="w-full h-11 px-3 rounded-md bg-white/[0.04] border border-white/15 text-white flex items-center"
            style={{ color: GOLD }}
          >
            {REGIAO_LABEL[refRegion]}
          </div>
        </div>
      ) : (
        <div>
          <label className={labelCls}>Em qual região quer atuar? *</label>
          <select
            className={inputCls}
            value={form.regiao}
            onChange={(e) => upd("regiao", e.target.value as RegiaoOpt)}
            required
          >
            <option value="" style={{ color: "#000" }}>Selecione…</option>
            {(Object.keys(REGIAO_LABEL) as RegiaoOpt[]).map((r) => (
              <option key={r} value={r} style={{ color: "#000" }}>
                {REGIAO_LABEL[r]}
              </option>
            ))}
          </select>
        </div>
      )}


      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className={labelCls}>Já atua como corretor?</label>
          <select className={inputCls} value={form.ja_corretor} onChange={(e) => upd("ja_corretor", e.target.value)}>
            <option value="" style={{ color: "#000" }}>Selecione…</option>
            <option style={{ color: "#000" }}>Sim, credenciado</option>
            <option style={{ color: "#000" }}>Ainda não</option>
            <option style={{ color: "#000" }}>Em processo</option>
          </select>
        </div>
        <div>
          <label className={labelCls}>CRECI ativo?</label>
          <select className={inputCls} value={form.creci_ativo} onChange={(e) => upd("creci_ativo", e.target.value)}>
            <option value="" style={{ color: "#000" }}>Selecione…</option>
            <option style={{ color: "#000" }}>Sim</option>
            <option style={{ color: "#000" }}>Não</option>
            <option style={{ color: "#000" }}>Em andamento</option>
          </select>
        </div>
      </div>

      <div>
        <label className={labelCls}>Número do CRECI (se tiver)</label>
        <input className={inputCls} value={form.numero_creci} onChange={(e) => upd("numero_creci", e.target.value)} />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className={labelCls}>Disponibilidade para videochamada diária?</label>
          <select className={inputCls} value={form.disponibilidade_video} onChange={(e) => upd("disponibilidade_video", e.target.value)}>
            <option value="" style={{ color: "#000" }}>Selecione…</option>
            <option style={{ color: "#000" }}>Sim</option>
            <option style={{ color: "#000" }}>Não</option>
          </select>
        </div>
        <div>
          <label className={labelCls}>Possui veículo para locomoção?</label>
          <select className={inputCls} value={form.possui_veiculo} onChange={(e) => upd("possui_veiculo", e.target.value)}>
            <option value="" style={{ color: "#000" }}>Selecione…</option>
            <option style={{ color: "#000" }}>Sim</option>
            <option style={{ color: "#000" }}>Não</option>
          </select>
        </div>
      </div>

      {status === "err" && errMsg && (
        <div className="text-sm text-red-300 bg-red-500/10 border border-red-400/30 rounded-md px-3 py-2">
          {errMsg}
        </div>
      )}

      <button
        type="submit"
        disabled={status === "saving"}
        className="w-full inline-flex items-center justify-center gap-2 px-8 py-4 rounded-md font-semibold text-sm md:text-base uppercase tracking-[0.2em] transition-transform hover:scale-[1.02] disabled:opacity-60 disabled:cursor-not-allowed"
        style={{ background: GOLD, color: "#0A0E1A", boxShadow: `0 18px 50px -18px ${GOLD}99` }}
      >
        {status === "saving" ? "Enviando…" : "Enviar candidatura →"}
      </button>
      <p className="text-[11px] text-white/40 text-center">
        Ao enviar você concorda em receber contato da liderança via WhatsApp ou telefone.
      </p>
    </form>
  );
}

