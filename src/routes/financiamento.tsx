import { createFileRoute, useSearch } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { z } from "zod";
import {
  getLeadParaFinanciamento,
  submeterFinanciamento,
} from "@/lib/financiamento.functions";
import logoAsset from "@/assets/logo_iuri_rodrigues_v2.png.asset.json";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Toaster } from "@/components/ui/sonner";
import { Loader2, Upload } from "lucide-react";

const searchSchema = z.object({
  lead: z.string().uuid().optional(),
});

export const Route = createFileRoute("/financiamento")({
  ssr: false,
  validateSearch: searchSchema,
  head: () => ({
    meta: [
      { title: "Financiamento Imobiliário — Iuri Rodrigues Imóveis" },
      { name: "description", content: "Envie sua documentação para análise de financiamento imobiliário." },
      { property: "og:title", content: "Financiamento Imobiliário — Iuri Rodrigues Imóveis" },
      { property: "og:description", content: "Envie sua documentação para análise de financiamento imobiliário." },
    ],
  }),
  component: FinanciamentoPage,
});

const GOLD = "#D4AF37";
const LOGO_URL = logoAsset.url;

const ESTADOS_CIVIS = [
  "Solteiro(a)",
  "Casado(a)",
  "União Estável",
  "Divorciado(a)",
  "Viúvo(a)",
];

async function fileToB64(file: File): Promise<{ nome: string; mimeType: string; base64: string }> {
  const buf = await file.arrayBuffer();
  let bin = "";
  const bytes = new Uint8Array(buf);
  for (let i = 0; i < bytes.byteLength; i++) bin += String.fromCharCode(bytes[i]);
  return { nome: file.name, mimeType: file.type || "application/octet-stream", base64: btoa(bin) };
}

type FileSlot = "rg" | "cpf" | "comp_renda" | "comp_residencia" | "extrato";

function FinanciamentoPage() {
  const search = useSearch({ from: "/financiamento" });
  const leadId = search.lead ?? null;
  const getLead = useServerFn(getLeadParaFinanciamento);
  const submit = useServerFn(submeterFinanciamento);

  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [form, setForm] = useState({
    nome: "",
    cpf: "",
    telefone: "",
    email: "",
    estado_civil: "",
    renda_mensal: "",
    profissao: "",
    imovel_endereco: "",
    imovel_valor: "",
  });
  const [files, setFiles] = useState<Partial<Record<FileSlot, File>>>({});
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (!leadId) return;
    getLead({ data: { leadId } })
      .then((r) => {
        if (r.lead) {
          setForm((f) => ({
            ...f,
            nome: f.nome || r.lead!.nome || "",
            telefone: f.telefone || r.lead!.telefone || "",
            email: f.email || r.lead!.email || "",
          }));
        }
      })
      .catch(() => null);
  }, [leadId, getLead]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.nome || !form.cpf || !form.telefone) {
      toast.error("Preencha nome, CPF e telefone.");
      return;
    }
    if (!files.rg || !files.cpf || !files.comp_renda || !files.comp_residencia) {
      toast.error("Envie RG, CPF, comprovante de renda e comprovante de residência.");
      return;
    }
    setLoading(true);
    try {
      const arquivos: Record<string, { nome: string; mimeType: string; base64: string }> = {};
      for (const slot of ["rg", "cpf", "comp_renda", "comp_residencia", "extrato"] as const) {
        const f = files[slot];
        if (f) arquivos[slot] = await fileToB64(f);
      }
      await submit({
        data: {
          leadId,
          nome: form.nome,
          cpf: form.cpf,
          telefone: form.telefone,
          email: form.email || undefined,
          estado_civil: form.estado_civil || undefined,
          renda_mensal: form.renda_mensal ? Number(form.renda_mensal.replace(/[^\d.]/g, "")) : undefined,
          profissao: form.profissao || undefined,
          imovel_endereco: form.imovel_endereco || undefined,
          imovel_valor: form.imovel_valor ? Number(form.imovel_valor.replace(/[^\d.]/g, "")) : undefined,
          arquivos: arquivos as never,
        },
      });
      setDone(true);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao enviar");
    } finally {
      setLoading(false);
    }
  }

  if (done) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6" style={{ background: "#0A0E1A", color: "white" }}>
        <Toaster richColors position="top-center" />
        <div className="max-w-lg text-center space-y-6">
          <div className="text-6xl">🎉</div>
          <h1 className="text-3xl md:text-4xl" style={{ fontFamily: "var(--font-display)", color: GOLD }}>
            Documentação recebida!
          </h1>
          <p className="text-white/80 text-lg">
            Nossa correspondente bancária vai analisar seu pedido e entraremos em contato em breve.
          </p>
        </div>
      </div>
    );
  }

  const inputCls = "bg-black/60 border-white/15 text-white h-11 focus-visible:ring-0";

  return (
    <div className="min-h-screen" style={{ background: "#0A0E1A", color: "white", fontFamily: "var(--font-sans)" }}>
      <Toaster richColors position="top-center" />
      <section className="px-6 pt-12 pb-10 md:pt-16 md:pb-12" style={{ background: "#0A0E1A" }}>
        <div className="max-w-3xl mx-auto text-center space-y-6">
          <img src={LOGO_URL} alt="Iuri Rodrigues Imóveis" className="w-full max-w-[160px] md:max-w-[200px] mx-auto object-contain" style={{ mixBlendMode: "screen" }} />
          <div className="space-y-3">
            <div className="text-xs md:text-sm uppercase tracking-[0.35em]" style={{ color: GOLD }}>
              Financiamento Imobiliário
            </div>
            <h1 className="text-3xl md:text-5xl leading-tight" style={{ fontFamily: "var(--font-display)", fontWeight: 600 }}>
              Realize o sonho da{" "}
              <span style={{ color: GOLD }}>casa própria</span>
            </h1>
            <p className="text-white/70 max-w-2xl mx-auto text-base md:text-lg leading-relaxed">
              Envie sua documentação abaixo para que nossa correspondente bancária possa analisar e
              apresentar as melhores condições de financiamento para você.
            </p>
          </div>
        </div>
      </section>

      <section className="px-6 pb-20" style={{ background: "#0A0E1A" }}>
        <div className="max-w-2xl mx-auto">
          <form
            ref={formRef}
            onSubmit={handleSubmit}
            className="rounded-2xl p-6 md:p-10 space-y-6"
            style={{ background: "#0F1626", border: `1px solid ${GOLD}33` }}
          >
            {/* Dados pessoais */}
            <div className="space-y-4">
              <div className="text-xs uppercase tracking-wider" style={{ color: GOLD }}>Dados pessoais</div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label className="text-white/80 text-xs uppercase tracking-wider mb-2 block">Nome completo *</Label>
                  <Input className={inputCls} value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} required maxLength={150} />
                </div>
                <div>
                  <Label className="text-white/80 text-xs uppercase tracking-wider mb-2 block">CPF *</Label>
                  <Input className={inputCls} value={form.cpf} onChange={(e) => setForm({ ...form, cpf: e.target.value })} required maxLength={20} />
                </div>
                <div>
                  <Label className="text-white/80 text-xs uppercase tracking-wider mb-2 block">Telefone / WhatsApp *</Label>
                  <Input className={inputCls} value={form.telefone} onChange={(e) => setForm({ ...form, telefone: e.target.value })} required maxLength={20} />
                </div>
                <div>
                  <Label className="text-white/80 text-xs uppercase tracking-wider mb-2 block">E-mail</Label>
                  <Input type="email" className={inputCls} value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} maxLength={255} />
                </div>
                <div>
                  <Label className="text-white/80 text-xs uppercase tracking-wider mb-2 block">Estado civil</Label>
                  <Select value={form.estado_civil} onValueChange={(v) => setForm({ ...form, estado_civil: v })}>
                    <SelectTrigger className={inputCls}><SelectValue placeholder="Selecione" /></SelectTrigger>
                    <SelectContent>
                      {ESTADOS_CIVIS.map((e) => <SelectItem key={e} value={e}>{e}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            {/* Renda */}
            <div className="space-y-4 pt-2">
              <div className="text-xs uppercase tracking-wider" style={{ color: GOLD }}>Renda</div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label className="text-white/80 text-xs uppercase tracking-wider mb-2 block">Renda mensal (R$)</Label>
                  <Input className={inputCls} value={form.renda_mensal} onChange={(e) => setForm({ ...form, renda_mensal: e.target.value })} inputMode="decimal" />
                </div>
                <div>
                  <Label className="text-white/80 text-xs uppercase tracking-wider mb-2 block">Profissão</Label>
                  <Input className={inputCls} value={form.profissao} onChange={(e) => setForm({ ...form, profissao: e.target.value })} maxLength={150} />
                </div>
              </div>
            </div>

            {/* Imóvel */}
            <div className="space-y-4 pt-2">
              <div className="text-xs uppercase tracking-wider" style={{ color: GOLD }}>Imóvel de interesse</div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="md:col-span-2">
                  <Label className="text-white/80 text-xs uppercase tracking-wider mb-2 block">Endereço</Label>
                  <Input className={inputCls} value={form.imovel_endereco} onChange={(e) => setForm({ ...form, imovel_endereco: e.target.value })} maxLength={500} />
                </div>
                <div>
                  <Label className="text-white/80 text-xs uppercase tracking-wider mb-2 block">Valor (R$)</Label>
                  <Input className={inputCls} value={form.imovel_valor} onChange={(e) => setForm({ ...form, imovel_valor: e.target.value })} inputMode="decimal" />
                </div>
              </div>
            </div>

            {/* Documentos */}
            <div className="space-y-3 pt-4">
              <div className="text-xs uppercase tracking-wider" style={{ color: GOLD }}>Documentos</div>
              {([
                ["rg", "RG (frente e verso) *"],
                ["cpf", "CPF *"],
                ["comp_renda", "Comprovante de renda *"],
                ["comp_residencia", "Comprovante de residência *"],
                ["extrato", "Extrato bancário (últimos 3 meses)"],
              ] as const).map(([k, label]) => (
                <label
                  key={k}
                  className="flex items-center gap-3 cursor-pointer rounded-lg px-4 py-4 transition-colors"
                  style={{ border: `2px dashed ${GOLD}40`, background: "#0A0E1A" }}
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
              style={{ background: GOLD, color: "#0A0E1A", boxShadow: `0 10px 40px -10px ${GOLD}80` }}
            >
              {loading ? (<><Loader2 className="h-5 w-5 mr-2 animate-spin" /> Enviando...</>) : "Enviar documentação"}
            </Button>
          </form>
        </div>
      </section>
    </div>
  );
}

