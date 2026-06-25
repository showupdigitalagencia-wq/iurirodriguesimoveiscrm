import { createFileRoute, useSearch } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { getCaptacaoConfig } from "@/lib/captacao.functions";
import {
  CAPTACAO_EXECUTIVOS,
  CAPTACAO_REGIOES_MARQUEE,
  CAPTACAO_STATS,
  findExecutivoByRef,
  type CaptacaoExecutivo,
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

function whatsappLink(exec: CaptacaoExecutivo) {
  const msg = `Olá ${exec.nome}! Vim pela página do Ecossistema Nexus e quero saber mais sobre fazer parte do time em ${exec.regiao}.`;
  return `https://wa.me/${exec.whatsapp}?text=${encodeURIComponent(msg)}`;
}

function SejaCorretorPage() {
  const { ref } = useSearch({ from: "/seja-corretor" });
  const getConfig = useServerFn(getCaptacaoConfig);
  const [vslId, setVslId] = useState<string | null>(null);
  const [, setPhotos] = useState<
    Array<{ url: string | null; nome: string; cargo: string }>
  >([]);
  const [groupUrl, setGroupUrl] = useState<string | null>(null);
  const [execPhotos, setExecPhotos] = useState<Record<string, string | null>>({});

  useEffect(() => {
    getConfig({})
      .then((r) => {
        setVslId(youtubeId(r.vslUrl));
        setPhotos(r.photos);
        setGroupUrl(r.groupUrl);
        setExecPhotos(r.execPhotos);
      })
      .catch(() => null);
  }, [getConfig]);

  const filteredExec = findExecutivoByRef(ref ?? null);
  const execsToShow = filteredExec ? [filteredExec] : CAPTACAO_EXECUTIVOS;

  function initials(nome: string): string {
    return nome.split(/\s+/).filter(Boolean).slice(0, 2).map((s) => s[0]?.toUpperCase() ?? "").join("");
  }

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
              href="#executivos"
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
              Três Pilares
            </div>
            <h2
              className="text-3xl md:text-5xl leading-[1.1] max-w-3xl mx-auto"
              style={{ fontFamily: SERIF, fontWeight: 500, letterSpacing: "-0.01em" }}
            >
              O que sustenta <em style={{ color: GOLD, fontStyle: "italic", fontWeight: 500 }}>cada corretor</em> do nosso time
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 md:gap-8">
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

      {/* MENTORIA E TREINAMENTO */}
      <section className="px-6 py-20 md:py-28" style={{ background: "#070B14" }}>
        <div className="max-w-4xl mx-auto">
          <article
            className="relative flex flex-col items-center text-center p-10 md:p-16 rounded-2xl"
            style={{
              background: "linear-gradient(180deg, #111A2E 0%, #0C1322 100%)",
              border: `1px solid ${GOLD}33`,
              boxShadow: "0 30px 80px -40px rgba(0,0,0,0.9)",
            }}
          >
            <div
              className="flex items-center justify-center mb-8 rounded-xl"
              style={{
                width: 72,
                height: 72,
                background: `${GOLD}14`,
                border: `1px solid ${GOLD}55`,
              }}
            >
              <GraduationCap size={36} strokeWidth={1.5} style={{ color: GOLD }} />
            </div>
            <div
              className="text-[10px] md:text-xs uppercase tracking-[0.45em] mb-4"
              style={{ color: GOLD }}
            >
              Mentoria & Treinamento
            </div>
            <h2
              className="text-3xl md:text-5xl leading-[1.1] mb-8"
              style={{ fontFamily: SERIF, fontWeight: 500, letterSpacing: "-0.01em" }}
            >
              Mentoria e treinamento que <em style={{ color: GOLD, fontStyle: "italic", fontWeight: 500 }}>formam referências</em>
            </h2>
            <div className="h-px w-16 mb-8" style={{ background: `${GOLD}66` }} />
            <p className="text-white/80 text-base md:text-lg leading-relaxed max-w-2xl">
              Investimos continuamente na formação de cada corretor através de mentorias presenciais, treinamentos práticos e acompanhamento próximo da liderança executiva. Não entregamos apenas ferramentas. Entregamos conhecimento, técnica e direcionamento estratégico construídos a partir de anos de experiência real no mercado imobiliário.
            </p>
            <p className="text-white/75 text-base md:text-lg leading-relaxed max-w-2xl mt-5">
              É esse compromisso com o desenvolvimento contínuo que faz da Iuri Rodrigues Imóveis uma referência reconhecida, formando profissionais preparados para os desafios reais do mercado, não apenas para cumprir tarefas.
            </p>
          </article>
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



      {/* EXECUTIVO(S) */}
      <section id="executivos" className="px-6 py-20 scroll-mt-20" style={{ background: "#0A0E1A" }}>

        <div className="max-w-5xl mx-auto space-y-12">
          <div className="text-center space-y-3">
            <div className="text-[10px] md:text-xs uppercase tracking-[0.45em]" style={{ color: GOLD }}>
              {filteredExec ? "Fale agora com" : "Liderança"}
            </div>
            <h2 className="text-3xl md:text-5xl leading-[1.1]" style={{ fontFamily: SERIF, fontWeight: 500, letterSpacing: "-0.01em" }}>
              {filteredExec ? (
                <>
                  Seu próximo passo é com o <em style={{ color: GOLD, fontStyle: "italic", fontWeight: 500 }}>{filteredExec.nome}</em>
                </>
              ) : (
                <>
                  Escolha por <em style={{ color: GOLD, fontStyle: "italic", fontWeight: 500 }}>região</em>
                </>
              )}
            </h2>
          </div>

          <div
            className={
              execsToShow.length === 1
                ? "max-w-4xl mx-auto"
                : "grid grid-cols-1 sm:grid-cols-2 gap-5"
            }
          >
            {execsToShow.map((exec) => {
              const photoUrl = execPhotos[exec.ref] ?? null;
              const isSolo = execsToShow.length === 1;

              if (isSolo) {
                return (
                  <div
                    key={exec.ref}
                    className="rounded-3xl overflow-hidden grid grid-cols-1 md:grid-cols-[minmax(0,42%)_1fr]"
                    style={{
                      background: "#0F1626",
                      border: `1px solid ${GOLD}44`,
                      boxShadow: `0 40px 100px -40px ${GOLD}33, 0 20px 60px -30px rgba(0,0,0,0.9)`,
                    }}
                  >
                    {/* FOTO — coluna esquerda */}
                    <div className="relative p-6 md:p-8 flex items-center justify-center" style={{ background: "#0A0E1A" }}>
                      <div
                        className="pointer-events-none absolute inset-0"
                        style={{
                          background: `radial-gradient(60% 50% at 50% 50%, ${GOLD}22, transparent 70%)`,
                        }}
                      />
                      <div
                        className="relative w-full max-w-[360px] aspect-[3/4] rounded-2xl overflow-hidden flex items-center justify-center"
                        style={{
                          background: "#141B2E",
                          border: `2px solid ${GOLD}`,
                          boxShadow: `0 0 0 1px ${GOLD}33, 0 30px 70px -20px ${GOLD}55, 0 20px 60px -20px rgba(0,0,0,0.8)`,
                        }}
                      >
                        {photoUrl ? (
                          <img src={photoUrl} alt={exec.nome} className="w-full h-full object-cover" />
                        ) : (
                          <span
                            style={{
                              color: GOLD,
                              fontFamily: SERIF,
                              fontSize: 96,
                              fontWeight: 500,
                              letterSpacing: "-0.02em",
                            }}
                          >
                            {initials(exec.nome)}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* TEXTO — coluna direita */}
                    <div className="p-7 md:p-10 flex flex-col justify-center space-y-5">
                      <div>
                        <div className="text-[10px] md:text-xs uppercase tracking-[0.45em] text-white/50 mb-2">
                          {exec.regiao}
                        </div>
                        <h3
                          className="text-3xl md:text-5xl leading-[1.05]"
                          style={{ fontFamily: SERIF, color: GOLD, fontWeight: 500, letterSpacing: "-0.01em" }}
                        >
                          {exec.nome}
                        </h3>
                      </div>
                      <div className="h-px w-16" style={{ background: `${GOLD}66` }} />
                      <p className="text-white/75 text-base md:text-lg leading-relaxed">
                        {exec.descricao}
                      </p>
                      <a
                        href={whatsappLink(exec)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center justify-center gap-2 px-7 py-4 rounded-md font-semibold text-sm uppercase tracking-[0.2em] transition-transform hover:scale-[1.02] self-start"
                        style={{ background: GOLD, color: "#0A0E1A", boxShadow: `0 18px 50px -18px ${GOLD}99` }}
                      >
                        Falar no WhatsApp →
                      </a>
                    </div>
                  </div>
                );
              }

              return (
              <div
                key={exec.ref}
                className="rounded-2xl p-7 space-y-5 flex flex-col"
                style={{ background: "#0F1626", border: `1px solid ${GOLD}33` }}
              >
                <div className="flex items-center gap-4">
                  <div
                    className="shrink-0 rounded-full overflow-hidden flex items-center justify-center"
                    style={{
                      width: 96,
                      height: 96,
                      background: "#141B2E",
                      border: `2px solid ${GOLD}`,
                      color: GOLD,
                      fontFamily: SERIF,
                      fontSize: 30,
                      fontWeight: 500,
                      boxShadow: `0 0 0 1px ${GOLD}33, 0 18px 40px -15px ${GOLD}66`,
                    }}
                  >
                    {photoUrl ? (
                      <img src={photoUrl} alt={exec.nome} className="w-full h-full object-cover" />
                    ) : (
                      <span>{initials(exec.nome)}</span>
                    )}
                  </div>
                  <div className="min-w-0">
                    <div className="text-[10px] md:text-xs uppercase tracking-[0.45em] text-white/50 mb-1">
                      {exec.regiao}
                    </div>
                    <h3
                      className="text-2xl md:text-3xl leading-[1.1] truncate"
                      style={{ fontFamily: SERIF, color: GOLD, fontWeight: 500, letterSpacing: "-0.01em" }}
                    >
                      {exec.nome}
                    </h3>
                  </div>
                </div>
                <p className="text-white/70 text-sm md:text-base leading-relaxed flex-1">
                  {exec.descricao}
                </p>
                <a
                  href={whatsappLink(exec)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-md font-semibold text-sm uppercase tracking-[0.2em] transition-transform hover:scale-[1.02]"
                  style={{ background: GOLD, color: "#0A0E1A" }}
                >
                  Falar no WhatsApp →
                </a>
              </div>
              );
            })}
          </div>

        </div>
      </section>

      {/* CTA FINAL */}
      <section className="px-6 py-24" style={{ background: "#0F1626" }}>
        <div className="max-w-3xl mx-auto text-center space-y-6">
          <h2 className="text-3xl md:text-5xl leading-[1.1]" style={{ fontFamily: SERIF, fontWeight: 500, letterSpacing: "-0.01em" }}>
            Pronto para fazer parte do <em style={{ color: GOLD, fontStyle: "italic", fontWeight: 500 }}>maior ecossistema</em> do Rio?
          </h2>
          <p className="text-white/70 text-base md:text-lg">
            {filteredExec
              ? `Chame ${filteredExec.nome} agora e descubra como começar.`
              : "Escolha o executivo da sua região acima e dê o primeiro passo."}
          </p>
          {filteredExec && (
            <a
              href={whatsappLink(filteredExec)}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center gap-2 px-8 py-4 rounded-md font-semibold text-sm md:text-base uppercase tracking-[0.2em] transition-transform hover:scale-[1.03]"
              style={{ background: GOLD, color: "#0A0E1A", boxShadow: `0 18px 50px -18px ${GOLD}99` }}
            >
              Quero fazer parte →
            </a>
          )}
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
