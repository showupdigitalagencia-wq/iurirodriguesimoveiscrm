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
  const [photos, setPhotos] = useState<
    Array<{ url: string | null; nome: string; cargo: string }>
  >([]);

  useEffect(() => {
    getConfig({})
      .then((r) => {
        setVslId(youtubeId(r.vslUrl));
        setPhotos(r.photos);
      })
      .catch(() => null);
  }, [getConfig]);

  const filteredExec = findExecutivoByRef(ref ?? null);
  const execsToShow = filteredExec ? [filteredExec] : CAPTACAO_EXECUTIVOS;

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
            Não somos uma imobiliária. Somos o time, a tecnologia e a liderança que faltava
            para você vender mais — com método, respaldo e presença real em cada negociação.
          </p>

          <div className="pt-2">
            <a
              href="#executivos"
              className="inline-flex items-center justify-center gap-2 px-8 py-4 rounded-md font-semibold text-sm md:text-base uppercase tracking-[0.2em] transition-transform hover:scale-[1.03]"
              style={{
                background: GOLD,
                color: "#0A0E1A",
                boxShadow: `0 18px 50px -18px ${GOLD}99`,
              }}
            >
              Quero fazer parte →
            </a>
          </div>
        </div>
      </section>


      {/* MARQUEE de regiões */}
      <section
        className="overflow-hidden py-5 border-y"
        style={{ background: "#0F1626", borderColor: `${GOLD}22` }}
      >
        <div className="flex animate-[marquee_30s_linear_infinite] gap-12 whitespace-nowrap text-sm uppercase tracking-[0.3em] text-white/60">
          {[...CAPTACAO_REGIOES_MARQUEE, ...CAPTACAO_REGIOES_MARQUEE].map((r, i) => (
            <span key={i} className="flex items-center gap-3">
              <span style={{ color: GOLD }}>◆</span> {r}
            </span>
          ))}
        </div>
        <style>{`@keyframes marquee { from { transform: translateX(0); } to { transform: translateX(-50%); } }`}</style>
      </section>

      {/* MANIFESTO */}
      <section className="px-6 py-20" style={{ background: "#0A0E1A" }}>
        <div className="max-w-3xl mx-auto text-center space-y-6">
          <div className="text-xs uppercase tracking-[0.35em]" style={{ color: GOLD }}>
            Manifesto
          </div>
          <h2
            className="text-3xl md:text-5xl leading-tight"
            style={{ fontFamily: "var(--font-display)", fontWeight: 600 }}
          >
            Não recrutamos <span style={{ color: GOLD }}>qualquer um</span>
          </h2>
          <p className="text-white/70 text-base md:text-lg leading-relaxed">
            Aqui dentro tem método, leads, mentoria e tecnologia. Por isso seguimos um padrão.
            Quem entra, entra para crescer — não para tentar. Se você quer apenas plantão e
            placa em poste, este lugar não é para você.
          </p>
          <p className="text-white/70 text-base md:text-lg leading-relaxed">
            Se quer um time que joga junto, um sistema que trabalha com você 24h por dia e um
            executivo presente em cada negociação importante, então sim, podemos conversar.
          </p>
        </div>
      </section>

      {/* STATS */}
      <section className="px-6 py-14" style={{ background: "#0F1626" }}>
        <div className="max-w-5xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-8 text-center">
          {CAPTACAO_STATS.map((s) => (
            <div key={s.l} className="space-y-2">
              <div
                className="text-5xl md:text-6xl"
                style={{ fontFamily: "var(--font-display)", color: GOLD, fontWeight: 700 }}
              >
                {s.n}
              </div>
              <div className="text-sm uppercase tracking-[0.2em] text-white/60">{s.l}</div>
            </div>
          ))}
        </div>
      </section>


      {/* GALERIA DO TIME */}
      <section className="px-6 py-20" style={{ background: "#0F1626" }}>
        <div className="max-w-6xl mx-auto space-y-12">
          <div className="text-center space-y-3">
            <div className="text-xs uppercase tracking-[0.35em]" style={{ color: GOLD }}>
              O time
            </div>
            <h2 className="text-3xl md:text-5xl" style={{ fontFamily: "var(--font-display)", fontWeight: 600 }}>
              Pessoas que <span style={{ color: GOLD }}>fazem acontecer</span>
            </h2>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-5">
            {[0, 1, 2, 3].map((i) => {
              const p = photos[i];
              return (
                <div
                  key={i}
                  className="rounded-xl overflow-hidden flex flex-col"
                  style={{ background: "#0A0E1A", border: `1px solid ${GOLD}26` }}
                >
                  <div
                    className="aspect-[3/4] w-full flex items-center justify-center text-white/30 text-xs uppercase tracking-widest"
                    style={{ background: "#141B2E" }}
                  >
                    {p?.url ? (
                      <img src={p.url} alt={p.nome || "Time"} className="w-full h-full object-cover" />
                    ) : (
                      "Foto em breve"
                    )}
                  </div>
                  <div className="p-3 text-center">
                    <div className="text-sm font-semibold" style={{ color: GOLD }}>
                      {p?.nome || "—"}
                    </div>
                    <div className="text-xs text-white/60">{p?.cargo || ""}</div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* EXECUTIVO(S) */}
      <section id="executivos" className="px-6 py-20 scroll-mt-20" style={{ background: "#0A0E1A" }}>

        <div className="max-w-5xl mx-auto space-y-12">
          <div className="text-center space-y-3">
            <div className="text-xs uppercase tracking-[0.35em]" style={{ color: GOLD }}>
              {filteredExec ? "Fale agora com" : "Liderança"}
            </div>
            <h2 className="text-3xl md:text-5xl" style={{ fontFamily: "var(--font-display)", fontWeight: 600 }}>
              {filteredExec ? (
                <>
                  Seu próximo passo é com <span style={{ color: GOLD }}>{filteredExec.nome}</span>
                </>
              ) : (
                <>
                  Escolha por <span style={{ color: GOLD }}>região</span>
                </>
              )}
            </h2>
          </div>

          <div
            className={
              execsToShow.length === 1
                ? "max-w-xl mx-auto"
                : "grid grid-cols-1 sm:grid-cols-2 gap-5"
            }
          >
            {execsToShow.map((exec) => (
              <div
                key={exec.ref}
                className="rounded-2xl p-7 space-y-5 flex flex-col"
                style={{ background: "#0F1626", border: `1px solid ${GOLD}40` }}
              >
                <div>
                  <div className="text-xs uppercase tracking-[0.3em] text-white/50 mb-2">
                    {exec.regiao}
                  </div>
                  <h3
                    className="text-3xl md:text-4xl leading-tight"
                    style={{ fontFamily: "var(--font-display)", color: GOLD, fontWeight: 600 }}
                  >
                    {exec.nome}
                  </h3>
                </div>
                <p className="text-white/70 text-sm md:text-base leading-relaxed flex-1">
                  {exec.descricao}
                </p>
                <a
                  href={whatsappLink(exec)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-md font-semibold text-sm uppercase tracking-wider transition-transform hover:scale-[1.02]"
                  style={{ background: GOLD, color: "#0A0E1A" }}
                >
                  Falar no WhatsApp →
                </a>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA FINAL */}
      <section className="px-6 py-24" style={{ background: "#0F1626" }}>
        <div className="max-w-3xl mx-auto text-center space-y-6">
          <h2 className="text-3xl md:text-5xl leading-tight" style={{ fontFamily: "var(--font-display)", fontWeight: 600 }}>
            Pronto para fazer parte do <span style={{ color: GOLD }}>maior ecossistema</span> do Rio?
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
              className="inline-flex items-center justify-center gap-2 px-8 py-4 rounded-md font-semibold text-base uppercase tracking-wider transition-transform hover:scale-105"
              style={{ background: GOLD, color: "#0A0E1A", boxShadow: `0 10px 40px -10px ${GOLD}80` }}
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
