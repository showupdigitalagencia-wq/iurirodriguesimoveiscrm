import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { submeterCandidato, getVslUrl } from "@/lib/candidatos.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Loader2, CheckCircle2, Upload, Users, TrendingUp, Award } from "lucide-react";

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
      <div className="min-h-screen bg-black text-white flex items-center justify-center p-6">
        <div className="max-w-md text-center space-y-4">
          <CheckCircle2 className="h-16 w-16 text-gold mx-auto" />
          <h1 className="text-3xl font-bold text-gold">Documentação enviada!</h1>
          <p className="text-white/80">Recebemos seus documentos. Nossa equipe entrará em contato em breve.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-white">
      <header className="border-b border-white/10 px-6 py-5">
        <div className="max-w-5xl mx-auto">
          <div className="text-[10px] uppercase tracking-[0.3em] text-white/50">Iuri Rodrigues Imóveis</div>
          <div className="text-2xl font-bold text-gold">Ecossistema NEXUS</div>
        </div>
      </header>

      <section className="px-6 py-10 max-w-5xl mx-auto space-y-10">
        <div className="text-center space-y-3">
          <h1 className="text-3xl md:text-5xl font-bold">Bem-vindo ao <span className="text-gold">Ecossistema Nexus</span></h1>
          <p className="text-white/70 max-w-2xl mx-auto">Para finalizar seu ingresso, assista ao vídeo e envie sua documentação abaixo.</p>
        </div>

        {vsl && (
          <div className="aspect-video w-full max-w-3xl mx-auto rounded-xl overflow-hidden border border-white/10">
            <iframe src={vsl} title="Apresentação" className="w-full h-full" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowFullScreen />
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[
            { i: Users, t: "Time forte", d: "Equipe estruturada por região" },
            { i: TrendingUp, t: "Leads qualificados", d: "Pipeline alimentado todos os dias" },
            { i: Award, t: "Marca consolidada", d: "Iuri Rodrigues Imóveis no mercado" },
          ].map(({ i: Icon, t, d }) => (
            <div key={t} className="rounded-lg border border-white/10 p-5 bg-white/5">
              <Icon className="h-6 w-6 text-gold mb-2" />
              <div className="font-semibold">{t}</div>
              <div className="text-sm text-white/60">{d}</div>
            </div>
          ))}
        </div>

        <form onSubmit={handleSubmit} className="bg-white/5 border border-white/10 rounded-xl p-6 md:p-8 space-y-5 max-w-2xl mx-auto">
          <h2 className="text-xl font-bold text-gold">Envie sua documentação</h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label className="text-white">Nome completo *</Label>
              <Input required maxLength={150} value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} className="bg-black/40 border-white/20 text-white" />
            </div>
            <div>
              <Label className="text-white">CPF *</Label>
              <Input required maxLength={20} value={form.cpf} onChange={(e) => setForm({ ...form, cpf: e.target.value })} className="bg-black/40 border-white/20 text-white" />
            </div>
            <div>
              <Label className="text-white">WhatsApp *</Label>
              <Input required maxLength={20} value={form.telefone} onChange={(e) => setForm({ ...form, telefone: e.target.value })} className="bg-black/40 border-white/20 text-white" />
            </div>
            <div>
              <Label className="text-white">E-mail</Label>
              <Input type="email" maxLength={255} value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="bg-black/40 border-white/20 text-white" />
            </div>
            <div>
              <Label className="text-white">CRECI</Label>
              <Input maxLength={50} value={form.creci} onChange={(e) => setForm({ ...form, creci: e.target.value })} className="bg-black/40 border-white/20 text-white" />
            </div>
            <div>
              <Label className="text-white">Região de atuação *</Label>
              <Select value={form.regiao} onValueChange={(v) => setForm({ ...form, regiao: v })}>
                <SelectTrigger className="bg-black/40 border-white/20 text-white"><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>{REGIOES.map((r) => <SelectItem key={r.v} value={r.v}>{r.l}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-3 pt-2">
            <div className="text-sm text-white/70 font-medium">Documentos</div>
            {([
              ["rg", "RG (frente e verso) *"],
              ["cpf", "CPF *"],
              ["creci", "CRECI (opcional)"],
              ["comprovante", "Comprovante de residência *"],
            ] as const).map(([k, label]) => (
              <div key={k} className="flex items-center gap-3">
                <Label className="text-white/80 w-48 text-sm">{label}</Label>
                <label className="flex-1 flex items-center gap-2 cursor-pointer text-sm border border-dashed border-white/20 rounded-md px-3 py-2 hover:border-gold/60">
                  <Upload className="h-4 w-4 text-gold" />
                  <span className="truncate">{files[k]?.name ?? "Selecionar arquivo"}</span>
                  <input type="file" className="hidden" accept="image/*,application/pdf" onChange={(e) => {
                    const f = e.target.files?.[0]; if (f) setFiles((s) => ({ ...s, [k]: f }));
                  }} />
                </label>
              </div>
            ))}
          </div>

          <Button type="submit" disabled={loading} className="w-full bg-gold text-black hover:bg-gold/90 font-semibold">
            {loading ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Enviando...</> : "Enviar documentação"}
          </Button>
        </form>
      </section>

      <footer className="border-t border-white/10 px-6 py-6 text-center text-white/50 text-xs">
        © Iuri Rodrigues Imóveis — Ecossistema Nexus
      </footer>
    </div>
  );
}
