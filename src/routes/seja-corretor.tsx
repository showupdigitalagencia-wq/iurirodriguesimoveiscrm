import { createFileRoute, useSearch, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { z } from "zod";
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

function SejaCorretorPage() {
  const { ref } = useSearch({ from: "/seja-corretor" });

  return (
    <div
      className="min-h-screen px-6 py-10 md:py-16"
      style={{
        background:
          "radial-gradient(1200px 600px at 50% -10%, rgba(212,175,55,0.10), transparent 60%), #0A0E1A",
        color: "white",
        fontFamily: "var(--font-sans)",
      }}
    >
      <main className="max-w-2xl mx-auto space-y-8">
        <header className="text-center space-y-5">
          <img
            src={LOGO_URL}
            alt="Iuri Rodrigues Imóveis"
            className="w-full max-w-[120px] md:max-w-[150px] mx-auto object-contain"
            style={{ mixBlendMode: "screen" }}
          />
          <div className="text-[10px] md:text-xs uppercase tracking-[0.45em]" style={{ color: GOLD }}>
            Candidatura
          </div>
          <h1
            className="text-4xl md:text-6xl leading-[1.05]"
            style={{ fontFamily: SERIF, fontWeight: 500, letterSpacing: "-0.01em" }}
          >
            Seja corretor da <em style={{ color: GOLD, fontStyle: "italic", fontWeight: 500 }}>Iuri Rodrigues</em>
          </h1>
          <p className="text-white/65 text-sm md:text-base leading-relaxed max-w-xl mx-auto">
            Preencha o formulário. Após enviar, você será direcionado para a página de obrigado com o contato do executivo responsável.
          </p>
        </header>

        <CandidaturaForm key={ref ?? "sem-ref"} refRegion={(ref as RegiaoOpt | undefined) ?? null} />

        <footer className="text-center text-xs text-white/50 space-y-1 pt-2">
          <div>© Iuri Rodrigues Imóveis · Ecossistema Nexus</div>
          <div className="text-[11px] text-white/40">
            Iuri Rodrigues Imóveis — <span style={{ color: GOLD }}>CRECI 11379J</span> — CNPJ 33.587.804/0001-98
          </div>
        </footer>
      </main>
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
          <label className={labelCls}>Disponibilidade para atuar na região</label>
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

