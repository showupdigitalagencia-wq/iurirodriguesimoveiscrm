import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { submeterCandidato, getVslUrl } from "@/lib/candidatos.functions";
import logoAsset from "@/assets/logo_iuri_rodrigues_v2.png.asset.json";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Loader2, Upload } from "lucide-react";

export const Route = createFileRoute("/ingresso")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Ingresso de Corretores — Iuri Rodrigues Imóveis" },
      { name: "description", content: "Entre para o Ecossistema Nexus. Envie sua documentação e faça parte do nosso time de corretores." },
      { property: "og:title", content: "Ingresso de Corretores — Iuri Rodrigues Imóveis" },
      { property: "og:description", content: "Faça parte do Ecossistema Nexus." },
    ],
  }),
  component: IngressoPage,
});

const GOLD = "#D4AF37";
const LOGO_URL = logoAsset.url;

const REGIOES = [
  { v: "barra_da_tijuca", l: "Barra da Tijuca" },
  { v: "recreio", l: "Recreio dos Bandeirantes" },
  { v: "jacarepagua", l: "Jacarepaguá" },
  { v: "zona_sul", l: "Zona Sul" },
  { v: "zona_norte", l: "Zona Norte" },
  { v: "zona_oeste", l: "Zona Oeste" },
  { v: "centro", l: "Centro" },
  { v: "belford_roxo", l: "Belford Roxo" },
  { v: "nilopolis", l: "Nilópolis" },
  { v: "mesquita", l: "Mesquita" },
  { v: "outras", l: "Outras" },
] as const;

const BENEFICIOS = [
  { e: "🚀", t: "Leads qualificados", d: "Pipeline alimentado diariamente com leads prontos para atendimento." },
  { e: "🤖", t: "Tecnologia de ponta", d: "CRM próprio, automações e IA para potencializar suas vendas." },
  { e: "👥", t: "Liderança presente", d: "Acompanhamento próximo de executivos e diretoria comprometida." },
  { e: "💰", t: "Ganhos maiores", d: "Comissionamento competitivo e oportunidades de crescimento real." },
  { e: "📱", t: "App exclusivo", d: "Plataforma mobile para gerenciar leads, agenda e fechamentos." },
  { e: "🏆", t: "Portfólio completo", d: "Imóveis em diversas regiões e perfis para todos os clientes." },
];

function youtubeEmbed(url: string): string | null {
  if (!url) return null;
  const m = url.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|shorts\/))([\w-]{11})/);
  return m ? `https://www.youtube.com/embed/${m[1]}` : null;
}

async function fileToB64(file: File): Promise<{ nome: string; mimeType: string; base64: string }> {
  const buf = await file.arrayBuffer();
  let bin = "";
  const bytes = new Uint8Array(buf);
  for (let i = 0; i < bytes.byteLength; i++) bin += String.fromCharCode(bytes[i]);
  return { nome: file.name, mimeType: file.type || "application/octet-stream", base64: btoa(bin) };
}

function IngressoPage() {
  const submit = useServerFn(submeterCandidato);
  const getVsl = useServerFn(getVslUrl);
  const [vsl, setVsl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [form, setForm] = useState({ nome: "", cpf: "", telefone: "", email: "", creci: "", regiao: "" });
  const [files, setFiles] = useState<{ rg?: File; cpf?: File; creci?: File; comprovante?: File }>({});
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    getVsl({}).then((r) => setVsl(youtubeEmbed(r.url))).catch(() => null);
  }, [getVsl]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.nome || !form.cpf || !form.telefone || !form.regiao) {
      toast.error("Preencha nome, CPF, WhatsApp e região.");
      return;
    }
    if (!files.rg || !files.cpf || !files.comprovante) {
      toast.error("Envie RG, CPF e comprovante de residência.");
      return;
    }
    setLoading(true);
    try {
      const arquivos: Record<string, { nome: string; mimeType: string; base64: string }> = {};
      if (files.rg) arquivos.rg = await fileToB64(files.rg);
      if (files.cpf) arquivos.cpf = await fileToB64(files.cpf);
      if (files.creci) arquivos.creci = await fileToB64(files.creci);
      if (files.comprovante) arquivos.comprovante = await fileToB64(files.comprovante);
      await submit({ data: { ...form, regiao: form.regiao as never, arquivos: arquivos as never } });
      setDone(true);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao enviar");
    } finally {
      setLoading(false);
    }
  }

  if (done) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6" style={{ background: "#0a0a0a", color: "white" }}>
        <div className="max-w-lg text-center space-y-6">
          <div className="text-6xl">🎉</div>
          <h1 className="text-4xl md:text-5xl" style={{ fontFamily: "var(--font-display)", color: GOLD }}>
            Bem-vindo ao Ecossistema Nexus!
          </h1>
          <p className="text-white/80 text-lg">
            Recebemos sua documentação com sucesso. Nossa equipe entrará em contato em breve para os próximos passos.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen" style={{ background: "#0a0a0a", color: "white", fontFamily: "var(--font-sans)" }}>
      {/* HERO */}
      <section className="px-6 pt-12 pb-16 md:pt-20 md:pb-24" style={{ background: "#0a0a0a" }}>
        <div className="max-w-4xl mx-auto text-center space-y-8">
          <img src={LOGO_URL} alt="Iuri Rodrigues Imóveis" className="w-full max-w-[180px] md:max-w-[220px] lg:max-w-[260px] mx-auto object-contain" />
          <div className="space-y-4">
            <div className="text-xs md:text-sm uppercase tracking-[0.35em]" style={{ color: GOLD }}>
              Bem-vindo à primeira etapa
            </div>
            <h1 className="text-4xl md:text-6xl lg:text-7xl leading-tight" style={{ fontFamily: "var(--font-display)", fontWeight: 600 }}>
              do <span style={{ color: GOLD }}>Sistema Nexus</span>
            </h1>
            <p className="text-white/70 max-w-2xl mx-auto text-base md:text-lg leading-relaxed">
              Você está a um passo de fazer parte do maior e mais completo ecossistema imobiliário do Rio de Janeiro.
              Envie sua documentação abaixo para iniciar.
            </p>
          </div>

          {vsl && (
            <div
              className="aspect-video w-full max-w-3xl mx-auto rounded-2xl overflow-hidden"
              style={{ border: `1px solid ${GOLD}66`, boxShadow: `0 0 60px -10px ${GOLD}55` }}
            >
              <iframe
                src={vsl}
                title="Apresentação Sistema Nexus"
                className="w-full h-full"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
              />
            </div>
          )}

          <button
            onClick={() => formRef.current?.scrollIntoView({ behavior: "smooth" })}
            className="inline-flex items-center gap-2 px-8 py-4 rounded-md font-semibold text-base transition-transform hover:scale-105"
            style={{ background: GOLD, color: "#0a0a0a", boxShadow: `0 10px 40px -10px ${GOLD}80` }}
          >
            Quero fazer parte →
          </button>
        </div>
      </section>

      {/* BENEFÍCIOS */}
      <section className="px-6 py-20" style={{ background: "#0a0a0a" }}>
        <div className="max-w-6xl mx-auto space-y-12">
          <div className="text-center space-y-3">
            <div className="text-xs uppercase tracking-[0.35em]" style={{ color: GOLD }}>Por que Nexus</div>
            <h2 className="text-3xl md:text-5xl" style={{ fontFamily: "var(--font-display)", fontWeight: 600 }}>
              Tudo que você precisa para <span style={{ color: GOLD }}>crescer</span>
            </h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {BENEFICIOS.map((b) => (
              <div
                key={b.t}
                className="rounded-xl p-6 transition-all hover:-translate-y-1"
                style={{ background: "#1a1a1a", border: `1px solid ${GOLD}26` }}
              >
                <div className="text-4xl mb-3">{b.e}</div>
                <div className="text-lg font-semibold mb-2" style={{ color: GOLD }}>{b.t}</div>
                <div className="text-sm text-white/65 leading-relaxed">{b.d}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ESTATÍSTICAS */}
      <section className="px-6 py-16" style={{ background: "#111111" }}>
        <div className="max-w-5xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-8 text-center">
          {[
            { n: "40+", l: "Corretores ativos" },
            { n: "4", l: "Regiões atendidas" },
            { n: "100%", l: "Digital e automatizado" },
          ].map((s) => (
            <div key={s.l} className="space-y-2">
              <div className="text-5xl md:text-6xl" style={{ fontFamily: "var(--font-display)", color: GOLD, fontWeight: 700 }}>
                {s.n}
              </div>
              <div className="text-sm uppercase tracking-[0.2em] text-white/60">{s.l}</div>
            </div>
          ))}
        </div>
      </section>

      {/* FORMULÁRIO */}
      <section className="px-6 py-20" style={{ background: "#0a0a0a" }}>
        <div className="max-w-2xl mx-auto">
          <div className="text-center mb-10 space-y-3">
            <div className="text-xs uppercase tracking-[0.35em]" style={{ color: GOLD }}>Documentação</div>
            <h2 className="text-3xl md:text-4xl" style={{ fontFamily: "var(--font-display)", fontWeight: 600 }}>
              Finalize seu <span style={{ color: GOLD }}>cadastro</span>
            </h2>
          </div>

          <form
            ref={formRef}
            onSubmit={handleSubmit}
            className="rounded-2xl p-6 md:p-10 space-y-6"
            style={{ background: "#111111", border: `1px solid ${GOLD}33` }}
          >
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {[
                { k: "nome", l: "Nome completo *", type: "text", max: 150 },
                { k: "cpf", l: "CPF *", type: "text", max: 20 },
                { k: "telefone", l: "WhatsApp *", type: "text", max: 20 },
                { k: "email", l: "E-mail", type: "email", max: 255 },
                { k: "creci", l: "CRECI", type: "text", max: 50 },
              ].map((f) => (
                <div key={f.k} className={f.k === "creci" ? "" : ""}>
                  <Label className="text-white/80 text-xs uppercase tracking-wider mb-2 block">{f.l}</Label>
                  <Input
                    type={f.type}
                    required={f.l.includes("*")}
                    maxLength={f.max}
                    value={(form as Record<string, string>)[f.k]}
                    onChange={(e) => setForm({ ...form, [f.k]: e.target.value })}
                    className="bg-black/60 border-white/15 text-white h-11 focus-visible:ring-0"
                    style={{ borderColor: undefined }}
                    onFocus={(e) => (e.currentTarget.style.borderColor = GOLD)}
                    onBlur={(e) => (e.currentTarget.style.borderColor = "")}
                  />
                </div>
              ))}
              <div>
                <Label className="text-white/80 text-xs uppercase tracking-wider mb-2 block">Região de atuação *</Label>
                <Select value={form.regiao} onValueChange={(v) => setForm({ ...form, regiao: v })}>
                  <SelectTrigger className="bg-black/60 border-white/15 text-white h-11">
                    <SelectValue placeholder="Selecione" />
                  </SelectTrigger>
                  <SelectContent>
                    {REGIOES.map((r) => <SelectItem key={r.v} value={r.v}>{r.l}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-3 pt-4">
              <div className="text-xs uppercase tracking-wider text-white/80">Documentos</div>
              {([
                ["rg", "RG (frente e verso) *"],
                ["cpf", "CPF *"],
                ["creci", "CRECI (opcional)"],
                ["comprovante", "Comprovante de residência *"],
              ] as const).map(([k, label]) => (
                <label
                  key={k}
                  className="flex items-center gap-3 cursor-pointer rounded-lg px-4 py-4 transition-colors"
                  style={{ border: `2px dashed ${GOLD}40`, background: "#0a0a0a" }}
                  onMouseEnter={(e) => (e.currentTarget.style.borderColor = GOLD)}
                  onMouseLeave={(e) => (e.currentTarget.style.borderColor = `${GOLD}40`)}
                >
                  <Upload className="h-5 w-5 flex-shrink-0" style={{ color: GOLD }} />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm text-white/90">{label}</div>
                    <div className="text-xs text-white/50 truncate">
                      {files[k]?.name ?? "Clique para selecionar o arquivo"}
                    </div>
                  </div>
                  <input
                    type="file"
                    className="hidden"
                    accept="image/*,application/pdf"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) setFiles((s) => ({ ...s, [k]: f }));
                    }}
                  />
                </label>
              ))}
            </div>

            <Button
              type="submit"
              disabled={loading}
              className="w-full h-14 text-base font-bold uppercase tracking-wider transition-transform hover:scale-[1.01]"
              style={{ background: GOLD, color: "#0a0a0a", boxShadow: `0 10px 40px -10px ${GOLD}80` }}
            >
              {loading ? (<><Loader2 className="h-5 w-5 mr-2 animate-spin" /> Enviando...</>) : "Enviar documentação"}
            </Button>
          </form>
        </div>
      </section>

      <footer className="px-6 py-8 text-center text-white/40 text-xs" style={{ background: "#0a0a0a", borderTop: "1px solid #1a1a1a" }}>
        © Iuri Rodrigues Imóveis — Ecossistema Nexus
      </footer>
    </div>
  );
}
