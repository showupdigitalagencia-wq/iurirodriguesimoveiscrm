import { createFileRoute, useSearch, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { getCaptacaoConfig } from "@/lib/captacao.functions";
import {
  findExecutivoByRef,
  type CaptacaoExecutivo,
} from "@/lib/captacao.constants";
import logoAsset from "@/assets/logo_iuri_rodrigues_v2.png.asset.json";

const GOLD = "#D4AF37";
const SERIF = "'Cormorant Garamond', 'Playfair Display', Georgia, serif";
const LOGO_URL = logoAsset.url;

const searchSchema = z.object({
  ref: z.enum(["barra", "recreio", "belford", "mesquita"]).optional(),
});

export const Route = createFileRoute("/obrigado")({
  ssr: false,
  validateSearch: searchSchema,
  head: () => ({
    meta: [
      { title: "Candidatura recebida — Iuri Rodrigues Imóveis" },
      {
        name: "description",
        content: "Recebemos sua candidatura. Veja com quem você vai falar agora.",
      },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: ObrigadoPage,
});

function whatsappLink(exec: CaptacaoExecutivo) {
  const msg = `Olá ${exec.nome}! Acabei de enviar minha candidatura pelo site e quero conversar sobre fazer parte do time em ${exec.regiao}.`;
  return `https://wa.me/${exec.whatsapp}?text=${encodeURIComponent(msg)}`;
}

function initials(nome: string): string {
  return nome
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((s) => s[0]?.toUpperCase() ?? "")
    .join("");
}

function ObrigadoPage() {
  const { ref } = useSearch({ from: "/obrigado" });
  const exec = findExecutivoByRef(ref ?? null);
  const getConfig = useServerFn(getCaptacaoConfig);
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!exec) return;
    getConfig({})
      .then((r) => setPhotoUrl(r.execPhotos[exec.ref] ?? null))
      .catch(() => null);
  }, [getConfig, exec]);

  return (
    <div
      className="min-h-screen px-6 py-12 md:py-20"
      style={{
        background:
          "radial-gradient(1200px 600px at 50% -10%, rgba(212,175,55,0.10), transparent 60%), #0A0E1A",
        color: "white",
        fontFamily: "var(--font-sans)",
      }}
    >
      <div className="max-w-4xl mx-auto space-y-10">
        <div className="text-center space-y-6">
          <img
            src={LOGO_URL}
            alt="Iuri Rodrigues Imóveis"
            className="w-full max-w-[120px] md:max-w-[150px] mx-auto object-contain"
            style={{ mixBlendMode: "screen" }}
          />
          <div
            className="text-[10px] md:text-xs uppercase tracking-[0.45em]"
            style={{ color: GOLD }}
          >
            Candidatura recebida
          </div>
          <h1
            className="text-4xl md:text-6xl leading-[1.05]"
            style={{ fontFamily: SERIF, fontWeight: 500, letterSpacing: "-0.01em" }}
          >
            Obrigado por se{" "}
            <em style={{ color: GOLD, fontStyle: "italic", fontWeight: 500 }}>
              candidatar
            </em>
          </h1>
          <p className="text-white/70 text-base md:text-lg max-w-xl mx-auto">
            Recebemos suas respostas. Em breve o executivo responsável pela sua região
            entra em contato pelo WhatsApp.
          </p>
        </div>

        {exec ? (
          <div
            className="rounded-3xl overflow-hidden grid grid-cols-1 md:grid-cols-[minmax(0,42%)_1fr]"
            style={{
              background: "#0F1626",
              border: `1px solid ${GOLD}44`,
              boxShadow: `0 40px 100px -40px ${GOLD}33, 0 20px 60px -30px rgba(0,0,0,0.9)`,
            }}
          >
            <div
              className="relative p-6 md:p-8 flex items-center justify-center"
              style={{ background: "#0A0E1A" }}
            >
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
                  <img
                    src={photoUrl}
                    alt={exec.nome}
                    className="w-full h-full object-cover"
                  />
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

            <div className="p-7 md:p-10 flex flex-col justify-center space-y-5">
              <div>
                <div className="text-[10px] md:text-xs uppercase tracking-[0.45em] text-white/50 mb-2">
                  Seu próximo passo é com
                </div>
                <h2
                  className="text-3xl md:text-5xl leading-[1.05]"
                  style={{
                    fontFamily: SERIF,
                    color: GOLD,
                    fontWeight: 500,
                    letterSpacing: "-0.01em",
                  }}
                >
                  {exec.nome}
                </h2>
                <div className="text-[11px] md:text-xs uppercase tracking-[0.35em] text-white/60 mt-2">
                  {exec.regiao}
                </div>
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
                style={{
                  background: GOLD,
                  color: "#0A0E1A",
                  boxShadow: `0 18px 50px -18px ${GOLD}99`,
                }}
              >
                Falar no WhatsApp →
              </a>
            </div>
          </div>
        ) : (
          <div
            className="rounded-2xl p-8 md:p-10 text-center"
            style={{ background: "#0F1626", border: `1px solid ${GOLD}33` }}
          >
            <p className="text-white/70">
              A liderança vai entrar em contato pelo WhatsApp em breve.
            </p>
          </div>
        )}

        <div className="text-center">
          <Link
            to="/seja-corretor"
            className="text-xs uppercase tracking-[0.35em] text-white/50 hover:text-white/80"
          >
            ← Voltar
          </Link>
        </div>
      </div>
    </div>
  );
}
